import { formatPolishGreeting } from '../utils/polishVocative';

export interface HomeworkConfirmationEmailParams {
  studentName?: string;
  title: string;
  dueDate?: string;
  instructions?: string;
  assignedBy?: string;
  sentences?: Array<any>;
  customNote?: string;
  appUrl?: string;
  isDirectLink?: boolean;
  expiresAt?: string;
  unsubscribeUrl?: string;
}

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

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

/**
 * Buduje spersonalizowaną wiadomość e-mail o nowej pracy domowej
 * z prostą informacją o przypisanym zadaniu, unikalnym linkiem bezpośrednim
 * (Magic Link z limitem ważności bez wymogu logowania)
 * oraz wizytówką lektora w stopce zgodnie ze wzorem.
 */
export function buildHomeworkConfirmationEmail(params: HomeworkConfirmationEmailParams): {
  subject: string;
  html: string;
  text: string;
  greeting: string;
} {
  const {
    studentName,
    title,
    dueDate,
    instructions,
    assignedBy = 'Maciej Wyrozumski',
    customNote,
    appUrl = 'https://app.maciej.pro',
    isDirectLink,
    expiresAt,
    unsubscribeUrl,
  } = params;

  const due = formatDate(dueDate);
  const expiresFormatted = formatDate(expiresAt);
  const greeting = formatPolishGreeting(studentName);

  const cleanTitle = title.trim() || 'Praca domowa';
  const subject = /praca domowa/i.test(cleanTitle)
    ? `Nowe zadanie: ${cleanTitle}`
    : `Nowa praca domowa: ${cleanTitle}`;

  const instructionsHtml = instructions
    ? `<div style="margin:16px 0 0;background:#f0fdf4;border-left:4px solid #16a34a;padding:12px 16px;border-radius:0 8px 8px 0;">
         <p style="margin:0;font-size:12px;font-weight:700;color:#166534;text-transform:uppercase;letter-spacing:0.05em;">Wskazówki od lektora:</p>
         <p style="margin:4px 0 0;color:#14532d;font-size:14px;line-height:1.5;">${escapeHtml(instructions)}</p>
       </div>`
    : '';

  const customNoteHtml = customNote
    ? `<div style="margin:16px 0 0;background:#fefce8;border-left:4px solid #eab308;padding:12px 16px;border-radius:0 8px 8px 0;">
         <p style="margin:0;font-size:12px;font-weight:700;color:#854d0e;text-transform:uppercase;letter-spacing:0.05em;">Wiadomość od lektora:</p>
         <p style="margin:4px 0 0;color:#713f12;font-size:14px;line-height:1.5;">${escapeHtml(customNote)}</p>
       </div>`
    : '';

  const metaRows = [
    ...(due ? [['Termin wykonania', due]] : []),
    ...(assignedBy ? [['Przypisane przez', assignedBy]] : []),
    ...(expiresFormatted ? [['Ważność linku', expiresFormatted]] : []),
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

  const isDirect = Boolean(isDirectLink || (appUrl && (appUrl.includes('/hw') || appUrl.includes('token='))));
  const buttonLabel = isDirect ? 'Wykonaj zadanie teraz (bez logowania) →' : 'Otwórz zadanie w aplikacji →';

  const directHintHtml = isDirect
    ? `<p style="margin:10px 0 0;font-size:12px;color:#64748b;line-height:1.4;text-align:center;">
         🔒 Link jest unikalny i ${expiresFormatted ? `ważny do <strong>${escapeHtml(expiresFormatted)}</strong>` : 'aktywny'}. Nie musisz się logować — po odesłaniu praca automatycznie zapisze się w Twoim profilu kursanta.
       </p>`
    : '';

  const buttonHtml = appUrl
    ? `<div style="margin:26px 0 0;text-align:center;">
         <a href="${escapeHtml(appUrl)}"
            style="display:inline-block;background:#0d9488;background:linear-gradient(135deg, #0d9488 0%, #0f766e 100%);color:#ffffff;text-decoration:none;
                   padding:15px 32px;border-radius:12px;font-size:15px;font-weight:700;box-shadow:0 4px 14px rgba(13, 148, 136, 0.3);">
           ${escapeHtml(buttonLabel)}
         </a>
         ${directHintHtml}
       </div>`
    : '';

  const unsubscribeHtml = unsubscribeUrl
    ? `<p style="margin:16px 0 0;color:#94a3b8;font-size:11px;line-height:1.5;text-align:center;">
         Nie chcesz otrzymywać powiadomień?
         <a href="${escapeHtml(unsubscribeUrl)}" style="color:#64748b;text-decoration:underline;">
           Wypisz się z powiadomień e-mail
         </a>
       </p>`
    : '';

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

          ${instructionsHtml}
          ${customNoteHtml}
          ${metaHtml}

          <!-- Przycisk CTA -->
          ${buttonHtml}

          <!-- Wizytówka ze stopki -->
          ${instructorCardHtml}

          ${unsubscribeHtml}
        </td>
      </tr>
    </table>
  </body>
</html>`;

  // Wersja tekstowa dla klientów pocztowych bez HTML
  const textLines = [
    greeting,
    '',
    `W systemie została dla Ciebie przypisana nowa praca domowa: „${cleanTitle}".`,
    due ? `Termin wykonania: ${due}` : null,
    assignedBy ? `Przypisane przez: ${assignedBy}` : null,
    instructions ? `\nWskazówki lektora: ${instructions}` : null,
    customNote ? `\nWiadomość od lektora: ${customNote}` : null,
    '',
    isDirect
      ? `Wykonaj zadanie teraz (bez logowania): ${appUrl}${expiresFormatted ? `\n(Link jest unikalny i ważny do: ${expiresFormatted})` : ''}`
      : `Otwórz zadanie w aplikacji: ${appUrl}`,
    unsubscribeUrl ? `Wypisz się z powiadomień: ${unsubscribeUrl}` : null,
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
  ].filter((line) => line !== null);

  return {
    subject,
    html,
    text: textLines.join('\n'),
    greeting,
  };
}

