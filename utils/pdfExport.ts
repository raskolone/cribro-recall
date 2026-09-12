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
 * Eksport treści notatnika do PDF — dokładnie ten sam wzorzec co
 * `exportTestToPDF` powyżej (html2pdf.js, zero nowych zależności).
 */
export const exportScratchpadToPDF = (title: string, contentHtml: string) => {
  const container = document.createElement('div');
  container.style.padding = '20px';
  container.style.fontFamily = 'Arial, sans-serif';
  container.style.color = '#000';
  container.style.backgroundColor = '#fff';

  container.innerHTML = `
    <h1 style="font-size: 22px; margin-bottom: 16px; color: #111;">${title || 'Notatnik'}</h1>
    <div style="font-size: 14px; line-height: 1.5;">${contentHtml}</div>
  `;

  const opt = {
    margin: 15,
    filename: `${(title || 'notatnik').replace(/\s+/g, '_')}.pdf`,
    image: { type: 'jpeg' as const, quality: 0.98 },
    html2canvas: { scale: 2 },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const },
  };

  html2pdf().from(container).set(opt).save();
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
