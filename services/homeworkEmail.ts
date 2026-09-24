import { formatPolishGreeting, inflectPolishVerb } from '../utils/polishVocative';

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
  const verbZnalazl = inflectPolishVerb(studentName, 'znalazła', 'znalazł');

  const cleanTitle = title.trim() || 'Praca domowa';
  const subject = /praca domowa/i.test(cleanTitle)
    ? `Nowe zadanie: ${cleanTitle}`
    : `Nowa praca domowa: ${cleanTitle}`;

  const instructionsHtml = instructions
    ? `<div style="margin:16px 0 0;background:#f8fafc;border-left:4px solid #3b82f6;padding:12px 16px;border-radius:0 8px 8px 0;">
         <p style="margin:0;font-size:12px;font-weight:700;color:#1d4ed8;text-transform:uppercase;letter-spacing:0.05em;">Wskazówki ode mnie:</p>
         <p style="margin:4px 0 0;color:#1e3a8a;font-size:14px;line-height:1.5;">${escapeHtml(instructions)}</p>
       </div>`
    : '';

  const customNoteHtml = customNote
    ? `<div style="margin:0 0 20px;background:#f0fdf4;border:1px solid #bbf7d0;border-left:4px solid #0d9488;padding:16px 18px;border-radius:0 10px 10px 0;">
         <p style="margin:0;font-size:11px;font-weight:700;color:#0f766e;text-transform:uppercase;letter-spacing:0.06em;">Wiadomość ode mnie:</p>
         <p style="margin:6px 0 0;color:#134e4a;font-size:15px;line-height:1.6;font-weight:500;">${escapeHtml(customNote)}</p>
       </div>`
    : '';

  const dueSentenceParts = [
    due ? `Zadanie czeka na Ciebie do ${due}` : null,
    expiresFormatted ? `link jest aktywny do ${expiresFormatted}` : null,
  ].filter((part): part is string => Boolean(part));

  const metaHtml = dueSentenceParts.length > 0
    ? `<p style="margin:16px 0 0;color:#475569;font-size:14px;line-height:1.6;">
         ${escapeHtml(`${dueSentenceParts.join(', ')}.`)}
       </p>`
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

          ${instructionsHtml}
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
    customNote ? `${customNote}\n` : null,
    `Przygotowałem dla Ciebie nową pracę domową: „${cleanTitle}".`,
    `Zadanie jest oczywiście opcjonalne, ale byłoby super, gdybyś ${verbZnalazl} na nie 5-10 minut przed naszą kolejną lekcją — to świetny sposób na utrwalenie materiału.`,
    due ? `Zadanie czeka na Ciebie do: ${due}` : null,
    instructions ? `\nWskazówki: ${instructions}` : null,
    customNote ? `\nWiadomość ode mnie: ${customNote}` : null,
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
         <p style="margin:0;font-size:11px;font-weight:800;color:#facc15;text-transform:uppercase;letter-spacing:0.08em;">Wiadomość ode mnie:</p>
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
            Twoje konto na platformie <strong style="color:#f1f5f9;">CRIBRO ENGLISH</strong> jest już w pełni gotowe! Przygotowałem dla Ciebie przestrzeń, w której znajdziesz notatki z naszych lekcji, słownictwo oraz krótkie, dopasowane do Ciebie zadania powtórkowe. Poniżej podsyłam Twoje dane logowania — wskocz na platformę i zerknij, jak to wygląda!
          </p>

          ${customNoteHtml}

          <!-- Dane logowania w karcie -->
          <div style="margin:24px 0;background:#0f172a;border:1px solid #334155;border-radius:12px;padding:20px 20px;overflow:hidden;">
            <p style="margin:0 0 12px;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.12em;color:#0d9488;">Twoje dane logowania</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding:8px 0;color:#94a3b8;font-size:13px;border-bottom:1px solid #1e293b;width:130px;">Login (e-mail)</td>
                <td style="padding:8px 0;color:#f1f5f9;font-size:15px;font-weight:700;font-family:'Courier New',monospace;border-bottom:1px solid #1e293b;text-align:right;">${escapeHtml(username)}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;color:#94a3b8;font-size:13px;width:130px;">Hasło startowe</td>
                <td style="padding:8px 0;color:#f1f5f9;font-size:15px;font-weight:700;font-family:'Courier New',monospace;text-align:right;">${escapeHtml(tempPassword)}</td>
              </tr>
            </table>
          </div>

          <div style="margin:16px 0 0;background:rgba(66,133,244,0.08);border:1px solid rgba(66,133,244,0.25);border-radius:12px;padding:14px 18px;">
            <p style="margin:0;color:#cbd5e1;font-size:13px;line-height:1.55;">
              💡 <strong style="color:#f1f5f9;">Wskazówka:</strong> Jeśli Twój adres e-mail to konto Google (Gmail lub Google Workspace), możesz zalogować się jednym kliknięciem przyciskiem „Kontynuuj przez Google” bez podawania hasła.
            </p>
          </div>

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
            <p style="margin:0 0 10px;font-size:12px;font-weight:700;color:#5eead4;text-transform:uppercase;letter-spacing:0.05em;">Co na Ciebie czeka:</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr><td style="padding:5px 0;color:#cbd5e1;font-size:13px;line-height:1.5;">📝 Krótkie i interaktywne prace domowe</td></tr>
              <tr><td style="padding:5px 0;color:#cbd5e1;font-size:13px;line-height:1.5;">🃏 Fiszki i system inteligentnych powtórek (SRS)</td></tr>
              <tr><td style="padding:5px 0;color:#cbd5e1;font-size:13px;line-height:1.5;">📖 Pełna historia naszych lekcji i słówek</td></tr>
              <tr><td style="padding:5px 0;color:#cbd5e1;font-size:13px;line-height:1.5;">📊 Śledzenie Twoich postępów i statystyk</td></tr>
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
    'Twoje konto na platformie CRIBRO ENGLISH jest już gotowe!',
    'Przygotowałem dla Ciebie przestrzeń z notatkami z lekcji, słownictwem oraz zadaniami.',
  ];

  if (customNote) {
    textLines.push('', 'Wiadomość ode mnie:', customNote);
  }

  textLines.push(
    '',
    `Login (e-mail): ${username}`,
    `Hasło startowe: ${tempPassword}`,
    '',
    'Wskazówka: Jeśli Twój adres e-mail to konto Google (Gmail lub Google Workspace),',
    'możesz zalogować się jednym kliknięciem przyciskiem "Kontynuuj przez Google" bez podawania hasła.',
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

export interface GradedHomeworkEmailParams {
  studentName?: string;
  title: string;
  score?: number | null;
  teacherFeedback?: string;
  gradedBy?: string;
  appUrl?: string;
  unsubscribeUrl?: string;
}

export function buildGradedHomeworkEmail(params: GradedHomeworkEmailParams): {
  subject: string;
  html: string;
  text: string;
  greeting: string;
} {
  const {
    studentName,
    title,
    score,
    teacherFeedback,
    gradedBy = 'Maciej Wyrozumski',
    appUrl = 'https://app.maciej.pro',
    unsubscribeUrl,
  } = params;

  const greeting = formatPolishGreeting(studentName);
  const cleanTitle = title.trim() || 'Praca domowa';
  const subject = `Sprawdziłem Twoją pracę domową: ${cleanTitle} 🎓 | CRIBRO English`;

  const scoreBadge =
    typeof score === 'number'
      ? `<div style="margin:20px 0;background:#0f172a;border:1px solid #334155;border-radius:12px;padding:16px 20px;text-align:center;">
           <span style="font-size:12px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.1em;display:block;margin-bottom:4px;">Twój wynik</span>
           <span style="font-size:32px;font-weight:900;color:#72f0b4;font-family:'Courier New',monospace;">${score}%</span>
         </div>`
      : '';

  const feedbackBlock = teacherFeedback
    ? `<div style="margin:16px 0;background:rgba(114,240,180,0.08);border-left:4px solid #72f0b4;padding:14px 18px;border-radius:0 10px 10px 0;">
         <p style="margin:0 0 6px;font-size:12px;font-weight:800;color:#72f0b4;text-transform:uppercase;letter-spacing:0.06em;">Komentarz i wskazówki ode mnie:</p>
         <p style="margin:0;color:#e2e8f0;font-size:14px;line-height:1.6;white-space:pre-wrap;">${escapeHtml(teacherFeedback)}</p>
       </div>`
    : '';

  const unsubscribeHtml = unsubscribeUrl
    ? `<div style="margin-top:24px;text-align:center;font-size:11px;color:#64748b;">
         <a href="${escapeHtml(unsubscribeUrl)}" style="color:#64748b;text-decoration:underline;">Wypisz się z powiadomień e-mail</a>
       </div>`
    : '';

  const html = `<!doctype html>
<html lang="pl">
  <body style="margin:0;padding:24px;background:#09101c;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:540px;margin:0 auto;background:#141b2a;border-radius:16px;border:1px solid rgba(255,255,255,0.08);overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,0.5);">
      <tr>
        <td style="background:linear-gradient(90deg, #72f0b4, #3b82f6);height:6px;font-size:0;line-height:0;">&nbsp;</td>
      </tr>
      <tr>
        <td style="padding:32px 32px 28px;">
          <div style="margin-bottom:20px;">
            <p style="margin:0;font-size:12px;letter-spacing:0.14em;font-weight:800;text-transform:uppercase;color:#72f0b4;">CRIBRO ENGLISH</p>
            <span style="display:inline-block;margin-top:8px;font-size:11px;font-weight:600;background:rgba(114,240,180,0.15);color:#72f0b4;border:1px solid rgba(114,240,180,0.3);padding:3px 10px;border-radius:999px;">🎓 SPRAWDZONA PRACA DOMOWA</span>
          </div>

          <h1 style="margin:0 0 14px;font-size:24px;line-height:1.3;color:#ffffff;font-weight:800;">
            ${escapeHtml(greeting)}
          </h1>

          <p style="margin:0 0 14px;color:#cbd5e1;font-size:15px;line-height:1.65;">
            Sprawdziłem Twoją pracę domową <strong style="color:#ffffff;">„${escapeHtml(cleanTitle)}”</strong>. Zajrzyj do aplikacji, aby sprawdzić swój wynik i ewentualnie przećwiczyć rzeczy do poprawy.
          </p>

          ${scoreBadge}
          ${feedbackBlock}

          <div style="margin:26px 0 0;text-align:center;">
            <a href="${escapeHtml(appUrl)}"
               style="display:inline-block;background:#72f0b4;background:linear-gradient(135deg, #72f0b4 0%, #10b981 100%);color:#06120c;text-decoration:none;
                      padding:15px 36px;border-radius:12px;font-size:16px;font-weight:800;box-shadow:0 4px 16px rgba(114, 240, 180, 0.4);">
              Zobacz ocenioną pracę w aplikacji →
            </a>
          </div>

          ${INSTRUCTOR_CARD_HTML}
          ${unsubscribeHtml}
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = `${greeting}\n\nSprawdziłem Twoją pracę domową „${cleanTitle}”. Zajrzyj do aplikacji, aby sprawdzić swój wynik i ewentualnie przećwiczyć rzeczy do poprawy.${
    score !== undefined && score !== null ? `\n\nTwój wynik: ${score}%` : ''
  }${teacherFeedback ? `\n\nKomentarz lektora:\n${teacherFeedback}` : ''}\n\nOtwórz aplikację: ${appUrl}\n\n—\n${gradedBy}\nCRIBRO ENGLISH`;

  return { subject, html, text, greeting };
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
  /** Data lekcji, YYYY-MM-DD lub już sformatowana. */
  date?: string;
  /** Temat lekcji. */
  topic?: string;
  /** Krótkie podsumowanie przebiegu lekcji (max 1–2 zdania). */
  summary?: string;
  /** Słownictwo i zwroty, jedna pozycja na linię. */
  vocabulary?: string;
  /** Korekty językowe i błędy z lekcji. */
  corrections?: string;
  /** Link do aplikacji / platformy. */
  appUrl?: string;
  /** Czy kursant ma dostęp do aplikacji (domyślnie true). */
  hasAppAccess?: boolean;
  /** Czy dołączyć wezwanie CTA (domyślnie true). */
  includeCta?: boolean;
  /** Link do wypisania z powiadomień. */
  unsubscribeUrl?: string;
  /** Imię/nazwisko lektora. */
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

/** Liczy słowa w tekście po oczyszczeniu z tagów i znaków specjalnych */
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

/** Generuje temat wiadomości o maksymalnej długości 60 znaków */
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

/** Formatuje i skraca podsumowanie lekcji do maksymalnie 2 zdań */
export function formatLessonRecapSummary(summary?: string, topic?: string): { summaryText: string; sentenceCount: number } {
  let raw = (summary || '').trim();

  // Usuwamy nagłówki markdown i znaczniki bloków Notion, jeśli zostały przekazane
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

  // Rozbicie na zdania
  const sentenceMatches = raw.match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g);
  let sentences = (sentenceMatches || [raw]).map((s) => s.trim()).filter(Boolean);

  // Maksymalnie 2 zdania
  if (sentences.length > 2) {
    sentences = sentences.slice(0, 2);
  }

  let text = sentences.join(' ');

  // Jeśli tekst nie zawiera podziękowania za lekcję na początku, dopasowujemy strukturę
  if (!/^dzięki\s+za\s+dzisiejszą\s+lekcję/i.test(text) && !/^dzięki\s+za\s+lekcję/i.test(text)) {
    text = `Dzięki za dzisiejszą lekcję. ${sentences[0]}`;
  }

  // Bezpieczne przycięcie, gdyby zdania były nienaturalnie długie (> 45 słów)
  const words = text.split(/\s+/);
  if (words.length > 45) {
    text = words.slice(0, 42).join(' ') + '...';
  }

  const finalSentenceMatches = text.match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g) || [];
  return { summaryText: text, sentenceCount: Math.min(finalSentenceMatches.length, 2) };
}

/** Wyciąga maksymalnie 3 kluczowe elementy językowe (priorytet: korekty -> słówka) */
export function extractTopLanguageItems(vocabulary?: string, corrections?: string, maxItems = 3): LessonLanguageItem[] {
  const items: LessonLanguageItem[] = [];

  // 1. Najwyższy priorytet: korekty z lekcji
  if (corrections && corrections.trim()) {
    const rawLines = corrections
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !/^#+\s+/.test(l) && !/^(korekty|corrections|things\s*to\s*improve|wymowa):?$/i.test(l));

    for (let i = 0; i < rawLines.length && items.length < maxItems; i++) {
      const line = rawLines[i];

      // Format z emoji ❌ / ✅
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

      // Wzorce typu "Źle -> Dobrze", "not: X say: Y", "błąd: X / poprawnie: Y"
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

  // 2. Drugi priorytet: słownictwo i zwroty (jeśli zostało miejsce < maxItems)
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

/** Waliduje parametry i treść generowanego maila */
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

  // FAIL
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

  // WARNING
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

/**
 * Buduje krótki, przyjazny e-mail podsumowujący lekcję (Recap):
 * - podziękowanie za lekcję i max 2 zdania podsumowania
 * - dokładnie max 3 najważniejsze elementy językowe
 * - 1 przycisk CTA do Cribro Recall
 * - limit długości: 80–150 słów (nigdy > 180 słów)
 */
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

  // 1. Zwięzłe podsumowanie lekcji (max 2 zdania)
  const { summaryText, sentenceCount } = formatLessonRecapSummary(summary, topic);

  // 2. Maksymalnie 3 elementy językowe (korekty pierwsze, potem słownictwo)
  const items = extractTopLanguageItems(vocabulary, corrections, 3);

  // 3. Logika CTA
  const showCta = includeCta !== false && (items.length > 0 || hasAppAccess);
  const showButton = showCta && hasAppAccess && Boolean(appUrl);

  // 4. Wersja tekstowa (Plain Text)
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

  // 5. Wersja wizualna (HTML)
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

