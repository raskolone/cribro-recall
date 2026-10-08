/** Plakietka zadań czekających na kursanta — liczba występuje tylko raz, w samym rzeczowniku. */
export function plZadania(n: number, lang: 'pl' | 'en' = 'pl'): string {
  if (lang === 'en') {
    return n === 1 ? '1 task' : `${n} tasks`;
  }
  if (n === 1) return '1 zadanie';
  const r10 = n % 10;
  const r100 = n % 100;
  if (r10 >= 2 && r10 <= 4 && (r100 < 10 || r100 >= 20)) {
    return `${n} zadania`;
  }
  return `${n} zadań`;
}
