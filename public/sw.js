// Service Worker de BÖDEN — maneja las notificaciones push.
const VERSION = 'boden-v1';

self.addEventListener('install', (e) => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

// Llega una notificación push del servidor
self.addEventListener('push', (event) => {
  let data = { title: 'BÖDEN', body: 'Nueva alerta de mantenimiento', url: '/' };
  try { if (event.data) data = { ...data, ...event.data.json() }; } catch (e) {}
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      vibrate: [120, 60, 120],
      tag: data.tag || 'boden-alerta',
      data: { url: data.url || '/' },
    })
  );
});

// El usuario toca la notificación -> abrir/enfocar la app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) { if ('focus' in c) return c.focus(); }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
