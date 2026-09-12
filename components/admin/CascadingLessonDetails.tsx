import React, { useState } from 'react';
import { 
  Sparkles, BookOpen, Clock, FileText, CheckCircle2, 
  ChevronDown, ChevronUp, Link as LinkIcon, ExternalLink, 
  User as UserIcon, MessageSquare, AlertTriangle, Target, Plus, Eye,
  KeyRound, ListChecks, Activity, Wand2, ArrowRight
} from 'lucide-react';
import Markdown from 'react-markdown';
import { LessonRecord, GeneratedLessonScenario } from '../../types';
import { extractLessonBlocks, isRecordNeedsCleanup, migrateRecordToBlocks, parseNumberedItems, isLessonPendingConfirmation } from '../../utils/lessonBlocks';
import Button from '../ui/Button';
import Card from '../ui/Card';
import TTSButtons from '../flashcards/TTSButtons';

interface CascadingLessonDetailsProps {
  record: LessonRecord;
  studentName?: string;
  onLinkScenario?: (scenario: GeneratedLessonScenario) => Promise<void>;
  onGenerateHomework?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onClose?: () => void;
  onUpdateRecord?: (updated: Partial<LessonRecord>) => Promise<void>;
  onConfirmLesson?: () => void;
  onRejectLesson?: () => void;
}

