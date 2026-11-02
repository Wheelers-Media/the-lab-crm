// THE LAB CRM alerts (Web Push): shows what the server sends and opens the right
// screen when one is tapped. Loaded into the app's own service worker through
// workbox.importScripts (vite.config.ts), so one worker both caches the app and
// shows alerts. It must not be named sw.js: the build generates that file.
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "THE LAB CRM", {
      body: data.body || "",
      icon: "/appIcon/192.png",
      badge: "/appIcon/badge.png",
      // A newer alert about the same thing replaces the old one
      tag: data.tag || undefined,
      renotify: Boolean(data.tag),
      data: { url: data.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (windows) => {
      const open = windows.find((w) => w.url.startsWith(self.location.origin));
      if (open) {
        await open.focus();
        if ("navigate" in open) return open.navigate(target);
        return undefined;
      }
      return self.clients.openWindow(target);
    }),
  );
});
