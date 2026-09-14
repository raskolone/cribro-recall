/**
 * Obrazy wklejane do notatnika.
 *
 * ══ DLACZEGO DATA URI, A NIE FIREBASE STORAGE ══
 *
 * W tym projekcie Firebase Storage NIE JEST ZAŁOŻONY (patrz nagłówek
 * `storage.rules`) — nie ma kubełka, do którego dałoby się wgrać plik.
 * Obraz musi więc zamieszkać w treści dokumentu, a treść dokumentu ma twardy
 * sufit 1 MiB narzucony przez Firestore.
 *
 * Z tego wynika wszystko, co robi ten plik: zrzut ekranu z retiny potrafi mieć
 * 3-5 MB i wklejony wprost NIE ZAPISAŁBY SIĘ w ogóle — notatnik przestałby się
 * zapisywać w środku lekcji. Dlatego każdy obraz jest najpierw zmniejszany do
 * szerokości ekranu dokumentu i przekodowywany, a dopiero potem wstawiany.
 *
 * ══ DLACZEGO WEBP ══
 *
 * Zrzuty ekranu to płaskie kolory i tekst — JPEG rozmywa na nich litery, PNG
 * nie kompresuje ich prawie wcale. WebP przy jakości 0,82 daje czytelny tekst
 * przy kilkukrotnie mniejszym pliku. Gdyby przeglądarka go nie umiała
 * (`toDataURL` zwraca wtedy PNG), kod to wykryje i spadnie na JPEG.
 */

/** Najszersza krawędź obrazu po zmniejszeniu. Kartka ma ~820 px treści. */
const MAX_EDGE_PX = 1400;

/** Jakość przekodowania. Wyżej nie widać różnicy, niżej rozmywa się tekst. */
const QUALITY = 0.82;

export interface PreparedImage {
  dataUrl: string;
  /** Szerokość, z jaką obraz wchodzi do dokumentu (px na kartce). */
  width: number;
  bytes: number;
}

const readAsDataUrl = (file: File | Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Nie udało się odczytać pliku.'));
    reader.readAsDataURL(file);
  });

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Nie udało się wczytać obrazu.'));
    image.src = src;
  });

/** Ile bajtów zajmie ten ciąg po zapisaniu. */
export const byteLength = (value: string): number =>
  typeof TextEncoder === 'undefined' ? value.length : new TextEncoder().encode(value).length;

/**
 * Zmniejsza i przekodowuje obraz tak, żeby zmieścił się w dokumencie.
 *
 * `maxWidthOnPage` to szerokość kolumny tekstu — obraz wchodzi co najwyżej na
 * całą szerokość kartki, nigdy szerszy, bo poza nią i tak byłby przycięty.
 */
export const prepareImageForScratchpad = async (
  file: File | Blob,
  maxWidthOnPage: number
): Promise<PreparedImage> => {
  const original = await readAsDataUrl(file);
  const image = await loadImage(original);

  const scale = Math.min(1, MAX_EDGE_PX / Math.max(image.naturalWidth, image.naturalHeight));
  const targetW = Math.max(1, Math.round(image.naturalWidth * scale));
  const targetH = Math.max(1, Math.round(image.naturalHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const context = canvas.getContext('2d');
  if (!context) {
    // Bez kanwy nie ma jak zmniejszyć — oddajemy oryginał i niech limit
    // rozmiaru zadecyduje wyżej. Lepsze to niż ciche zgubienie wklejki.
    return { dataUrl: original, width: Math.min(targetW, maxWidthOnPage), bytes: byteLength(original) };
  }
  context.drawImage(image, 0, 0, targetW, targetH);

  let dataUrl = canvas.toDataURL('image/webp', QUALITY);
  // Przeglądarka bez WebP zwraca PNG mimo poproszenia o WebP — wtedy JPEG.
  if (!dataUrl.startsWith('data:image/webp')) {
    dataUrl = canvas.toDataURL('image/jpeg', QUALITY);
  }

  return {
    dataUrl,
    width: Math.min(targetW, maxWidthOnPage),
    bytes: byteLength(dataUrl),
  };
};

/** Pierwszy obraz ze schowka albo `null`, gdy wklejono zwykły tekst. */
export const imageFromClipboard = (data: DataTransfer | null): File | null => {
  if (!data) return null;
  const items = Array.from(data.items || []);
  const imageItem = items.find(item => item.kind === 'file' && item.type.startsWith('image/'));
  return imageItem ? imageItem.getAsFile() : null;
};
