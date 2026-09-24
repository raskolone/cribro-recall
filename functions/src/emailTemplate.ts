import { createHmac } from 'crypto';
import { APP_URL } from './config';

const UNSUBSCRIBE_SECRET = process.env.UNSUBSCRIBE_SECRET || 'cribro-recall-opt-out-secret-2026';

export const generateUnsubscribeToken = (uid: string): string => {
  return createHmac('sha256', UNSUBSCRIBE_SECRET).update(uid).digest('hex').slice(0, 16);
};

export const buildUnsubscribeUrl = (uid: string): string => {
  const token = generateUnsubscribeToken(uid);
  return `${APP_URL}/unsubscribe?uid=${encodeURIComponent(uid)}&token=${token}`;
};

/**
 * Treść powiadomienia o nowej pracy domowej.
 *
 * Wersja HTML i tekstowa niosą to samo — część klientów pocztowych blokuje
 * HTML, a powiadomienie bez treści alternatywnej ląduje wtedy puste. Style są
 * pisane w atrybutach, bo klienty pocztowe wycinają arkusze z nagłówka.
 */

export interface HomeworkEmailData {
  studentName: string;
  title: string;
  instructions?: string;
  dueDate?: string;
  itemCount: number;
  assignedBy?: string;
  customNote?: string;
  unsubscribeUrl?: string;
}

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** `2026-08-21` → `21.08.2026`. Inny kształt zostawiamy, jaki przyszedł. */
const formatDate = (value?: string): string => {
  if (!value) return '';
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return match ? `${match[3]}.${match[2]}.${match[1]}` : value;
};

const plural = (n: number, one: string, few: string, many: string): string => {
  if (n === 1) return one;
  const last = n % 10;
  const lastTwo = n % 100;
  if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) return few;
  return many;
};

export function toPolishVocative(rawName?: string | null): string {
  if (!rawName || typeof rawName !== 'string') return '';
  const trimmed = rawName.trim();
  if (!trimmed) return '';
  const name = trimmed.split(/\s+/)[0];

  const irregulars: Record<string, string> = {
    'anna': 'Anno',
    'marta': 'Marto',
    'kuba': 'Kubo',
    'tomek': 'Tomku',
    'bartek': 'Bartku',
    'wojtek': 'Wojtku',
    'przemek': 'Przemku',
    'kacper': 'Kacprze',
    'piotr': 'Piotrze',
    'paweł': 'Pawle',
    'pawel': 'Pawle',
    'michał': 'Michale',
    'michal': 'Michale',
    'marek': 'Marku',
    'jacek': 'Jacku',
    'aleksander': 'Aleksandrze',
    'artur': 'Arturze',
    'wiktor': 'Wiktorze',
    'igor': 'Igorze',
    'grzegorz': 'Grzegorzu',
    'łukasz': 'Łukaszu',
    'lukasz': 'Łukaszu',
    'mateusz': 'Mateuszu',
    'bartosz': 'Bartoszu',
    'tomasz': 'Tomaszu',
    'maciej': 'Macieju',
    'andrzej': 'Andrzeju',
    'mikołaj': 'Mikołaju',
    'mikolaj': 'Mikołaju',
    'rafał': 'Rafale',
    'rafal': 'Rafale',
    'karol': 'Karolu',
    'kamil': 'Kamilu',
    'adam': 'Adamie',
    'jan': 'Janie',
    'marcin': 'Marcinie',
    'damian': 'Damianie',
    'szymon': 'Szymonie',
    'adrian': 'Adrianie',
    'sebastian': 'Sebastianie',
    'jakub': 'Jakubie',
    'filip': 'Filipie',
    'krzysztof': 'Krzysztofie',
    'dawid': 'Dawidzie',
    'robert': 'Robercie',
    'kasia': 'Kasiu',
    'basia': 'Basiu',
    'zuzia': 'Zuziu',
    'ania': 'Aniu',
    'ola': 'Olu',
    'asia': 'Asiu',
  };

  const lower = name.toLowerCase();
  if (irregulars[lower]) {
    const res = irregulars[lower];
    return res.charAt(0).toUpperCase() + res.slice(1);
  }

  if (lower.endsWith('a')) {
    if (/(sia|cia|zia|dzia|nia)$/.test(lower)) {
      return name.slice(0, -1) + 'u';
    }
    return name.slice(0, -1) + 'o';
  }
  if (lower.endsWith('ek')) return name.slice(0, -2) + 'ku';
  if (lower.endsWith('ik') || lower.endsWith('yk')) return name + 'u';
  if (lower.endsWith('sz') || lower.endsWith('cz') || lower.endsWith('rz')) return name + 'u';
  if (lower.endsWith('ej') || lower.endsWith('aj')) return name + 'u';
  if (lower.endsWith('aw') || lower.endsWith('an') || lower.endsWith('on') || lower.endsWith('in')) return name + 'ie';
  if (lower.endsWith('b') || lower.endsWith('p') || lower.endsWith('m') || lower.endsWith('w')) return name + 'ie';
  if (lower.endsWith('d')) return name.slice(0, -1) + 'dzie';
  if (lower.endsWith('t')) return name.slice(0, -1) + 'cie';
  if (lower.endsWith('r')) return name + 'ze';
  if (lower.endsWith('l')) return name + 'u';
  if (lower.endsWith('ł')) return name.slice(0, -1) + 'le';

  return name;
}