// ──────────────────────────────────────────────────────────────
// Wspólny reusable blok: wizytówka lektora w stopce e-maili
// ──────────────────────────────────────────────────────────────
export const INSTRUCTOR_CARD_HTML = `
  <div style="margin:28px 0 0;border:1.5px solid #334155;border-radius:12px;background:#0f172a;padding:20px 22px;text-align:left;">
    <div style="font-size:18px;font-weight:800;color:#e2e8f0;line-height:1.25;letter-spacing:-0.01em;">
      Maciej Wyrozumski
    </div>
    <div style="margin-top:4px;font-size:13px;font-weight:400;color:#94a3b8;line-height:1.4;">
      Instructional Designer | AI EdTech Specialist | English Trainer
    </div>
    <div style="margin:14px 0 12px;border-top:1px solid #334155;height:0;line-height:0;font-size:0;">&nbsp;</div>
    <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;">
      <tr>
        <td style="width:24px;vertical-align:middle;padding:4px 0;font-size:15px;line-height:1;">✉️</td>
        <td style="vertical-align:middle;padding:4px 0 4px 8px;font-size:13.5px;">
          <a href="mailto:wyrozumski@maciej.pro" style="color:#e2e8f0;text-decoration:none;font-weight:500;">wyrozumski@maciej.pro</a>
        </td>
      </tr>
      <tr>
        <td style="width:24px;vertical-align:middle;padding:4px 0;font-size:15px;line-height:1;">📞</td>
        <td style="vertical-align:middle;padding:4px 0 4px 8px;font-size:13.5px;">
          <a href="tel:+48698250507" style="color:#e2e8f0;text-decoration:none;font-weight:500;">+48 698 250 507</a>
        </td>
      </tr>
      <tr>
        <td style="width:24px;vertical-align:middle;padding:4px 0;font-size:15px;line-height:1;">🌐</td>
        <td style="vertical-align:middle;padding:4px 0 4px 8px;font-size:13.5px;">
          <a href="https://www.maciej.pro" target="_blank" rel="noopener noreferrer" style="color:#e2e8f0;text-decoration:none;font-weight:500;">www.maciej.pro</a>
        </td>
      </tr>
      <tr>
        <td style="width:24px;vertical-align:middle;padding:4px 0;font-size:15px;line-height:1;">🔗</td>
        <td style="vertical-align:middle;padding:4px 0 4px 8px;font-size:13.5px;">
          <a href="https://linkedin.com/in/maciej-pro" target="_blank" rel="noopener noreferrer" style="color:#e2e8f0;text-decoration:none;font-weight:500;">linkedin.com/in/maciej-pro</a>
        </td>
      </tr>
    </table>
  </div>
`;

