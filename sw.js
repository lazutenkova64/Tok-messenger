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
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            for (const client of clientList) {
                if (client.url && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow('./');
            }
        })
    );
});
