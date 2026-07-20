# Cursor Cloud agent base image. Do not COPY the project — Cursor mounts the workspace.
FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive
ENV BUN_INSTALL=/usr/local/bun
ENV PATH="${BUN_INSTALL}/bin:${PATH}"

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    git \
    unzip \
    build-essential \
    openssl \
    && rm -rf /var/lib/apt/lists/*

# Install Bun system-wide for all users
RUN curl -fsSL https://bun.sh/install | bash \
    && mv /root/.bun /usr/local/bun \
    && ln -sf /usr/local/bun/bin/bun /usr/local/bin/bun \
    && ln -sf /usr/local/bun/bin/bunx /usr/local/bin/bunx

# Non-root ubuntu user (Cursor default)
RUN id -u ubuntu >/dev/null 2>&1 || useradd -m -s /bin/bash ubuntu \
    && usermod -aG sudo ubuntu \
    && echo "ubuntu ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/ubuntu

USER ubuntu
WORKDIR /home/ubuntu
