"""The household's music service directory.

``MusicServices#ListAvailableServices`` is answered by the speaker, not by
Sonos, and returns the whole catalog: on a live household, 102 entries on S1
and 108 on S2. Each carries the provider's own SMAPI endpoint, so the directory
costs nothing beyond a single local SOAP call.

Which services a household actually *uses* is a separate question, and one the
firmware does not answer directly: ``/status/accounts`` returns an empty
document on 57.x, ``AvailableServiceTypeList`` is the whole catalog again,
and ``SystemProperties`` can add and remove accounts but not list them. Two
local answers are combined instead:

* Account-bearing services are recovered from the content the household
  holds. Every favorite, playlist and saved station carries a ``sid`` query
  parameter naming the service that produced it.
* Anonymous services (no account, so no content need exist) are probed with
  ``MusicServices#GetSessionId``. On a 57.x player an anonymous service that
  has been added answers UPnP error 1000, one that has not answers 806
  (measured 2026-09-05: 80s80s, Audacy, SomaFM, and Sonos Radio gave 1000; Hit
  Network, NRK, Hype Machine, and every account-based service gave 806). The
  probe runs once per anonymous catalog entry, on the LAN, and is cached.
  S2 players answer 806 for everything, so there the probe adds nothing and
  the household's cloud registration list, which does carry anonymous
  services on S2, is the source.
"""

from __future__ import annotations

import asyncio
import html
import logging
import re
from time import monotonic
from dataclasses import dataclass, field

from defusedxml import ElementTree as DET

from .const import BROWSE_ROOTS, CONTENT_DIRECTORY, MUSIC_SERVICES
from .soap import SoapClient, SoapFault

log = logging.getLogger(__name__)

#: ``sid`` appears in track and container URIs as a query parameter.
_SID = re.compile(r"[?&]sid=(\d+)")

#: Auth policies a service can declare, and whether a local-only controller
#: can complete the flow itself.
AUTH_LOCAL = {"Anonymous", "DeviceLink"}


@dataclass(slots=True)
class MusicService:
    """One entry from the household's service catalog."""

    id: int
    name: str
    uri: str = ""
    secure_uri: str = ""
    version: str = ""
    container_type: str = ""
    capabilities: int = 0
    #: ``Anonymous``, ``DeviceLink`` or ``AppLink``.
    auth: str = ""
    poll_interval: int = 0
    #: True when this service appears in the household's own content.
    in_use: bool = False
    #: The provider's manifest (presentation map, strings), when it has one.
    manifest_uri: str = ""

    @property
    def endpoint(self) -> str:
        return self.secure_uri or self.uri

    @property
    def provider_host(self) -> str:
        match = re.match(r"https?://([^/]+)", self.endpoint)
        return match.group(1) if match else ""

    @property
    def linkable_locally(self) -> bool:
        """Whether a new account could be linked without Sonos' cloud.

        ``DeviceLink`` is the enter-a-code flow, negotiated directly with the
        provider over SMAPI. ``AppLink`` is brokered by Sonos' app.
        """
        return self.auth in AUTH_LOCAL

    #: Initials for a monogram, since the catalog carries no local artwork.
    @property
    def initials(self) -> str:
        words = [w for w in re.split(r"[\s\-–—]+", self.name) if w]
        if not words:
            return "?"
        if len(words) == 1:
            return words[0][:2].upper()
        return (words[0][0] + words[1][0]).upper()

    def as_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "auth": self.auth,
            "in_use": self.in_use,
            "linkable_locally": self.linkable_locally,
            "provider": self.provider_host,
            "initials": self.initials,
            "container_type": self.container_type,
            "capabilities": self.capabilities,
        }


@dataclass(slots=True)
class ServiceDirectory:
    services: list[MusicService] = field(default_factory=list)

    @property
    def in_use(self) -> list[MusicService]:
        return [s for s in self.services if s.in_use]

    def by_id(self, sid: int) -> MusicService | None:
        return next((s for s in self.services if s.id == sid), None)


def parse_service_list(payload: str) -> list[MusicService]:
    """Parse an ``AvailableServiceDescriptorList``."""
    text = payload.strip()
    if not text:
        return []
    if not text.startswith("<"):
        text = html.unescape(text)
    root = DET.fromstring(text)

    services: list[MusicService] = []
    for node in root.iter("Service"):
        try:
            sid = int(node.get("Id", "0"))
        except ValueError:
            continue
        policy = node.find("Policy")
        manifest = node.find("Manifest")
        services.append(MusicService(
            id=sid,
            name=(node.get("Name") or "").strip(),
            uri=node.get("Uri") or "",
            secure_uri=node.get("SecureUri") or "",
            version=node.get("Version") or "",
            container_type=node.get("ContainerType") or "",
            capabilities=int(node.get("Capabilities") or 0),
            auth=(policy.get("Auth") if policy is not None else "") or "",
            poll_interval=int(
                (policy.get("PollInterval") if policy is not None else 0) or 0),
            manifest_uri=(manifest.get("Uri") if manifest is not None else "") or "",
        ))
    return services


