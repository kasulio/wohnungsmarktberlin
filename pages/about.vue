<script setup lang="ts">
const { $client } = useNuxtApp();
const propertyManagements = await $client.propertyManagement.getAll.useQuery();

const initialStats = {
  activeFlatCount: 0,
  allFlatsCount: 0,
};

const stats = propertyManagements.data.value?.reduce(
  (acc, propertyManagement) => {
    acc.allFlatsCount += propertyManagement.flats.length;
    acc.activeFlatCount += propertyManagement.flats.filter(
      (flat) => flat.isActive,
    ).length;

    return acc;
  },
  initialStats,
);
const { activeFlatCount, allFlatsCount } = stats || initialStats;
</script>

<template>
  <div>
    <h1 class="py-4 text-xl">Über dieses Projekt</h1>
    <p class="max-w-2xl">
      Unsere Bots
      <NuxtLink
        to="https://de.wikipedia.org/wiki/Screen_Scraping"
        target="_blank"
        class="cursor-help"
      >
        <!-- eslint-disable-next-line vue/multiline-html-element-content-newline -->
        scrapen</NuxtLink
      >
      die Webseiten der Berliner Wohnungsverwaltungen und speichern die
      Wohnungen einheitlich in einer Datenbank ab.
    </p>
    <h2 class="pb-2 pt-6 text-l font-semibold">Daten, Fakten, Statistiken</h2>
    <p class="max-w-2xl">
      Hier ein paar Infos was alles so im Hintergrund passiert:
    </p>
    <div class="flex flex-wrap gap-4">
      <div class="flex-1 rounded-md border border-dashed border-black p-4">
        <h3 class="pb-2 text-m font-semibold">Eingebundene Hausverwaltungen</h3>
        <ul class="ml-4 list-disc">
          <li
            v-for="propertyManagement in propertyManagements.data.value"
            :key="propertyManagement.slug"
          >
            <StyledNuxtLink
              v-if="propertyManagement.website"
              :to="propertyManagement.website"
              target="_blank"
            >
              {{ propertyManagement.name }}
            </StyledNuxtLink>
            <span v-else>{{ propertyManagement.name }}</span>
          </li>
        </ul>
      </div>

      <div class="flex-1 rounded-md border border-dashed border-black p-4">
        <h3 class="pb-2 text-m font-semibold">Wohnungen</h3>
        <table class="w-full">
          <tbody>
            <tr>
              <td class="text-nowrap">Aktive Wohnungen:</td>
              <td>{{ activeFlatCount }}</td>
            </tr>
            <tr>
              <td class="text-nowrap">Gesamt seit Januar '24:</td>
              <td>{{ allFlatsCount }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- <div class="flex-1 rounded-md border border-dashed border-black p-4">
        <h3 class="pb-2 text-m font-semibold">User</h3>
        <p>105 Besuche seit Livegang</p>
      </div> -->
    </div>

    <p></p>
    <h2 class="pb-2 pt-6 text-l font-semibold">Ich will auch</h2>
    <p class="max-w-2xl">
      Wenn du auch an diesem Projekt teilhaben willst, und helfen Berlin's
      Wohnungen leichter auffindbar zu machen, klick den Button ;&#41;
    </p>
    <div
      class="bg-gradient rota inline-flex rounded-full bg-gradient-to-b from-primary to-accent p-[3px] hover:from-accent hover:to-accent"
    >
      <NuxtLink
        to="https://github.com/lufrey/hausverwaltungs-finder"
        target="_blank"
        class="contribute rounded-full bg-white px-5 py-2"
      >
        <span>Mitwirken</span>
        <img
          src="/github-mark.svg"
          alt="Klicke um auf GitHub zu diesem Projekt beizutragen"
          class="github_logo ml-2 inline w-6"
        />
      </NuxtLink>
    </div>
  </div>
</template>

<style scoped>
/* a {
  text-decoration: underline;
} */
p {
  margin-bottom: 1rem;
  margin-top: 0.5rem;
}
</style>