export function formatPolishGreeting(rawName?: string | null): string {
  const vocative = toPolishVocative(rawName);
  if (!vocative) return 'Cześć!';
  return `Cześć, ${vocative}!`;
}

export function detectPolishGender(rawName?: string | null): 'female' | 'male' {
  if (!rawName || typeof rawName !== 'string') return 'male';
  const first = rawName.trim().split(/\s+/)[0].toLowerCase();
  if (!first) return 'male';
  const maleEndingInA = ['kuba', 'kosma', 'barnaba', 'bonawentura', 'jarema'];
  if (maleEndingInA.includes(first)) return 'male';
  const femaleNotEndingInA = ['miriam', 'ines', 'inés', 'beatrix', 'karmen', 'carmen', 'karen', 'nicole', 'rachel', 'ruth', 'ester', 'estera', 'nel', 'nela'];
  if (femaleNotEndingInA.includes(first)) return 'female';
  if (first.endsWith('a')) return 'female';
  return 'male';
}

export function inflectPolishVerb(
  rawName: string | undefined | null,
  femaleForm: string,
  maleForm: string
): string {
  return detectPolishGender(rawName) === 'female' ? femaleForm : maleForm;
}

export function buildHomeworkEmail(data: HomeworkEmailData): {
  subject: string;
  html: string;
  text: string;
} {
  const due = formatDate(data.dueDate);
  const greeting = formatPolishGreeting(data.studentName);
  const verbZnalazl = inflectPolishVerb(data.studentName, 'znalazła', 'znalazł');

  const cleanTitle = data.title?.trim() || 'Praca domowa';
  const subject = /praca domowa/i.test(cleanTitle)
    ? `Nowe zadanie: ${cleanTitle}`
    : `Nowa praca domowa: ${cleanTitle}`;

  // Wizytówka lektora ze stopki (dokładnie według wzoru ze zrzutu ekranu)
  const instructorCardHtml = `
    <div style="margin:28px 0 0;border:1.5px solid #2563eb;border-radius:4px;background:#ffffff;padding:20px 22px;text-align:left;">
      <div style="font-size:18px;font-weight:800;color:#0f172a;line-height:1.25;letter-spacing:-0.01em;">
        Maciej Wyrozumski
      </div>
      <div style="margin-top:4px;font-size:13px;font-weight:400;color:#334155;line-height:1.4;">
        Instructional Designer | AI EdTech Specialist | English Trainer
      </div>
      <div style="margin:14px 0 12px;border-top:2px solid #0f172a;height:0;line-height:0;font-size:0;">&nbsp;</div>
      <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;">
        <tr>
          <td style="width:24px;vertical-align:middle;padding:4px 0;font-size:15px;line-height:1;">✉️</td>
          <td style="vertical-align:middle;padding:4px 0 4px 8px;font-size:13.5px;">
            <a href="mailto:wyrozumski@maciej.pro" style="color:#0f172a;text-decoration:none;font-weight:500;">wyrozumski@maciej.pro</a>
          </td>
        </tr>
        <tr>
          <td style="width:24px;vertical-align:middle;padding:4px 0;font-size:15px;line-height:1;">📞</td>
          <td style="vertical-align:middle;padding:4px 0 4px 8px;font-size:13.5px;">
            <a href="tel:+48698250507" style="color:#0f172a;text-decoration:none;font-weight:500;">+48 698 250 507</a>
          </td>
        </tr>
        <tr>
          <td style="width:24px;vertical-align:middle;padding:4px 0;font-size:15px;line-height:1;">🌐</td>
          <td style="vertical-align:middle;padding:4px 0 4px 8px;font-size:13.5px;">
            <a href="https://www.maciej.pro" target="_blank" rel="noopener noreferrer" style="color:#0f172a;text-decoration:none;font-weight:500;">www.maciej.pro</a>
          </td>
        </tr>
        <tr>
          <td style="width:24px;vertical-align:middle;padding:4px 0;font-size:15px;line-height:1;">🔗</td>
          <td style="vertical-align:middle;padding:4px 0 4px 8px;font-size:13.5px;">
            <a href="https://linkedin.com/in/maciej-pro" target="_blank" rel="noopener noreferrer" style="color:#0f172a;text-decoration:none;font-weight:500;">linkedin.com/in/maciej-pro</a>
          </td>
        </tr>
        <tr>
          <td style="width:24px;vertical-align:middle;padding:4px 0;font-size:15px;line-height:1;">🐙</td>
          <td style="vertical-align:middle;padding:4px 0 4px 8px;font-size:13.5px;">
            <a href="https://github.com/raskolone" target="_blank" rel="noopener noreferrer" style="color:#0f172a;text-decoration:none;font-weight:500;">github.com/raskolone</a>
          </td>
        </tr>
      </table>
    </div>
  `;

  const customNoteHtml = data.customNote
    ? `<div style="margin:0 0 20px;background:#f0fdf4;border:1px solid #bbf7d0;border-left:4px solid #0d9488;padding:16px 18px;border-radius:0 10px 10px 0;">
         <p style="margin:0;font-size:11px;font-weight:700;color:#0f766e;text-transform:uppercase;letter-spacing:0.06em;">Wiadomość ode mnie:</p>
         <p style="margin:6px 0 0;color:#134e4a;font-size:15px;line-height:1.6;font-weight:500;">${escapeHtml(data.customNote)}</p>
       </div>`
    : '';

  const textLines: Array<string | null> = [
    greeting,
    '',
    data.customNote ? `${data.customNote}\n` : null,
    `Przygotowałem dla Ciebie nową pracę domową: „${cleanTitle}".`,
    `Zadanie jest oczywiście opcjonalne, ale byłoby super, gdybyś ${verbZnalazl} na nie 5-10 minut przed naszą kolejną lekcją — to świetny sposób na utrwalenie materiału.`,
    due ? `Zadanie czeka na Ciebie do: ${due}` : null,
    data.instructions ? `\nWskazówki: ${data.instructions}` : null,
    APP_URL ? `\nOtwórz zadanie w aplikacji: ${APP_URL}` : null,
    data.unsubscribeUrl ? `\nWypisz się z powiadomień: ${data.unsubscribeUrl}` : null,
    '',
    '—',
    'Maciej Wyrozumski',
    'Instructional Designer | AI EdTech Specialist | English Trainer',
    '--------------------------------------------------',
    '✉️ wyrozumski@maciej.pro',
    '📞 +48 698 250 507',
    '🌐 www.maciej.pro',
    '🔗 linkedin.com/in/maciej-pro',
    '🐙 github.com/raskolone',
  ];

  const metaHtml = due
    ? `<p style="margin:16px 0 0;color:#475569;font-size:14px;line-height:1.6;">
         ${escapeHtml(`Zadanie czeka na Ciebie do ${due}.`)}
       </p>`
    : '';

  const button = APP_URL
    ? `<div style="margin:26px 0 0;text-align:center;">
         <a href="${escapeHtml(APP_URL)}"
            style="display:inline-block;background:#0d9488;background:linear-gradient(135deg, #0d9488 0%, #0f766e 100%);color:#ffffff;text-decoration:none;
                   padding:14px 28px;border-radius:10px;font-size:15px;font-weight:700;box-shadow:0 4px 12px rgba(13, 148, 136, 0.25);">
           Otwórz zadanie w aplikacji →
         </a>
       </div>`
    : '';

  const instructions = data.instructions
    ? `<div style="margin:16px 0 0;background:#f0fdf4;border-left:4px solid #16a34a;padding:12px 16px;border-radius:0 8px 8px 0;">
         <p style="margin:0;font-size:12px;font-weight:700;color:#166534;text-transform:uppercase;letter-spacing:0.05em;">Wskazówki ode mnie:</p>
         <p style="margin:4px 0 0;color:#14532d;font-size:14px;line-height:1.5;">${escapeHtml(data.instructions)}</p>
       </div>`
    : '';

  const unsubscribeHtml = data.unsubscribeUrl
    ? `<p style="margin:16px 0 0;color:#94a3b8;font-size:11px;line-height:1.5;text-align:center;">
         Nie chcesz otrzymywać powiadomień?
         <a href="${escapeHtml(data.unsubscribeUrl)}" style="color:#64748b;text-decoration:underline;">
           Wypisz się z powiadomień e-mail
         </a>
       </p>`
    : '';

  const html = `<!doctype html>
<html lang="pl">
  <body style="margin:0;padding:24px;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:540px;margin:0 auto;background:#ffffff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,0.06);">
      <!-- Header Gradient Bar -->
      <tr>
        <td style="background:linear-gradient(90deg, #0d9488, #3b82f6);height:6px;font-size:0;line-height:0;">&nbsp;</td>
      </tr>
      <tr>
        <td style="padding:32px 32px 28px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
            <p style="margin:0;font-size:12px;letter-spacing:0.14em;font-weight:800;text-transform:uppercase;color:#0d9488;">CRIBRO ENGLISH</p>
            <span style="font-size:11px;font-weight:600;background:#f0fdf4;color:#16a34a;border:1px solid #bbf7d0;padding:3px 8px;border-radius:999px;">NOWA PRACA DOMOWA</span>
          </div>

          <h1 style="margin:0 0 16px;font-size:23px;line-height:1.3;color:#0f172a;font-weight:800;">
            ${escapeHtml(greeting)}
          </h1>

          ${customNoteHtml}

          <div style="margin:16px 0 0;padding:14px 18px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;">
            <p style="margin:0;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;">Praca domowa:</p>
            <strong style="color:#0f172a;display:block;margin-top:4px;font-size:16px;font-weight:700;line-height:1.4;">${escapeHtml(cleanTitle)}</strong>
          </div>

          <p style="margin:14px 0 0;color:#475569;font-size:14px;line-height:1.6;">
            Zadanie jest oczywiście opcjonalne, ale byłoby super, gdybyś ${verbZnalazl} na nie 5–10 minut przed naszym kolejnym spotkaniem — to świetny sposób, żeby utrwalić to, nad czym pracowaliśmy na lekcji.
          </p>

          ${instructions}
          ${metaHtml}

          <!-- Przycisk CTA -->
          ${button}

          <!-- Wizytówka ze stopki -->
          ${instructorCardHtml}

          ${unsubscribeHtml}
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { subject, html, text: textLines.filter((line) => line !== null).join('\n') };
}

/**
 * Treść powiadomienia o sprawdzonej pracy domowej (v1 — jedyna ścieżka, w
 * której ocena jest osobną, późniejszą akcją lektora; silnik v2 ocenia
 * każdą próbę od razu, więc nie ma tu dla niego odpowiednika zdarzenia).
 *
 * Duplikuje wizytówkę i szkielet z `buildHomeworkEmail` zamiast go
 * refaktoryzować — ten szablon jest już na produkcji i sprawdzony, a nowa
 * wiadomość ma inny nagłówek i inną treść główną.
 */
export interface HomeworkGradedEmailData {
  studentName: string;
  title: string;
  teacherFeedback?: string;
  grade?: number;
  unsubscribeUrl?: string;
}

export function buildHomeworkGradedEmail(data: HomeworkGradedEmailData): {
  subject: string;
  html: string;
  text: string;
} {
  const greeting = formatPolishGreeting(data.studentName);
  const cleanTitle = data.title?.trim() || 'Praca domowa';
  const subject = `Sprawdziłem Twoją pracę domową: ${cleanTitle} 🎓 | Cribro English`;

  const instructorCardHtml = `
    <div style="margin:28px 0 0;border:1.5px solid #2563eb;border-radius:4px;background:#ffffff;padding:20px 22px;text-align:left;">
      <div style="font-size:18px;font-weight:800;color:#0f172a;line-height:1.25;letter-spacing:-0.01em;">
        Maciej Wyrozumski
      </div>
      <div style="margin-top:4px;font-size:13px;font-weight:400;color:#334155;line-height:1.4;">
        Instructional Designer | AI EdTech Specialist | English Trainer
      </div>
      <div style="margin:14px 0 12px;border-top:2px solid #0f172a;height:0;line-height:0;font-size:0;">&nbsp;</div>
      <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;">
        <tr>
          <td style="width:24px;vertical-align:middle;padding:4px 0;font-size:15px;line-height:1;">✉️</td>
          <td style="vertical-align:middle;padding:4px 0 4px 8px;font-size:13.5px;">
            <a href="mailto:wyrozumski@maciej.pro" style="color:#0f172a;text-decoration:none;font-weight:500;">wyrozumski@maciej.pro</a>
          </td>
        </tr>
      </table>
    </div>
  `;

  const feedbackHtml = data.teacherFeedback
    ? `<div style="margin:16px 0 0;background:#f0fdf4;border-left:4px solid #16a34a;padding:12px 16px;border-radius:0 8px 8px 0;">
         <p style="margin:0;font-size:12px;font-weight:700;color:#166534;text-transform:uppercase;letter-spacing:0.05em;">Komentarz i wskazówki ode mnie:</p>
         <p style="margin:4px 0 0;color:#14532d;font-size:14px;line-height:1.5;">${escapeHtml(data.teacherFeedback)}</p>
       </div>`
    : '';

  const gradeHtml = typeof data.grade === 'number'
    ? `<div style="margin:16px 0 0;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:10px 16px;text-align:center;">
         <span style="color:#64748b;font-size:13px;">Ocena: </span>
         <span style="color:#0f172a;font-size:16px;font-weight:700;">${escapeHtml(String(data.grade))}</span>
       </div>`
    : '';

  const button = APP_URL
    ? `<div style="margin:26px 0 0;text-align:center;">
         <a href="${escapeHtml(APP_URL)}"
            style="display:inline-block;background:linear-gradient(135deg, #0d9488 0%, #0f766e 100%);color:#ffffff;text-decoration:none;
                   padding:14px 28px;border-radius:10px;font-size:15px;font-weight:700;box-shadow:0 4px 12px rgba(13, 148, 136, 0.25);">
           Zobacz szczegóły w aplikacji →
         </a>
       </div>`
    : '';

  const unsubscribeHtml = data.unsubscribeUrl
    ? `<p style="margin:16px 0 0;color:#94a3b8;font-size:11px;line-height:1.5;text-align:center;">
         Nie chcesz otrzymywać powiadomień?
         <a href="${escapeHtml(data.unsubscribeUrl)}" style="color:#64748b;text-decoration:underline;">
           Wypisz się z powiadomień e-mail
         </a>
       </p>`
    : '';

  const html = `<!doctype html>
<html lang="pl">
  <body style="margin:0;padding:24px;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:540px;margin:0 auto;background:#ffffff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,0.06);">
      <tr>
        <td style="background:linear-gradient(90deg, #0d9488, #3b82f6);height:6px;font-size:0;line-height:0;">&nbsp;</td>
      </tr>
      <tr>
        <td style="padding:32px 32px 28px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
            <p style="margin:0;font-size:12px;letter-spacing:0.14em;font-weight:800;text-transform:uppercase;color:#0d9488;">CRIBRO ENGLISH</p>
            <span style="font-size:11px;font-weight:600;background:#eff6ff;color:#2563eb;border:1px solid #bfdbfe;padding:3px 8px;border-radius:999px;">PRACA SPRAWDZONA</span>
          </div>

          <h1 style="margin:0 0 14px;font-size:22px;line-height:1.3;color:#0f172a;font-weight:800;">
            ${escapeHtml(greeting)}
          </h1>

          <p style="margin:0;color:#334155;font-size:15px;line-height:1.65;">
            Sprawdziłem Twoją pracę domową:
            <strong style="color:#0f172a;display:block;margin-top:6px;font-size:17px;font-weight:700;">${escapeHtml(cleanTitle)}</strong>
          </p>

          <p style="margin:12px 0 0;color:#475569;font-size:14px;line-height:1.6;">
            Zostawiłem dla Ciebie kilka uwag i wskazówek. Zerknij do aplikacji, żeby zobaczyć szczegóły — dobra robota z wykonaniem zadania!
          </p>

          ${gradeHtml}
          ${feedbackHtml}
          ${button}
          ${instructorCardHtml}
          ${unsubscribeHtml}
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const textLines: Array<string | null> = [
    greeting,
    '',
    `Sprawdziłem Twoją pracę domową: „${cleanTitle}".`,
    typeof data.grade === 'number' ? `Ocena: ${data.grade}` : null,
    data.teacherFeedback ? `\nKomentarz i wskazówki ode mnie: ${data.teacherFeedback}` : null,
    APP_URL ? `\nZobacz szczegóły w aplikacji: ${APP_URL}` : null,
    data.unsubscribeUrl ? `\nWypisz się z powiadomień: ${data.unsubscribeUrl}` : null,
  ];

  return { subject, html, text: textLines.filter((line) => line !== null).join('\n') };
}