class ServiceReader:
    """Reads the catalog and works out which services are in use."""

    #: Content roots whose items name their originating service.
    USAGE_ROOTS = ("sonos_favorites", "sonos_playlists", "radio_stations")

    #: How long a household's anonymous-service probe is trusted. The
    #: controller also drops it the moment a player reports its account list
    #: changed, so this only bounds the case where no event arrived.
    ANONYMOUS_TTL = 900.0

    def __init__(self, soap: SoapClient) -> None:
        self._soap = soap
        self._anonymous: dict[str, tuple[float, set[int]]] = {}

    def forget_anonymous(self) -> None:
        """Drop the cached probe results, after the household's accounts changed."""
        self._anonymous.clear()

    async def read(self, host: str, configured: set[int] | None = None, *,
                   timeout: float | None = None, retries: int | None = None,
                   strict: bool = False) -> ServiceDirectory:
        """The household's catalog, with the services it uses marked.

        ``configured`` is the set of sids the household holds an account for,
        read off the speakers' own account list. It is the direct answer and
        needs no cloud; the inference below only adds the services that need
        no account at all.

        ``timeout`` and ``retries`` go to every call this makes. ``strict``
        fails the whole read when any of them goes unanswered, rather than
        returning a catalog with a hole in it: a caller with another player to
        ask should ask it, not keep a half answer.
        """
        opts = {"timeout": timeout, "retries": retries}
        result = await self._soap.call(
            host, MUSIC_SERVICES, "ListAvailableServices", **opts)
        services = parse_service_list(
            result.get("AvailableServiceDescriptorList", ""))

        used = await self._service_ids_in_use(host, opts, strict)
        # Content only proves a service was used at some point; for anonymous
        # ones the probe says whether it is on the household now, so a saved
        # station from one since removed no longer keeps it listed. For the
        # rest the account list says so, when there is one: a favorite saved
        # from a service whose account has since gone listed it as in use,
        # and every search then asked it and failed (Deezer).
        anonymous = {s.id for s in services if s.auth == "Anonymous"}
        if configured:
            used = set()
        used = (used - anonymous) | await self._anonymous_in_use(host, services, opts, strict)
        # An account is proof on its own: a service linked but never saved
        # from has no content to infer it from, and used to go unlisted for
        # anyone not signed in to Sonos. Only for services the catalog
        # actually offers, though -- a household's account list also names
        # Sonos' own internal ids, which are not browsable services and
        # invented a "Service 1" row when taken at face value.
        catalogd = {s.id for s in services}
        used |= (configured or set()) & catalogd
        for service in services:
            service.in_use = service.id in used

        # Services referenced by content but missing from the catalog are
        # worth keeping: the household plainly uses them.
        known = {s.id for s in services}
        for sid in sorted(used - known):
            services.append(MusicService(id=sid, name=f"Service {sid}",
                                         in_use=True))

        # Ordered by name. The product orders by reverse-DNS integration id,
        # which only the signed-in registration list carries; the local
        # catalog has no equivalent field, so this differs by necessity and
        # only applies when signed out.
        services.sort(key=lambda s: (not s.in_use, s.name.casefold()))
        log.info("service directory: %d services, %d in use",
                 len(services), len(used))
        return ServiceDirectory(services=services)

    async def _service_ids_in_use(self, host: str, opts: dict | None = None,
                                  strict: bool = False) -> set[int]:
        found: set[int] = set()
        for key in self.USAGE_ROOTS:
            try:
                result = await self._soap.call(
                    host, CONTENT_DIRECTORY, "Browse", {
                        "ObjectID": BROWSE_ROOTS[key],
                        "BrowseFlag": "BrowseDirectChildren",
                        "Filter": "*",
                        "StartingIndex": 0,
                        "RequestedCount": 200,
                        "SortCriteria": "",
                    }, **(opts or {}))
            except SoapFault as exc:
                log.info("service usage scan of %s failed: %s", key, exc)
                continue
            except Exception as exc:
                log.info("service usage scan of %s failed: %s", key, exc)
                if strict:
                    raise
                continue
            payload = html.unescape(result.get("Result", ""))
            found.update(int(m) for m in _SID.findall(payload))
        return found

    async def _anonymous_in_use(self, host: str, services: list[MusicService],
                                opts: dict | None = None,
                                strict: bool = False) -> set[int]:
        """Anonymous catalog entries the household has added, by probe."""
        cached = self._anonymous.get(host)
        if cached is not None and monotonic() - cached[0] < self.ANONYMOUS_TTL:
            return cached[1]
        found: set[int] = set()
        unanswered: list[Exception] = []
        gate = asyncio.Semaphore(6)

        async def probe(service: MusicService) -> None:
            async with gate:
                try:
                    await self._soap.call(
                        host, MUSIC_SERVICES, "GetSessionId",
                        {"ServiceId": service.id, "Username": ""}, **(opts or {}))
                except SoapFault as exc:
                    if exc.code == "1000":
                        found.add(service.id)
                except Exception as exc:
                    log.info("anonymous probe of %s failed: %s", service.name, exc)
                    unanswered.append(exc)
                else:  # a session back means it is there as well
                    found.add(service.id)

        await asyncio.gather(*(probe(s) for s in services if s.auth == "Anonymous"))
        # A probe the player never answered says nothing either way, so an
        # answer with one missing is not kept for fifteen minutes as if it
        # were whole, and a strict caller is told to ask someone else.
        if unanswered:
            if strict:
                raise unanswered[0]
            return found
        self._anonymous[host] = (monotonic(), found)
        log.info("anonymous services on %s: %s", host, sorted(found))
        return found
