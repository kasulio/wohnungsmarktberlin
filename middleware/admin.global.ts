import { authClient } from "~/lib/auth-client";

export default defineNuxtRouteMiddleware(async (to) => {
  if (!to.path.startsWith("/admin")) {
    return;
  }

  const isLogin = to.path === "/admin/login";
  const { data: session } = await authClient.useSession(useFetch);

  if (!session.value && !isLogin) {
    return navigateTo({
      path: "/admin/login",
      query: { redirect: to.fullPath },
    });
  }

  if (session.value && isLogin) {
    const raw = to.query.redirect;
    const target =
      typeof raw === "string" && raw.startsWith("/") ? raw : "/admin/dashboard";
    return navigateTo(target);
  }
});
