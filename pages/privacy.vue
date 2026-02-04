<script setup lang="ts">
const consent = useConsent();
</script>

<template>
  <div class="max-w-2xl">
    <h1 class="py-4 text-xl">Datenschutzerklärung</h1>
    <p>
      Unsere Webseite erhebt keine personenbezogenen Daten, wir haben bemüht den
      Besuch so anonym wie möglich zu gestalten. Dennoch müssen wir über die
      Nutzung von IP-Adresse und Cookies informieren.
    </p>
    <h2 class="pb-2 pt-6 text-l font-semibold">
      Erhebung, Verarbeitung und Nutzung personenbezogener Daten
    </h2>
    <p>
      User können unsere Webseite nutzen, ohne ihre Identität preiszugeben. An
      keiner Stelle wird von Usern die Eingabe persönlicher Daten verlangt,
      daher werden auf unserer Webseite zu keinem Zeitpunkt personenbezogene
      Daten im Sinne der Datenschutz-Grundverordnung (DSGVO) erhoben,
      verarbeitet oder genutzt.
    </p>
    <p>
      Unsere Webseite wird auf Servern von
      <StyledNuxtLink
        to="https://www.netcup.com/de/kontakt/datenschutzerklaerung"
        target="_blank"
      >
        Netcup
      </StyledNuxtLink>
      gehostet, die sich innerhalb der Europäischen Union befinden. Zudem nutzen
      wir
      <StyledNuxtLink
        to="https://www.cloudflare.com/de-de/privacypolicy/"
        target="_blank"
      >
        Cloudflare
      </StyledNuxtLink>
      als DNS-Dienst und Content Delivery Network (CDN). Obwohl durch diese
      Services keine personenbezogenen Daten unserer Webseitenbesucher direkt
      durch uns erhoben werden, können diese Dienste typische Informationen wie
      <strong>IP-Adresse, Browser-Typ und Ähnliches</strong> erfassen. Für
      Details verweisen wir oben auf die Datenschutzerklärungen dieser Anbieter.
    </p>
    <h2 class="pb-2 pt-6 text-l font-semibold">Verwendung von Google Maps</h2>
    <p>
      Diese Webseite nutzt die Google Maps API, um geographische Informationen
      visuell darzustellen. Die Nutzung von Google Maps erfolgt im Interesse
      einer ansprechenden Darstellung unserer Online-Angebote und an leicht
      auffindbaren Orten der von uns auf der Webseite angegebenen Adressen. Dies
      stellt ein berechtigtes Interesse im Sinne von
      <StyledNuxtLink to="https://dsgvo-gesetz.de/art-6-dsgvo/">
        Art.6 Abs.1 lit. f DSGVO
      </StyledNuxtLink>
      dar. Die Nutzung von Google Maps erfolgt erst nach ausdrücklicher
      Einwilligung durch den Nutzer.
    </p>

    <p>
      Nach Einwilligung kann Google unter Daten über die Nutzung der
      Maps-Funktionen, den Standort und mehr erfassen, übertragen und nutzen.
      Mit Zustimmung zur Nutzung der Google Maps Dienste werden diese Daten an
      folgende Domains übertragen:
    </p>
    <ul class="ml-4 list-disc">
      <li>google.com</li>
      <li>fonts.gstatic.com</li>
      <li>maps.googleapis.com</li>
      <li>maps.gstatic.com</li>
    </ul>

    <h3 class="pb-2 pt-6 text-m font-semibold">Widerrufung der Einwilligung</h3>
    <div v-if="!consent.state?.value?.maps">
      Du hast aktuell keine Einwilligung erteilt. Die Karte wird nicht
      angezeigt. Es gibt also auch nichts zu widerrufen.
    </div>
    <div v-else>
      <p>
        Mit folgendem Button kannst du deine Zustimmung zu den Google Diensten
        widerrufen. Die Karte wird danach nicht mehr ausgespielt.
      </p>
      <SimpleButton @click="consent.set({ maps: false })">
        Einwilligung widerrufen
      </SimpleButton>
    </div>
    <h2 class="pb-2 pt-6 text-l font-semibold">
      Kontakt zum Datenschutzbeauftragten
    </h2>
    <p>
      Sollten Sie Fragen zum Datenschutz haben, schreiben Sie uns bitte eine
      E-Mail an Malie.Bertram[at]Student.htw-berlin.de
    </p>
  </div>
</template>

<style scoped>
p {
  margin-bottom: 1rem;
  margin-top: 0.5rem;
}
</style>
