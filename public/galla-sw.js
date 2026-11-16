// Apni Galli front-desk service worker: a push only wakes it; the Galla reads the real rows itself.
self.addEventListener("push", (e) => {
  e.waitUntil(
    self.registration.showNotification("Galla mein kuch naya hai", {
      body: "Nayi chit, booking ya order aaya hai. Kholke dekho.",
      tag: "galla-new",
      renotify: true,
      icon: "/icon.svg",
    }),
  );
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = new URL(self.registration.scope).pathname.replace(/\/$/, "") || "/studio";
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((cs) => {
      for (const c of cs) if (c.url.includes("/galla")) return c.focus();
      return self.clients.openWindow(url.includes("/galla") ? url : "/studio");
    }),
  );
});