// ──────────────────────────────────────────────────────────────
// E-mail podsumowania lekcji: zwięzły recap (max 3 elementy, 80–150 słów)
// ──────────────────────────────────────────────────────────────
export interface LessonLanguageItem {
  type: 'vocab' | 'correction';
  term?: string;
  definition?: string;
  incorrect?: string;
  correct?: string;
  formattedText: string;
}

export interface LessonSummaryEmailParams {
  studentName?: string;
  date?: string;
  topic?: string;
  summary?: string;
  vocabulary?: string;
  corrections?: string;
  appUrl?: string;
  hasAppAccess?: boolean;
  includeCta?: boolean;
  unsubscribeUrl?: string;
  trainerName?: string;
}

export interface LessonSummaryValidationResult {
  status: 'PASS' | 'WARNING' | 'FAIL';
  wordCount: number;
  itemCount: number;
  sentenceCount: number;
  warnings: string[];
  errors: string[];
}

export interface LessonSummaryEmailResult {
  subject: string;
  html: string;
  text: string;
  greeting: string;
  wordCount: number;
  itemCount: number;
  sentenceCount: number;
  validation: LessonSummaryValidationResult;
  items: LessonLanguageItem[];
}

export function countWords(text: string): number {
  if (!text) return 0;
  const clean = text
    .replace(/<[^>]*>/g, ' ')
    .replace(/[❌✅✉️📞🌐🔗🐙·•—–\-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!clean) return 0;
  return clean.split(/\s+/).filter(Boolean).length;
}

export function buildLessonRecapSubject(topic?: string, date?: string): string {
  const cleanTopic = topic?.trim();
  if (cleanTopic) {
    const isAlreadyPrefixed = /^(podsumowanie\s+lekcji|lesson\s+recap|your\s+lesson\s+recap|notatki\s+z\s+lekcji)/i.test(cleanTopic);
    const candidate = isAlreadyPrefixed ? cleanTopic : `Podsumowanie lekcji: ${cleanTopic}`;
    if (candidate.length <= 60) return candidate;
    return candidate.slice(0, 57).trim() + '...';
  }
  if (date?.trim()) {
    const formattedDate = formatDate(date.trim()) || date.trim();
    const candidate = `Podsumowanie lekcji (${formattedDate})`;
    if (candidate.length <= 60) return candidate;
    return candidate.slice(0, 57).trim() + '...';
  }
  return 'Podsumowanie lekcji | Cribro Recall';
}

export function formatLessonRecapSummary(summary?: string, topic?: string): { summaryText: string; sentenceCount: number } {
  let raw = (summary || '').trim();

  raw = raw
    .replace(/^\s*#+\s+.*$/gm, '')
    .replace(/^\s*(?:blok\s*\d+[^:\n]*[:—–-]?\s*)/gim, '')
    .replace(/^\s*(?:lekcja\s+w\s+skr[óo]cie|key\s+language|homework|next\s+lesson|learning\s+curve)[^:\n]*[:—–-]?\s*/gim, '')
    .trim();

  if (!raw) {
    if (topic?.trim()) {
      const topicClean = topic.trim();
      const text = `Dzięki za dzisiejszą lekcję. Rozmawialiśmy o: ${topicClean}.`;
      return { summaryText: text, sentenceCount: 2 };
    }
    return { summaryText: 'Dzięki za dzisiejszą lekcję!', sentenceCount: 1 };
  }

  const sentenceMatches = raw.match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g);
  let sentences = (sentenceMatches || [raw]).map((s) => s.trim()).filter(Boolean);

  if (sentences.length > 2) {
    sentences = sentences.slice(0, 2);
  }

  let text = sentences.join(' ');

  if (!/^dzięki\s+za\s+dzisiejszą\s+lekcję/i.test(text) && !/^dzięki\s+za\s+lekcję/i.test(text)) {
    text = `Dzięki za dzisiejszą lekcję. ${sentences[0]}`;
  }

  const words = text.split(/\s+/);
  if (words.length > 45) {
    text = words.slice(0, 42).join(' ') + '...';
  }

  const finalSentenceMatches = text.match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g) || [];
  return { summaryText: text, sentenceCount: Math.min(finalSentenceMatches.length, 2) };
}

