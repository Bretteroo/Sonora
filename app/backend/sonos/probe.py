"""Active network probing of speakers from the controller.

Speakers report their noise floor, their accumulated radio errors, and the
signal margins to other speakers they can hear. What they do not report is the
quality of their link to the access point, and on a system where every unit is
an ordinary WiFi station rather than part of a SonosNet mesh, that is the link
which actually carries audio. No diagnostic endpoint on the device exposes it.

So measure it from this end instead. A TCP handshake to a speaker's control
port traverses the same path the audio does, in reverse: controller to access
point to speaker. Repeated handshakes give a latency distribution, and the
shape of that distribution says more than any single number. A room with a
healthy link answers in a few milliseconds every time. A room with a marginal
link answers quickly on average but with a long tail, which is exactly what
produces audio that stutters intermittently while appearing fine in a spot
check.

A handshake is used rather than an HTTP request because it costs the speaker
almost nothing: no request is parsed and no page is rendered, so the numbers
reflect the network rather than how busy the little CPU in the speaker is.
"""

from __future__ import annotations

import asyncio
import statistics
import time
from dataclasses import dataclass, field

from .const import SONOS_PORT

#: Round trip in milliseconds, from Sonora to the speaker. Healthy 2.4 GHz
#: Wi-Fi answers anywhere from 4 to 60 ms, varying from one try to the next
#: by 10 ms or more (measured on this house, 2026-10-02), and none of that
#: is audible: a speaker buffers seconds of audio, and grouped speakers keep
#: time among themselves. The old bar, a 15 ms median and 5 ms of jitter,
#: called nearly every healthy speaker uneven. What is worth flagging is a
#: typical answer slower than 40 ms, a slowest one in twenty past 100 ms, or
#: a stall of a second or more.
LATENCY_GOOD_MS = 40.0
LATENCY_FAIR_MS = 120.0
P95_GOOD_MS = 100.0
P95_FAIR_MS = 250.0
STALL_MS = 1000.0

#: Kept for the findings that weigh variation alongside a slow median.
JITTER_GOOD_MS = 25.0
JITTER_FAIR_MS = 60.0

DEFAULT_SAMPLES = 12
DEFAULT_INTERVAL = 0.12
DEFAULT_TIMEOUT = 2.0


@dataclass(slots=True)
class LatencyReport:
    """Timing distribution for one speaker."""

    host: str
    zone_name: str = ""
    samples: list[float] = field(default_factory=list)
    failures: int = 0

    @property
    def attempts(self) -> int:
        return len(self.samples) + self.failures

    @property
    def loss(self) -> float:
        return self.failures / self.attempts if self.attempts else 0.0

    @property
    def best(self) -> float | None:
        return min(self.samples) if self.samples else None

    @property
    def median(self) -> float | None:
        return statistics.median(self.samples) if self.samples else None

    @property
    def worst(self) -> float | None:
        return max(self.samples) if self.samples else None

    @property
    def jitter(self) -> float | None:
        """Standard deviation of the round trips, in milliseconds."""
        if len(self.samples) < 2:
            return None
        return statistics.stdev(self.samples)

    @property
    def spread(self) -> float | None:
        """Gap between the best and worst round trip.

        A large spread on an otherwise good median is the signature of a link
        that is fine until it is not.
        """
        if not self.samples:
            return None
        return max(self.samples) - min(self.samples)

    @property
    def p95(self) -> float | None:
        if not self.samples:
            return None
        ordered = sorted(self.samples)
        index = min(len(ordered) - 1, int(round(0.95 * (len(ordered) - 1))))
        return ordered[index]

    @property
    def quality(self) -> str:
        """How the speaker answers: good, fair, poor or critical, judged on
        the typical answer and the slowest one in twenty rather than on
        the spread, which ordinary Wi-Fi always has."""
        if not self.samples:
            return "unreachable"
        if self.loss > 0.2:
            return "critical"
        median = self.median or 0.0
        p95 = self.p95 or 0.0
        if median > LATENCY_FAIR_MS or p95 > P95_FAIR_MS or self.loss > 0.05:
            return "poor"
        if median > LATENCY_GOOD_MS or p95 > P95_GOOD_MS or self.loss > 0:
            return "fair"
        return "good"

    def as_dict(self) -> dict:
        return {
            "host": self.host,
            "zone_name": self.zone_name,
            "attempts": self.attempts,
            "failures": self.failures,
            "loss": round(self.loss, 4),
            "best_ms": _round(self.best),
            "median_ms": _round(self.median),
            "p95_ms": _round(self.p95),
            "worst_ms": _round(self.worst),
            "jitter_ms": _round(self.jitter),
            "spread_ms": _round(self.spread),
            "quality": self.quality,
        }


def _round(value: float | None) -> float | None:
    return round(value, 2) if value is not None else None


async def probe_once(host: str, port: int = SONOS_PORT,
                     timeout: float = DEFAULT_TIMEOUT) -> float | None:
    """Time a single TCP handshake in milliseconds, or ``None`` on failure."""
    started = time.perf_counter()
    writer = None
    try:
        _, writer = await asyncio.wait_for(
            asyncio.open_connection(host, port), timeout=timeout)
        return (time.perf_counter() - started) * 1000.0
    except (OSError, asyncio.TimeoutError):
        return None
    finally:
        if writer is not None:
            writer.close()
            try:
                await writer.wait_closed()
            except Exception:
                pass


async def probe_host(
    host: str,
    *,
    zone_name: str = "",
    samples: int = DEFAULT_SAMPLES,
    interval: float = DEFAULT_INTERVAL,
    timeout: float = DEFAULT_TIMEOUT,
) -> LatencyReport:
    """Build a latency distribution for one speaker.

    Samples are spaced out rather than fired in a burst. A burst measures how
    fast the speaker can accept queued connections; spacing them measures the
    network as a person listening would experience it.
    """
    report = LatencyReport(host=host, zone_name=zone_name)
    for index in range(samples):
        result = await probe_once(host, timeout=timeout)
        if result is None:
            report.failures += 1
        else:
            report.samples.append(result)
        if index + 1 < samples:
            await asyncio.sleep(interval)
    return report


async def probe_all(
    targets: dict[str, str],
    *,
    samples: int = DEFAULT_SAMPLES,
    interval: float = DEFAULT_INTERVAL,
    timeout: float = DEFAULT_TIMEOUT,
) -> dict[str, LatencyReport]:
    """Probe several speakers at once.

    ``targets`` maps a host to a room name. Rooms are probed concurrently
    because probing them one after another would take long enough for
    conditions to change in between, making the results incomparable.
    """
    async def one(host: str, name: str) -> tuple[str, LatencyReport]:
        return host, await probe_host(
            host, zone_name=name, samples=samples,
            interval=interval, timeout=timeout)

    results = await asyncio.gather(*(one(h, n) for h, n in targets.items()))
    return dict(results)
