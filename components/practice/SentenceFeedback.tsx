import React, { useId, useState } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, ChevronDown, Lightbulb, Loader2, Sparkles, Volume2, XCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { TranslationEvaluationResult } from '../../types';
import { sanitizeHighlightHtml } from '../../utils/safeHighlight';
import { TONE_CLASSES, TONE_LABEL_KEYS, toneForPercent, toneForPoints, type ScoreTone } from '../../utils/scoreTone';

/**
 * Prezentacja oceny zdania — jedna dla podsumowania pod zdaniem i dla listy wyników.
 * Treść oceny i punktacja przychodzą gotowe (`TranslationEvaluationResult`); tu zmienia się
 * wyłącznie wygląd: zwarty rząd plakietek zamiast dużych kafli, ton wyniku z tokenów
 * semantycznych (zawsze z ikoną i liczbą), kompaktowe bloki odpowiedzi i akordeon feedbacku.
 */

const ToneIcon: Record<ScoreTone, React.ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' }>> = {
  success: CheckCircle2,
  warn: AlertTriangle,
  danger: XCircle,
};

/** Pojedyncza plakietka wyniku: ikona tonu + etykieta + `punkty/max`; tekst tokenem text-hi. */
export const ScoreChip: React.FC<{ label: string; points: number; max: number }> = ({ label, points, max }) => {
  const { t } = useTranslation();
  const tone = toneForPoints(points, max);
  const classes = TONE_CLASSES[tone];
  const Icon = ToneIcon[tone];
  return (
    <li
      data-testid="score-chip"
      data-tone={tone}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-sm text-text-hi ${classes.surface} ${classes.border}`}
    >
      <Icon className={`h-4 w-4 shrink-0 ${classes.icon}`} aria-hidden="true" />
      <span className="font-medium">{label}</span>
      <span className="font-mono font-bold">
        {points}/{max}
      </span>
      <span className="sr-only">{t(TONE_LABEL_KEYS[tone])}</span>
    </li>
  );
};

export const ScoreBreakdownRow: React.FC<{ breakdown?: TranslationEvaluationResult['breakdown'] }> = ({ breakdown }) => {
  const { t } = useTranslation();
  if (!breakdown) return null;
  return (
    <ul aria-label={t('Wynik składowych')} data-testid="score-breakdown" className="flex flex-wrap gap-1.5">
      <ScoreChip label={t('Znaczenie')} points={breakdown.meaning_score} max={40} />
      <ScoreChip label={t('Gramatyka')} points={breakdown.grammar_score} max={40} />
      <ScoreChip label={t('Słownictwo')} points={breakdown.vocabulary_score} max={20} />
    </ul>
  );
};

/** Wynik ogólny: procent z ikoną tonu. */
export const OverallScore: React.FC<{ score: number }> = ({ score }) => {
  const { t } = useTranslation();
  const tone = toneForPercent(score);
  const classes = TONE_CLASSES[tone];
  const Icon = ToneIcon[tone];
  return (
    <span
      data-testid="overall-score"
      data-tone={tone}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-sm font-bold text-text-hi ${classes.surface} ${classes.border}`}
    >
      <Icon className={`h-4 w-4 ${classes.icon}`} aria-hidden="true" />
      <span className="font-mono">{score}%</span>
      <span className="sr-only">{t(TONE_LABEL_KEYS[tone])}</span>
    </span>
  );
};

/** Odsłuch: wizualnie mały przycisk, strefa dotyku ≥ 44 px (niewidoczny ::before sięga 12 px w górę i w dół). */
export const ListenButtons: React.FC<{
  text: string;
  onPlay: (text: string, accent: 'en-US' | 'en-GB') => void;
  disabled?: boolean;
  playing?: boolean;
}> = ({ text, onPlay, disabled, playing }) => {
  const { t } = useTranslation();
  const accents: Array<{ accent: 'en-US' | 'en-GB'; label: string; title: string }> = [
    { accent: 'en-US', label: 'US', title: t('Wymowa amerykańska') },
    { accent: 'en-GB', label: 'UK', title: t('Wymowa brytyjska') },
  ];
  return (
    <div role="group" aria-label={t('Odsłuchaj')} className="flex items-center gap-3">
      {accents.map(({ accent, label, title }) => (
        <button
          key={accent}
          type="button"
          data-testid={`listen-${label.toLowerCase()}`}
          onClick={() => onPlay(text, accent)}
          disabled={disabled}
          title={title}
          aria-label={title}
          className="relative inline-flex h-7 min-w-11 items-center justify-center gap-1 rounded-lg border border-line-strong bg-surface-flat px-2 text-xs font-bold text-text-hi before:absolute before:inset-x-0 before:-inset-y-3 before:content-[''] hover:border-primary disabled:cursor-default disabled:text-text-3 cursor-pointer transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {playing ? <Loader2 className="h-3 w-3 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Volume2 className="h-3 w-3" aria-hidden="true" />}
          {label}
        </button>
      ))}
    </div>
  );
};

