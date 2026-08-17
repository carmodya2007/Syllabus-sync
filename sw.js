/*
  Syllabus Sync — service worker
  Caches the app shell (HTML/CSS/JS + pdf.js + mammoth.js) so the app itself opens offline.
  This does NOT sync or back up student data — all real data lives in
  window.storage / localStorage on-device, untouched by this file.
*/

const CACHE_VERSION = "syllabus-sync-v6"; // bumped: HARD BLOCKER FIX — "+ Add class" crashed (null DOM ref) and never rendered the upload card
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png",
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js"
];

self.addEventListener("install", (event)=>{
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache)=>{
      // addAll fails as a whole if any single request fails (e.g. offline during
      // first install, or a CDN hiccup) — cache what we can individually instead
      // so a single miss doesn't block the rest of the shell from being cached.
      return Promise.all(
        APP_SHELL.map((url)=>
          cache.add(url).catch((err)=> console.warn("Syllabus Sync SW: couldn't precache", url, err))
        )
      );
    }).then(()=> self.skipWaiting())
  );
});

self.addEventListener("activate", (event)=>{
  event.waitUntil(
    caches.keys().then((keys)=>
      Promise.all(
        keys.filter((k)=> k !== CACHE_VERSION).map((k)=> caches.delete(k))
      )
    ).then(()=> self.clients.claim())
  );
});

self.addEventListener("fetch", (event)=>{
  const req = event.request;
  if(req.method !== "GET") return;

  event.respondWith(
    caches.match(req).then((cached)=>{
      const networkFetch = fetch(req).then((res)=>{
        // Keep the cached shell fresh when online, without blocking the response.
        if(res && res.status === 200 && (res.type === "basic" || res.type === "cors")){
          const resClone = res.clone();
          caches.open(CACHE_VERSION).then((cache)=> cache.put(req, resClone));
        }
        return res;
      }).catch(()=> cached); // offline: fall back to cache

      // Cache-first for instant, reliable offline app loads; network runs in
      // the background to keep the cache current for next time.
      return cached || networkFetch;
    })
  );
});
