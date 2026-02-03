# use the official Bun image
# see all versions at https://hub.docker.com/r/oven/bun/tags
FROM oven/bun:slim
WORKDIR /usr/src/app
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y curl

COPY package.json ./
COPY bun.lock ./

RUN bun install --frozen-lockfile

COPY . .
RUN bun run build


ENTRYPOINT [ "bun", "run", ".output/server/index.mjs" ]