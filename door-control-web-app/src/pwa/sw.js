// This is the service worker that will handle all navigation requests
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  // Check if the request URL starts with the app URL
  if (url.origin === appUrl || url.pathname.startsWith(appUrl)) {
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          // If fetch fails, return the cached version or fallback to index.html
          return caches.match(event.request)
            .then(response => response || caches.match('/index.html'));
        })
    );
  }
});
