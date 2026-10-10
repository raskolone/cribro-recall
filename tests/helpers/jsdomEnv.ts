/**
 * Środowisko jsdom dla testów komponentów. Importuj jako PIERWSZY import w pliku testu:
 * `import` jest hoistowany nad zwykłe instrukcje, więc globalne `window`/`document` ustawiane
 * w ciele pliku powstawałyby już PO załadowaniu react-dom — a ten sprawdza obsługę zdarzeń
 * (np. `input` dla pól tekstowych) w chwili importu. Kolejność importów jest gwarantowana.
 */
import { JSDOM } from 'jsdom';

export const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
(globalThis as any).window = dom.window;
(globalThis as any).document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
(globalThis as any).HTMLElement = dom.window.HTMLElement;
(globalThis as any).customElements = dom.window.customElements;
(globalThis as any).getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
