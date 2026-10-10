/**
 * Tekst fiszki bywa zapisany jako HTML: edytor kart (`RichTextInput`) oddaje `innerHTML`, więc
 * pogrubienie daje `<b>`, a `&` zapisuje się jako `&amp;`. Widoki, które chcą pokazać taki tekst
 * jako zwykły tekst (bez `dangerouslySetInnerHTML`), przepuszczają go przez tę funkcję.
 *
 * `DOMParser` zamiast `innerHTML` na oderwanym elemencie: parsowanie w osobnym dokumencie nie
 * wykonuje skryptów ani nie ładuje obrazków, więc `<img src=x onerror=…>` nic nie uruchomi.
 */
export function htmlToPlainText(html: string | null | undefined): string {
  const source = html ?? '';
  if (!source || !/[<&]/.test(source)) return source;
  if (typeof DOMParser !== 'undefined') {
    const doc = new DOMParser().parseFromString(source, 'text/html');
    return doc.body.textContent ?? '';
  }
  return source
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}
