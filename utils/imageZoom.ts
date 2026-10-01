/** Zoom obrazka w notatniku: podgląd ma 150% wymiarów, jakie obraz ma na kartce. */
export const IMAGE_ZOOM_FACTOR = 1.5;

/**
 * Szerokość obrazu na kartce w pikselach. Dla załącznika (obraz ukryty,
 * `display:none`) pomiar daje 0, więc schodzimy do szerokości z atrybutu
 * `style`, a na końcu do naturalnej.
 */
export const measureImageBaseWidth = (img: HTMLImageElement): number => {
  const rendered = img.getBoundingClientRect().width;
  if (rendered > 0) return rendered;
  const styled = parseFloat(img.style.width);
  if (styled > 0) return styled;
  return img.naturalWidth || 0;
};

/** Szerokość podglądu po zoomie; 0 (nieznany rozmiar) oznacza „nie wymuszaj". */
export const zoomedImageWidth = (baseWidth: number): number =>
  baseWidth > 0 ? Math.round(baseWidth * IMAGE_ZOOM_FACTOR) : 0;
