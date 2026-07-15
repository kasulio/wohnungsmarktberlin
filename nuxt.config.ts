import { resolve } from "node:path";
import { defineNuxtConfig } from "nuxt/config";

import { env } from "./env";
export const deploymentUrl = env.DEPLOYMENT_URL;

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2026-07-15",
  routeRules: {
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
  vue: {
    compilerOptions: { isCustomElement: (tag) => ["lord-icon"].includes(tag) },
  },
  image: {
    domains: [deploymentUrl!, "localhost:3000"],
    densities: [1, 2],
  },
  nitro: {
    esbuild: { options: { target: "esnext" } },
    experimental: { tasks: true },
    scheduledTasks: {
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
        "@lordicon/element",
        "@vue/devtools-core",
        "@vue/devtools-kit",
        "better-auth/vue",
        "drizzle-orm",
        "lottie-web", // CJS
      ],
    },
  },
});
