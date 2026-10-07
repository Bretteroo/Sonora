"""Optional Sonos sign-in, for the two things the LAN cannot answer.

Everything else in Sonora is local. Two questions are not answerable on the
network at all, and this module exists solely for them:

Which music services a household has configured. The local surface was
exhausted looking for this: ``Browse("SA:")`` returns HTTP 500, and so does
``GetString`` on the token keys that content descriptors reveal;
``/status/accounts`` is an empty document on both firmware trains; neither
``SystemProperties`` nor ``MusicServices`` declares an enumeration action; and
both outputs of ``ListAvailableServices`` return the entire catalog rather
than the configured subset. Content-derived inference works but under-reports:
a household whose only favorite comes from one service looks like it has one
service.

What each service's logo looks like. The catalog carries no artwork, only a
manifest URI whose presentation map describes size substitutions.

A third joined them later: the name of the television input a soundbar is
playing (see ``muse.py``), which only the cloud's websocket reports.

All are answered by ``play.sonos.com``, behind a signed-in session. The
sign-in is Okta primary auth followed by the web app's OIDC exchange, all of
which is plain HTTP: no browser is needed.

Handling of credentials: an email and password are used once to obtain a
session and are never stored, logged, or written to disk. The resulting session
cookies are held in memory and also written to the data dir (mode 0600) so the
sign-in survives a restart instead of dropping every time the process stops;
they are validated on startup and discarded if the web app no longer accepts
them. Only two hosts are ever contacted over HTTP, ``login.sonos.com`` and
``play.sonos.com``, plus the websocket host ``api.ws.sonos.com``, and nothing
about the household is sent to any of them beyond the household id already in
the URL.
"""

from __future__ import annotations

import asyncio
import json
import logging
import urllib.parse
from dataclasses import dataclass, field
from pathlib import Path
from time import monotonic

import aiohttp

from ..config import settings

log = logging.getLogger(__name__)

OKTA_AUTHN = "https://login.sonos.com/api/v1/authn"
APP = "https://play.sonos.com"
#: Sonos' own service directory, the one the desktop app reads. Its entries
#: carry a ``containerType`` naming what kind of listing a service belongs
#: to -- ``MUSIC_SERVICE`` for the ordinary directory, ``SONOS_LABS`` for
#: the pre-release one the app's "Sonos Labs" button offers.
SERVICE_CATALOG = "https://service-catalog.ws.sonos.com/catalog/services"
CSRF = f"{APP}/api/auth/csrf"
#: Returns the current session as JSON (a user object when signed in, ``{}``
#: when not). Used to validate a restored session cheaply.
SESSION = f"{APP}/api/auth/session"
SIGNIN = f"{APP}/api/auth/signin/okta"
CONTENT = f"{APP}/api/content/v1"
#: Issues the one-time ticket the websocket is opened with.
MFE = f"{APP}/api/mfe"
MUSE_WS = "wss://api.ws.sonos.com/websocket"
MUSE_PROTOCOL = "v1.api.smartspeaker.audio"

#: A browser-shaped agent. The web app's API rejects requests it does not
#: recognize as coming from a browser session.
USER_AGENT = ("Mozilla/5.0 (X11; Linux x86_64; rv:133.0) Gecko/20100101 "
              "Firefox/133.0")

SESSION_COOKIE = "__Secure-next-auth.session-token"

# There was an OAuth flow here once, obtaining a bearer with the
# `hh-config-admin` scope so Sonora could write a household setting -- explicit
# content filtering. It used the web app's own client id, which meant Sonora
# presenting itself as an application it is not, and it was removed
# when that write turned out to be impossible for any controller:
# the speakers demand a credential from their own registration realm, and the
# cloud command answers ERROR_UNSUPPORTED_COMMAND on 57.23 and ERROR_NYI on
# 97.1. Nothing ever read the token it produced.
#
# Everything Sonora does with the cloud rides on the session cookies the
# sign-in leaves in the jar, which are the person's own.
#: Icons are small and never change; caching them avoids hammering the API on
#: every page load. Capped so a long-running process cannot grow unbounded.
ICON_CACHE_MAX = 200

#: The service the web app reads a household's pinned collections from: one
#: store of "favorites", held under the person's own Sonos account rather
#: than under any music service's. The web app's home asks it for the
#: containers and draws a row for each (measured 2026-09-20 in its network
#: log). The number is Sonos', not a household's, and is sent as it stands.
FAVORITES_SERVICE = "16751367"

