// Имя кеша
const CACHE_NAME = 'math-kz-v2.1';
const OFFLINE_URL = 'offline.html';

// Файлы для кеширования при установке
const STATIC_CACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/offline.html', // Страница для оффлайн-режима
  // Иконки
  '/icon-192.png',
  '/icon-512.png',
  // Шрифты (если используете)
  'https://fonts.googleapis.com/css2?family=Segoe+UI:wght@300;400;600;700&display=swap'
];

// Установка Service Worker
self.addEventListener('install', event => {
  console.log('🛠️ Service Worker: Установка...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('📦 Кеширование основных файлов...');
        return cache.addAll(STATIC_CACHE_URLS);
      })
      .then(() => {
        console.log('✅ Service Worker установлен');
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('❌ Ошибка при кешировании:', error);
      })
  );
});

// Активация Service Worker
self.addEventListener('activate', event => {
  console.log('🔄 Service Worker: Активация...');
  
  // Удаляем старые кеши
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('🗑️ Удаляем старый кеш:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
    .then(() => {
      console.log('✅ Service Worker активирован');
      return self.clients.claim();
    })
  );
});

// Перехват сетевых запросов
self.addEventListener('fetch', event => {
  // Пропускаем POST запросы и запросы не HTTP/HTTPS
  if (event.request.method !== 'GET') {
    return;
  }
  
  // Для API запросов используем стратегию "Network First"
  if (event.request.url.includes('/api/')) {
    event.respondWith(networkFirstStrategy(event.request));
    return;
  }
  
  // Для статических ресурсов используем стратегию "Cache First"
  event.respondWith(cacheFirstStrategy(event.request));
});

// Стратегия "Cache First" для статических ресурсов
function cacheFirstStrategy(request) {
  return caches.match(request)
    .then(cachedResponse => {
      if (cachedResponse) {
        console.log('📄 Из кеша:', request.url);
        return cachedResponse;
      }
      
      // Если нет в кеше, загружаем из сети
      return fetch(request)
        .then(networkResponse => {
          // Проверяем валидность ответа
          if (!networkResponse || networkResponse.status !== 200 || 
              networkResponse.type !== 'basic') {
            return networkResponse;
          }
          
          // Клонируем ответ для кеширования
          const responseToCache = networkResponse.clone();
          
          // Кешируем новый ресурс
          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(request, responseToCache);
              console.log('💾 Сохранено в кеш:', request.url);
            });
          
          return networkResponse;
        })
        .catch(error => {
          console.log('🌐 Оффлайн:', request.url);
          
          // Если запрос к HTML странице и мы оффлайн
          if (request.headers.get('Accept').includes('text/html')) {
            return caches.match(OFFLINE_URL);
          }
          
          // Для других типов запросов
          return new Response('Нет подключения к интернету. Вы в оффлайн-режиме.', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: new Headers({
              'Content-Type': 'text/plain'
            })
          });
        });
    });
}

// Стратегия "Network First" для API запросов
function networkFirstStrategy(request) {
  return fetch(request)
    .then(networkResponse => {
      // Клонируем для кеширования
      const responseToCache = networkResponse.clone();
      
      caches.open(CACHE_NAME)
        .then(cache => {
          cache.put(request, responseToCache);
        });
      
      return networkResponse;
    })
    .catch(error => {
      // Если сеть недоступна, пробуем из кеша
      return caches.match(request)
        .then(cachedResponse => {
          if (cachedResponse) {
            console.log('📄 API из кеша (оффлайн):', request.url);
            return cachedResponse;
          }
          
          // Если нет в кеше, возвращаем ошибку
          throw error;
        });
    });
}

// Фоновая синхронизация (если поддерживается)
self.addEventListener('sync', event => {
  if (event.tag === 'sync-results') {
    console.log('🔄 Фоновая синхронизация результатов...');
    event.waitUntil(syncResults());
  }
});

// Периодическая синхронизация (раз в день)
self.addEventListener('periodicsync', event => {
  if (event.tag === 'update-content') {
    console.log('🔄 Периодическая синхронизация контента...');
    event.waitUntil(updateContent());
  }
});

// Функция синхронизации результатов
function syncResults() {
  // Здесь можно добавить логику синхронизации с сервером
  return Promise.resolve().then(() => {
    console.log('✅ Результаты синхронизированы');
  });
}

// Функция обновления контента
function updateContent() {
  return Promise.resolve().then(() => {
    console.log('✅ Контент обновлен');
  });
}

// Push уведомления
self.addEventListener('push', event => {
  console.log('📨 Push уведомление получено');
  
  if (!event.data) {
    return;
  }
  
  const data = event.data.json();
  const title = data.title || 'Математика РК';
  const options = {
    body: data.body || 'У вас есть новые задачи для решения!',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [200, 100, 200],
    data: {
      url: data.url || '/'
    }
  };
  
  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Обработка клика по уведомлению
self.addEventListener('notificationclick', event => {
  console.log('👆 Нажато на уведомление');
  
  event.notification.close();
  
  // Открываем страницу приложения
  event.waitUntil(
    clients.matchAll({ type: 'window' })
      .then(clientList => {
        // Если уже открыто окно, фокусируемся на нем
        for (const client of clientList) {
          if (client.url === '/' && 'focus' in client) {
            return client.focus();
          }
        }
        
        // Иначе открываем новое окно
        if (clients.openWindow) {
          return clients.openWindow(event.notification.data.url || '/');
        }
      })
  );
});