import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./purgeOversizedQueryCache";
import App from "./App.tsx";

// Tells the boot watchdog in index.html that the app's code did start
document.documentElement.setAttribute("data-boot", "started");

// After a new deploy, the service worker may replace its pre-cache while
// the page still holds old chunk references. A reload picks up the new
// HTML + new SW cache. A sessionStorage guard prevents infinite loops.
// See https://vite.dev/guide/build.html#load-error-handling
const CHUNK_RELOAD_KEY = "chunk-reload";
window.addEventListener("vite:preloadError", () => {
  if (!sessionStorage.getItem(CHUNK_RELOAD_KEY)) {
    sessionStorage.setItem(CHUNK_RELOAD_KEY, "1");
    window.location.reload();
  }
});
// A phone keeps the same tab session for days. Once the app has stayed up,
// the reload has done its job: re-arm the guard so the next deploy can
// recover the same way instead of being stuck behind this one.
window.addEventListener("load", () => {
  window.setTimeout(() => {
    try {
      sessionStorage.removeItem(CHUNK_RELOAD_KEY);
    } catch {
      // storage unavailable: nothing was stored either
    }
  }, 10_000);
});

// Supabase sends invite and password-reset links to the Site URL. When that
// is the app root instead of auth-callback.html, the tokens arrive in the
// hash ("#access_token=...&type=recovery") and the hash router would ignore
// them. Hand them to the auth-callback route, which opens "Choose your
// password". Runs before the Supabase client reads the URL.
const authHash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
const authType = authHash.get("type");
if (
  authHash.get("access_token") &&
  authHash.get("refresh_token") &&
  (authType === "recovery" || authType === "invite")
) {
  const params = new URLSearchParams({
    access_token: authHash.get("access_token")!,
    refresh_token: authHash.get("refresh_token")!,
    type: authType,
  });
  window.location.replace(
    `${window.location.pathname}#/auth-callback?${params}`,
  );
}

// Phones keep the CRM open for days. Check for a new version whenever the
// app comes back to the screen, and switch to it once the new service
// worker takes over, so a deploy shows up without closing the app.
// Not while someone is typing: then it waits until the app is reopened.
if ("serviceWorker" in navigator) {
  const hadController = Boolean(navigator.serviceWorker.controller);
  let updateReady = false;
  const isTyping = () =>
    document.activeElement instanceof HTMLInputElement ||
    document.activeElement instanceof HTMLTextAreaElement;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!hadController) return; // first install, already on the latest
    updateReady = true;
    if (!isTyping()) window.location.reload();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    if (updateReady) {
      window.location.reload();
      return;
    }
    navigator.serviceWorker
      .getRegistration()
      .then((registration) => registration?.update())
      .catch(() => undefined);
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
