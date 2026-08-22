/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core';
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';

/**
 * Service worker aplikacji.
 *
 * Piszemy go ręcznie zamiast korzystać z generatora workboxa (`generateSW`),
 * bo tamten zapisuje plik pośredni z bezwzględnymi importami z node_modules.
 * Ścieżka projektu zawiera apostrof ("Park'n'fly"), który rozrywa te stringi
 * i cały build się wywraca. Przy `injectManifest` ten plik bunduje Vite
 * własnym resolverem, więc żadna bezwzględna ścieżka nie trafia do źródła.
 *
 * Zachowanie odpowiada dotychczasowemu `registerType: 'autoUpdate'`:
 * nowa wersja przejmuje kontrolę od razu, bez pytania użytkownika.
 */

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};

self.skipWaiting();
clientsClaim();

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// Żądania do API nigdy nie idą z cache'u — odpowiedzi AI i dane kursantów
// muszą być świeże. Nawigacje spoza /api obsługuje precache z index.html.
const NAVIGATION_DENYLIST = /^\/api/;

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.origin === self.location.origin && NAVIGATION_DENYLIST.test(url.pathname)) {
    event.respondWith(fetch(event.request));
  }
});

export {};
