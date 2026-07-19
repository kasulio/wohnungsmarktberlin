# use the official Bun image
# see all versions at https://hub.docker.com/r/oven/bun/tags
FROM oven/bun:slim
WORKDIR /usr/src/app
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y curl build-essential

COPY package.json ./
COPY bun.lock ./

RUN bun install


COPY . .
RUN bun run build

EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=5s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/api/health || exit 1

# Exec form so bun is PID 1 and receives Coolify/Docker SIGTERM directly.
STOPSIGNAL SIGTERM
ENTRYPOINT ["bun", ".output/server/index.mjs"]
