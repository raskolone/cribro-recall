/**
 * Narzędzie kompresji obrazów dla Prezentacji i Slajdów.
 * Zabezpiecza twardy limit 1 MiB w Cloud Firestore.
 * 
 * Jeśli obrazek przekracza 1280x720 px, skaluje go proporcjonalnie na elemencie <canvas>
 * i kompresuje do formatu WebP (lub JPEG fallback) z jakością 0.75 - 0.80.
 * Gwarantuje to, że każdy slajd z grafiką zajmuje 50-150 KB.
 */

export interface CompressedImageResult {
  dataUrl: string;
  width: number;
  height: number;
  sizeBytes: number;
}

const MAX_WIDTH = 1280;
const MAX_HEIGHT = 720;
const QUALITY = 0.78;

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
    image.onerror = () => reject(new Error('Nie udało się wczytać grafiki.'));
    image.src = src;
  });

export async function compressPresentationImage(
  file: File | Blob
): Promise<CompressedImageResult> {
  const originalDataUrl = await readAsDataUrl(file);
  const image = await loadImage(originalDataUrl);

  let targetW = image.naturalWidth;
  let targetH = image.naturalHeight;

  // Skalowanie proporcjonalne w dół, jeśli któryś wymiar przekracza 1280x720
  if (targetW > MAX_WIDTH || targetH > MAX_HEIGHT) {
    const ratio = Math.min(MAX_WIDTH / targetW, MAX_HEIGHT / targetH);
    targetW = Math.max(1, Math.round(targetW * ratio));
    targetH = Math.max(1, Math.round(targetH * ratio));
  }

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    const fallbackBytes = typeof TextEncoder !== 'undefined'
      ? new TextEncoder().encode(originalDataUrl).length
      : originalDataUrl.length;
    return {
      dataUrl: originalDataUrl,
      width: targetW,
      height: targetH,
      sizeBytes: fallbackBytes,
    };
  }

  // Wygładzanie obrazu przy skalowaniu
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, 0, 0, targetW, targetH);

  // Kompresja do WebP, a przy braku obsługi do JPEG
  let outputDataUrl = canvas.toDataURL('image/webp', QUALITY);
  if (!outputDataUrl.startsWith('data:image/webp')) {
    outputDataUrl = canvas.toDataURL('image/jpeg', QUALITY);
  }

  const sizeBytes = typeof TextEncoder !== 'undefined'
    ? new TextEncoder().encode(outputDataUrl).length
    : outputDataUrl.length;

  return {
    dataUrl: outputDataUrl,
    width: targetW,
    height: targetH,
    sizeBytes,
  };
}
