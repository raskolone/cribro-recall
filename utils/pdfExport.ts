import html2pdf from 'html2pdf.js';
import { StudentTest } from "../types";

export const exportTestToPDF = (test: StudentTest, t: any) => {
  const container = document.createElement('div');
  container.style.padding = '20px';
  container.style.fontFamily = 'Arial, sans-serif';
  container.style.color = '#000';
  container.style.backgroundColor = '#fff';
  
  let html = `
    <h1 style="font-size: 24px; margin-bottom: 10px; color: #111;">${test.title}</h1>
    <p style="margin: 5px 0; font-size: 14px;"><strong>${t("Zakres:")}</strong> ${test.scope}</p>
  `;
  
  if (test.completedAt) {
    const d = new Date(test.completedAt);
    html += `<p style="margin: 5px 0; font-size: 14px;"><strong>${t("Zakończony:")}</strong> ${d.toLocaleDateString()} ${d.toLocaleTimeString()}</p>`;
  }
  
  if (test.score !== undefined) {
    html += `<p style="margin: 5px 0; font-size: 16px;"><strong>${t("Wynik:")}</strong> ${test.score}/${test.maxScore} pkt</p>`;
  }
  
  html += `<hr style="margin: 20px 0; border: 1px solid #ccc;" />`;
  
  test.questions.forEach((q, i) => {
    html += `
      <div style="margin-bottom: 20px; page-break-inside: avoid;">
        <h3 style="font-size: 16px; margin: 0 0 5px 0; color: #333;">${i + 1}. ${q.instruction || ''}</h3>
        <p style="font-size: 14px; margin: 0 0 10px 0;">${q.prompt}</p>
        <p style="font-size: 14px; margin: 0 0 5px 0; color: #555;"><strong>${t("Twoja odpowiedź:")}</strong> ${test.studentAnswers?.[q.id] || `<i>${t("(brak)")}</i>`}</p>
        <p style="font-size: 14px; margin: 0; color: #007700;"><strong>${t("Poprawna odpowiedź:")}</strong> ${q.correctAnswer}</p>
      </div>
    `;
  });
  
  if (test.aiFeedback) {
    html += `
      <hr style="margin: 20px 0; border: 1px solid #ccc;" />
      <div style="page-break-inside: avoid;">
        <h2 style="font-size: 18px; margin-bottom: 10px;">${t("Feedback nauczyciela / AI:")}</h2>
        <p style="font-size: 14px; white-space: pre-wrap;">${test.aiFeedback}</p>
      </div>
    `;
  }
  
  container.innerHTML = html;
  
  const opt = {
    margin:       15,
    filename:     `${test.title?.replace(/\s+/g, '_') || 'test'}_raport.pdf`,
    image:        { type: 'jpeg' as const, quality: 0.98 },
    html2canvas:  { scale: 2 },
    jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' as const }
  };
  
  html2pdf().from(container).set(opt).save();
};

/**
 * Eksport treści notatnika do PDF — wierne odwzorowanie dokumentu A4
 * z zachowaniem kolorów sekcji lekcji, podziałów stron i czystej typografii.
 */