export function extractTopLanguageItems(vocabulary?: string, corrections?: string, maxItems = 3): LessonLanguageItem[] {
  const items: LessonLanguageItem[] = [];

  if (corrections && corrections.trim()) {
    const rawLines = corrections
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !/^#+\s+/.test(l) && !/^(korekty|corrections|things\s*to\s*improve|wymowa):?$/i.test(l));

    for (let i = 0; i < rawLines.length && items.length < maxItems; i++) {
      const line = rawLines[i];

      if (line.includes('❌') || line.includes('✅')) {
        let incorrect = '';
        let correct = '';
        if (line.includes('❌') && line.includes('✅')) {
          const parts = line.split(/✅/);
          incorrect = parts[0].replace(/❌/g, '').trim();
          correct = parts[1]?.trim() || '';
        } else if (line.includes('❌')) {
          incorrect = line.replace(/❌/g, '').trim();
          if (i + 1 < rawLines.length && rawLines[i + 1].includes('✅')) {
            correct = rawLines[i + 1].replace(/✅/g, '').trim();
            i++;
          }
        } else if (line.includes('✅')) {
          correct = line.replace(/✅/g, '').trim();
        }

        const formatted = incorrect && correct
          ? `❌ ${incorrect}\n✅ ${correct}`
          : (correct ? `✅ ${correct}` : `❌ ${incorrect}`);

        items.push({
          type: 'correction',
          incorrect: incorrect || undefined,
          correct: correct || undefined,
          formattedText: formatted,
        });
        continue;
      }

      const arrowMatch = line.match(/^([^*•\->—]+)\s*(?:->|→|=>|zamiast:?)\s*(.+)$/i);
      const notSayMatch = line.match(/^not:\s*(.+?)\s*[,;]?\s*say:\s*(.+)$/i);
      const bladMatch = line.match(/^błąd:\s*(.+?)\s*[,;]?\s*(?:poprawnie|korekta):\s*(.+)$/i);

      if (arrowMatch) {
        const incorrect = arrowMatch[1].replace(/^\s*[-*•]\s*/, '').replace(/^['"]|['"]$/g, '').trim();
        const correct = arrowMatch[2].replace(/^['"]|['"]$/g, '').trim();
        items.push({
          type: 'correction',
          incorrect,
          correct,
          formattedText: `❌ ${incorrect}\n✅ ${correct}`,
        });
      } else if (notSayMatch) {
        const incorrect = notSayMatch[1].trim();
        const correct = notSayMatch[2].trim();
        items.push({
          type: 'correction',
          incorrect,
          correct,
          formattedText: `❌ ${incorrect}\n✅ ${correct}`,
        });
      } else if (bladMatch) {
        const incorrect = bladMatch[1].trim();
        const correct = bladMatch[2].trim();
        items.push({
          type: 'correction',
          incorrect,
          correct,
          formattedText: `❌ ${incorrect}\n✅ ${correct}`,
        });
      } else {
        const clean = line.replace(/^\s*[-*•\d.)]+\s*/, '').trim();
        if (clean) {
          items.push({
            type: 'correction',
            correct: clean,
            formattedText: `✅ ${clean}`,
          });
        }
      }
    }
  }

  if (items.length < maxItems && vocabulary && vocabulary.trim()) {
    const rawVocabLines = vocabulary
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !/^#+\s+/.test(l) && !/^(key\s*language|słownictwo|vocabulary|nowe\s*słowa):?$/i.test(l));

    for (const line of rawVocabLines) {
      if (items.length >= maxItems) break;

      const stripped = line.replace(/^\s*[-*•\d.)]+\s*/, '').trim();
      if (!stripped) continue;

      const separatorMatch = stripped.match(/^([^-—–:]+?)\s*(?:—|–|-|:)\s*(.+)$/);
      if (separatorMatch) {
        const term = separatorMatch[1].trim();
        const definition = separatorMatch[2].trim();
        items.push({
          type: 'vocab',
          term,
          definition,
          formattedText: `${term} — ${definition}`,
        });
      } else {
        items.push({
          type: 'vocab',
          term: stripped,
          formattedText: stripped,
        });
      }
    }
  }

  return items.slice(0, maxItems);
}

export function validateLessonSummaryEmail(data: {
  wordCount: number;
  itemCount: number;
  sentenceCount: number;
  studentName?: string;
  recipientEmail?: string;
  hasAppAccess?: boolean;
  appUrl?: string;
  hasFullReportMarkers?: boolean;
  hasTranscriptMarkers?: boolean;
}): LessonSummaryValidationResult {
  const warnings: string[] = [];
  const errors: string[] = [];

  if (data.wordCount > 180) {
    errors.push(`Wiadomość przekracza dopuszczalny limit 180 słów (obecnie: ${data.wordCount} słów).`);
  }
  if (data.itemCount > 3) {
    errors.push(`Zbyt wiele elementów językowych (${data.itemCount} zamiast maksymalnie 3).`);
  }
  if (!data.studentName && !data.recipientEmail) {
    errors.push('Brak imienia lub adresu e-mail odbiorcy.');
  }
  if (data.hasFullReportMarkers) {
    errors.push('Wiadomość zawiera pełny raport z lekcji zamiast zwięzłego podsumowania.');
  }
  if (data.hasTranscriptMarkers) {
    errors.push('Wiadomość zawiera fragmenty surowej transkrypcji.');
  }

  if (data.wordCount > 150 && data.wordCount <= 180) {
    warnings.push(`Długość wiadomości (${data.wordCount} słów) zbliża się do limitu 180 słów.`);
  }
  if (data.itemCount === 0) {
    warnings.push('Brak zapisanych elementów językowych do ćwiczenia.');
  }
  if (!data.appUrl || data.hasAppAccess === false) {
    warnings.push('Brak aktywnego linku do aplikacji Cribro Recall dla kursanta.');
  }

  let status: 'PASS' | 'WARNING' | 'FAIL' = 'PASS';
  if (errors.length > 0) {
    status = 'FAIL';
  } else if (warnings.length > 0) {
    status = 'WARNING';
  }

  return {
    status,
    wordCount: data.wordCount,
    itemCount: data.itemCount,
    sentenceCount: data.sentenceCount,
    warnings,
    errors,
  };
}

export function buildLessonSummaryEmail(params: LessonSummaryEmailParams): LessonSummaryEmailResult {
  const {
    studentName,
    date,
    topic,
    summary,
    vocabulary,
    corrections,
    appUrl = 'https://app.maciej.pro',
    hasAppAccess = true,
    includeCta = true,
    unsubscribeUrl,
    trainerName = 'Maciej Wyrozumski',
  } = params;

  const greeting = formatPolishGreeting(studentName);
  const subject = buildLessonRecapSubject(topic, date);
  const trainerFirstName = trainerName.trim().split(/\s+/)[0] || 'Maciej';
  const trainerFullName = trainerName.trim() || 'Maciej Wyrozumski';

  const { summaryText, sentenceCount } = formatLessonRecapSummary(summary, topic);
  const items = extractTopLanguageItems(vocabulary, corrections, 3);

  const showCta = includeCta !== false && (items.length > 0 || hasAppAccess);
  const showButton = showCta && hasAppAccess && Boolean(appUrl);

  const textLines: Array<string | null> = [
    greeting,
    '',
    summaryText,
  ];

  if (items.length > 0) {
    textLines.push('');
    textLines.push('Warto zapamiętać:');
    for (const item of items) {
      if (item.type === 'correction') {
        textLines.push(item.formattedText);
      } else {
        textLines.push(`- ${item.formattedText}`);
      }
    }
  }

  if (showCta) {
    textLines.push('');
    if (items.length > 0) {
      textLines.push('Możesz teraz otworzyć Cribro Recall i przećwiczyć te elementy w krótkich zadaniach przygotowanych na podstawie naszej lekcji.');
    }
    if (showButton) {
      textLines.push(`\nĆwicz w Cribro Recall: ${appUrl}`);
    } else {
      textLines.push('\nOtwórz Cribro Recall, aby przećwiczyć dzisiejsze elementy.');
    }
  }

  textLines.push('');
  textLines.push(`Do zobaczenia,\n${trainerFirstName}`);

  if (unsubscribeUrl) {
    textLines.push('');
    textLines.push(`Wypisz się z powiadomień: ${unsubscribeUrl}`);
  }

  const plainText = textLines.filter((l) => l !== null).join('\n');
  const wordCount = countWords(plainText);

  const itemsHtml = items.length > 0
    ? `<div style="margin:18px 0 0;">
         <p style="margin:0 0 10px;font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;">Warto zapamiętać:</p>
         ${items.map((item) => {
           if (item.type === 'correction') {
             return `<div style="margin-bottom:8px;padding:10px 14px;background:#f0fdf4;border-left:3px solid #16a34a;border-radius:0 8px 8px 0;font-size:13.5px;line-height:1.5;">
               ${item.incorrect ? `<div style="color:#991b1b;margin-bottom:3px;">❌ ${escapeHtml(item.incorrect)}</div>` : ''}
               <div style="color:#166534;font-weight:600;">✅ ${escapeHtml(item.correct || '')}</div>
             </div>`;
           }
           return `<div style="margin-bottom:8px;padding:9px 14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;font-size:13.5px;color:#0f172a;line-height:1.5;">
             <strong style="color:#0f172a;">${escapeHtml(item.term || '')}</strong>${item.definition ? ` — ${escapeHtml(item.definition)}` : ''}
           </div>`;
         }).join('')}
       </div>`
    : '';

  const ctaHtml = showCta
    ? `<div style="margin:20px 0 0;">
         ${items.length > 0 ? `<p style="margin:0 0 14px;color:#475569;font-size:13.5px;line-height:1.6;">
           Możesz teraz otworzyć Cribro Recall i przećwiczyć te elementy w krótkich zadaniach przygotowanych na podstawie naszej lekcji.
         </p>` : ''}
         ${showButton ? `<div style="margin:16px 0 0;text-align:center;">
           <a href="${escapeHtml(appUrl)}"
              style="display:inline-block;background:#0d9488;background:linear-gradient(135deg, #0d9488 0%, #0f766e 100%);color:#ffffff;text-decoration:none;
                     padding:13px 30px;border-radius:10px;font-size:14.5px;font-weight:700;box-shadow:0 3px 12px rgba(13, 148, 136, 0.25);">
             Ćwicz w Cribro Recall
           </a>
         </div>` : `<p style="margin:12px 0 0;color:#64748b;font-size:13px;line-height:1.5;text-align:center;">
           Otwórz Cribro Recall, aby przećwiczyć dzisiejsze elementy.
         </p>`}
       </div>`
    : '';

  const unsubscribeHtml = unsubscribeUrl
    ? `<p style="margin:18px 0 0;color:#94a3b8;font-size:11px;line-height:1.5;text-align:center;">
         Nie chcesz otrzymywać powiadomień?
         <a href="${escapeHtml(unsubscribeUrl)}" style="color:#64748b;text-decoration:underline;">
           Wypisz się z powiadomień e-mail
         </a>
       </p>`
    : '';

  const html = `<!doctype html>
<html lang="pl">
  <body style="margin:0;padding:24px;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">
      <tr>
        <td style="background:linear-gradient(90deg, #0d9488, #3b82f6);height:5px;font-size:0;line-height:0;">&nbsp;</td>
      </tr>
      <tr>
        <td style="padding:28px 28px 24px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
            <p style="margin:0;font-size:11px;letter-spacing:0.12em;font-weight:800;text-transform:uppercase;color:#0d9488;">CRIBRO ENGLISH</p>
            <span style="font-size:10px;font-weight:700;background:#eff6ff;color:#2563eb;border:1px solid #bfdbfe;padding:2px 8px;border-radius:999px;">PODSUMOWANIE LEKCJI</span>
          </div>

          <h1 style="margin:0 0 12px;font-size:20px;line-height:1.3;color:#0f172a;font-weight:800;">
            ${escapeHtml(greeting)}
          </h1>

          <p style="margin:0 0 14px;color:#334155;font-size:14.5px;line-height:1.6;">
            ${escapeHtml(summaryText)}
          </p>

          ${itemsHtml}
          ${ctaHtml}

          <p style="margin:22px 0 0;color:#334155;font-size:14px;line-height:1.5;">
            Do zobaczenia,<br>
            <strong style="color:#0f172a;">${escapeHtml(trainerFirstName)}</strong>
          </p>

          <div style="margin:22px 0 0;border-top:1px solid #e2e8f0;padding-top:14px;color:#64748b;font-size:12px;line-height:1.5;">
            <strong style="color:#0f172a;">${escapeHtml(trainerFullName)}</strong> · CRIBRO ENGLISH<br>
            <a href="mailto:wyrozumski@maciej.pro" style="color:#64748b;text-decoration:none;">wyrozumski@maciej.pro</a> · +48 698 250 507
          </div>

          ${unsubscribeHtml}
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const validation = validateLessonSummaryEmail({
    wordCount,
    itemCount: items.length,
    sentenceCount,
    studentName,
    recipientEmail: undefined,
    hasAppAccess,
    appUrl,
    hasFullReportMarkers: Boolean(summaryText && (summaryText.includes('BLOK 1') || summaryText.includes('BLOK 2') || summaryText.includes('Key Language:'))),
    hasTranscriptMarkers: Boolean(summaryText && (summaryText.includes('Teacher:') || summaryText.includes('Student:'))),
  });

  return {
    subject,
    html,
    text: plainText,
    greeting,
    wordCount,
    itemCount: items.length,
    sentenceCount,
    validation,
    items,
  };
}
