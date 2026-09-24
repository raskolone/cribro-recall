import { test, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildLessonSummaryEmail,
  buildLessonRecapSubject,
  extractTopLanguageItems,
  formatLessonRecapSummary,
  validateLessonSummaryEmail,
  countWords,
} from '../services/homeworkEmail';

describe('Globalny system maili po lekcji (Recap)', () => {
  // 1. Lekcja z dużą liczbą słów i korekt -> max 3 elementy
  it('1. Lekcja z dużą liczbą słów i korekt: mail pokazuje dokładnie maksymalnie 3 elementy z priorytetem dla korekt', () => {
    const vocab = `
      be worth it — być wartym wysiłku lub ceny
      avoid a problem — uniknąć problemu
      trade-off — kompromis
      bottleneck — wąskie gardło
      streamline — usprawniać
      leverage — wykorzystać dźwignię
    `;
    const corrections = `
      ❌ I have listened to that advice earlier.
      ✅ If I had listened to that advice earlier, I would have missed fewer problems.
      not: I am agree, say: I agree
    `;

    const result = buildLessonSummaryEmail({
      studentName: 'Jan Kowalski',
      topic: 'Negotiations & Trade-offs',
      summary: 'Dzięki za dzisiejszą lekcję. Rozmawialiśmy o trudnych negocjacjach biznesowych i ćwiczyliśmy formułowanie kompromisów.',
      vocabulary: vocab,
      corrections: corrections,
      appUrl: 'https://app.maciej.pro',
    });

    assert.equal(result.items.length, 3, 'Powinny być dokładnie 3 elementy');
    assert.equal(result.itemCount, 3);
    // 2 korekty (priorytet) + 1 słówko
    assert.equal(result.items[0].type, 'correction');
    assert.equal(result.items[1].type, 'correction');
    assert.equal(result.items[2].type, 'vocab');
    assert.ok(result.items[2].term?.includes('be worth it'));

    // Wersja tekstowa i HTML zawierają tylko te 3 elementy
    assert.ok(result.text.includes('Warto zapamiętać:'));
    assert.ok(result.text.includes('be worth it'));
    assert.ok(!result.text.includes('bottleneck'), 'Dodatkowe słowa nie powinny znaleźć się w mailu');
    assert.ok(!result.text.includes('streamline'));

    // Liczba słów mieści się w limicie 80–180
    assert.ok(result.wordCount <= 180, `Liczba słów (${result.wordCount}) musi być <= 180`);
  });

  // 2. Lekcja bez korekt -> najważniejsze słowa lub zwroty
  it('2. Lekcja bez korekt: mail pokazuje najważniejsze słowa lub zwroty (max 3)', () => {
    const vocab = `
      commute — dojeżdżać do pracy
      rush hour — godziny szczytu
      public transit — transport publiczny
      traffic jam — korek drogowy
    `;

    const result = buildLessonSummaryEmail({
      studentName: 'Anna',
      topic: 'Daily Commute',
      summary: 'Dzięki za dzisiejszą lekcję. Rozmawialiśmy o codziennych dojazdach do biura i porównywaliśmy transport miejski.',
      vocabulary: vocab,
      corrections: '',
      appUrl: 'https://app.maciej.pro',
    });

    assert.equal(result.items.length, 3);
    assert.ok(result.items.every((it) => it.type === 'vocab'));
    assert.ok(result.text.includes('commute'));
    assert.ok(result.text.includes('rush hour'));
    assert.ok(result.text.includes('public transit'));
    assert.ok(!result.text.includes('traffic jam'));
  });

  // 3. Lekcja bez nowych elementów -> krótkie podsumowanie i brak zmyślania materiału
  it('3. Lekcja bez nowych elementów: mail zawiera krótkie podsumowanie i nie wymyśla materiału', () => {
    const result = buildLessonSummaryEmail({
      studentName: 'Piotr',
      topic: 'General Discussion & Review',
      summary: 'Dzięki za dzisiejszą lekcję. Płynnie powtórzyliśmy materiał z poprzednich tygodni w swobodnej konwersacji.',
      vocabulary: '',
      corrections: '',
      appUrl: 'https://app.maciej.pro',
    });

    assert.equal(result.items.length, 0);
    assert.equal(result.itemCount, 0);
    assert.ok(!result.text.includes('Warto zapamiętać:'));
    assert.ok(!result.html.includes('Warto zapamiętać:'));
    assert.ok(result.text.includes('Cześć, Piotrze!'));
    assert.ok(result.text.includes('Dzięki za dzisiejszą lekcję.'));
    assert.ok(result.wordCount < 180);
  });

  // 4. Kursant bez dostępu do aplikacji -> brak fałszywego linku, krótki tekst
  it('4. Kursant bez dostępu do aplikacji: mail nie zawiera fałszywego linku / przycisku', () => {
    const result = buildLessonSummaryEmail({
      studentName: 'Katarzyna',
      topic: 'Business Writing',
      summary: 'Dzięki za dzisiejszą lekcję. Ćwiczyliśmy pisanie formalnych wiadomości do klientów.',
      vocabulary: 'inquire — dowiadywać się\nfurthermore — ponadto',
      hasAppAccess: false,
      appUrl: undefined,
    });

    assert.ok(!result.html.includes('Ćwicz w Cribro Recall'), 'Nie powinno być przycisku CTA');
    assert.ok(!result.html.includes('href="https://'), 'Nie powinno być linku https');
    assert.ok(result.html.includes('Otwórz Cribro Recall, aby przećwiczyć dzisiejsze elementy.'));
    assert.ok(result.text.includes('Otwórz Cribro Recall, aby przećwiczyć dzisiejsze elementy.'));
    assert.ok(!result.text.includes('https://'));
  });

  // 5. Kursant z aktywnym dostępem -> jeden przycisk Cribro Recall
  it('5. Kursant z aktywnym dostępem: mail zawiera dokładnie jeden przycisk Cribro Recall', () => {
    const result = buildLessonSummaryEmail({
      studentName: 'Marek',
      topic: 'Agile Project Management',
      summary: 'Dzięki za dzisiejszą lekcję. Rozmawialiśmy o ceremoniach Scrum i zarządzaniu sprintem.',
      vocabulary: 'backlog — rejestr zadań\nstandup — krótkie spotkanie statusowe',
      hasAppAccess: true,
      appUrl: 'https://app.maciej.pro',
    });

    assert.ok(result.html.includes('Ćwicz w Cribro Recall'));
    assert.ok(result.html.includes('href="https://app.maciej.pro"'));
    // Dokładnie 1 główny przycisk CTA
    const buttonOccurrences = result.html.split('Ćwicz w Cribro Recall').length - 1;
    assert.equal(buttonOccurrences, 1);
  });

  // 6. Bardzo długie podsumowanie -> mail pozostaje krótszy niż 180 słów (automatyczne skracanie)
  it('6. Bardzo długie podsumowanie: automatycznie skracane do max 2 zdań, mail pozostaje < 180 słów', () => {
    const veryLongSummary = `
      # Pełny Raport Lekcji
      BLOK 1 — Lekcja w skrócie:
      Dzisiaj odbyła się bardzo obszerna i intensywna lekcja z zakresu zaawansowanej komunikacji międzykulturowej w międzynarodowych korporacjach technologicznych.
      Przeanalizowaliśmy dokładnie kilkanaście różnych scenariuszy negocjacyjnych z partnerami z rynków azjatyckich oraz amerykańskich.
      Kursant wykazał się doskonałym zrozumieniem niuansów, aczkolwiek w dalszym ciągu należy zwrócić szczególną uwagę na stosowanie właściwych zwrotów dyplomatycznych.
      W dalszej części lekcji przeszliśmy do szczegółowej analizy struktur gramatycznych oraz omówienia długoterminowego planu rozwoju.
      Na sam koniec lektor przedstawił dodatkowe wskazówki dotyczące samodzielnej pracy w domu.
    `;

    const result = buildLessonSummaryEmail({
      studentName: 'Aleksander',
      topic: 'Cross-Cultural Negotiations and Global Stakeholder Management in High-Stakes Tech Mergers',
      summary: veryLongSummary,
      vocabulary: 'diplomatic phrasing — dyplomatyczne formułowanie myśli\nmitigate risks — ograniczać ryzyko\ncontingency plan — plan awaryjny',
      corrections: '❌ We must to agree. ✅ We must agree.',
      appUrl: 'https://app.maciej.pro',
    });

    assert.ok(result.sentenceCount <= 2, `Liczba zdań w podsumowaniu (${result.sentenceCount}) musi być <= 2`);
    assert.ok(result.wordCount <= 180, `Liczba słów (${result.wordCount}) musi być <= 180`);
    assert.ok(result.subject.length <= 60, `Temat (${result.subject.length} zn.) musi mieć max 60 znaków`);
    assert.ok(result.items.length <= 3);
    assert.equal(result.validation.status, 'PASS');
  });

  // 7. Ponowne wygenerowanie -> nie zmienia odbiorcy ani lekcji
  it('7. Ponowne wygenerowanie: zachowuje determinizm, odbiorcę i wybrane elementy', () => {
    const params = {
      studentName: 'Monika',
      topic: 'Financial Reporting',
      summary: 'Dzięki za dzisiejszą lekcję. Rozmawialiśmy o kwartalnych raportach finansowych i analizie wskaźników ROI.',
      vocabulary: 'revenue stream — źródło przychodów\nprofit margin — marża zysku',
      corrections: '❌ In my opinion it is more cheap. ✅ In my opinion it is cheaper.',
      appUrl: 'https://app.maciej.pro',
    };

    const run1 = buildLessonSummaryEmail(params);
    const run2 = buildLessonSummaryEmail(params);

    assert.equal(run1.greeting, run2.greeting);
    assert.equal(run1.subject, run2.subject);
    assert.equal(run1.wordCount, run2.wordCount);
    assert.equal(run1.text, run2.text);
    assert.equal(run1.html, run2.html);
    assert.deepEqual(run1.items, run2.items);
    assert.equal(run1.greeting, 'Cześć, Moniko!');
  });

  // Temat wiadomości <= 60 znaków
  it('buildLessonRecapSubject: ucina długi temat do maksymalnie 60 znaków', () => {
    const longTopic = 'Troubleshooting Complex Aeronautical Engineering Systems in International Aviation Environments';
    const subj = buildLessonRecapSubject(longTopic);
    assert.ok(subj.length <= 60, `Temat (${subj.length} zn.) nie może przekraczać 60 znaków: "${subj}"`);
    assert.ok(subj.endsWith('...'));
  });

  // Walidacja statusów
  it('validateLessonSummaryEmail: poprawnie klasyfikuje PASS, WARNING i FAIL', () => {
    const pass = validateLessonSummaryEmail({
      wordCount: 110,
      itemCount: 3,
      sentenceCount: 2,
      studentName: 'Jan',
      appUrl: 'https://app.maciej.pro',
      hasAppAccess: true,
    });
    assert.equal(pass.status, 'PASS');

    const warning = validateLessonSummaryEmail({
      wordCount: 160,
      itemCount: 0,
      sentenceCount: 2,
      studentName: 'Jan',
      hasAppAccess: false,
    });
    assert.equal(warning.status, 'WARNING');
    assert.ok(warning.warnings.length > 0);

    const fail = validateLessonSummaryEmail({
      wordCount: 200,
      itemCount: 5,
      sentenceCount: 4,
      studentName: '',
      hasFullReportMarkers: true,
    });
    assert.equal(fail.status, 'FAIL');
    assert.ok(fail.errors.length >= 2);
  });
});