export const exportScratchpadToPDF = async (title: string, contentHtml: string): Promise<boolean> => {
  const safeTitle = title || 'Notatnik';

  // Stwórz kontener i dołącz go do DOM-u (poza ekranem), żeby html2canvas wyliczył wymiary i style
  const container = document.createElement('div');
  container.className = 'scratchpad-pdf-export-container';
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = '794px'; // Dokładna szerokość A4 @ 96 DPI
  container.style.padding = '48px 56px';
  container.style.backgroundColor = '#ffffff';
  container.style.color = '#1e293b';
  container.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
  container.style.fontSize = '14.5px';
  container.style.lineHeight = '1.7';
  container.style.boxSizing = 'border-box';

  // Sformatuj treść: rozwiń wszystkie zwinięte sekcje i usuń przyciski UI
  const tempDoc = document.createElement('div');
  tempDoc.innerHTML = contentHtml || '<p>(Brak treści)</p>';

  // Rozwiń ukryte elementy (zwinięte rozdziały)
  tempDoc.querySelectorAll('[style*="display: none"], [style*="display:none"]').forEach((el: any) => {
    el.style.display = '';
  });
  tempDoc.querySelectorAll('[data-collapsed]').forEach((el) => {
    el.removeAttribute('data-collapsed');
  });
  // Usuń kontrolki strzałek
  tempDoc.querySelectorAll('.pad-toggle').forEach((el) => el.remove());
  // Przekształć pad-page-break w czysty podział strony w druku
  tempDoc.querySelectorAll('.pad-page-break').forEach((el: any) => {
    el.style.cssText = 'page-break-before: always !important; break-before: page !important; height: 1px; margin: 0; padding: 0; background: transparent; border: none; overflow: hidden;';
    el.innerHTML = '';
  });

  container.innerHTML = `
    <style>
      .scratchpad-pdf-export-container h1,
      .scratchpad-pdf-export-container h2,
      .scratchpad-pdf-export-container h3 {
        color: #0f172a;
        font-family: inherit;
        page-break-after: avoid;
        break-after: avoid;
      }
      .scratchpad-pdf-export-container h1 {
        font-size: 24px;
        font-weight: 800;
        margin: 0 0 16px;
        padding-bottom: 8px;
        border-bottom: 2px solid #0d9488;
        color: #0f172a;
      }
      .scratchpad-pdf-export-container h2 {
        font-size: 19px;
        font-weight: 700;
        margin: 24px 0 10px;
        color: #0f172a;
        page-break-before: auto;
      }
      .scratchpad-pdf-export-container h3 {
        font-size: 15px;
        font-weight: 700;
        margin: 18px 0 6px;
      }
      .scratchpad-pdf-export-container p {
        margin: 6px 0;
      }
      .scratchpad-pdf-export-container ul, .scratchpad-pdf-export-container ol {
        margin: 6px 0;
        padding-left: 24px;
      }
      .scratchpad-pdf-export-container li {
        margin: 3px 0;
      }
      .scratchpad-pdf-export-container blockquote {
        margin: 12px 0;
        padding: 4px 12px;
        border-left: 3px solid #0d9488;
        color: #475569;
        background: #f8fafc;
      }
      .scratchpad-pdf-export-container img {
        max-width: 100%;
        height: auto;
        border-radius: 6px;
        margin: 10px 0;
      }
      .scratchpad-pdf-export-container code {
        background: #f1f5f9;
        padding: 2px 5px;
        border-radius: 4px;
        font-family: monospace;
        font-size: 13px;
      }
      .scratchpad-pdf-export-container hr {
        border: none;
        border-top: 1px solid #e2e8f0;
        margin: 18px 0;
      }
      .scratchpad-pdf-export-container table {
        width: 100%;
        border-collapse: collapse;
        margin: 12px 0;
      }
      .scratchpad-pdf-export-container th,
      .scratchpad-pdf-export-container td {
        border: 1px solid #cbd5e1;
        padding: 6px 10px;
        font-size: 13.5px;
      }
    </style>
    <div style="margin-bottom: 20px;">
      <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.12em; color: #0d9488; margin-bottom: 4px;">
        CRIBRO ENGLISH • NOTATNIK
      </div>
      <h1 style="margin: 0; padding-bottom: 12px; font-size: 22px; font-weight: 800; color: #0f172a; border-bottom: 2px solid #0d9488;">
        ${safeTitle}
      </h1>
    </div>
    <div>${tempDoc.innerHTML}</div>
  `;

  document.body.appendChild(container);

  const opt = {
    margin: [10, 10, 10, 10] as [number, number, number, number],
    filename: `${safeTitle.replace(/[/\\?%*:|"<>]/g, '_').replace(/\s+/g, '_')}.pdf`,
    image: { type: 'jpeg' as const, quality: 0.98 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      logging: false,
      scrollY: 0,
    },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const },
    pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
  };

  try {
    await html2pdf().set(opt).from(container).save();
    return true;
  } catch (err) {
    console.error('[PDF Export] Błąd eksportu PDF:', err);
    throw err;
  } finally {
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
  }
};

/**
 * Eksport dowolnego dokumentu / raportu / planu HTML wygenerowanego przez AI do PDF A4.
 */