/** Zwarty blok z podpisem (Po polsku / Twoja odpowiedź / Wzorcowe tłumaczenie). */
export const AnswerBlock: React.FC<{
  label: string;
  tone?: ScoreTone;
  action?: React.ReactNode;
  testId?: string;
  children: React.ReactNode;
}> = ({ label, tone, action, testId, children }) => (
  <div data-testid={testId} className="min-w-0 space-y-1">
    <div className="flex min-h-6 items-center justify-between gap-2">
      <span className="text-xs font-bold uppercase tracking-wider text-text-2">{label}</span>
      {action}
    </div>
    <div
      className={`rounded-lg border px-3 py-2 text-base leading-snug text-text-hi break-words ${
        tone ? `${TONE_CLASSES[tone].surface} ${TONE_CLASSES[tone].border}` : 'border-line-strong bg-base-100/40'
      }`}
    >
      {children}
    </div>
  </div>
);

/** Fragment z podświetlonymi błędami: HTML przefiltrowany przez białą listę (`safeHighlight`). */
export const HighlightedText: React.FC<{ html: string; fallback?: string; className?: string }> = ({ html, fallback = '', className }) => (
  <span className={className} dangerouslySetInnerHTML={{ __html: sanitizeHighlightHtml(html || fallback) }} />
);

/** Zwarte akapity feedbacku: ikona + podpis + tekst, kolor tylko jako akcent (lewa kreska i ikona). */
export const FeedbackNotes: React.FC<{ result: Pick<TranslationEvaluationResult, 'feedbackSyntax' | 'feedbackVocab' | 'feedbackRule' | 'explanation'> }> = ({ result }) => {
  const { t } = useTranslation();
  const notes: Array<{ key: string; label: string; text?: string; tone: ScoreTone | 'info'; Icon: typeof AlertCircle }> = [
    { key: 'syntax', label: t('Szyk i gramatyka'), text: result.feedbackSyntax, tone: 'danger', Icon: AlertCircle },
    { key: 'vocab', label: t('Słownictwo i naturalność'), text: result.feedbackVocab, tone: 'info', Icon: AlertCircle },
    { key: 'rule', label: t('Złota zasada'), text: result.feedbackRule, tone: 'warn', Icon: Sparkles },
  ];
  const visible = notes.filter((n) => n.text && n.text.trim());
  const border = { danger: 'border-l-danger', info: 'border-l-info', warn: 'border-l-warn', success: 'border-l-primary' } as const;
  const iconColor = { danger: 'text-danger', info: 'text-info', warn: 'text-warn', success: 'text-primary' } as const;
  if (visible.length === 0) {
    return result.explanation ? <p className="whitespace-pre-wrap text-sm leading-snug text-text-2">{result.explanation}</p> : null;
  }
  return (
    <div className="space-y-2">
      {visible.map(({ key, label, text, tone, Icon }) => (
        <div key={key} data-testid={`feedback-${key}`} className={`border-l-4 ${border[tone]} pl-3`}>
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-text-hi">
            <Icon className={`h-3.5 w-3.5 shrink-0 ${iconColor[tone]}`} aria-hidden="true" />
            {label}
          </div>
          <p className="mt-0.5 text-sm leading-snug text-text-2">{text}</p>
        </div>
      ))}
    </div>
  );
};

/**
 * Akordeon „Sprawdź feedback": przycisk z `aria-expanded` i `aria-controls`, zwarty nagłówek
 * z ikoną stanu (żarówka, bez migania), zawartość w regionie. Domyślnie zwinięty.
 */
export const FeedbackAccordion: React.FC<{ result: TranslationEvaluationResult; defaultOpen?: boolean }> = ({ result, defaultOpen = false }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();
  return (
    <div className="rounded-lg border border-line-strong">
      <button
        type="button"
        data-testid="feedback-toggle"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-11 w-full items-center gap-2 px-3 py-1.5 text-left text-sm font-bold text-text-hi cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg"
      >
        <Lightbulb className="h-4 w-4 shrink-0 text-warn" aria-hidden="true" />
        <span className="flex-1">{t('Sprawdź feedback')}</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-text-2 transition-transform motion-reduce:transition-none ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>
      <div id={panelId} role="region" hidden={!open} data-testid="feedback-panel" className="border-t border-line-soft px-3 py-2.5">
        <FeedbackNotes result={result} />
      </div>
    </div>
  );
};

interface ListenProps {
  onPlay: (text: string, accent: 'en-US' | 'en-GB') => void;
  playing?: boolean;
}

