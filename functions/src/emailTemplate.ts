import { APP_URL } from './config';

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

export function buildHomeworkEmail(data: HomeworkEmailData): {
  subject: string;
  html: string;
  text: string;
} {
  const due = formatDate(data.dueDate);
  const items = `${data.itemCount} ${plural(data.itemCount, 'zadanie', 'zadania', 'zadań')}`;
  const firstName = data.studentName.split(' ')[0] || data.studentName;

  // Nauczyciel zwykle nazywa zadanie „Praca domowa: …", więc doklejanie tego
  // samego przed tytułem dawało temat w rodzaju „Nowa praca domowa: Praca
  // domowa: Tłumaczenie zdań".
  const subject = /praca domowa/i.test(data.title)
    ? `Nowe zadanie: ${data.title}`
    : `Nowa praca domowa: ${data.title}`;

  // `null` oznacza linię, której w tej wiadomości nie ma; pusty ciąg to
  // celowa przerwa między akapitami i musi przetrwać filtrowanie.
  const textLines: Array<string | null> = [
    `Cześć ${firstName},`,
    '',
    `czeka na Ciebie nowa praca domowa: „${data.title}".`,
    '',
    `Liczba ćwiczeń: ${items}`,
    due ? `Termin: ${due}` : null,
    data.assignedBy ? `Od: ${data.assignedBy}` : null,
    data.instructions ? `\nWskazówki: ${data.instructions}` : null,
    APP_URL ? `\nOtwórz aplikację: ${APP_URL}` : null,
    '',
    '—',
    'CRIBRO ENGLISH',
  ];

  const rows = [
    ['Ćwiczenia', items],
    ...(due ? [['Termin', due]] : []),
    ...(data.assignedBy ? [['Od', data.assignedBy]] : []),
  ]
    .map(
      ([label, value]) => `
        <tr>
          <td style="padding:6px 0;color:#7c8798;font-size:13px;">${escapeHtml(label)}</td>
          <td style="padding:6px 0;color:#111820;font-size:14px;font-weight:600;text-align:right;">${escapeHtml(value)}</td>
        </tr>`
    )
    .join('');

  const button = APP_URL
    ? `<p style="margin:28px 0 0;">
         <a href="${escapeHtml(APP_URL)}"
            style="display:inline-block;background:#0f7a52;color:#ffffff;text-decoration:none;
                   padding:12px 22px;border-radius:8px;font-size:15px;font-weight:600;">
           Otwórz zadanie
         </a>
       </p>`
    : '';

  const instructions = data.instructions
    ? `<p style="margin:20px 0 0;color:#3b4655;font-size:14px;line-height:1.6;">
         ${escapeHtml(data.instructions)}
       </p>`
    : '';

  const html = `<!doctype html>
<html lang="pl">
  <body style="margin:0;padding:24px;background:#f4f6f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;border:1px solid #e3e8ee;">
      <tr>
        <td style="padding:28px 28px 0;">
          <p style="margin:0;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#7c8798;">CRIBRO ENGLISH</p>
          <h1 style="margin:12px 0 0;font-size:20px;line-height:1.35;color:#111820;">Nowa praca domowa</h1>
          <p style="margin:14px 0 0;color:#3b4655;font-size:15px;line-height:1.6;">
            Cześć ${escapeHtml(firstName)}, czeka na Ciebie zadanie
            <strong style="color:#111820;">${escapeHtml(data.title)}</strong>.
          </p>
          ${instructions}
        </td>
      </tr>
      <tr>
        <td style="padding:20px 28px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                 style="border-top:1px solid #e3e8ee;border-bottom:1px solid #e3e8ee;">
            ${rows}
          </table>
          ${button}
        </td>
      </tr>
      <tr>
        <td style="padding:24px 28px 28px;">
          <p style="margin:0;color:#7c8798;font-size:12px;line-height:1.6;">
            Wiadomość wysłana automatycznie po dodaniu zadania w panelu lektora.
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { subject, html, text: textLines.filter((line) => line !== null).join('\n') };
}
