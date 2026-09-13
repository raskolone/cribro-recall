import { useEffect, useState } from 'react';

/**
 * Czy warunek CSS jest spełniony — na żywo.
 *
 * ══ PO CO TO, KIEDY JEST TAILWIND ══
 *
 * Klasy `md:` wystarczają, dopóki różnica między telefonem a komputerem
 * dotyczy WYGLĄDU. Nie wystarczają, gdy dotyczy tego, CO SIĘ RENDERUJE:
 * układ tabelaryczny i układ kafelkowy to dwa różne drzewa elementów, więc
 * „ukryj jedno, pokaż drugie" znaczyłoby zbudować oba i jeden wyrzucić.
 * Przy pięćdziesięciu pracach domowych to pięćdziesiąt niepotrzebnych
 * wierszy w drzewie na każdym telefonie.
 *
 * ══ DLACZEGO STAN STARTOWY JEST „NIE" ══
 *
 * Pierwszy przebieg renderowania dzieje się bez okna przy renderowaniu po
 * stronie serwera i w testach. Zaczynamy więc od `false` i poprawiamy po
 * zamontowaniu — jedno dodatkowe przemalowanie jest tanie, a sięgnięcie po
 * `window` w ciele komponentu wywraca cały render.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;

    const media = window.matchMedia(query);
    setMatches(media.matches);

    const onChange = (event: MediaQueryListEvent) => setMatches(event.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

/**
 * Czy jesteśmy na dużym ekranie (próg `md` Tailwinda, 768 px).
 *
 * Jeden próg dla całej aplikacji, w jednym miejscu: gdyby każdy komponent
 * pisał własną liczbę, część interfejsu przełączałaby się przy 768 px,
 * a część przy 820 px, i nikt by nie wiedział, dlaczego.
 */
export function useIsDesktop(): boolean {
  return useMediaQuery('(min-width: 768px)');
}

export default useMediaQuery;