#: How long a registration listing is reused before being fetched again.
REGISTRATIONS_TTL = 300.0
#: The pins change only when someone pins something in the Sonos app.
PINNED_TTL = 300.0
LABS_TTL = 900.0

#: The full service catalog changes rarely, so it is held far longer.
CATALOG_TTL = 3600.0


class CloudError(Exception):
    """A failure talking to Sonos' web app."""


class NotSignedIn(CloudError):
    def __init__(self) -> None:
        super().__init__("not signed in to Sonos")


@dataclass(slots=True)
class Registration:
    """One music service a household has configured."""

    #: Sonos' service *type* code, as it appears in content descriptors.
    service_type: int
    #: Catalog service id. The type encodes it in its high bits.
    service_id: int
    integration_id: str
    config_id: str
    name: str
    nickname: str = ""
    #: The account's serial number on the speakers: what ``sn=`` carries in
    #: playback URIs. Not what SystemProperties calls an AccountID.
    account_id: str = ""
    #: The account's logon string, ``X_#Svc<type>-<key>-Token`` for an OAuth
    #: account. This is the ``AccountID`` the SystemProperties actions take
    #: (AddAccountX names a password service's username the same way), and
    #: ``SA_RINCON<type>_<username>`` is its UDN. RemoveAccount given the
    #: serial instead matched nothing and took off the oldest account.
    username: str = ""
    description: str = ""

    @property
    def icon_path(self) -> str:
        """Backend-relative path this controller serves the logo from."""
        return f"/api/cloud/icon/{self.integration_id}/{self.config_id}"

    def as_dict(self) -> dict:
        return {
            # Same field the local catalog uses, so the two shapes agree.
            "id": self.service_id,
            "service_id": self.service_id,
            "service_type": self.service_type,
            "integration_id": self.integration_id,
            "account_id": self.account_id,
            "name": self.name,
            "nickname": self.nickname,
            "icon": self.icon_path,
        }


@dataclass(slots=True)
class _Cached:
    value: object
    at: float = field(default_factory=monotonic)

    def fresh(self, ttl: float) -> bool:
        return (monotonic() - self.at) < ttl


def _account_sort_key(account_id: str) -> tuple[int, str]:
    """Sort account ids numerically where they are numeric."""
    return (int(account_id), "") if account_id.isdigit() else (1 << 30, account_id)



def _note_background_failure(task: "asyncio.Task") -> None:
    """Log a fetch that failed with nobody waiting on its answer."""
    if task.cancelled():
        return
    exc = task.exception()
    if exc is not None:
        log.info("cloud refresh failed: %s", exc)

