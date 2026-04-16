<script setup lang="ts">
import { authClient } from "~/lib/auth-client";

useHead({ title: "Admin · Anmeldung" });

const route = useRoute();
const identifier = ref("");
const password = ref("");
const errorMessage = ref<string | null>(null);
const pending = ref(false);

const redirectTarget = computed(() => {
  const raw = route.query.redirect;
  return typeof raw === "string" && raw.startsWith("/")
    ? raw
    : "/admin/dashboard";
});

const submit = async () => {
  errorMessage.value = null;
  pending.value = true;
  const id = identifier.value.trim();
  const pw = password.value;
  try {
    const result = id.includes("@")
      ? await authClient.signIn.email({ email: id, password: pw })
      : await authClient.signIn.username({ username: id, password: pw });
    if (result.error) {
      errorMessage.value =
        result.error.message ?? "Anmeldung fehlgeschlagen. Bitte erneut versuchen.";
      return;
    }
    await navigateTo(redirectTarget.value);
  } finally {
    pending.value = false;
  }
};
</script>

<template>
  <div class="mx-auto flex max-w-md flex-col gap-8 py-12">
    <div class="rounded-3xl border border-black bg-background p-8 shadow-sm">
      <h1 class="text-2xl font-semibold">Admin</h1>
      <p class="mt-2 text-sm text-neutral-600">
        Mit E-Mail oder Benutzername anmelden.
      </p>
      <form class="mt-6 flex flex-col gap-4" @submit.prevent="submit">
        <label class="flex flex-col gap-1 text-sm font-medium">
          E-Mail oder Benutzername
          <input
            v-model="identifier"
            autocomplete="username"
            class="rounded-xl border border-black px-3 py-2 font-normal outline-none ring-0 focus:border-black"
            required
            type="text"
          />
        </label>
        <label class="flex flex-col gap-1 text-sm font-medium">
          Passwort
          <input
            v-model="password"
            autocomplete="current-password"
            class="rounded-xl border border-black px-3 py-2 font-normal outline-none ring-0 focus:border-black"
            required
            type="password"
          />
        </label>
        <p
          v-if="errorMessage"
          class="text-sm text-red-600"
          role="alert"
        >
          {{ errorMessage }}
        </p>
        <button
          class="rounded-full bg-black px-5 py-3 text-sm font-medium text-white disabled:opacity-50"
          type="submit"
          :disabled="pending"
        >
          {{ pending ? "Wird angemeldet…" : "Anmelden" }}
        </button>
      </form>
    </div>
  </div>
</template>
