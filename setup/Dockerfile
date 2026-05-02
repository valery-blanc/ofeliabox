FROM python:3.11-slim-bookworm

# Install Docker CLI + Compose plugin (arm64-compatible via Docker official repo)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl gnupg \
  && install -m 0755 -d /etc/apt/keyrings \
  && curl -fsSL https://download.docker.com/linux/debian/gpg \
       | gpg --dearmor -o /etc/apt/keyrings/docker.gpg \
  && chmod a+r /etc/apt/keyrings/docker.gpg \
  && ARCH=$(dpkg --print-architecture) \
  && echo "deb [arch=$ARCH signed-by=/etc/apt/keyrings/docker.gpg] \
       https://download.docker.com/linux/debian bookworm stable" \
       > /etc/apt/sources.list.d/docker.list \
  && apt-get update \
  && apt-get install -y --no-install-recommends docker-ce-cli docker-compose-plugin \
  && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir flask

WORKDIR /app
COPY app.py .
COPY templates/ templates/

EXPOSE 8080
CMD ["python3", "app.py"]
