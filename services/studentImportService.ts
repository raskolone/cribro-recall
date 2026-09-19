import { auth } from '../firebase';
import { StudentImportAnalysis } from '../types/studentImport';

export const SUPPORTED_STUDENT_IMPORT_EXTENSIONS = ['txt', 'md', 'markdown', 'pdf'];

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/**
 * Analizuje plik z notatkami o kursancie (profil + historia lekcji) przez
 * backendowy endpoint Gemini. Wywoływane z okna dodawania kursanta, przed
 * jego utworzeniem — patrz `components/admin/StudentImportReviewCard.tsx`.
 */
export async function parseStudentDocument(file: File): Promise<StudentImportAnalysis> {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  const isPdf = file.type === 'application/pdf' || ext === 'pdf';

  const body: { textContent?: string; pdfBase64?: string } = {};
  if (isPdf) {
    body.pdfBase64 = await readFileAsDataUrl(file);
  } else {
    body.textContent = await readFileAsText(file);
  }

  const token = auth.currentUser ? await auth.currentUser.getIdToken() : '';
  const res = await fetch('/api/gemini/analyze-student-import', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(body)
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || 'Nie udało się przeanalizować pliku.');
  }
  return data.analysis as StudentImportAnalysis;
}
