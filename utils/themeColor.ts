/**
 * Kolor paska przeglądarki / systemu (`<meta name="theme-color">`) zgodny z motywem aplikacji.
 * Wartości = `--bg` z design/theme/tokens.css (ciemny / jasny); skrypt w index.html ma te same.
 */
export const THEME_COLORS = { dark: '#09101c', light: '#eaf1f8' } as const;

export function applyThemeColor(theme: 'light' | 'dark', doc: Document = document): void {
  let meta = doc.querySelector<HTMLMetaElement>('meta[name="theme-color"]:not([media])');
  if (!meta) {
    meta = doc.createElement('meta');
    meta.name = 'theme-color';
    doc.head.appendChild(meta);
  }
  meta.content = THEME_COLORS[theme];
}
