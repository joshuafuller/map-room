FROM ghcr.io/onthegomap/planetiler:0.10.2 AS planetiler

FROM maptiler/tileserver-gl:v5.6.0

USER root
COPY --from=planetiler /opt/java/openjdk /opt/java/openjdk
COPY --from=planetiler /app /app
COPY config.json /opt/map-room/config.json
COPY maintainer /opt/map-room/maintainer
COPY web/atak.js /opt/map-room/web/atak.js
COPY scripts/write-manifest.py scripts/server-entrypoint.sh /opt/map-room/scripts/
RUN chmod +x /opt/map-room/scripts/server-entrypoint.sh
USER node

ENTRYPOINT ["/opt/map-room/scripts/server-entrypoint.sh"]
