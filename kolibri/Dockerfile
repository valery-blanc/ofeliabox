FROM python:3.11-slim-bookworm

ARG KOLIBRI_VERSION=0.18.1

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl ca-certificates && \
    pip install --no-cache-dir kolibri==${KOLIBRI_VERSION} && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

ENV KOLIBRI_HOME=/kolibri_data
ENV KOLIBRI_HTTP_PORT=8080
ENV KOLIBRI_LISTEN_PORT=8080

# Créer le répertoire de données avec les bonnes permissions
RUN mkdir -p /kolibri_data && chmod 777 /kolibri_data

VOLUME /kolibri_data

EXPOSE 8080

CMD ["kolibri", "start", "--foreground", "--port=8080"]