export const CascadingLessonDetails: React.FC<CascadingLessonDetailsProps> = ({
  record,
  studentName,
  onGenerateHomework,
  onEdit,
  onDelete,
  onClose,
  onUpdateRecord,
  onConfirmLesson,
  onRejectLesson,
}) => {
  const [isAnswerKeyOpen, setIsAnswerKeyOpen] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const [cleanSuccess, setCleanSuccess] = useState(false);

  // Normalizujemy bloki lekcji (działa zarówno dla nowych jak i historycznych wpisów z bazy)
  const blocks = extractLessonBlocks(record);
  const needsCleanup = isRecordNeedsCleanup(record);
  const isPending = isLessonPendingConfirmation(record);

  // Section collapse states (Domyślnie wszystkie bloki Notion są rozwinięte, aby lektor widział pełny obraz)
  const [expandedSections, setExpandedSections] = useState<{
    block1: boolean;
    block2: boolean;
    block3: boolean;
    block4: boolean;
    learningCurve: boolean;
  }>({
    block1: true,
    block2: true,
    block3: true,
    block4: true,
    learningCurve: true
  });

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const handleCleanRecord = async () => {
    if (!onUpdateRecord) return;
    setIsCleaning(true);
    try {
      const migrated = migrateRecordToBlocks(record);
      await onUpdateRecord(migrated);
      setCleanSuccess(true);
      setTimeout(() => setCleanSuccess(false), 4000);
    } catch (err) {
      console.error('Błąd podczas porządkowania lekcji:', err);
    } finally {
      setIsCleaning(false);
    }
  };

  const parsedVocabList = (blocks.vocabulary || '')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .map((line, idx) => {
      let term = line;
      let def = '';
      if (line.includes(' - ')) {
        const parts = line.split(' - ');
        term = parts[0].trim();
        def = parts.slice(1).join(' - ').trim();
      } else if (line.includes(' – ')) {
        const parts = line.split(' – ');
        term = parts[0].trim();
        def = parts.slice(1).join(' – ').trim();
      } else if (line.includes(' — ')) {
        const parts = line.split(' — ');
        term = parts[0].trim();
        def = parts.slice(1).join(' — ').trim();
      } else if (line.includes(':')) {
        const parts = line.split(':');
        term = parts[0].trim();
        def = parts.slice(1).join(':').trim();
      }
      return { id: idx, term, def, raw: line };
    });

  const parsedHwSentences = parseNumberedItems(blocks.homework);

  return (
    <div className="space-y-4">
      {/* Alert dla lekcji wymagających potwierdzenia */}
      {isPending && (
        <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-[0_0_20px_rgba(245,158,11,0.15)]">
          <div className="flex items-start sm:items-center gap-3 text-amber-300">
            <AlertTriangle size={22} className="shrink-0 text-amber-400 mt-0.5 sm:mt-0" />
            <div>
              <div className="font-bold text-sm text-amber-200">
                Wymaga potwierdzenia przed publikacją dla kursanta
              </div>
              <p className="text-amber-200/80 mt-0.5 leading-relaxed">
                {record.pendingReason || (record.isDateMissing ? 'Brak daty spotkania w Notion' : 'Wybrakowane dane z Notion')}. Ta lekcja jest ukryta przed kursantem dopóki jej nie potwierdzisz.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
            {onConfirmLesson && (
              <Button
                size="sm"
                variant="primary"
                onClick={onConfirmLesson}
                className="text-xs font-bold bg-primary text-accent-ink hover:brightness-110 shadow-sm"
              >
                ✓ Zatwierdź dla kursanta
              </Button>
            )}
            {onRejectLesson && (
              <Button
                size="sm"
                variant="ghost"
                onClick={onRejectLesson}
                className="text-xs font-bold text-danger hover:bg-danger/15 hover:text-danger"
              >
                ✕ Odrzuć wpis
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Alert dla starych wpisów z opcją 1-click uporządkowania bazy */}
      {needsCleanup && onUpdateRecord && (
        <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-amber-300">
            <Wand2 size={16} className="shrink-0 text-amber-400" />
            <span>
              Ten wpis z Notion zawierał zlane zadanie domowe lub tekst wieloblokowy. Został uporządkowany w locie do układu 4 bloków Notion.
            </span>
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={handleCleanRecord}
            isLoading={isCleaning}
            className="shrink-0 text-xs font-bold border-amber-500/40 text-amber-300 hover:bg-amber-500/20"
          >
            {cleanSuccess ? '✓ Zapisano w nowym formacie!' : 'Utrwal czysty format w bazie'}
          </Button>
        </div>
      )}

      {/* 1. BLOK 1: LEKCJA W SKRÓCIE (Blue Accordion / Badge) */}
      <div className="rounded-2xl border border-sky-500/20 bg-sky-950/15 overflow-hidden shadow-sm transition-all">
        <div 
          onClick={() => toggleSection('block1')}
          className="p-3.5 bg-gradient-to-r from-sky-900/40 via-sky-950/30 to-transparent flex items-center justify-between gap-3 cursor-pointer hover:bg-sky-900/50 transition-colors select-none border-b border-sky-500/15"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-sky-500/20 text-sky-400 border border-sky-500/30 flex items-center justify-center shrink-0">
              <BookOpen size={16} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider bg-sky-500/20 text-sky-300 border border-sky-500/30">
                  BLOK 1
                </span>
                <h4 className="font-extrabold text-sm text-white">Lekcja w skrócie</h4>
              </div>
              <p className="text-[11px] text-sky-200/70">Podsumowanie, kontekst i przebieg lekcji</p>
            </div>
          </div>
          <div className="text-sky-300">
            {expandedSections.block1 ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </div>
        </div>
        {expandedSections.block1 && (
          <div className="p-4 bg-sky-950/10 space-y-2">
            {blocks.summary ? (
              <div className="text-sm text-content whitespace-pre-wrap leading-relaxed">
                <Markdown>{blocks.summary}</Markdown>
              </div>
            ) : (
              <p className="text-xs text-content-muted italic">Brak wpisanego streszczenia lekcji.</p>
            )}
          </div>
        )}
      </div>

      {/* 2. BLOK 2: KEY LANGUAGE & CORRECTIONS (Emerald Accordion / Badge) */}
      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-950/15 overflow-hidden shadow-sm transition-all">
        <div 
          onClick={() => toggleSection('block2')}
          className="p-3.5 bg-gradient-to-r from-emerald-900/40 via-emerald-950/30 to-transparent flex items-center justify-between gap-3 cursor-pointer hover:bg-emerald-900/50 transition-colors select-none border-b border-emerald-500/15"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <Sparkles size={16} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  BLOK 2
                </span>
                <h4 className="font-extrabold text-sm text-white">Key Language & Corrections</h4>
                <span className="text-[11px] text-emerald-400/80 font-bold">
                  ({parsedVocabList.length} słówek{blocks.corrections ? ' + korekty' : ''})
                </span>
              </div>
              <p className="text-[11px] text-emerald-200/70">Kluczowe słownictwo, gramatyka i korekta błędów</p>
            </div>
          </div>
          <div className="text-emerald-300">
            {expandedSections.block2 ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </div>
        </div>

        {expandedSections.block2 && (
          <div className="p-4 bg-emerald-950/10 space-y-4">
            {/* Pod-obszar 2a: Słownictwo i Wymowa */}
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-emerald-400 mb-2 flex items-center gap-1.5">
                <span>📚 Nowe słownictwo & zwroty:</span>
              </div>
              {parsedVocabList.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {parsedVocabList.map(v => (
                    <div 
                      key={v.id}
                      className="p-2.5 rounded-xl bg-base-300/70 border border-emerald-500/20 flex items-center justify-between gap-2 hover:border-emerald-500/40 transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="font-bold text-white text-xs">{v.term}</div>
                        {v.def && <div className="text-[11px] text-emerald-200/80 truncate">{v.def}</div>}
                      </div>
                      <TTSButtons text={v.term} />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-content-muted italic">Brak słownictwa przypisanego do tej lekcji.</p>
              )}
            </div>

            {/* Pod-obszar 2b: Korekty językowe i błędy */}
            {blocks.corrections && (
              <div className="pt-3 border-t border-emerald-500/15">
                <div className="text-xs font-bold uppercase tracking-wider text-emerald-400 mb-2 flex items-center gap-1.5">
                  <AlertTriangle size={14} className="text-amber-400" />
                  <span>Korekty językowe & Wymowa (Corrections):</span>
                </div>
                <div className="p-3.5 rounded-xl bg-base-300/60 border border-emerald-500/20 text-xs text-content leading-relaxed whitespace-pre-wrap">
                  <Markdown>{blocks.corrections}</Markdown>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. BLOK 3: HOMEWORK — CRIBRO HABIT (Amber/Brown Accordion / Badge) */}
      <div className="rounded-2xl border border-amber-500/25 bg-amber-950/15 overflow-hidden shadow-sm transition-all">
        <div 
          onClick={() => toggleSection('block3')}
          className="p-3.5 bg-gradient-to-r from-amber-900/40 via-amber-950/30 to-transparent flex items-center justify-between gap-3 cursor-pointer hover:bg-amber-900/50 transition-colors select-none border-b border-amber-500/15"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
              <ListChecks size={16} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  BLOK 3
                </span>
                <h4 className="font-extrabold text-sm text-white">Homework — Cribro Habit</h4>
              </div>
              <p className="text-[11px] text-amber-200/70">Zadania domowe z lekcji, zdania do tłumaczenia i klucz odpowiedzi</p>
            </div>
          </div>
          <div className="text-amber-300">
            {expandedSections.block3 ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </div>
        </div>

        {expandedSections.block3 && (
          <div className="p-4 bg-amber-950/10 space-y-3.5">
            {blocks.homework ? (
              <div className="space-y-3">
                <div className="p-3.5 rounded-xl bg-base-300/80 border border-amber-500/20 space-y-2">
                  <div className="text-xs font-bold text-amber-300 flex items-center justify-between gap-2">
                    <span>Zdania do przetłumaczenia / Zadanie:</span>
                    {onGenerateHomework && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onGenerateHomework();
                        }}
                        className="text-[11px] text-primary hover:underline font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Sparkles size={12} /> Przekształć w zadanie Cribro
                      </button>
                    )}
                  </div>
                  <div className="text-xs text-content whitespace-pre-wrap leading-relaxed space-y-1">
                    <Markdown>{blocks.homework}</Markdown>
                  </div>
                </div>

                {/* Answer key w zwijanym akordeonie, by nie zdradzać odpowiedzi */}
                {blocks.answerKey && (
                  <div className="rounded-xl border border-white/10 bg-base-300/50 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setIsAnswerKeyOpen(v => !v)}
                      className="w-full p-2.5 flex items-center justify-between text-xs font-bold text-content-muted hover:text-text-hi transition-colors cursor-pointer select-none"
                    >
                      <span className="flex items-center gap-1.5">
                        <KeyRound size={13} className="text-amber-400" />
                        Klucz odpowiedzi (Answer Key)
                      </span>
                      <span>{isAnswerKeyOpen ? 'Ukryj odpowiedzi ▲' : 'Pokaż odpowiedzi ▼'}</span>
                    </button>
                    {isAnswerKeyOpen && (
                      <div className="p-3 border-t border-white/5 bg-base-200/50 text-xs text-content leading-relaxed whitespace-pre-wrap">
                        <Markdown>{blocks.answerKey}</Markdown>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-base-300/40 border border-white/5 text-center text-xs text-content-muted">
                Brak zadań domowych przypisanych bezpośrednio w notatkach lekcji.
                {onGenerateHomework && (
                  <div className="mt-2">
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={onGenerateHomework}
                      className="text-xs font-bold mx-auto flex items-center gap-1.5"
                    >
                      <Sparkles size={13} /> Wygeneruj zadanie domowe AI z tej lekcji
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 4. BLOK 4: NEXT LESSON (Olive/Yellow Accordion / Badge) */}
      <div className="rounded-2xl border border-yellow-500/20 bg-yellow-950/15 overflow-hidden shadow-sm transition-all">
        <div 
          onClick={() => toggleSection('block4')}
          className="p-3.5 bg-gradient-to-r from-yellow-900/40 via-yellow-950/30 to-transparent flex items-center justify-between gap-3 cursor-pointer hover:bg-yellow-900/50 transition-colors select-none border-b border-yellow-500/15"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 flex items-center justify-center shrink-0">
              <Target size={16} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">
                  BLOK 4
                </span>
                <h4 className="font-extrabold text-sm text-white">Next Lesson</h4>
              </div>
              <p className="text-[11px] text-yellow-200/70">Plany, tematyka i cele na kolejne spotkanie</p>
            </div>
          </div>
          <div className="text-yellow-300">
            {expandedSections.block4 ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </div>
        </div>

        {expandedSections.block4 && (
          <div className="p-4 bg-yellow-950/10">
            {blocks.nextLesson ? (
              <div className="text-xs text-content whitespace-pre-wrap leading-relaxed">
                <Markdown>{blocks.nextLesson}</Markdown>
              </div>
            ) : (
              <p className="text-xs text-content-muted italic">Brak zdefiniowanych planów na kolejną lekcję.</p>
            )}
          </div>
        )}
      </div>

      {/* 5. LEARNING CURVE / UWAGI O KURŚCIE (Purple Accordion / Badge) */}
      <div className="rounded-2xl border border-purple-500/20 bg-purple-950/15 overflow-hidden shadow-sm transition-all">
        <div 
          onClick={() => toggleSection('learningCurve')}
          className="p-3.5 bg-gradient-to-r from-purple-900/40 via-purple-950/30 to-transparent flex items-center justify-between gap-3 cursor-pointer hover:bg-purple-900/50 transition-colors select-none border-b border-purple-500/15"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center justify-center shrink-0">
              <Activity size={16} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  LEARNING CURVE
                </span>
                <h4 className="font-extrabold text-sm text-white">Wypowiedzi i dynamika kursanta</h4>
              </div>
              <p className="text-[11px] text-purple-200/70">O czym mówił kursant, obserwacje dotyczące płynności i postępów</p>
            </div>
          </div>
          <div className="text-purple-300">
            {expandedSections.learningCurve ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </div>
        </div>

        {expandedSections.learningCurve && (
          <div className="p-4 bg-purple-950/10">
            {blocks.learningCurve ? (
              <div className="text-xs text-content whitespace-pre-wrap leading-relaxed">
                <Markdown>{blocks.learningCurve}</Markdown>
              </div>
            ) : (
              <p className="text-xs text-content-muted italic">Brak szczegółowych uwag o wypowiedziach kursanta z tej lekcji.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
