# Building the app #
FROM oven/bun:alpine AS builder

WORKDIR /app

COPY package.json ./
COPY bun.lock ./

RUN bun install

COPY . .
RUN bun run build

# Running the app #
FROM oven/bun:alpine
WORKDIR /app

COPY --from=builder /app/.output ./

EXPOSE 3000

ENTRYPOINT [ "bun", "./server/index.mjs" ]