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

export function buildHomeworkEmail(data: HomeworkEmailData): {
  subject: string;
  html: string;
  text: string;
} {
  const due = formatDate(data.dueDate);
  const greeting = formatPolishGreeting(data.studentName);

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

  const textLines: Array<string | null> = [
    greeting,
    '',
    `W systemie została dla Ciebie przypisana nowa praca domowa: „${cleanTitle}".`,
    due ? `Termin wykonania: ${due}` : null,
    data.assignedBy ? `Przypisane przez: ${data.assignedBy}` : null,
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

  const metaRows = [
    ...(due ? [['Termin wykonania', due]] : []),
    ...(data.assignedBy ? [['Przypisane przez', data.assignedBy]] : []),
  ];

  const metaHtml = metaRows.length > 0
    ? `<div style="margin:20px 0 0;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:10px 16px;">
         <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
           ${metaRows.map(([label, value]) => `
             <tr>
               <td style="padding:6px 0;color:#64748b;font-size:13px;border-bottom:1px solid #f1f5f9;">${escapeHtml(label)}</td>
               <td style="padding:6px 0;color:#0f172a;font-size:14px;font-weight:600;text-align:right;border-bottom:1px solid #f1f5f9;">${escapeHtml(value)}</td>
             </tr>
           `).join('')}
         </table>
       </div>`
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
         <p style="margin:0;font-size:12px;font-weight:700;color:#166534;text-transform:uppercase;letter-spacing:0.05em;">Wskazówki od lektora:</p>
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

          <h1 style="margin:0 0 14px;font-size:22px;line-height:1.3;color:#0f172a;font-weight:800;">
            ${escapeHtml(greeting)}
          </h1>

          <p style="margin:0;color:#334155;font-size:15px;line-height:1.65;">
            Lektor przypisał dla Ciebie nową pracę domową:
            <strong style="color:#0f172a;display:block;margin-top:6px;font-size:17px;font-weight:700;">${escapeHtml(cleanTitle)}</strong>
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
  const subject = `Lektor sprawdził pracę: ${cleanTitle}`;

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
         <p style="margin:0;font-size:12px;font-weight:700;color:#166534;text-transform:uppercase;letter-spacing:0.05em;">Komentarz lektora:</p>
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
            Lektor sprawdził Twoją pracę domową:
            <strong style="color:#0f172a;display:block;margin-top:6px;font-size:17px;font-weight:700;">${escapeHtml(cleanTitle)}</strong>
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
    `Lektor sprawdził Twoją pracę domową: „${cleanTitle}".`,
    typeof data.grade === 'number' ? `Ocena: ${data.grade}` : null,
    data.teacherFeedback ? `\nKomentarz lektora: ${data.teacherFeedback}` : null,
    APP_URL ? `\nZobacz szczegóły w aplikacji: ${APP_URL}` : null,
    data.unsubscribeUrl ? `\nWypisz się z powiadomień: ${data.unsubscribeUrl}` : null,
  ];

  return { subject, html, text: textLines.filter((line) => line !== null).join('\n') };
}
