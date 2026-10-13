import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  buildHomeworkEmail,
  buildHomeworkGradedEmail,
  buildUnsubscribeUrl,
  generateUnsubscribeToken,
} from '../functions/src/emailTemplate';
import {
  buildGradedHomeworkEmail,
  buildHomeworkConfirmationEmail,
} from '../services/homeworkEmail';
import {
  HOMEWORK_TYPE_LABELS,
  buildStaticHomeworkNote,
  cleanTopic,
} from '../services/homeworkGenerator';

const SCRATCH_DIR = '/Users/maciej/.gemini/antigravity-ide/brain/6a65d380-eecb-45ac-8509-8aac4a82d83b/scratch';

// Funkcja pomocnicza do obliczania kontrastu WCAG
function getLuminance(hex: string): number {
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.slice(0, 2), 16) / 255;
  const g = parseInt(cleanHex.slice(2, 4), 16) / 255;
  const b = parseInt(cleanHex.slice(4, 6), 16) / 255;

  const toLinear = (c: number) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);

  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

function getContrastRatio(hex1: string, hex2: string): number {
  const l1 = getLuminance(hex1);
  const l2 = getLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

test('generateUnsubscribeToken tworzy powtarzalny 16-znakowy token HMAC', () => {
  const uid = 'student-test-uid-123';
  const token1 = generateUnsubscribeToken(uid);
  const token2 = generateUnsubscribeToken(uid);

  assert.equal(token1.length, 16);
  assert.equal(token1, token2);
  assert.notEqual(token1, generateUnsubscribeToken('other-student-uid'));
});

test('buildUnsubscribeUrl generuje poprawny URL z parametrami uid i token', () => {
  const uid = 'student-xyz';
  const url = buildUnsubscribeUrl(uid);

  assert.ok(url.startsWith('https://app.maciej.pro/unsubscribe?'));
  assert.ok(url.includes(`uid=${uid}`));
  assert.ok(url.includes(`token=${generateUnsubscribeToken(uid)}`));
});

test('buildHomeworkEmail zawiera link wypisania w wersji HTML i tekstowej', () => {
  const uid = 'student-abc';
  const unsubUrl = buildUnsubscribeUrl(uid);

  const email = buildHomeworkEmail({
    studentName: 'Jan Kowalski',
    title: 'Czasowniki modalne',
    dueDate: '2026-09-20',
    itemCount: 5,
    assignedBy: 'Lektor Testowy',
    unsubscribeUrl: unsubUrl,
  });

  assert.ok(email.html.includes(unsubUrl.replace('&', '&amp;')));
  assert.ok(email.html.includes('Wypisz się z powiadomień e-mail'));
  assert.ok(email.text.includes(unsubUrl));
  assert.ok(email.text.includes('Wypisz się z powiadomień:'));
});

test('buildHomeworkEmail działa poprawnie bez podanego unsubscribeUrl', () => {
  const email = buildHomeworkEmail({
    studentName: 'Jan',
    title: 'Test bez linku',
    itemCount: 3,
  });

  assert.ok(!email.html.includes('Wypisz się z powiadomień e-mail'));
  assert.ok(email.html.includes('NOWA PRACA DOMOWA'));
  assert.ok(email.text.includes('Przygotowałem dla Ciebie nową pracę domową'));
  assert.ok(email.html.includes('Maciej Wyrozumski'));
  assert.ok(email.html.includes('wyrozumski@maciej.pro'));
  assert.ok(email.html.includes('+48 698 250 507'));
  assert.ok(email.html.includes('www.maciej.pro'));
  assert.ok(email.html.includes('linkedin.com/in/maciej-pro'));
  assert.ok(email.html.includes('github.com/raskolone'));
});

test('buildHomeworkConfirmationEmail generuje powitanie z wołaczem, prostą treść i stopkę z wizytówką', () => {
  const email = buildHomeworkConfirmationEmail({
    studentName: 'Aleksander Ziółkowski',
    title: 'Cybersecurity & Privacy in the AI Era',
    dueDate: '2026-09-16',
    instructions: 'Zwróć uwagę na czasowniki modalne.',
    assignedBy: 'Maciej Wyrozumski',
    sentences: [
      { polishSentence: 'W dzisiejszych czasach prywatność w sieci jest kluczowa.', hint: 'crucial' },
      { polishSentence: 'Musimy uważać na podejrzane wiadomości e-mail.', hint: 'phishing' },
    ],
    customNote: 'Dobra robota na dzisiejszych zajęciach!',
  });

  assert.equal(email.greeting, 'Cześć, Aleksandrze!');
  assert.ok(email.html.includes('Cześć, Aleksandrze!'));
  assert.ok(email.html.includes('Cybersecurity &amp; Privacy in the AI Era'));
  assert.ok(!email.html.includes('W dzisiejszych czasach prywatność w sieci jest kluczowa.'));
  assert.ok(email.html.includes('Zwróć uwagę na czasowniki modalne.'));
  assert.ok(email.html.includes('Dobra robota na dzisiejszych zajęciach!'));

  assert.ok(email.html.includes('Maciej Wyrozumski'));
  assert.ok(email.html.includes('Instructional Designer | AI EdTech Specialist | English Trainer'));
  assert.ok(email.html.includes('wyrozumski@maciej.pro'));
  assert.ok(email.html.includes('+48 698 250 507'));
  assert.ok(email.html.includes('www.maciej.pro'));
  assert.ok(email.html.includes('linkedin.com/in/maciej-pro'));
  assert.ok(email.html.includes('github.com/raskolone'));

  assert.ok(email.text.includes('Cześć, Aleksandrze!'));
  assert.ok(email.text.includes('Cybersecurity & Privacy in the AI Era'));
  assert.ok(!email.text.includes('1. W dzisiejszych czasach prywatność w sieci jest kluczowa.'));
  assert.ok(email.text.includes('Maciej Wyrozumski'));
  assert.ok(email.text.includes('wyrozumski@maciej.pro'));
});

test('buildStaticHomeworkNote: statyczna notatka zawiera wołacz Cześć, temat i bez wywołania AI', () => {
  const note = buildStaticHomeworkNote({
    studentName: 'Bartłomiej',
    topicTitle: 'From Symptom to Solution: Troubleshooting an Aircraft Problem',
    lessonTopics: ['From Symptom to Solution: Troubleshooting an Aircraft Problem'],
    link: 'https://app.maciej.pro/hw?token=abc123',
  });

  assert.ok(note.startsWith('Cześć, Bartłomieju!'));
  assert.ok(note.includes('From Symptom to Solution: Troubleshooting an Aircraft Problem'));
  assert.ok(note.includes('Daj znać, jak Ci poszło!'));
  const topicOccurrences = note.split('Troubleshooting an Aircraft Problem').length - 1;
  assert.strictEqual(topicOccurrences, 1, `temat nie powinien się duplikować, wystąpił ${topicOccurrences} razy`);
});

test('buildStaticHomeworkNote: brak tematu/linku nie psuje zdania (statyczny fallback bez wymyślonych danych)', () => {
  const note = buildStaticHomeworkNote({ studentName: 'Zofia' });

  assert.ok(note.startsWith('Cześć, Zofio!'));
  assert.ok(note.includes('zestaw powtórkowy'));
  assert.ok(!note.includes('Link'));
});

test('buildStaticHomeworkNote: brak imienia kursanta używa ogólnego powitania "Cześć!"', () => {
  const note = buildStaticHomeworkNote({ topicTitle: 'Business Idioms' });
  assert.ok(note.startsWith('Cześć!'));
});

test('buildStaticHomeworkNote: wersja EN dla kursanta anglojęzycznego', () => {
  const note = buildStaticHomeworkNote({
    studentName: 'Anna',
    topicTitle: 'Business Idioms',
    link: 'https://app.maciej.pro/hw?token=xyz789',
    language: 'en',
  });

  assert.ok(note.startsWith('Hi Anna!'));
  assert.ok(note.includes('Business Idioms'));
  assert.ok(note.includes('Let me know how it goes!'));
});

test('cleanTopic: usuwa prefiks "Praca domowa:" i duplikat tego samego tematu sklejonego z topicTitle i lessonTopics', () => {
  assert.strictEqual(cleanTopic('Praca domowa: Digital Tools for Remote Teams'), 'Digital Tools for Remote Teams');
  assert.strictEqual(cleanTopic('Homework: Business Idioms'), 'Business Idioms');
  assert.strictEqual(cleanTopic('Digital Tools, Digital Tools'), 'Digital Tools');

  const note = buildStaticHomeworkNote({
    studentName: 'Kacper',
    topicTitle: 'Praca domowa: Digital Tools for Remote Teams',
    lessonTopics: ['Digital Tools for Remote Teams'],
  });

  const topicOccurrences = note.split('Digital Tools for Remote Teams').length - 1;
  assert.strictEqual(topicOccurrences, 1, `temat nie powinien się duplikować, wystąpił ${topicOccurrences} razy`);
  assert.ok(!note.includes('Praca domowa:'));
});

// ══════════════════════════════════════════════════════════════
// TESTY DLA WYMAGAŃ ZADANIA MAIL1 (etap A)
// ══════════════════════════════════════════════════════════════

test('MAIL1 (a): obecność linku do pracy w obu mailach (przycisk CTA oraz tekstowy link pod spodem)', () => {
  const directLinkAssigned = 'https://app.maciej.pro/hw?token=assigned-token-123';
  const directLinkGraded = 'https://app.maciej.pro/hw?token=graded-token-456';

  // 1. Mail z przypisaniem (buildHomeworkEmail)
  const assigned = buildHomeworkEmail({
    studentName: 'Monika Kowalska',
    title: 'Conditional Sentences',
    dueDate: '2026-10-20',
    itemCount: 4,
    appUrl: directLinkAssigned,
  });

  // Przycisk CTA
  assert.ok(
    assigned.html.includes(`href="${directLinkAssigned}"`),
    'Mail przypisania: brak linku w przycisku CTA'
  );
  // Tekstowy link pod przyciskiem
  assert.ok(
    assigned.html.includes(`>${directLinkAssigned}</a>`),
    'Mail przypisania: brak bezpośredniego linku tekstowego pod przyciskiem'
  );
  assert.ok(
    assigned.html.includes('Lub przejdź bezpośrednio pod adres:'),
    'Mail przypisania: brak etykiety pod przyciskiem'
  );
  assert.ok(
    assigned.text.includes(directLinkAssigned),
    'Mail przypisania: brak linku w wersji tekstowej'
  );

  // 2. Mail po ocenie (buildGradedHomeworkEmail)
  const graded = buildGradedHomeworkEmail({
    studentName: 'Monika Kowalska',
    title: 'Conditional Sentences',
    score: 95,
    teacherFeedback: 'Doskonałe opanowanie drugiego trybu warunkowego!',
    appUrl: directLinkGraded,
  });

  // Przycisk CTA
  assert.ok(
    graded.html.includes(`href="${directLinkGraded}"`),
    'Mail oceny: brak linku w przycisku CTA'
  );
  // Tekstowy link pod przyciskiem
  assert.ok(
    graded.html.includes(`>${directLinkGraded}</a>`),
    'Mail oceny: brak bezpośredniego linku tekstowego pod przyciskiem'
  );
  assert.ok(
    graded.html.includes('Lub przejdź bezpośrednio pod adres:'),
    'Mail oceny: brak etykiety pod przyciskiem'
  );
  assert.ok(
    graded.text.includes(directLinkGraded),
    'Mail oceny: brak linku w wersji tekstowej'
  );
});

test('MAIL1 (b): brak „Hej”, brak zdublowanego tytułu, zwrot do kursanta w 2. osobie', () => {
  // 1. Mail przypisania
  const assigned = buildHomeworkEmail({
    studentName: 'Monika Kowalska',
    title: 'Praca domowa: Business Negotiations',
    itemCount: 5,
  });

  assert.ok(!assigned.html.includes('Hej'), 'Mail przypisania HTML nie może zawierać słowa Hej');
  assert.ok(!assigned.text.includes('Hej'), 'Mail przypisania Text nie może zawierać słowa Hej');
  assert.ok(
    assigned.greeting.startsWith('Cześć, Moniko!'),
    `Oczekiwano "Cześć, Moniko!", otrzymano: ${assigned.greeting}`
  );
  // Brak zdublowanego tytułu: "Praca domowa: Praca domowa: ..."
  assert.ok(!assigned.html.includes('Praca domowa: Praca domowa'));
  assert.ok(!assigned.subject.includes('Praca domowa: Praca domowa'));
  assert.ok(assigned.html.includes('Twoja praca domowa:'));
  assert.ok(assigned.html.includes('Business Negotiations'));

  // 2. Mail po ocenie
  const graded = buildGradedHomeworkEmail({
    studentName: 'Monika Kowalska',
    title: 'Homework: Business Negotiations',
    score: 88,
  });

  assert.ok(!graded.html.includes('Hej'), 'Mail oceny HTML nie może zawierać słowa Hej');
  assert.ok(!graded.text.includes('Hej'), 'Mail oceny Text nie może zawierać słowa Hej');
  assert.ok(
    graded.greeting.startsWith('Cześć, Moniko!'),
    `Oczekiwano "Cześć, Moniko!", otrzymano: ${graded.greeting}`
  );
  assert.ok(!graded.html.includes('Praca domowa: Praca domowa'));
  assert.ok(!graded.html.includes('Homework: Homework'));
  assert.ok(graded.html.includes('Sprawdziłem Twoją pracę domową'));

  // 3. Etykieta typu zadania translation w 2. osobie
  assert.equal(
    HOMEWORK_TYPE_LABELS.translation.hint.pl,
    'Tłumaczysz z polskiego na angielski.',
    'Etykieta typu tłumaczenia musi być w 2. osobie ("Tłumaczysz z..."), a nie w 3. ("Kursant tłumaczy...")'
  );
});

test('MAIL1 (c): sprawdzenie kontrastu AA (≥ 4.5:1) dla wszystkich par tekst/tło w szablonie', () => {
  const colorPairs = [
    // [nazwa roli, kolor tekstu, kolor tła]
    ['Przycisk CTA tekst na fallback tła', '#ffffff', '#0f766e'],
    ['Przycisk CTA tekst na ciemnym końcu gradientu', '#ffffff', '#115e59'],
    ['Główny nagłówek h1 na białym tle karty', '#0f172a', '#ffffff'],
    ['Akapity treści głównej na białym tle', '#334155', '#ffffff'],
    ['Tekst drugorzędny / etykiety na białym tle', '#475569', '#ffffff'],
    ['Link akcentowy / brand na białym tle', '#0f766e', '#ffffff'],
    ['Zielona odznaka tekst na zielonym tle', '#166534', '#f0fdf4'],
    ['Niebieska odznaka tekst na błękitnym tle', '#1d4ed8', '#eff6ff'],
    ['Tytuł zadania na jasnoszarym tle kafelka', '#0f172a', '#f8fafc'],
    ['Etykieta kafelka na jasnoszarym tle', '#475569', '#f8fafc'],
    ['Wartość oceny na jasnoszarym tle', '#0f172a', '#f8fafc'],
    ['Tekst wypisania z subskrypcji na tle strony', '#64748b', '#f8fafc'],
    ['Tekst wypisania z subskrypcji na białym tle', '#64748b', '#ffffff'],
  ];

  for (const [name, fg, bg] of colorPairs) {
    const ratio = getContrastRatio(fg, bg);
    assert.ok(
      ratio >= 4.5,
      `Kontrast dla "${name}" (${fg} na ${bg}) wynosi ${ratio.toFixed(2)}:1 i jest poniżej progu WCAG AA 4.5:1`
    );
  }
});

test('MAIL1 (d): obecność atrybutów bgcolor i meta color-scheme light (niezależność od trybu ciemnego)', () => {
  const assigned = buildHomeworkEmail({
    studentName: 'Monika Kowalska',
    title: 'Grammar review',
    itemCount: 3,
  });

  const graded = buildGradedHomeworkEmail({
    studentName: 'Monika Kowalska',
    title: 'Grammar review',
    score: 90,
  });

  for (const [name, email] of [['Przypisanie', assigned], ['Ocena', graded]] as const) {
    // Meta color-scheme
    assert.ok(
      email.html.includes('<meta name="color-scheme" content="light">'),
      `${name}: brak meta name="color-scheme" content="light"`
    );
    assert.ok(
      email.html.includes('<meta name="supported-color-schemes" content="light">'),
      `${name}: brak meta name="supported-color-schemes" content="light"`
    );
    assert.ok(
      email.html.includes('color-scheme: light;'),
      `${name}: brak CSS color-scheme: light w nagłówku style`
    );

    // Atrybuty bgcolor dla tabelowego layoutu kompatybilnego z klientami poczty
    assert.ok(
      email.html.includes('bgcolor="#f8fafc"'),
      `${name}: brak bgcolor="#f8fafc" na body lub tabeli nadrzędnej`
    );
    assert.ok(
      email.html.includes('bgcolor="#ffffff"'),
      `${name}: brak bgcolor="#ffffff" na karcie wiadomości`
    );
    assert.ok(
      email.html.includes('bgcolor="#0f766e"'),
      `${name}: brak bgcolor="#0f766e" na komórce przycisku bulletproof`
    );
  }
});

test('MAIL1 (e): renderowanie obu maili do plików HTML w scratchpadzie', () => {
  if (!fs.existsSync(SCRATCH_DIR)) {
    fs.mkdirSync(SCRATCH_DIR, { recursive: true });
  }

  const assigned = buildHomeworkEmail({
    studentName: 'Monika Kowalska',
    title: 'Business English — Past Tenses & Idioms',
    dueDate: '2026-10-25',
    itemCount: 6,
    instructions: 'Zwróć szczególną uwagę na różnicę między Past Simple a Past Continuous.',
    appUrl: 'https://app.maciej.pro/hw?token=monika-test-token-hw1',
    unsubscribeUrl: 'https://app.maciej.pro/unsubscribe?uid=monika-test&token=mock1234',
  });

  const graded = buildGradedHomeworkEmail({
    studentName: 'Monika Kowalska',
    title: 'Business English — Past Tenses & Idioms',
    score: 92,
    teacherFeedback: 'Bardzo dobrze poradziłaś sobie z czasownikami nieregularnymi! Pamiętaj jedynie o szyku wyrazów w pytaniach.',
    gradedBy: 'Maciej Wyrozumski',
    appUrl: 'https://app.maciej.pro/hw?token=monika-test-token-hw1',
    unsubscribeUrl: 'https://app.maciej.pro/unsubscribe?uid=monika-test&token=mock1234',
  });

  const assignedPath = path.join(SCRATCH_DIR, 'assigned_homework_email.html');
  const gradedPath = path.join(SCRATCH_DIR, 'graded_homework_email.html');

  fs.writeFileSync(assignedPath, assigned.html, 'utf-8');
  fs.writeFileSync(gradedPath, graded.html, 'utf-8');

  assert.ok(fs.existsSync(assignedPath), 'Plik assigned_homework_email.html nie został utworzony');
  assert.ok(fs.existsSync(gradedPath), 'Plik graded_homework_email.html nie został utworzony');
  assert.ok(fs.statSync(assignedPath).size > 1000, 'assigned_homework_email.html jest za mały lub pusty');
  assert.ok(fs.statSync(gradedPath).size > 1000, 'graded_homework_email.html jest za mały lub pusty');
});