/**
 * Podsumowanie PO sprawdzeniu zdania (pod zdaniem, w trakcie ćwiczenia): werdykt + wynik ogólny,
 * rząd plakietek, odpowiedź kursanta i wzorzec z odsłuchem, zwarte akapity feedbacku.
 */
export const SentenceFeedbackPanel: React.FC<
  ListenProps & { result: TranslationEvaluationResult; modelLabel?: string; children?: React.ReactNode }
> = ({ result, modelLabel, onPlay, playing, children }) => {
  const { t } = useTranslation();
  const tone = toneForPercent(result.score);
  const classes = TONE_CLASSES[tone];
  const VerdictIcon = ToneIcon[tone];
  const answerTone = result.isCorrect ? 'success' : tone === 'success' ? 'warn' : tone;
  return (
    <section
      aria-label={t('Wynik zdania')}
      data-testid="sentence-feedback"
      className={`w-full space-y-2.5 rounded-xl border bg-surface-flat p-3 text-left ${classes.border}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-sm font-bold text-text-hi" role="status">
          <VerdictIcon className={`h-4 w-4 ${classes.icon}`} aria-hidden="true" />
          {result.isCorrect ? t('Poprawnie') : t('Do poprawy')}
        </span>
        <OverallScore score={result.score} />
      </div>
      {modelLabel && (
        <p className="text-xs text-text-2">
          {t('Sprawdzone przez')} <strong className="font-semibold text-text-hi">{modelLabel}</strong>
        </p>
      )}
      <ScoreBreakdownRow breakdown={result.breakdown} />
      <AnswerBlock label={t('Twoja odpowiedź')} tone={answerTone} testId="answer-student">
        {result.studentAnswer ? (
          <HighlightedAnswerOrText result={result} />
        ) : (
          <span className="italic text-text-2">{t('(brak)')}</span>
        )}
      </AnswerBlock>
      <AnswerBlock
        label={t('Wzorcowe tłumaczenie')}
        testId="answer-model"
        action={<ListenButtons text={result.correctTranslation} onPlay={onPlay} playing={playing} disabled={playing} />}
      >
        <HighlightedText html={result.highlighted_better_version || ''} fallback={result.correctTranslation} />
      </AnswerBlock>
      <FeedbackNotes result={result} />
      {children}
    </section>
  );
};

const HighlightedAnswerOrText: React.FC<{ result: TranslationEvaluationResult }> = ({ result }) => (
  <HighlightedText html={result.highlightedAnswer || ''} fallback={result.studentAnswer} />
);

/**
 * Karta jednego zdania na liście wyników: nagłówek (numer, wynik ogólny), plakietki,
 * „Po polsku" na całą szerokość, a „Twoja odpowiedź" i „Wzorcowe tłumaczenie" obok siebie od
 * szerokiego ekranu, na telefonie jedno pod drugim; akordeon feedbacku na końcu.
 */
export const SentenceResultCard: React.FC<
  ListenProps & { result: TranslationEvaluationResult; index: number; modelLabel?: string }
> = ({ result, index, modelLabel, onPlay, playing }) => {
  const { t } = useTranslation();
  const tone = toneForPercent(result.score);
  const classes = TONE_CLASSES[tone];
  const answerTone = result.isCorrect ? 'success' : tone === 'success' ? 'warn' : tone;
  return (
    <article data-testid="sentence-result" data-tone={tone} className={`space-y-2.5 rounded-xl border border-line-strong border-l-4 bg-surface-flat p-3 sm:p-4 ${classes.bar}`}>
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md border border-line-strong px-2 py-0.5 font-mono text-xs text-text-2">
            {t('Zdanie')} {index + 1}
          </span>
          {modelLabel && (
            <span className="text-xs text-text-2">
              {t('Sprawdzone przez')} <strong className="font-semibold text-text-hi">{modelLabel}</strong>
            </span>
          )}
        </div>
        <OverallScore score={result.score} />
      </header>
      <ScoreBreakdownRow breakdown={result.breakdown} />
      <AnswerBlock label={t('Po polsku')} testId="result-polish">
        <span className="font-semibold">{result.polishSentence}</span>
      </AnswerBlock>
      <div className="grid gap-2.5 sm:grid-cols-2" data-testid="result-answers">
        <AnswerBlock label={t('Twoja odpowiedź')} tone={answerTone} testId="result-student">
          {result.studentAnswer ? result.studentAnswer : <span className="italic text-text-2">{t('(brak)')}</span>}
        </AnswerBlock>
        <AnswerBlock
          label={t('Wzorcowe tłumaczenie')}
          testId="result-model"
          action={<ListenButtons text={result.correctTranslation} onPlay={onPlay} playing={playing} disabled={playing} />}
        >
          <HighlightedText html={result.highlighted_better_version || ''} fallback={result.correctTranslation} />
        </AnswerBlock>
      </div>
      <FeedbackAccordion result={result} />
    </article>
  );
};
