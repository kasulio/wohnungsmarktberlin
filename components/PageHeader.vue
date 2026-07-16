<script setup lang="ts">
import type { LottieIconPlayer } from "~/utils/lottieIcons";

const siteMenuVisibility = ref({ visible: false, closing: true });

const iconsContainer = ref<HTMLElement | null>(null);

function showSiteMenu(state: boolean) {
  siteMenuVisibility.value.closing = !state;
  if (state) {
    siteMenuVisibility.value.visible = true;
  } else {
    setTimeout(() => {
      siteMenuVisibility.value.visible = false;
    }, 300);
  }
}

const route = useRoute();

const nuxtApp = useNuxtApp();
const _cleanup: Array<() => void> = [];

function getPlayer(el: Element | null | undefined): LottieIconPlayer | undefined {
  return (el as (HTMLElement & { playerInstance?: LottieIconPlayer }) | null)
    ?.playerInstance;
}

onMounted(() => {
  (["vue:error", "page:loading:end"] as const).forEach((hook) => {
    _cleanup.push(
      nuxtApp.hook(hook, () => {
        showSiteMenu(false);
        Array.from(
          iconsContainer.value?.querySelectorAll("[data-lottie-icon]") ?? [],
        ).forEach((icon) => {
          const playerInstance = getPlayer(icon);
          if (!playerInstance) return;
          playerInstance.loop = false;
        });
      }),
    );
  });
});

onUnmounted(() => _cleanup.forEach((hook) => hook()));

// start animation on linkclick
const handleLinkClick = (e: PointerEvent) => {
  if (!(e.target instanceof HTMLElement)) return;
  const icon =
    e.target.closest("[data-lottie-icon]") ??
    e.target.querySelector("[data-lottie-icon]");
  const playerInstance = getPlayer(icon);
  if (!playerInstance) return;
  playerInstance.loop = true;
  playerInstance.play();
};
</script>

<template>
  <nav class="flex items-center gap-4 min-h-12 md:justify-between">
    <NuxtLink
      to="/"
      title="Startseite"
      class="logo text-[24px] font-medium text-main md:flex-1"
    >
      <span
        class="inline-flex flex-wrap -mb-6 leading-none tracking-tighter max-w-40 xs:flex-nowrap md:flex-col lg:flex-row"
      >
        <span class="text-accent">Wohnungs</span>
        <span class="text-primary">Markt</span>
        <span class="">Berlin</span>
      </span>
    </NuxtLink>
    <h2
      class="hidden font-light text-center opacity-50 tagline whitespace-nowrap text-l md:block md:flex-1"
    >
      What's a housing crisis?
    </h2>
    <div
      class="items-baseline gap-4 ml-auto text-right nav_links md:ml-0 md:flex md:flex-1 md:justify-end"
    >
      <NuxtLink
        to="/"
        title="Startseite"
        class="hidden md:block"
      >
        <LottieIcon
          src="/icons/home.json"
          trigger="hover"
          style="width: 32px; height: 32px"
        >
          <img
            src="/icons/home.svg"
            alt=""
          />
        </LottieIcon>
      </NuxtLink>
      <NuxtLink
        to="/overview"
        title="Listenansicht"
        class="hidden md:block"
      >
        <LottieIcon
          src="/icons/overview.json"
          trigger="hover"
          style="width: 32px; height: 32px"
        >
          <img
            src="/icons/overview.svg"
            alt=""
          />
        </LottieIcon>
      </NuxtLink>
      <NuxtLink
        to="/map"
        title="Kartenansicht"
        class="hidden md:block"
      >
        <LottieIcon
          src="/icons/map.json"
          trigger="hover"
          style="width: 32px; height: 32px"
        >
          <img
            src="/icons/map.svg"
            alt=""
          />
        </LottieIcon>
      </NuxtLink>
      <FavoritesList />
    </div>
    <HamburgerMenu @click="() => showSiteMenu(true)" />
    <div
      class="fixed top-0 left-0 z-40 flex flex-col items-center w-full h-screen px-4 pt-4 pb-16 transition-opacity duration-300 bg-background"
      :class="{
        'opacity-0': siteMenuVisibility.closing,
        'opacity-100':
          siteMenuVisibility.visible && !siteMenuVisibility.closing,
        invisible: !siteMenuVisibility.visible,
      }"
    >
      <div class="flex items-center ml-auto">
        <div
          class="relative w-8 h-12 cursor-pointer"
          @click="() => showSiteMenu(false)"
        >
          <span
            class="absolute top-0 h-0.5 w-8 translate-y-6 rotate-45 rounded-full bg-accent"
          ></span>
          <span
            class="absolute top-0 h-0.5 w-8 translate-y-6 -rotate-45 rounded-full bg-accent"
          ></span>
        </div>
      </div>
      <div
        ref="iconsContainer"
        class="flex flex-col gap-4 my-auto text-right"
      >
        <NuxtLink
          v-for="link in [
            { name: 'Home', path: '/', icon: 'home' },
            { name: 'Alle Wohnungen', path: '/overview', icon: 'overview' },
            { name: 'Karte', path: '/map', icon: 'map' },
          ]"
          :key="link.path"
          :to="link.path"
          class="flex items-center justify-end gap-4 text-xl font-medium"
          :class="{
            'text-accent': route.path === link.path,
            'text-main': route.path !== link.path,
          }"
          @click="handleLinkClick"
        >
          {{ link.name }}
          <LottieIcon
            :src="`/icons/${link.icon}.json`"
            style="width: 42px; height: 42px"
            class="current-color"
          >
            <img
              :src="`/icons/${link.icon}.svg`"
              alt=""
            />
          </LottieIcon>
        </NuxtLink>
      </div>
    </div>
  </nav>
</template>
