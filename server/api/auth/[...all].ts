import { defineEventHandler, getRequestURL, readRawBody } from "h3";

import { auth } from "~/lib/auth";

export default defineEventHandler(async (event) => {
  const url = getRequestURL(event);
  let body: BodyInit | undefined;
  if (event.method !== "GET" && event.method !== "HEAD") {
    const raw = await readRawBody(event);
    if (raw) {
      body = typeof raw === "string" ? raw : new Uint8Array(raw);
    }
  }
  const request = new Request(url.href, {
    method: event.method,
    headers: event.headers,
    body,
  });
  return auth.handler(request);
});
