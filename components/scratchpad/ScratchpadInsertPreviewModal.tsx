import React, { useState, useEffect } from 'react';
import {
  X,
  CheckCircle2,
  Sparkles,
  BookOpen,
  Calendar,
  Layers,
  Copy,
  Check,
  Edit3,
  Eye,
  FileText,
  ArrowRight,
  PlusCircle,
  HelpCircle
} from 'lucide-react';
import Button from '../ui/Button';
import { useEscapeModal } from '../../hooks/useEscapeModal';
import { buildLessonTemplate } from '../../utils/lessonTemplate';
import { parseNotionMultiBlockText } from '../../utils/lessonBlocks';
import { NOTEBOOK_COLORS } from '../../utils/notebookPalette';

const SECTION_TITLES = {
  SUMMARY: '1. Lesson Summary',
  VOCABULARY: '2. Key Language & Words',
  CORRECTIONS: '3. Language Corrections & Grammar',
  HOMEWORK: '4. Homework',
  NEXT_LESSON: '5. Next Lesson Plan',
};

export interface StructuredLessonContent {
  title: string;
  date?: string;
  summary: string;
  vocabulary: string;
  corrections: string;
  homework: string;
  nextLesson?: string;
  revision?: string;
}

interface ScratchpadInsertPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialContent: Partial<StructuredLessonContent>;
  onConfirmInsert: (htmlContent: string, mode: 'template' | 'append' | 'cursor' | 'replace') => void;
}

/**
 * Parsuje dowolny tekst wygenerowany przez AI lub wyciągnięty z dokumentu (PDF/DOCX)
 * na ustrukturyzowany obiekt 4/5 bloków.
 */