// ──────────────────────────────────────────────────────────────
// E-mail powitalny: zaproszenie do zalogowania się
// ──────────────────────────────────────────────────────────────
export interface WelcomeEmailParams {
  studentName?: string;
  username: string;
  tempPassword: string;
  appUrl?: string;
  unsubscribeUrl?: string;
  customNote?: string;
  assignedBy?: string;
  subject?: string;
}

export function buildWelcomeEmail(params: WelcomeEmailParams): {
  subject: string;
  html: string;
  text: string;
} {
  const {
    studentName,
    username,
    tempPassword,
    appUrl = 'https://app.maciej.pro',
    unsubscribeUrl,
    customNote,
    assignedBy = 'Maciej Wyrozumski',
    subject: customSubject,
  } = params;

  const greeting = formatPolishGreeting(studentName);
  const subject = customSubject?.trim() || 'Witaj w CRIBRO ENGLISH — Twoje dane logowania';

  const customNoteHtml = customNote
    ? `<div style="margin:20px 0;background:rgba(234,179,8,0.1);border-left:4px solid #eab308;padding:14px 18px;border-radius:0 10px 10px 0;">
         <p style="margin:0;font-size:11px;font-weight:800;color:#facc15;text-transform:uppercase;letter-spacing:0.08em;">Wiadomość od lektora:</p>
         <p style="margin:6px 0 0;color:#fef08a;font-size:14px;line-height:1.5;">${escapeHtml(customNote)}</p>
       </div>`
    : '';

  const unsubscribeHtml = unsubscribeUrl
    ? `<p style="margin:16px 0 0;color:#64748b;font-size:11px;line-height:1.5;text-align:center;">
         Nie chcesz otrzymywać wiadomości?
         <a href="${escapeHtml(unsubscribeUrl)}" style="color:#94a3b8;text-decoration:underline;">
           Wypisz się z powiadomień e-mail
         </a>
       </p>`
    : '';

  const html = `<!doctype html>
<html lang="pl">
  <body style="margin:0;padding:24px;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:540px;margin:0 auto;background:#1e293b;border-radius:16px;border:1px solid #334155;overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,0.4);">
      <!-- Header Gradient Bar -->
      <tr>
        <td style="background:linear-gradient(90deg, #0d9488, #3b82f6);height:6px;font-size:0;line-height:0;">&nbsp;</td>
      </tr>
      <tr>
        <td style="padding:32px 32px 28px;">
          <div style="margin-bottom:20px;">
            <p style="margin:0;font-size:12px;letter-spacing:0.14em;font-weight:800;text-transform:uppercase;color:#0d9488;">CRIBRO ENGLISH</p>
            <span style="display:inline-block;margin-top:8px;font-size:11px;font-weight:600;background:rgba(13,148,136,0.15);color:#5eead4;border:1px solid rgba(13,148,136,0.3);padding:3px 10px;border-radius:999px;">🎓 WITAMY W ZESPOLE</span>
          </div>

          <h1 style="margin:0 0 14px;font-size:24px;line-height:1.3;color:#f1f5f9;font-weight:800;">
            ${escapeHtml(greeting)}
          </h1>

          <p style="margin:0;color:#cbd5e1;font-size:15px;line-height:1.65;">
            Twoje konto na platformie <strong style="color:#f1f5f9;">CRIBRO ENGLISH</strong> jest już aktywne! Poniżej znajdziesz dane logowania — zapamiętaj je lub zmień hasło po pierwszym zalogowaniu.
          </p>

          ${customNoteHtml}

          <!-- Dane logowania w karcie -->
          <div style="margin:24px 0;background:#0f172a;border:1px solid #334155;border-radius:12px;padding:20px 20px;overflow:hidden;">
            <p style="margin:0 0 12px;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.12em;color:#0d9488;">Twoje dane logowania</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding:8px 0;color:#94a3b8;font-size:13px;border-bottom:1px solid #1e293b;width:100px;">Login</td>
                <td style="padding:8px 0;color:#f1f5f9;font-size:15px;font-weight:700;font-family:'Courier New',monospace;border-bottom:1px solid #1e293b;text-align:right;">${escapeHtml(username)}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;color:#94a3b8;font-size:13px;width:100px;">Hasło</td>
                <td style="padding:8px 0;color:#f1f5f9;font-size:15px;font-weight:700;font-family:'Courier New',monospace;text-align:right;">${escapeHtml(tempPassword)}</td>
              </tr>
            </table>
          </div>

          <p style="margin:0 0 4px;color:#94a3b8;font-size:13px;line-height:1.5;">
            💡 Po zalogowaniu możesz zmienić hasło na własne lub powiązać konto z Google — wystarczy jedno kliknięcie.
          </p>

          <!-- CTA Button -->
          <div style="margin:26px 0 0;text-align:center;">
            <a href="${escapeHtml(appUrl)}"
               style="display:inline-block;background:#0d9488;background:linear-gradient(135deg, #0d9488 0%, #0f766e 100%);color:#ffffff;text-decoration:none;
                      padding:15px 36px;border-radius:12px;font-size:16px;font-weight:700;box-shadow:0 4px 14px rgba(13, 148, 136, 0.4);">
              Zaloguj się do CRIBRO ENGLISH →
            </a>
          </div>

          <!-- Co Cię czeka -->
          <div style="margin:28px 0 0;background:rgba(13,148,136,0.08);border:1px solid rgba(13,148,136,0.2);border-radius:12px;padding:16px 18px;">
            <p style="margin:0 0 10px;font-size:12px;font-weight:700;color:#5eead4;text-transform:uppercase;letter-spacing:0.05em;">Co Cię czeka na platformie:</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr><td style="padding:5px 0;color:#cbd5e1;font-size:13px;line-height:1.5;">📝 Interaktywne prace domowe z natychmiastową oceną</td></tr>
              <tr><td style="padding:5px 0;color:#cbd5e1;font-size:13px;line-height:1.5;">🃏 Fiszki i system inteligentnych powtórek (SRS)</td></tr>
              <tr><td style="padding:5px 0;color:#cbd5e1;font-size:13px;line-height:1.5;">📖 Historia lekcji z notatkami i słownictwem</td></tr>
              <tr><td style="padding:5px 0;color:#cbd5e1;font-size:13px;line-height:1.5;">📊 Statystyki postępów i śledzenie rozwoju</td></tr>
            </table>
          </div>

          <!-- Wizytówka lektora -->
          ${INSTRUCTOR_CARD_HTML}

          ${unsubscribeHtml}
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const textLines: (string | null)[] = [
    greeting,
    '',
    'Twoje konto na platformie CRIBRO ENGLISH jest gotowe!',
  ];

  if (customNote) {
    textLines.push('', 'Wiadomość od lektora:', customNote);
  }

  textLines.push(
    '',
    `Login: ${username}`,
    `Hasło: ${tempPassword}`,
    '',
    'Po zalogowaniu możesz zmienić hasło na własne lub powiązać konto z Google.',
    '',
    `Zaloguj się: ${appUrl}`,
    unsubscribeUrl ? `\nWypisz się z powiadomień: ${unsubscribeUrl}` : null,
    '',
    '—',
    assignedBy,
    'CRIBRO ENGLISH',
  );

  const text = textLines.filter((line) => line !== null).join('\n');

  return { subject, html, text };
}

