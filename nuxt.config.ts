import { resolve } from "node:path";
import { defineNuxtConfig } from "nuxt/config";

import { env } from "./env";
export const deploymentUrl = env.DEPLOYMENT_URL;

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2026-02-03",
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
      "* * * * *": ["address-improvement", "extract-flats", "update-flats"],
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
    "@hebilicious/authjs-nuxt",
    "@nuxtjs/sitemap",
    "nuxt-ipx-cache",
  ],
  ipxCache: {
    maxAge: 60 * 60 * 24 * 7, // 7 days
    cacheDir: ".cache/ipx",
    ipxPrefix: "/_ipx",
  },
  site: { url: deploymentUrl },
  sitemap: { exclude: ["/admin/**"] },
  authJs: {
    guestRedirectTo: "/api/auth/signin",
    authenticatedRedirectTo: "/admin/dashboard",
  },
  build: { transpile: ["trpc-nuxt", "zod"] },
  experimental: { clientFallback: true },
  runtimeConfig: {
    authJs: { secret: env.NUXT_NEXTAUTH_SECRET },
    public: {
      authJs: { baseUrl: deploymentUrl },
      deploymentUrl,
      googleMapsApiKey: env.NUXT_PUBLIC_GOOGLE_MAPS_API_KEY,
      googleMapsId: env.NUXT_PUBLIC_GOOGLE_MAPS_MAP_ID,
    },
  },
  css: ["~/assets/global.css"],
});