export const exportHtmlToPDF = async (contentHtml: string, title?: string): Promise<boolean> => {
  const safeTitle = title || 'Dokument CRIBRO';

  const container = document.createElement('div');
  container.className = 'cribro-html-pdf-export-container';
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = '794px'; // A4 @ 96 DPI
  container.style.padding = '44px 52px';
  container.style.backgroundColor = '#ffffff';
  container.style.color = '#0f172a';
  container.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
  container.style.fontSize = '14px';
  container.style.lineHeight = '1.65';
  container.style.boxSizing = 'border-box';

  const tempDoc = document.createElement('div');
  tempDoc.innerHTML = contentHtml || '<p>(Brak treści)</p>';

  container.innerHTML = `
    <style>
      .cribro-html-pdf-export-container * {
        box-sizing: border-box;
      }
      .cribro-html-pdf-export-container h1,
      .cribro-html-pdf-export-container h2,
      .cribro-html-pdf-export-container h3,
      .cribro-html-pdf-export-container h4 {
        color: #0f172a;
        font-family: inherit;
        page-break-after: avoid;
        break-after: avoid;
      }
      .cribro-html-pdf-export-container h1 {
        font-size: 22px;
        font-weight: 800;
        margin: 0 0 12px;
        padding-bottom: 8px;
        border-bottom: 2px solid #0d9488;
        color: #0f172a;
      }
      .cribro-html-pdf-export-container h2 {
        font-size: 17px;
        font-weight: 700;
        margin: 20px 0 8px;
        color: #0f172a;
      }
      .cribro-html-pdf-export-container h3 {
        font-size: 14.5px;
        font-weight: 700;
        margin: 14px 0 6px;
      }
      .cribro-html-pdf-export-container p {
        margin: 6px 0;
      }
      .cribro-html-pdf-export-container ul, .cribro-html-pdf-export-container ol {
        margin: 6px 0;
        padding-left: 22px;
      }
      .cribro-html-pdf-export-container li {
        margin: 3px 0;
      }
      .cribro-html-pdf-export-container table {
        width: 100%;
        border-collapse: collapse;
        margin: 14px 0;
        page-break-inside: avoid;
      }
      .cribro-html-pdf-export-container th {
        background-color: #f1f5f9;
        font-weight: 700;
        text-align: left;
        border: 1px solid #cbd5e1;
        padding: 7px 10px;
        font-size: 13px;
      }
      .cribro-html-pdf-export-container td {
        border: 1px solid #cbd5e1;
        padding: 7px 10px;
        font-size: 13px;
      }
      .cribro-html-pdf-export-container tr:nth-child(even) td {
        background-color: #f8fafc;
      }
      .cribro-html-pdf-export-container blockquote {
        margin: 12px 0;
        padding: 6px 14px;
        border-left: 3px solid #0d9488;
        color: #334155;
        background: #f8fafc;
        border-radius: 0 4px 4px 0;
      }
      .cribro-html-pdf-export-container code {
        background: #f1f5f9;
        padding: 2px 4px;
        border-radius: 3px;
        font-family: monospace;
        font-size: 12.5px;
      }
      .cribro-html-pdf-export-container pre {
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        padding: 10px;
        border-radius: 6px;
        font-family: monospace;
        font-size: 12px;
        overflow-x: auto;
        white-space: pre-wrap;
      }
      .cribro-html-pdf-export-container hr {
        border: none;
        border-top: 1px solid #e2e8f0;
        margin: 16px 0;
      }
      .cribro-html-pdf-export-container .card {
        border: 1px solid #e2e8f0;
        border-radius: 6px;
        padding: 12px;
        margin: 10px 0;
        background: #ffffff;
      }
    </style>
    <div style="margin-bottom: 18px; display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #0d9488; padding-bottom: 8px;">
      <div>
        <div style="font-size: 10.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.12em; color: #0d9488; margin-bottom: 3px;">
          CRIBRO ENGLISH • DOKUMENT & RAPORT
        </div>
        <h1 style="margin: 0; padding: 0; border: none; font-size: 20px; font-weight: 800; color: #0f172a;">
          ${safeTitle}
        </h1>
      </div>
      <div style="text-align: right; font-size: 11px; color: #64748b;">
        <div>${new Date().toLocaleDateString('pl-PL')}</div>
        <div style="font-weight: 600; color: #0d9488;">CRIBRO Workspace</div>
      </div>
    </div>
    <div>${tempDoc.innerHTML}</div>
  `;

  document.body.appendChild(container);

  const opt = {
    margin: [10, 10, 10, 10] as [number, number, number, number],
    filename: `${safeTitle.replace(/[/\\?%*:|"<>]/g, '_').replace(/\s+/g, '_')}.pdf`,
    image: { type: 'jpeg' as const, quality: 0.98 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      logging: false,
      scrollY: 0,
    },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const },
    pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
  };

  try {
    await html2pdf().set(opt).from(container).save();
    return true;
  } catch (err) {
    console.error('[PDF Export] Błąd eksportu dokumentu HTML do PDF:', err);
    throw err;
  } finally {
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
  }
};

