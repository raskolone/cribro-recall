import { SpecialTask } from '../types';
import type { HomeworkRow } from './groupHomeworkRows';

/** Teksty wyszukiwarki listy prac lektora. */
export const HOMEWORK_SEARCH_PLACEHOLDER = 'Szukaj: kursant, grupa lub tytuł pracy';
export const HOMEWORK_SEARCH_CLEAR_LABEL = 'Wyczyść wyszukiwanie';
export const HOMEWORK_SEARCH_EMPTY_TITLE = 'Brak prac pasujących do wyszukiwania';
export const HOMEWORK_SEARCH_EMPTY_HINT = 'Zmień wpisaną frazę, wyczyść wyszukiwanie albo zmień filtr statusu.';

/**
 * Małe litery, bez znaków diakrytycznych. „ł/Ł" nie rozkłada się w NFD, więc
 * zamieniamy je ręcznie — inaczej „Łukasz" nie pasowałby do „lukasz".
 */
export const normalizeSearchText = (value: unknown): string =>
  String(value ?? '')
    .replace(/ł/g, 'l')
    .replace(/Ł/g, 'L')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Czy wiersz listy pasuje do wpisanej frazy. Fraza jest dzielona na słowa;
 * WSZYSTKIE muszą wystąpić w jednym „kandydacie": imieniu i nazwisku jednego
 * kursanta razem z nazwą grupy i tytułem pracy. Wiersz grupowy pasuje, gdy
 * pasuje którykolwiek członek (słowa z różnych członków się nie sumują).
 * Pusta fraza pasuje do wszystkiego.
 */
export const matchesHomeworkSearch = (
  row: HomeworkRow,
  query: string,
  getName?: (task: SpecialTask) => string
): boolean => {
  const tokens = normalizeSearchText(query).split(' ').filter(Boolean);
  if (tokens.length === 0) return true;

  const candidates: string[] = [];
  if (row.kind === 'single') {
    const t = row.task;
    const names = [getName ? getName(t) : '', t.studentName || ''];
    const tail = `${t.groupName || ''} ${t.title || ''}`;
    candidates.push(normalizeSearchText(`${names.join(' ')} ${tail}`));
  } else {
    const tail = `${row.groupName} ${row.title || ''}`;
    candidates.push(normalizeSearchText(tail));
    row.members.forEach((m) => {
      candidates.push(normalizeSearchText(`${m.name} ${m.task.studentName || ''} ${tail}`));
    });
  }

  return candidates.some((c) => tokens.every((tok) => c.includes(tok)));
};

export const filterHomeworkRows = (
  rows: HomeworkRow[],
  query: string,
  getName?: (task: SpecialTask) => string
): HomeworkRow[] => (normalizeSearchText(query) ? rows.filter((r) => matchesHomeworkSearch(r, query, getName)) : rows);
