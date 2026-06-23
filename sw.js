// Alívio Diário — Service Worker
// Estratégia: o documento HTML (a página em si) sempre busca a versão mais
// nova da rede primeiro, e só usa o cache se estiver offline. Isso evita o
// app ficar "preso" numa versão antiga depois de uma atualização.
// Os demais arquivos do shell usam cache-first com atualização em segundo
// plano (mais rápido, e raramente mudam).
//
// IMPORTANTE: sempre que o conteúdo do app mudar, troque o número da versão
// abaixo (v2 -> v3 -> ...). Isso é o que faz o navegador notar que o
// Service Worker mudou e substituir o cache antigo.

const CACHE_NAME = 'alivio-diario-v3';
const SHELL_FILES = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const isDocument = event.request.mode === 'navigate' || event.request.destination === 'document';

  if (isDocument) {
    // Network-first: sempre tenta buscar a versão atual primeiro.
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() =>
          caches.match(event.request).then((cached) => cached || caches.match('./index.html'))
        )
    );
    return;
  }

  // Demais arquivos (ícones, manifest): cache-first, com atualização
  // silenciosa do cache em segundo plano.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkFetch = fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached);
      return cached || networkFetch;
    })
  );
});

