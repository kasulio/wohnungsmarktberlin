import { resolve } from "node:path";
import { defineNuxtConfig } from "nuxt/config";

import { env } from "./env";
export const deploymentUrl = env.DEPLOYMENT_URL;

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2025-06-01",
  app: {
    head: {
      charset: "utf-8",
      viewport: "width=device-width, initial-scale=1",
      script: [
        {
          defer: true,
          "data-domain": new URL(deploymentUrl).hostname,
          src: "https://plausible.lukasfrey.com/js/script.js",
        },
        {
          async: true,
          defer: true,
          "data-domain": "wohnungsmarktberlin.de",
          src: "https://speedin.site/static/js/collect.js",
        },
      ],
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
  nitro: {
    esbuild: { options: { target: "esnext" } },
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
  ],
  site: { url: deploymentUrl },
  sitemap: { exclude: ["/admin/**"] },
  authJs: {
    guestRedirectTo: "/api/auth/signin",
    authenticatedRedirectTo: "/admin/dashboard",
  },
  build: { transpile: ["trpc-nuxt"] },
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

  image: {
    // this default is not really used, because it only works with NuxtPicture
    format: ["avif", "webp", "jpg"],
    domains: [deploymentUrl],
    ipx: {
      http: {
        maxAge: 60 * 60 * 24 * 30,
      },
      fs: {
        maxAge: 60 * 60 * 24 * 7,
      },
      maxAge: 60 * 60 * 24 * 30,
    },
  },

  css: ["~/assets/global.css"],
});
