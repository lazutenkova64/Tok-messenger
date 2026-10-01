// Service Worker для Tok Web
// Нужен для показа уведомлений на Android/iOS

self.addEventListener('install', (event) => {
    console.log('SW installed');
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    console.log('SW activated');
    event.waitUntil(clients.claim());
});

// Показ уведомлений приходит из основного потока через postMessage
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
        const { title, options } = event.data;
        event.waitUntil(
            self.registration.showNotification(title, options)
        );
    }
});

// Клик по уведомлению — фокусируем вкладку или открываем новую
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const chatId = event.notification.data && event.notification.data.chatId;
    const urlToOpen = chatId ? ('./#' + chatId) : './';
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            for (const client of clientList) {
                if (client.url && 'focus' in client) {
                    client.focus();
                    if (client.navigate) client.navigate(urlToOpen);
                    return;
                }
            }
            if (clients.openWindow) return clients.openWindow(urlToOpen);
        })
    );
});

// Web Push поддержка (на будущее)
self.addEventListener('push', (event) => {
    if (!event.data) return;
    let payload = {};
    try { payload = event.data.json(); } catch (e) { payload = { title: 'Tok Web', body: event.data.text() }; }
    const title = payload.title || 'Новое сообщение';
    const options = {
        body: payload.body || '',
        icon: payload.icon || '/icon-192.png',
        badge: '/icon-192.png',
        tag: payload.tag || 'tok-message',
        data: { chatId: payload.chatId || null }
    };
    event.waitUntil(self.registration.showNotification(title, options));
});