class SonosCloud:
    """A signed-in session against Sonos' web app.

    Optional throughout: every method raises ``NotSignedIn`` rather than
    prompting, and callers fall back to local behavior.
    """

    def __init__(self) -> None:
        self._session: aiohttp.ClientSession | None = None
        self._user_id: str | None = None
        #: The person's Sonos account number, which the content API addresses
        #: their pins by. Not the Okta id in ``_user_id``.
        self._account: str | None = None
        self._email: str | None = None
        self._lock = asyncio.Lock()
        self._icons: dict[str, tuple[bytes, str]] = {}
        self._registrations: dict[str, _Cached] = {}
        self._pinned: dict[str, _Cached] = {}
        self._catalog: dict[str, _Cached] = {}
        self._labs: dict[str, _Cached] = {}
        #: One fetch per list and household at a time (see ``_shared``), and
        #: a count per key bumped when that list is dropped, so a fetch begun
        #: before the drop does not store what it found.
        self._inflight: dict[tuple, asyncio.Task] = {}
        self._gen: dict[tuple, int] = {}
        #: The session survives a restart through these two files: the cookie
        #: jar (aiohttp's own pickle format) and a little sidecar naming who is
        #: signed in. Both are written mode 0600 and live only in the data dir.
        self._cookie_file = settings.data_dir / "cloud_session.cookies"
        self._meta_file = settings.data_dir / "cloud_session.json"

    # -- lifecycle -----------------------------------------------------------

    @property
    def signed_in(self) -> bool:
        return self._session is not None and not self._session.closed

    def status(self) -> dict:
        return {
            "signed_in": self.signed_in,
            "email": self._email,
            "user_id": self._user_id,
        }

    async def close(self) -> None:
        if self._session is not None and not self._session.closed:
            await self._session.close()
        self._session = None
        self._user_id = None
        self._account = None
        self._email = None
        self._icons.clear()
        self._registrations.clear()
        self._pinned.clear()
        self._catalog.clear()
        # A fetch still under way belongs to the session just closed.
        for key in set(self._inflight) | set(self._gen):
            self._gen[key] = self._gen.get(key, 0) + 1
        self._inflight.clear()

    async def sign_in(self, email: str, password: str) -> dict:
        """Authenticate and hold the resulting session.

        Raises ``CloudError`` with a message safe to show a person. The
        password is not retained after this call returns.
        """
        async with self._lock:
            await self.close()
            session = aiohttp.ClientSession(
                cookie_jar=aiohttp.CookieJar(),
                headers={"User-Agent": USER_AGENT},
                timeout=aiohttp.ClientTimeout(total=45),
            )
            try:
                token, user_id = await self._okta_authn(session, email, password)
                await self._exchange(session, token)
                if not self._has_session_cookie(session):
                    raise CloudError(
                        "Signed in to Sonos but the web app did not issue a "
                        "session. It may have changed how it authenticates.")
            except Exception:
                await session.close()
                raise
            self._session = session
            self._user_id = user_id
            self._email = email
            self._persist()
            log.info("signed in to Sonos as %s", email)
            return self.status()

    async def restore(self) -> bool:
        """Bring back a session persisted by an earlier run, if still valid.

        Returns whether a usable session was restored. A session the web app no
        longer accepts is dropped, along with its files, so a stale sign-in
        never lingers as a "signed in" state that every request then fails.
        """
        async with self._lock:
            if self.signed_in:
                return True
            if not self._cookie_file.exists():
                return False
            try:
                meta = json.loads(self._meta_file.read_text())
            except (OSError, ValueError):
                meta = {}
            jar = aiohttp.CookieJar()
            try:
                jar.load(self._cookie_file)
            except (OSError, ValueError, EOFError) as exc:
                log.info("could not read stored Sonos session: %s", exc)
                self._forget()
                return False
            session = aiohttp.ClientSession(
                cookie_jar=jar,
                headers={"User-Agent": USER_AGENT},
                timeout=aiohttp.ClientTimeout(total=45),
            )
            try:
                async with session.get(SESSION) as resp:
                    data = await resp.json(content_type=None)
                valid = bool(data) and bool(data.get("user"))
            except Exception as exc:
                # Sonos could not be asked: keep the files and try again next
                # time rather than throwing away a sign-in over a network
                # blip at start-up.
                log.info("stored Sonos session could not be checked, keeping it: %s", exc)
                await session.close()
                return False
            if not valid:
                # Sonos answered and no longer knows this session, which is
                # the one case worth forgetting -- and worth a line in the
                # log, since the sign-in is what service logos hang on
                # (they once vanished unannounced).
                log.info("Sonos no longer accepts the stored session for %s; signed out",
                         meta.get("email") or "unknown")
                await session.close()
                self._forget()
                return False
            self._session = session
            self._email = meta.get("email")
            self._user_id = meta.get("user_id")
            self._account = str(((data.get("user") or {}).get("sonosId") or "")) or None
            log.info("restored Sonos session for %s", self._email or "unknown")
            return True

    def _persist(self) -> None:
        """Write the current session's cookies and owner to the data dir."""
        if self._session is None:
            return
        try:
            self._cookie_file.parent.mkdir(parents=True, exist_ok=True)
            self._session.cookie_jar.save(self._cookie_file)
            self._cookie_file.chmod(0o600)
            self._meta_file.write_text(json.dumps(
                {"email": self._email, "user_id": self._user_id}))
            self._meta_file.chmod(0o600)
        except OSError as exc:
            log.warning("could not persist Sonos session: %s", exc)

    def _forget(self) -> None:
        """Remove the persisted session files."""
        for path in (self._cookie_file, self._meta_file):
            try:
                path.unlink()
            except OSError:
                pass

    async def sign_out(self) -> None:
        """Sign out and forget the persisted session for good."""
        await self.close()
        self._forget()


    @staticmethod
    async def _okta_authn(session: aiohttp.ClientSession, email: str,
                          password: str) -> tuple[str, str | None]:
        payload = {
            "username": email,
            "password": password,
            "options": {"multiOptionalFactorEnroll": False,
                        "warnBeforePasswordExpired": False},
        }
        try:
            async with session.post(OKTA_AUTHN, json=payload) as resp:
                body = await resp.text()
                if resp.status == 401:
                    raise CloudError("Sonos rejected that email or password.")
                if resp.status >= 400:
                    raise CloudError(f"Sonos sign-in failed ({resp.status}).")
                data = json.loads(body)
        except CloudError:
            raise
        except aiohttp.ClientError as exc:
            raise CloudError(f"Could not reach Sonos: {exc}") from exc

        status = data.get("status")
        if status != "SUCCESS":
            # MFA and forced password changes both land here. Naming the state
            # is more useful than a generic failure.
            raise CloudError(
                f"Sonos needs another step before signing in ({status}). "
                f"This controller only handles a plain password sign-in.")
        token = data.get("sessionToken")
        if not token:
            raise CloudError("Sonos returned no session token.")
        user = (data.get("_embedded") or {}).get("user") or {}
        return token, user.get("id")

    @staticmethod
    async def _exchange(session: aiohttp.ClientSession, token: str) -> None:
        """Trade the one-time Okta token for a web-app session.

        The token is handed to the OIDC authorize endpoint, which then issues a
        code without showing a login form; following the redirects back to the
        app sets its session cookie.
        """
        async with session.get(CSRF) as resp:
            ctype = resp.headers.get("Content-Type", "")
            if resp.status != 200 or "json" not in ctype:
                # Sonos answers with a verification/challenge HTML page when it
                # is rate-limiting sign-ins. Report it as such rather than
                # letting a JSON-decode error surface as a 500.
                raise CloudError(
                    "Sonos is temporarily blocking sign-in (it returned a "
                    "verification page instead of a session). This is usually "
                    "rate limiting after several sign-ins; wait a while and try "
                    "again.")
            csrf = (await resp.json()).get("csrfToken")
        async with session.post(
            SIGNIN,
            data={"csrfToken": csrf, "json": "true", "callbackUrl": f"{APP}/"},
            allow_redirects=False,
        ) as resp:
            text = await resp.text()
            try:
                url = json.loads(text)["url"]
            except Exception:
                url = resp.headers.get("Location", "")
        if not url:
            raise CloudError("Sonos did not start the sign-in exchange.")

        separator = "&" if "?" in url else "?"
        url = f"{url}{separator}sessionToken={urllib.parse.quote(token)}"
        for _ in range(12):
            async with session.get(url, allow_redirects=False) as resp:
                location = resp.headers.get("Location")
                if resp.status in (301, 302, 303, 307, 308) and location:
                    url = urllib.parse.urljoin(url, location)
                    continue
                break

    @staticmethod
    def _has_session_cookie(session: aiohttp.ClientSession) -> bool:
        return any(cookie.key == SESSION_COOKIE
                   for cookie in session.cookie_jar)

    # -- the two questions ---------------------------------------------------

    def _require(self) -> aiohttp.ClientSession:
        if not self.signed_in:
            raise NotSignedIn()
        return self._session  # type: ignore[return-value]

    def _headers(self) -> dict[str, str]:
        headers = {"Accept": "application/json"}
        if self._user_id:
            headers["x-sonos-user-id"] = self._user_id
        return headers

    def forget_registrations(self, household_id: str) -> None:
        """Drop the cached service list, after the household changed."""
        key = ("registrations", household_id)
        self._registrations.pop(household_id, None)
        self._inflight.pop(key, None)
        self._gen[key] = self._gen.get(key, 0) + 1

    def _shared(self, key: tuple, fetch) -> "asyncio.Task":
        """The fetch for ``key``, started unless one is already under way.

        Everyone who asks while it runs waits on the same one, and a fetch
        started only to refresh a held copy, which nobody waits on, still has
        its failure logged rather than left unretrieved.
        """
        task = self._inflight.get(key)
        if task is None or task.done():
            task = asyncio.create_task(fetch())
            task.add_done_callback(_note_background_failure)
            self._inflight[key] = task
        return task

    def last_registrations(self, household_id: str) -> list[Registration] | None:
        """The most recently fetched service list, fresh or not.

        Used as the "before" when the household changes, so a service that has
        just gone can be told apart from one Sonora only ever held itself.
        """
        cached = self._registrations.get(household_id)
        return cached.value if cached is not None else None  # type: ignore[return-value]

    async def registrations(self, household_id: str) -> list[Registration]:
        """The music services a household has configured.

        A list older than ``REGISTRATIONS_TTL`` is still the answer while a
        new one is fetched behind it: waiting on Sonos every five minutes put
        a cloud round trip in front of every theme's service list.
        With none held -- the first ask, or after the household
        changed -- the caller waits, on the one fetch everyone shares.
        """
        key = ("registrations", household_id)
        cached = self._registrations.get(household_id)
        if cached is not None:
            if not cached.fresh(REGISTRATIONS_TTL):
                self._shared(key, lambda: self._fetch_registrations(household_id))
            return cached.value  # type: ignore[return-value]
        return await self._shared(key, lambda: self._fetch_registrations(household_id))

    async def _fetch_registrations(self, household_id: str) -> list[Registration]:
        gen = self._gen.get(("registrations", household_id), 0)
        session = self._require()
        url = f"{CONTENT}/households/{household_id}/integrations/registrations"
        async with session.get(url, headers=self._headers()) as resp:
            if resp.status == 401:
                await self.close()
                raise NotSignedIn()
            if resp.status >= 400:
                raise CloudError(
                    f"Sonos returned {resp.status} for the service list.")
            data = await resp.json(content_type=None)

        entries = data if isinstance(data, list) else data.get("registrations", [])
        out: list[Registration] = []
        for entry in entries:
            try:
                service_type = int(entry.get("service-id"))
            except (TypeError, ValueError):
                continue
            out.append(Registration(
                service_type=service_type,
                # The catalog id lives in the type's high bits, which is the
                # same relationship the SA_RINCON token in local content uses.
                service_id=service_type >> 8,
                integration_id=entry.get("integration-id", ""),
                config_id=entry.get("config-id", ""),
                name=entry.get("name", ""),
                nickname=entry.get("nickname", "") or "",
                account_id=str(entry.get("account-id", "") or ""),
                username=str(entry.get("username", "") or ""),
                description=(entry.get("service-description", "") or "")[:400],
            ))
        # Ordered the way Sonos itself lists services, not by name and not
        # in the order this endpoint answers.
        #
        # The web app puts them in the order they appear in the household's
        # integration catalog -- the same list this client reads for logos.
        # Checked against play.sonos.com on 2026-09-19 with seventeen
        # services: its listing runs AccuRadio, SomaFM, Spotify, TuneIn,
        # Community Radio Plus, Sonos Radio, Plex, 80er-Radio harmony, then
        # (in a second run of the same ordering) 90s90s, Libby, Pocket Casts,
        # 80s80s, Audacy, SoundCloud, Amazon Music, and every one of those is
        # in catalog order. What splits the two runs is not yet known --
        # the seven in the second are the accounts the speakers number 13 and
        # up -- and Mixcloud and Pandora sit at the end of the first run
        # rather than at their catalog positions, so this matches the
        # product for fifteen of seventeen and is close for the other two.
        #
        # Read again on 2026-09-24, the product's order was unchanged and
        # fits one rule for all seventeen: the accounts fall into groups by
        # account id -- 1 to 10, then 11 and 12 (Pandora, Mixcloud), then 13
        # to 19 -- and each group is in catalog order. What makes the groups
        # is not known; the accounts' creation dates are the likely answer,
        # and the registrations endpoint, which would say, answered [] that
        # day. This sort is one run of catalog order and so still differs.
        #
        # Read a third time on 2026-09-30, after Mixcloud and Libby were
        # linked again under new account ids (21 and 22): both kept their
        # places, Mixcloud still in the first run, so the account-id groups
        # were a coincidence. The registrations carry no date either
        # (service-id, integration-id, account-id, nickname, username,
        # config-id, name, service-description), and their own order is not
        # the product's. The runs are still unexplained: AccuRadio, SomaFM,
        # Spotify, TuneIn, Community Radio Plus, Sonos Radio, Plex, harmony;
        # then Mixcloud, Pandora; then 90s90s, Libby, Pocket Casts, 80s80s,
        # Audacy, SoundCloud, Amazon Music -- each run in catalog order.
        #
        # An earlier pass sorted the reverse-DNS identifiers, which matched
        # all six positions of a six-service household by coincidence: that
        # household's catalog order and its alphabet happened to agree.
        #
        # Account id breaks ties, which matters for a household holding
        # several accounts on one service. A service missing from the
        # catalog (an outage, or one Sonos no longer lists) sorts last,
        # alphabetically among its like.
        try:
            catalog = await self.service_catalog(household_id)
        except (CloudError, NotSignedIn):
            catalog = {}
        rank = {entry["integration_id"]: entry.get("rank", 0)
                for entry in catalog.values() if entry.get("integration_id")}
        out.sort(key=lambda r: (rank.get(r.integration_id, len(rank) + 1),
                                r.integration_id.casefold(),
                                _account_sort_key(r.account_id)))
        if gen == self._gen.get(("registrations", household_id), 0):
            self._registrations[household_id] = _Cached(out)
        log.info("household %s has %d configured services",
                 household_id[:22], len(out))
        return out

    async def account_number(self) -> str:
        """The person's Sonos account number, as the content API addresses it.

        The session document carries it as ``sonosId``; it is the number the
        pins live under. Read once and kept, since it cannot change while a
        session lasts.
        """
        if self._account:
            return self._account
        session = self._require()
        async with session.get(SESSION) as resp:
            data = await resp.json(content_type=None)
        if resp.status == 401 or not (data or {}).get("user"):
            await self.close()
            raise NotSignedIn()
        self._account = str((data["user"].get("sonosId") or "")) or None
        return self._account or ""

    async def pinned(self, household_id: str) -> list[dict]:
        """The collections pinned to a household's home.

        These are the rows the web app draws under Your Services: a name, the
        service they came from and the first few things inside. The pin is
        Sonos' to keep -- it is made in the Sonos app and lives in the cloud
        -- but what it names is an ordinary browse id, so Sonora reads the
        list here and then browses each one over the service's own SMAPI as
        it browses everything else.

        Each entry gives the service by content type, the same number the
        catalog id lives in the high bits of (Plex's 54279 is sid 212).

        The household id is the plain one: the web app's own URLs carry a
        dotted suffix, and the endpoint answers 410 "eligible player not
        found" when it is sent along (measured 2026-09-20).
        """
        cached = self._pinned.get(household_id)
        if cached is not None and cached.fresh(PINNED_TTL):
            return cached.value  # type: ignore[return-value]

        account = await self.account_number()
        if not account:
            raise NotSignedIn()
        session = self._require()
        url = (f"{CONTENT}/households/{household_id}/services/{FAVORITES_SERVICE}"
               f"/accounts/{account}/favorites/resources?resources=CONTAINERS")
        async with session.get(url, headers=self._headers()) as resp:
            if resp.status == 401:
                await self.close()
                raise NotSignedIn()
            if resp.status >= 400:
                # 410 for a household whose players the cloud cannot reach,
                # which is a household with no pins to show rather than a
                # fault: it is reported as an empty list.
                log.info("household %s has no pins to read: %s",
                         household_id[:22], resp.status)
                self._pinned[household_id] = _Cached([])
                return []
            data = await resp.json(content_type=None)

        out: list[dict] = []
        for entry in ((data.get("CONTAINERS") or {}).get("resources") or []):
            resource = entry.get("resource") or {}
            ident = resource.get("id") or {}
            try:
                service_type = int(ident.get("serviceId"))
            except (TypeError, ValueError):
                continue
            item = str(ident.get("objectId") or "")
            if not item:
                continue
            images = resource.get("images") or []
            out.append({
                "sid": service_type >> 8,
                "service_type": service_type,
                "item": item,
                "title": str(resource.get("name") or ""),
                "art": str((images[0] or {}).get("url", "")) if images else "",
                "playable": bool(resource.get("playable")),
            })
        self._pinned[household_id] = _Cached(out)
        log.info("household %s has %d pinned collections", household_id[:22], len(out))
        return out

    async def service_catalog(self, household_id: str) -> dict[int, dict]:
        """Every service the household could use, keyed by browse sid.

        Registrations are only the accounts a person has linked; this is the
        full catalog Sonos offers, and each entry carries the integration id
        and logo config. It is what lets an anonymous or not-yet-linked
        service (which has no registration) still show a real logo. The
        catalog's ``service-id`` is the SMAPI service type, whose high bits
        are the browse sid, the same relationship registrations use.
        """
        key = ("catalog", household_id)
        cached = self._catalog.get(household_id)
        if cached is not None:
            # An hour-old catalog is still the answer while a new one is
            # fetched behind it, as with the registrations.
            if not cached.fresh(CATALOG_TTL):
                self._shared(key, lambda: self._fetch_catalog(household_id))
            return cached.value  # type: ignore[return-value]
        return await self._shared(key, lambda: self._fetch_catalog(household_id))

    async def _fetch_catalog(self, household_id: str) -> dict[int, dict]:
        gen = self._gen.get(("catalog", household_id), 0)
        session = self._require()
        url = f"{CONTENT}/households/{household_id}/integrations"
        async with session.get(url, headers=self._headers()) as resp:
            if resp.status == 401:
                await self.close()
                raise NotSignedIn()
            if resp.status >= 400:
                raise CloudError(
                    f"Sonos returned {resp.status} for the catalog.")
            data = await resp.json(content_type=None)

        entries = data if isinstance(data, list) else data.get("integrations", [])
        out: dict[int, dict] = {}
        for entry in entries:
            try:
                sid = int(entry.get("service-id")) >> 8
            except (TypeError, ValueError):
                continue
            integration = entry.get("integration-id", "")
            config = entry.get("id", "")
            if integration and config:
                out[sid] = {"integration_id": integration, "config_id": config,
                            "name": entry.get("name", ""),
                            # Where Sonos itself lists this service. The web
                            # app orders a household's services by this, so it
                            # is worth keeping (see ``registrations``).
                            "rank": len(out),
                            # The service's own front page. The web app draws
                            # it as the pill under the service's name (read
                            # off play.sonos.com 2026-09-19: AccuRadio's pill
                            # goes to www.accuradio.com, harmony's to
                            # www.harmonyfm.de, and this field is where both
                            # come from -- it is not the SMAPI endpoint, whose
                            # host is resource.harmonyfm.de).
                            "site": ((entry.get("websites") or {}).get("home") or ""),
                            # Sonos declares here that it attaches the device
                            # certificate to this service's requests. Only such
                            # a service can reject a certificate-less controller
                            # the way SoundCloud does, so this narrows which
                            # ones are worth probing. See
                            # ``unpairable_service_ids``.
                            "needs_cert": bool(
                                entry.get("request-header-device-cert"))}
        if gen == self._gen.get(("catalog", household_id), 0):
            self._catalog[household_id] = _Cached(out)
        log.info("household %s catalog has %d services",
                 household_id[:22], len(out))
        return out

    async def labs_services(self, household_id: str) -> list[dict]:
        """The Sonos Labs services on offer to a household.

        The desktop app's "Sonos Labs" button lists these: it reads Sonos'
        service catalog and keeps the entries whose ``containerType`` is
        ``SONOS_LABS`` rather than ``MUSIC_SERVICE`` (both strings, and the
        ``userType`` query it sends alongside, are in sclib-csharp.dll).

        The catalog is keyed by household and needs a signed-in session. A
        household that has not opted in to Labs is offered none, which is what
        the app shows as an empty list (measured 2026-09-14 against the app on
        this system, whose own Labs list was empty and whose catalog answers
        with the ordinary directory alone).
        """
        cached = self._labs.get(household_id)
        if cached is not None and cached.fresh(LABS_TTL):
            return cached.value  # type: ignore[return-value]

        session = self._require()
        headers = {**self._headers(),
                   "Accept": "application/sonos_service_catalog.v2.json"}
        url = f"{SERVICE_CATALOG}?householdId={household_id}"
        async with session.get(url, headers=headers) as resp:
            if resp.status == 401:
                await self.close()
                raise NotSignedIn()
            if resp.status >= 400:
                raise CloudError(
                    f"Sonos returned {resp.status} for the service catalog.")
            data = await resp.json(content_type=None)

        out: list[dict] = []
        for entry in data.get("services", []) or []:
            if str(entry.get("containerType", "")).upper() != "SONOS_LABS":
                continue
            try:
                service_type = int(entry.get("rsvcId"))
            except (TypeError, ValueError):
                continue
            out.append({
                # The catalog's rsvcId is the SMAPI service type; its high
                # bits are the browse sid, as everywhere else here.
                "id": service_type >> 8,
                "service_type": service_type,
                "name": entry.get("name", ""),
                "auth": entry.get("authMode", ""),
                "description": (entry.get("shortDescription", "") or "")[:400],
            })
        out.sort(key=lambda item: item["name"].casefold())
        self._labs[household_id] = _Cached(out)
        log.info("household %s is offered %d Sonos Labs services",
                 household_id[:22], len(out))
        return out

    async def icon(self, integration_id: str, config_id: str,
                   size: int = 160) -> tuple[bytes, str]:
        """Fetch a service logo, caching it for the life of the process."""
        key = f"{integration_id}/{config_id}/{size}"
        hit = self._icons.get(key)
        if hit is not None:
            return hit

        session = self._require()
        url = (f"{CONTENT}/integrations/{urllib.parse.quote(integration_id)}"
               f"/configurations/{urllib.parse.quote(config_id)}/images/icon"
               f"?height={size}&width={size}")

        # The endpoint refuses a wildcard Accept and names the two it takes:
        # "accept header must be 'image/png' or 'image/svg+xml'". Vector is
        # preferred, since these render as circles at several sizes.
        body: bytes | None = None
        content_type = "image/png"
        last: str = ""
        for accept in ("image/svg+xml", "image/png"):
            async with session.get(url, headers={"Accept": accept}) as resp:
                if resp.status == 401:
                    await self.close()
                    raise NotSignedIn()
                if resp.status == 200:
                    body = await resp.read()
                    content_type = resp.headers.get("Content-Type", accept)
                    break
                last = f"{resp.status} for {accept}"
        if body is None:
            raise CloudError(f"Sonos returned {last} for a logo.")

        if len(self._icons) >= ICON_CACHE_MAX:
            self._icons.pop(next(iter(self._icons)))
        self._icons[key] = (body, content_type)
        return body, content_type

    async def brand_image(self, integration_id: str, config_id: str, kind: str,
                          width: int, height: int) -> tuple[bytes, str]:
        """One of a service's brand pictures: its badge, or its wordmark.

        ``badge`` is the attribution mark the product stamps on artwork;
        ``logo`` is the wordmark it prints under the artist in Now Playing
        ("pandora", 200x40). Both come from the catalog's brand assets and
        both 404 for a service that publishes none, which is the answer.
        """
        key = f"{kind}/{integration_id}/{config_id}/{width}x{height}"
        hit = self._icons.get(key)
        if hit is not None:
            return hit

        session = self._require()
        url = (f"{CONTENT}/integrations/{urllib.parse.quote(integration_id)}"
               f"/configurations/{urllib.parse.quote(config_id)}/images/{kind}"
               f"?height={height}&width={width}")
        body: bytes | None = None
        content_type = "image/png"
        last = ""
        for accept in ("image/png", "image/svg+xml"):
            async with session.get(url, headers={"Accept": accept}) as resp:
                if resp.status == 401:
                    await self.close()
                    raise NotSignedIn()
                if resp.status == 200:
                    body = await resp.read()
                    content_type = resp.headers.get("Content-Type", accept)
                    break
                last = f"{resp.status} for {accept}"
        if body is None:
            raise CloudError(f"Sonos returned {last} for a {kind}.")

        if len(self._icons) >= ICON_CACHE_MAX:
            self._icons.pop(next(iter(self._icons)))
        self._icons[key] = (body, content_type)
        return body, content_type

    async def badge(self, integration_id: str, config_id: str,
                    size: int = 40) -> tuple[bytes, str]:
        """A service's attribution badge, where it publishes one.

        Not every service does: the catalog's ``brand-assets`` carries a
        ``badge`` list for Pandora, Audacy and 80er-Radio harmony and an empty
        one for AccuRadio, Mixcloud and Plex, and the product shows a mark on
        exactly the first set -- a Pandora flag over its stations' art, an
        Audacy triangle over its own, nothing over a Mixcloud playlist
        (measured 2026-09-19). A service without one answers 404, which is
        the answer: draw nothing.

        Unlike a logo this is left as the service drew it -- these are
        transparent marks meant to sit over artwork, not discs to fill.
        """
        return await self.brand_image(integration_id, config_id, "badge",
                                      size, size)

    # -- the websocket -------------------------------------------------------

    async def muse_ticket(self) -> str:
        """A one-time ticket authorizing a websocket connection."""
        session = self._require()
        async with session.get(MFE, headers=self._headers()) as resp:
            if resp.status == 401:
                await self.close()
                raise NotSignedIn()
            if resp.status >= 400:
                raise CloudError(
                    f"Sonos returned {resp.status} for a websocket ticket.")
            data = await resp.json(content_type=None)
        ticket = (data or {}).get("ticket")
        if not ticket:
            raise CloudError("Sonos issued no websocket ticket.")
        return ticket

    async def muse_connect(self) -> aiohttp.ClientWebSocketResponse:
        """Open the live-status websocket on this session."""
        session = self._require()
        ticket = await self.muse_ticket()
        url = f"{MUSE_WS}?ticket={urllib.parse.quote(ticket)}"
        try:
            # Without the subprotocol the server answers the upgrade with a
            # plain 200; this is the same name the speakers' own LAN
            # websocket uses.
            return await session.ws_connect(
                url, headers={"Origin": APP}, protocols=[MUSE_PROTOCOL],
                heartbeat=30)
        except aiohttp.ClientError as exc:
            raise CloudError(f"Could not open the Sonos websocket: {exc}") from exc
