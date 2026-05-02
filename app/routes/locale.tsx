import { redirect } from "react-router";
import { isLocale } from "~/i18n/locale";
import { setLocaleCookie } from "~/i18n/locale.server";
import type { Route } from "./+types/locale";

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const value = String(formData.get("locale") ?? "");
  if (!isLocale(value)) {
    throw new Response("Invalid locale", { status: 400 });
  }
  const referer = request.headers.get("Referer");
  const target = safeRedirectTarget(referer, request.url);
  return redirect(target, {
    headers: { "Set-Cookie": setLocaleCookie(value) },
  });
}

export async function loader() {
  throw redirect("/");
}

function safeRedirectTarget(
  referer: string | null,
  requestUrl: string,
): string {
  if (!referer) return "/";
  try {
    const refUrl = new URL(referer);
    const reqUrl = new URL(requestUrl);
    if (refUrl.origin !== reqUrl.origin) return "/";
    return refUrl.pathname + refUrl.search;
  } catch {
    return "/";
  }
}
