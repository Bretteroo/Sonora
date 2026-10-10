# syntax=docker/dockerfile:1.7

# ---- frontend -------------------------------------------------------------
FROM --platform=$BUILDPLATFORM node:25-slim AS web
# The page imports the themes from app/themes/, beside app/frontend/, so
# the two keep their places here.
WORKDIR /src/frontend
COPY app/frontend/package*.json ./
RUN npm ci --no-audit --no-fund
COPY app/frontend/ ./
COPY app/themes/ ../themes/
RUN npm run build

# ---- python deps ----------------------------------------------------------
FROM python:3.14-slim AS deps
ENV PIP_DISABLE_PIP_VERSION_CHECK=1 PIP_NO_CACHE_DIR=1
WORKDIR /src
COPY app/pyproject.toml app/requirements.lock ./
COPY app/backend ./backend
# The same hash-pinned versions the tests ran against, then Sonora itself.
RUN python -m venv /venv \
 && /venv/bin/pip install --upgrade pip wheel \
 && /venv/bin/pip install --require-hashes -r requirements.lock \
 && /venv/bin/pip install --no-deps .

# ---- runtime --------------------------------------------------------------
FROM python:3.14-slim AS runtime
LABEL org.opencontainers.image.title="Sonora" \
      org.opencontainers.image.description="Web controller for Sonos S1 and S2 systems" \
      org.opencontainers.image.licenses="AGPL-3.0-only"

RUN useradd --system --uid 10001 --create-home --home-dir /home/sonora sonora \
 && mkdir -p /data && chown sonora:sonora /data

COPY --from=deps /venv /venv
COPY --from=deps /src/backend /app/backend
COPY --from=web  /src/frontend/dist /app/frontend/dist
# The license and the third-party notices, which the About windows link to.
COPY LICENSE THIRD-PARTY-NOTICES.md /app/

ENV PATH=/venv/bin:$PATH \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    SONORA_DATA_DIR=/data \
    SONORA_WEB_PORT=50205

WORKDIR /app
# Not USER sonora: the entrypoint starts as root only to find who owns /data,
# then runs Sonora as that user (see docker-entrypoint.sh).
COPY --chmod=755 app/docker-entrypoint.sh /app/docker-entrypoint.sh
ENTRYPOINT ["/app/docker-entrypoint.sh"]
VOLUME ["/data"]
EXPOSE 50205

# Asked where Sonora listens: 127.0.0.1 unless SONORA_WEB_HOST names one
# address, as it may on a machine with several.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD python -c "import os,urllib.request,sys; \
h=os.environ.get('SONORA_WEB_HOST','') or '127.0.0.1'; h={'0.0.0.0':'127.0.0.1','::':'::1'}.get(h,h); \
h='['+h+']' if ':' in h else h; \
sys.exit(0 if urllib.request.urlopen('http://'+h+':'+os.environ.get('SONORA_WEB_PORT','50205')+'/api/health',timeout=4).status==200 else 1)"

# app/backend/__main__.py reads SONORA_WEB_HOST and SONORA_WEB_PORT itself. With host
# networking there is no port mapping to fall back on, so the port has to be
# settable, and it is -- through the environment rather than through this line.
CMD ["python", "-m", "backend"]

# ---- Home Assistant -------------------------------------------------------
# The same image runs as a Home Assistant app (homeassistant/sonora/),
# whose Supervisor reads these labels. Home Assistant calls arm64 aarch64, so
# each platform's image takes its own name from a stage of its own
# (TARGETARCH is BuildKit's; declaring it would blank it).
FROM runtime AS runtime-amd64
LABEL io.hass.arch="amd64"
FROM runtime AS runtime-arm64
LABEL io.hass.arch="aarch64"

FROM runtime-${TARGETARCH}
ARG SONORA_VERSION=dev
LABEL io.hass.type="app" \
      io.hass.name="Sonora" \
      io.hass.version="${SONORA_VERSION}"