/**
 * Eksport treści notatnika do pliku `.doc` — zwykły HTML z nagłówkiem MS
 * Office, bez żadnej integracji API. Word otwiera taki plik bezpośrednio;
 * Google Docs otwiera go po wgraniu na Dysk ("Otwórz za pomocą → Dokumenty
 * Google") — stąd świadomie NIE nazywamy tego eksportem "do Google Docs" w UI.
 * Zero nowych zależności: czysty string + Blob + link do pobrania.
 */
export const exportScratchpadToWord = (title: string, contentHtml: string) => {
  const safeTitle = title || 'Notatnik';
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8">
<title>${safeTitle}</title>
<!--[if gte mso 9]>
<xml>
  <w:WordDocument>
    <w:View>Print</w:View>
    <w:Zoom>100</w:Zoom>
    <w:DoNotOptimizeForBrowser/>
  </w:WordDocument>
</xml>
<![endif]-->
<style>
  body { font-family: Calibri, Arial, sans-serif; font-size: 12pt; }
  h1, h2, h3 { color: #111; }
</style>
</head>
<body>
<h1>${safeTitle}</h1>
${contentHtml}
</body>
</html>`;

  const blob = new Blob(['﻿', html], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${safeTitle.replace(/\s+/g, '_')}.doc`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Przeniesienie notatnika do Google Docs.
 *
 * ══ DLACZEGO KOPIUJ-I-WKLEJ, A NIE „WYŚLIJ" ══
 *
 * Prawdziwy eksport — utworzenie dokumentu na koncie lektora — wymaga
 * logowania do Google (OAuth, zakres `drive.file`) i zgody użytkownika na
 * dostęp aplikacji do jego Dysku. Cribro nie ma ani tej integracji, ani
 * powodu, żeby prosić o dostęp do całego Dysku dla jednej funkcji.
 *
 * To, co działa BEZ żadnego dostępu i daje ten sam wynik w dwóch ruchach:
 * notatnik ląduje w schowku jako tekst sformatowany (`text/html`), a w nowej
 * karcie otwiera się pusty dokument Google. Wklejenie zachowuje nagłówki,
 * listy, pogrubienia, kolory i zakreślacze — Google Docs czyta HTML ze
 * schowka tak samo jak Word.
 *
 * Zwraca `true`, gdy treść trafiła do schowka. Jeżeli przeglądarka odmówiła
 * (`ClipboardItem` bez HTTPS albo bez gestu użytkownika), zwraca `false` —
 * wtedy zostaje eksport do Worda, który w Google Docs też się otwiera, tylko
 * przez wgranie pliku.
 */
export const exportScratchpadToGoogleDocs = async (
  title: string,
  contentHtml: string
): Promise<boolean> => {
  const safeTitle = title || 'Notatnik';
  const html = `<meta charset="utf-8"><h1>${safeTitle}</h1>${contentHtml}`;

  // Zwykły tekst jako zapas: gdyby docelowa aplikacja nie umiała HTML-a,
  // wklei się przynajmniej treść bez formatowania.
  const plain = (() => {
    const tmp = document.createElement('div');
    tmp.innerHTML = contentHtml;
    return `${safeTitle}\n\n${tmp.innerText || tmp.textContent || ''}`;
  })();

  let copied = false;
  try {
    if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([plain], { type: 'text/plain' }),
        }),
      ]);
      copied = true;
    } else if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(plain);
      copied = true;
    }
  } catch (error) {
    console.warn('[Notatnik] Schowek odmówił przyjęcia treści:', error);
  }

  // Okno otwieramy zawsze — nawet bez schowka lektor ma gdzie wkleić ręcznie.
  window.open('https://docs.google.com/document/create', '_blank', 'noopener');
  return copied;
};
