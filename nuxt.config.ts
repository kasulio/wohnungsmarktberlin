import { resolve } from "node:path";
import { defineNuxtConfig } from "nuxt/config";

import { env } from "./env";
export const deploymentUrl = env.DEPLOYMENT_URL;

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2026-07-15",
  routeRules: {
    // Icon JSONs change rarely; rename the file when editing one.
    "/icons/**": {
      headers: {
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    },
    "/_ipx/**": {
      isr: 60 * 60 * 24 * 7, // 7 days
      headers: {
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    },
  },
  app: {
    head: {
      charset: "utf-8",
      viewport: "width=device-width, initial-scale=1",
      meta: [
        {
          name: "robots",
          content:
            deploymentUrl === "https://wohnungsmarktberlin.de"
              ? "index, follow"
              : "noindex, nofollow",
        },
      ],
      htmlAttrs: { lang: "de" },
    },
  },
  devtools: {
    enabled: true,
    timeline: { enabled: true },
  },
  image: {
    domains: [deploymentUrl!, "localhost:3000"],
    densities: [1, 2],
  },
  nitro: {
    esbuild: { options: { target: "esnext" } },
    experimental: { tasks: true },
    scheduledTasks:
      env.SCHEDULED_TASKS === "off"
        ? {}
        : {
            "* * * * *": [
              "address-improvement",
              "extract-flats",
              "update-flats",
              "notify",
            ],
            "*/15 * * * *": ["update-map-preview"],
          },
    preset: "bun",
  },
  alias: { cookie: resolve(__dirname, "node_modules/cookie") },
  modules: [
    "@nuxtjs/tailwindcss",
    [
      "@nuxtjs/google-fonts",
      {
        preconnect: true,
        prefetch: true,
        preload: true,
        families: { Poppins: [300, 400, 500, 600, 700] },
        display: "swap",
      },
    ],
    "@nuxt/image",
    "@nuxtjs/sitemap",
    "nuxt-ipx-cache",
    "@nuxt/icon",
    // Dev workarounds for upstream incompatibilities:
    // 1. @vitejs/devtools 0.3.4 ignores Nuxt's deprecated disableAuthorization
    //    and breaks Vite 8's vite.devtools config hook; disable client auth on
    //    loopback via its env flag and pass the real port for --host auth URLs.
    // 2. nuxt-ipx-cache 1.0.8 targets ipx 2/3 and calls setHeaders inside
    //    res.end() after @nuxt/image 2's streamed res.write() already sent
    //    headers, throwing before originalEnd() and stalling keep-alive sockets.
    (_options, nuxt) => {
      if (!nuxt.options.dev) return;
      nuxt.hook("nitro:init", (nitro) => {
        nitro.options.plugins = nitro.options.plugins.filter(
          (p) => !p.includes("nuxt-ipx-cache"),
        );
      });
      nuxt.hook("vite:extendConfig", (config) => {
        const { host, port } = nuxt.options.devServer;
        if (port) {
          const viteConfig = config as { server?: { port?: number } };
          viteConfig.server ??= {};
          viteConfig.server.port ??= port;
        }
        const isLoopback =
          !host ||
          host === "localhost" ||
          host === "127.0.0.1" ||
          host === "::1" ||
          host === "::ffff:127.0.0.1";
        if (
          isLoopback &&
          process.env.VITE_DEVTOOLS_DISABLE_CLIENT_AUTH === undefined
        ) {
          process.env.VITE_DEVTOOLS_DISABLE_CLIENT_AUTH = "true";
        }
      });
    },
  ],
  ipxCache: {
    maxAge: 60 * 60 * 24 * 7, // 7 days
    cacheDir: ".cache/ipx",
    ipxPrefix: "/_ipx",
  },
  site: { url: deploymentUrl },
  sitemap: {
    exclude: ["/admin/**", "/login"],
    urls: [
      { loc: "/", changefreq: "hourly", priority: 1.0 },
      { loc: "/overview", changefreq: "hourly", priority: 0.9 },
      { loc: "/map", changefreq: "hourly", priority: 0.8 },
      { loc: "/about", changefreq: "monthly", priority: 0.5 },
      { loc: "/privacy", changefreq: "yearly", priority: 0.2 },
    ],
  },
  build: { transpile: ["trpc-nuxt", "zod"] },
  experimental: { clientFallback: true },
  runtimeConfig: {
    public: {
      deploymentUrl,
      googleMapsApiKey: env.NUXT_PUBLIC_GOOGLE_MAPS_API_KEY,
      googleMapsId: env.NUXT_PUBLIC_GOOGLE_MAPS_MAP_ID,
      // Presence gates the "Notify me on Telegram" UI; not a secret.
      telegramBotUsername: env.TELEGRAM_BOT_USERNAME ?? "",
    },
  },
  css: ["~/assets/global.css"],
  typescript: {
    tsConfig: {
      exclude: ["../scripts/**", "../**/*.test.ts"],
    },
  },
  vite: {
    optimizeDeps: {
      include: [
        "@vue/devtools-core",
        "@vue/devtools-kit",
        "better-auth/vue",
        "chart.js",
        "drizzle-orm",
        "drizzle-orm/sqlite-core",
        "lottie-web/build/player/lottie_light", // CJS
        "tailwindcss/resolveConfig", // CJS
        "vue-chartjs",
        "vue3-google-map", // CJS
      ],
    },
  },
});
