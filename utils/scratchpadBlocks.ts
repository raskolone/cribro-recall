import { ScratchpadBlock, ScratchpadBlockType } from '../types';

/**
 * Adapter i serializer modelu blokowego notatnika (Iteracja 1, za flagą
 * `SHARED_NOTEBOOK_V2` w `config/featureFlags.ts`).
 *
 * Rozszerzenie hybrydowe: `ScratchpadDocument.blocks` żyje OBOK
 * `contentHtml`/`contentText`, nigdy zamiast nich. Dzięki temu stare
 * widoki, podgląd, druk i eksport do Notion/PDF — wszystkie czytające
 * wyłącznie `contentHtml` — nie wiedzą, że bloki w ogóle istnieją.
 * `blocksToHtml`/`blocksToText` są wołane przy KAŻDYM zapisie blokowym,
 * żeby te dwa pola zawsze odzwierciedlały aktualną treść bloków.
 */

let blockIdCounter = 0;

/** ID bloku — czytelne w debugowaniu, unikalne w obrębie procesu. */
export const generateBlockId = (): string => {
  blockIdCounter += 1;
  return `blk_${Date.now().toString(36)}_${blockIdCounter.toString(36)}`;
};

const escapeHtml = (text: string): string =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

/** Usuwa znaczniki HTML — współdzielone z `services/scratchpadService.ts` (kopia celowa, brak cyklu importów). */
const stripHtmlToText = (html: string): string =>
  html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

/**
 * Konwertuje istniejący HTML notatnika na pojedynczy blok typu `text`.
 *
 * Celowo NIE parsuje HTML na wiele bloków — to wymagałoby parsera DOM
 * i decyzji o granicach akapitów/nagłówków, których Iteracja 1 (fundament)
 * jeszcze nie podejmuje. Dokument sprzed modelu blokowego dostaje jeden
 * blok "kontenerowy" zachowujący całą treść jeden do jednego; podział na
 * właściwe typy bloków (`heading`, `vocabulary_pair`, ...) to kolejna
 * iteracja.
 */
export function htmlToBlocks(html: string): ScratchpadBlock[] {
  const trimmed = (html || '').trim();
  if (!trimmed) return [];

  return [
    {
      id: generateBlockId(),
      type: 'text',
      content: trimmed,
      visibility: 'shared',
      editPolicy: 'teacher',
      order: 0,
      updatedAt: Date.now(),
    },
  ];
}

const renderBlockContentHtml = (block: ScratchpadBlock): string => {
  switch (block.type) {
    case 'heading':
      return `<h2>${escapeHtml(block.content)}</h2>`;
    case 'bullet_list':
      return `<ul>${block.content
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => `<li>${escapeHtml(line)}</li>`)
        .join('')}</ul>`;
    case 'callout':
      return `<blockquote>${escapeHtml(block.content)}</blockquote>`;
    case 'text':
    case 'vocabulary_pair':
    case 'correction':
    case 'student_input':
    case 'slide_break':
    default:
      // `text` i typy niosące JSON (vocabulary_pair/correction) trzymają
      // już gotowy HTML wygenerowany w edytorze — nie ma czego escapować
      // ponownie, inaczej podwójnie zakodowalibyśmy encje.
      return block.content;
  }
};

/**
 * Serializuje bloki do jednego ciągu HTML — dokładnie to, co dotąd
 * siedziało w `contentHtml`. Woła się to przy każdym zapisie blokowym,
 * żeby stare widoki (podgląd, druk, eksport) nigdy nie zobaczyły pustki.
 */
export function blocksToHtml(blocks: ScratchpadBlock[]): string {
  return [...blocks]
    .sort((a, b) => a.order - b.order)
    .filter((block) => block.visibility === 'shared')
    .map(renderBlockContentHtml)
    .join('');
}

/** Wersja tekstowa bloków — dla podglądu/wyszukiwania, tak jak `contentText` dotąd. */
export function blocksToText(blocks: ScratchpadBlock[]): string {
  return stripHtmlToText(blocksToHtml(blocks));
}

/**
 * Punkt wejścia dla `ScratchpadEditor`: zwraca bloki gotowe do
 * zainicjalizowania stanu edytora.
 *
 * - Dokument ma już `blocks` → zwraca je bez zmian (źródło prawdy).
 * - Dokument ma tylko `contentHtml` → konwertuje przez `htmlToBlocks`
 *   (fallback wsteczny, patrz `htmlToBlocks`).
 *
 * Wołający jest odpowiedzialny za sprawdzenie flagi `SHARED_NOTEBOOK_V2`
 * PRZED wywołaniem — ta funkcja nie zna flag, żeby dało się ją testować
 * niezależnie od `config/featureFlags.ts`.
 */
export function getScratchpadBlocksOrFallback(doc: {
  blocks?: ScratchpadBlock[];
  contentHtml?: string;
}): ScratchpadBlock[] {
  if (Array.isArray(doc.blocks) && doc.blocks.length > 0) {
    return doc.blocks;
  }
  return htmlToBlocks(doc.contentHtml || '');
}

/** Typy bloków wspierane w Iteracji 1 — do walidacji przy tworzeniu nowych bloków w UI. */
export const SCRATCHPAD_BLOCK_TYPES: ScratchpadBlockType[] = [
  'heading',
  'text',
  'bullet_list',
  'vocabulary_pair',
  'correction',
  'callout',
  'student_input',
  'slide_break',
];
