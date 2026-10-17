import '../../i18n';
import React from 'react';
import { createRoot } from 'react-dom/client';
// FlashcardsMode nie jest eksportowany ze źródła — skrypt testu dopisuje eksport w pamięci (onLoad esbuild).
// @ts-ignore
import { FlashcardsMode } from '../../components/flashcards/FlashcardStudyScreen';
import { HomeworkWarmupCards } from '../../components/dashboard/HomeworkWarmupCards';

const q = new URLSearchParams(location.search);
document.documentElement.setAttribute('data-theme', q.get('theme') || 'dark');
const TERMS: Record<string, [string, string]> = {
  motivation: ['motivation', 'motywacja'],
  save: ['save time', 'oszczędzać czas'],
  keep: ['keep something under control', 'mieć coś pod kontrolą'],
  long: ['to get away with something that you really should not have done in the first place and never be asked about it again', 'ujść komuś na sucho coś, czego w ogóle nie powinno się było robić, i nigdy więcej nie zostać o to zapytanym przez nikogo'],
};
const [T, D] = TERMS[q.get('term') || 'motivation'];
const labels: Record<string, string> = { 'flashcards.term': 'Pojęcie', 'flashcards.definition': 'Definicja', 'flashcards.quit': 'Zakończ', 'flashcards.clickReveal': 'Kliknij, aby odkryć' };

// Łańcuch kontenerów jak w Dashboard.tsx: kolumna flex, a w GSAPModuleTransition `max-md:[&>*]:w-full`.
const Study = () => (
  <div className="flex flex-col h-[100dvh] w-full overflow-hidden">
    <div className="h-14 shrink-0 border-b border-line-strong px-4 flex items-center">TopBar</div>
    <main className="flex-1 overflow-y-auto overflow-x-hidden relative min-w-0 flex flex-col">
      <div className="flex-1 min-h-0 flex flex-col">
        <div className="flex-1 min-h-0 flex flex-col max-md:[&>*]:w-full max-md:[&>*]:min-w-0">
          <FlashcardsMode
            cards={[{ id: 'c1', term: T, definition: D }, { id: 'c2', term: 'second', definition: 'drugi' }]}
            setId="s1" onBack={() => {}} saveSession={async () => {}} t={(k: string) => labels[k] || k}
            showConfirm={() => {}} closeConfirm={() => {}} onNavigate={() => {}} language="pl"
            onStartQuiz={() => {}} onStartSentences={() => {}}
          />
        </div>
      </div>
    </main>
  </div>
);
// Łańcuch jak w shell() z DirectHomeworkScreen.tsx (kolumna flex, items-center).
const Warmup = () => (
  <div className="min-h-[100dvh] relative text-content bg-base-100 flex flex-col items-center justify-start overflow-y-auto overflow-x-hidden">
    <div className="relative z-10 w-full max-w-3xl px-4 py-8 sm:py-12 pb-36 flex flex-col items-center">
      <HomeworkWarmupCards cards={[{ term: T, definition: D, contextSentence: 'This is an example.' }, { term: 'second', definition: 'drugi' }]} onDone={() => {}} onSkip={() => {}} />
    </div>
  </div>
);
createRoot(document.getElementById('root')!).render(q.get('area') === 'warmup' ? <Warmup /> : <Study />);