export function parseRawTextToStructuredLesson(rawText: string): StructuredLessonContent {
  const multiBlocks = parseNotionMultiBlockText(rawText);

  // Wyciągamy ewentualny tytuł i datę z pierwszych linii
  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
  let title = 'Temat lekcji';
  let date = new Date().toISOString().split('T')[0];

  const dateMatch = rawText.match(/\b(20\d{2}[-/.]\d{1,2}[-/.]\d{1,2})\b/);
  if (dateMatch) {
    date = dateMatch[1].replace(/[/.]/g, '-');
  }

  // Szukamy nagłówka lekcji
  for (const line of lines.slice(0, 5)) {
    if (/^(?:#{1,3}\s*)?(?:lekcja|lesson|temat|topic)\b/i.test(line)) {
      title = line.replace(/^(?:#{1,3}\s*)?(?:lekcja|lesson|temat|topic)[:\s—–-]*/i, '').trim();
      break;
    }
  }

  if (multiBlocks && (multiBlocks.summary || multiBlocks.vocabulary || multiBlocks.homework)) {
    return {
      title: title || 'Lekcja języka angielskiego',
      date,
      summary: multiBlocks.summary || '',
      vocabulary: multiBlocks.vocabulary || '',
      corrections: multiBlocks.corrections || '',
      homework: multiBlocks.homework || '',
      nextLesson: multiBlocks.nextLesson || '',
    };
  }

  // Fallback: heurystyczny podział na sekcje
  let currentSec: 'summary' | 'vocabulary' | 'corrections' | 'homework' | 'nextLesson' = 'summary';
  const secMap: Record<string, string[]> = {
    summary: [],
    vocabulary: [],
    corrections: [],
    homework: [],
    nextLesson: [],
  };

  for (const rawLine of rawText.split('\n')) {
    const line = rawLine.trim();
    if (/^(?:#{1,4}\s*)?(?:nowe\s*słownictwo|vocabulary|słówka|key\s*language|words)\b/i.test(line)) {
      currentSec = 'vocabulary';
      continue;
    }
    if (/^(?:#{1,4}\s*)?(?:korekty|błędy|corrections|accuracy|wymowa|pronunciation|do\s*poprawy)\b/i.test(line)) {
      currentSec = 'corrections';
      continue;
    }
    if (/^(?:#{1,4}\s*)?(?:homework|zadanie\s*domowe|praca\s*domowa)\b/i.test(line)) {
      currentSec = 'homework';
      continue;
    }
    if (/^(?:#{1,4}\s*)?(?:kolejna\s*lekcja|next\s*lesson|follow-?up)\b/i.test(line)) {
      currentSec = 'nextLesson';
      continue;
    }
    if (/^(?:#{1,4}\s*)?(?:przebieg|podsumowanie|summary|lesson\s*summary)\b/i.test(line)) {
      currentSec = 'summary';
      continue;
    }

    secMap[currentSec].push(rawLine);
  }

  return {
    title: title || 'Lekcja języka angielskiego',
    date,
    summary: secMap.summary.join('\n').trim(),
    vocabulary: secMap.vocabulary.join('\n').trim(),
    corrections: secMap.corrections.join('\n').trim(),
    homework: secMap.homework.join('\n').trim(),
    nextLesson: secMap.nextLesson.join('\n').trim(),
  };
}

export const ScratchpadInsertPreviewModal: React.FC<ScratchpadInsertPreviewModalProps> = ({
  isOpen,
  onClose,
  initialContent,
  onConfirmInsert,
}) => {
  useEscapeModal(isOpen, onClose);

  const [activeTab, setActiveTab] = useState<'editor' | 'preview'>('editor');
  const [title, setTitle] = useState(initialContent.title || 'Lekcja języka angielskiego');
  const [date, setDate] = useState(initialContent.date || new Date().toISOString().split('T')[0]);
  const [summary, setSummary] = useState(initialContent.summary || '');
  const [vocabulary, setVocabulary] = useState(initialContent.vocabulary || '');
  const [corrections, setCorrections] = useState(initialContent.corrections || '');
  const [homework, setHomework] = useState(initialContent.homework || '');
  const [nextLesson, setNextLesson] = useState(initialContent.nextLesson || '');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen && initialContent) {
      if (initialContent.title) setTitle(initialContent.title);
      if (initialContent.date) setDate(initialContent.date);
      if (initialContent.summary !== undefined) setSummary(initialContent.summary);
      if (initialContent.vocabulary !== undefined) setVocabulary(initialContent.vocabulary);
      if (initialContent.corrections !== undefined) setCorrections(initialContent.corrections);
      if (initialContent.homework !== undefined) setHomework(initialContent.homework);
      if (initialContent.nextLesson !== undefined) setNextLesson(initialContent.nextLesson);
    }
  }, [isOpen, initialContent]);

  if (!isOpen) return null;

  // Generuje pełny kod HTML lekcji w standardzie edytora CRIBRO
  const generateFormattedHTML = (): string => {
    // Nagłówek lekcji z numerem lub tematem
    const headerHtml = `<h1>${title} &mdash; ${date}</h1>`;

    // 1. Summary
    const summaryHtml = `<h2>${SECTION_TITLES.SUMMARY}</h2>` +
      (summary.trim()
        ? `<p>${summary.split('\n').filter(Boolean).join('</p><p>')}</p>`
        : '<p><em>Omówiono bieżące zagadnienia konwersacyjne i praktyczne.</em></p>');

    // 2. Vocabulary
    const vocabList = vocabulary
      .split('\n')
      .map(l => l.replace(/^[-*•\d.]+\s*/, '').trim())
      .filter(Boolean);

    const vocabHtml = `<h2>${SECTION_TITLES.VOCABULARY}</h2>` +
      (vocabList.length > 0
        ? `<ul>${vocabList.map(v => {
            if (v.includes(' - ') || v.includes(' – ') || v.includes(':')) {
              const parts = v.split(/\s*[-–:]\s*/);
              return `<li><strong>${parts[0]}</strong> &mdash; ${parts.slice(1).join(' &mdash; ')}</li>`;
            }
            return `<li><strong>${v}</strong></li>`;
          }).join('')}</ul>`
        : '<p><em>Brak nowego słownictwa w tym module.</em></p>');

    // 3. Corrections
    const fixList = corrections
      .split('\n')
      .map(l => l.replace(/^[-*•\d.]+\s*/, '').trim())
      .filter(Boolean);

    const fixHtml = `<h2>${SECTION_TITLES.CORRECTIONS}</h2>` +
      (fixList.length > 0
        ? `<ul>${fixList.map(f => `<li>${f}</li>`).join('')}</ul>`
        : '<p><em>Brak krytycznych błędów gramatycznych.</em></p>');

    // 4. Homework
    const hwList = homework
      .split('\n')
      .map(l => l.replace(/^[-*•\d.]+\s*/, '').trim())
      .filter(Boolean);

    const hwHtml = `<h2>${SECTION_TITLES.HOMEWORK}</h2>` +
      (hwList.length > 0
        ? `<ol>${hwList.map(h => `<li>${h}</li>`).join('')}</ol>`
        : '<p><em>Utrwalenie słówek w aplikacji Recall.</em></p>');

    // 5. Next Lesson
    const nextHtml = nextLesson.trim()
      ? `<h2>${SECTION_TITLES.NEXT_LESSON}</h2><p>${nextLesson.split('\n').filter(Boolean).join('</p><p>')}</p>`
      : '';

    return `${headerHtml}\n${summaryHtml}\n${vocabHtml}\n${fixHtml}\n${hwHtml}\n${nextHtml}`;
  };

  const formattedHtml = generateFormattedHTML();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(formattedHtml);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.warn('Copy failed:', e);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="insert-preview-title"
        className="relative w-full max-w-4xl bg-base-200 border border-primary/40 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-line-strong bg-base-300/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/20 border border-primary/40 flex items-center justify-center text-primary shadow-[0_0_15px_rgba(114,240,180,0.3)]">
              <Sparkles size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono uppercase bg-primary/20 text-primary border border-primary/30 px-2.5 py-0.5 rounded-full font-bold">
                  AI Notion Template
                </span>
                <span className="text-xs text-content-muted">Zatwierdzenie materiałów z pliku / czatu</span>
              </div>
              <h3 id="insert-preview-title" className="text-base sm:text-lg font-black text-text-hi mt-0.5">
                Formatowanie i wstawianie lekcji do notatnika
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Przełącznik Edytor pól vs Podgląd HTML */}
            <div className="flex items-center p-1 bg-base-100 rounded-xl border border-line-strong text-xs font-bold">
              <button
                type="button"
                onClick={() => setActiveTab('editor')}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'editor'
                    ? 'bg-primary text-accent-ink shadow-sm'
                    : 'text-content-muted hover:text-text-hi'
                }`}
              >
                <Edit3 size={13} />
                <span>Edycja bloków</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('preview')}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'preview'
                    ? 'bg-primary text-accent-ink shadow-sm'
                    : 'text-content-muted hover:text-text-hi'
                }`}
              >
                <Eye size={13} />
                <span>Podgląd dokumentu</span>
              </button>
            </div>

            <button
              onClick={onClose}
              aria-label="Zamknij"
              className="p-2 rounded-xl text-content-muted hover:text-text-hi hover:bg-line-soft transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
          {activeTab === 'editor' ? (
            <div className="space-y-4">
              {/* Tytuł i Data */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-content-muted uppercase tracking-wider mb-1">
                    Temat lekcji (H1):
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-base-100 border border-line-strong text-xs sm:text-sm font-bold text-text-hi focus:border-primary focus:outline-none"
                    placeholder="np. Business Negotiations & Conditional Structures"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-content-muted uppercase tracking-wider mb-1">
                    Data zajęć:
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-base-100 border border-line-strong text-xs font-mono text-text-hi focus:border-primary focus:outline-none"
                  />
                </div>
              </div>

              {/* 1. Przebieg / Summary */}
              <div>
                <label className="block text-xs font-bold text-primary uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <BookOpen size={13} />
                  <span>1. Lekcja w skrócie / Przebieg (Lesson Summary):</span>
                </label>
                <textarea
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  rows={3}
                  className="w-full px-3.5 py-2 rounded-xl bg-base-100 border border-line-strong text-xs text-content focus:border-primary focus:outline-none leading-relaxed"
                  placeholder="Krótki opis poruszonych zagadnień i przebiegu rozmowy..."
                />
              </div>

              {/* 2. Słownictwo / Key Language */}
              <div>
                <label className="block text-xs font-bold text-primary uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <Layers size={13} />
                  <span>2. Słownictwo i zwroty (Key Language / New Words):</span>
                </label>
                <textarea
                  value={vocabulary}
                  onChange={(e) => setVocabulary(e.target.value)}
                  rows={4}
                  className="w-full px-3.5 py-2 rounded-xl bg-base-100 border border-line-strong text-xs font-mono text-content focus:border-primary focus:outline-none leading-relaxed"
                  placeholder="word 1 - znaczenie 1&#10;word 2 - znaczenie 2"
                />
                <span className="text-[10px] text-content-muted">Każde słówko w nowej linii (format: słówko - znaczenie).</span>
              </div>

              {/* 3. Korekty i Gramatyka */}
              <div>
                <label className="block text-xs font-bold text-amber-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <Edit3 size={13} />
                  <span>3. Korekty językowe i błędy kursanta (Accuracy & Corrections):</span>
                </label>
                <textarea
                  value={corrections}
                  onChange={(e) => setCorrections(e.target.value)}
                  rows={3}
                  className="w-full px-3.5 py-2 rounded-xl bg-base-100 border border-line-strong text-xs text-content focus:border-primary focus:outline-none leading-relaxed"
                  placeholder="Say: ... Not: ...&#10;Poprawna kolokacja..."
                />
              </div>

              {/* 4. Zadanie domowe */}
              <div>
                <label className="block text-xs font-bold text-emerald-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <CheckCircle2 size={13} />
                  <span>4. Zadanie domowe (Homework / Practice):</span>
                </label>
                <textarea
                  value={homework}
                  onChange={(e) => setHomework(e.target.value)}
                  rows={3}
                  className="w-full px-3.5 py-2 rounded-xl bg-base-100 border border-line-strong text-xs text-content focus:border-primary focus:outline-none leading-relaxed"
                  placeholder="Zdania do przetłumaczenia lub ćwiczenia powtórkowe..."
                />
              </div>

              {/* 5. Kolejna lekcja / Follow-up */}
              <div>
                <label className="block text-xs font-bold text-purple-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <Calendar size={13} />
                  <span>5. Rekomendowany kolejny krok (Next Lesson Plan - opcjonalnie):</span>
                </label>
                <input
                  type="text"
                  value={nextLesson}
                  onChange={(e) => setNextLesson(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-base-100 border border-line-strong text-xs text-content focus:border-primary focus:outline-none"
                  placeholder="Temat lub zagadnienie do kontynuacji na następnej lekcji..."
                />
              </div>
            </div>
          ) : (
            /* Tab: Live HTML Preview */
            <div className="space-y-3">
              <div className="p-2 rounded-xl bg-primary/10 border border-primary/30 text-xs text-primary font-medium flex items-center justify-between">
                <span>Podgląd formatu notatnika (nagłówki H1, sekcje H2, listy punktowane i numerowane):</span>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="px-2.5 py-1 rounded-lg bg-base-100 hover:bg-base-300 border border-line text-[11px] font-bold text-text-hi transition-colors flex items-center gap-1 cursor-pointer"
                >
                  {copied ? <Check size={12} className="text-primary" /> : <Copy size={12} />}
                  <span>{copied ? 'Skopiowano HTML' : 'Kopiuj HTML'}</span>
                </button>
              </div>

              <div
                className="p-6 rounded-2xl bg-white dark:bg-[#0b0f17] text-slate-900 dark:text-white border border-line-strong shadow-inner min-h-[300px] font-sans prose dark:prose-invert max-w-none text-xs sm:text-sm"
                dangerouslySetInnerHTML={{ __html: formattedHtml }}
              />
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-line-strong bg-base-300/80 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-line-soft text-content-muted hover:text-text-hi text-xs font-bold border border-line-strong transition-colors cursor-pointer"
          >
            Anuluj
          </button>

          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={() => {
                onConfirmInsert(formattedHtml, 'append');
                onClose();
              }}
              className="px-3.5 py-2 rounded-xl bg-base-100 hover:bg-white/10 border border-line text-text-hi text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              title="Wstaw tę lekcję na samym dole dokumentu"
            >
              <PlusCircle size={13} className="text-primary" />
              <span>Dopisz na końcu</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onConfirmInsert(formattedHtml, 'cursor');
                onClose();
              }}
              className="px-3.5 py-2 rounded-xl bg-base-100 hover:bg-white/10 border border-line text-text-hi text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              title="Wstaw w aktualnej pozycji kursora"
            >
              <ArrowRight size={13} className="text-primary" />
              <span>W miejscu kursora</span>
            </button>

            <Button
              size="sm"
              onClick={() => {
                onConfirmInsert(formattedHtml, 'template');
                onClose();
              }}
              className="px-5 py-2.5 rounded-xl bg-primary text-accent-ink font-bold text-xs shadow-btn flex items-center gap-1.5 hover:brightness-110 cursor-pointer"
              title="Wstaw jako nową stronę / pełną lekcję z podziałem strony"
            >
              <CheckCircle2 size={14} />
              <span>Wstaw jako nową lekcję</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScratchpadInsertPreviewModal;
