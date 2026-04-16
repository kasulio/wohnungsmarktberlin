<script setup lang="ts">
import { authClient } from "~/lib/auth-client";

useHead({ title: "Anmeldung" });

const route = useRoute();
const email = ref("");
const password = ref("");
const errorMessage = ref<string | null>(null);
const pending = ref(false);

const submit = async () => {
  errorMessage.value = null;
  pending.value = true;
  const addr = email.value.trim();
  const pw = password.value;
  try {
    const result = await authClient.signIn.email({
      email: addr,
      password: pw,
      callbackURL:
        typeof route.query.redirect === "string"
          ? route.query.redirect
          : "/admin/dashboard",
    });
    if (result.error) {
      errorMessage.value =
        result.error.message ??
        "Anmeldung fehlgeschlagen. Bitte erneut versuchen.";
      return;
    }
  } finally {
    pending.value = false;
  }
};
</script>

<template>
  <div class="mx-auto flex max-w-md flex-col gap-8 py-12">
    <div class="rounded-3xl border border-black bg-background p-8 shadow-sm">
      <h1 class="text-2xl font-semibold">Admin</h1>
      <p class="text-sm mt-2 text-neutral-600">Mit E-Mail anmelden.</p>
      <form
        class="mt-6 flex flex-col gap-4"
        @submit.prevent="submit"
      >
        <label class="text-sm flex flex-col gap-1 font-medium">
          E-Mail
          <input
            v-model="email"
            autocomplete="username"
            class="rounded-xl border border-black px-3 py-2 font-normal outline-none ring-0 focus:border-black"
            required
            type="email"
          />
        </label>
        <label class="text-sm flex flex-col gap-1 font-medium">
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
          class="text-sm rounded-full bg-black px-5 py-3 font-medium text-white disabled:opacity-50"
          type="submit"
          :disabled="pending"
        >
          {{ pending ? "Wird angemeldet…" : "Anmelden" }}
        </button>
      </form>
    </div>
  </div>
</template>
