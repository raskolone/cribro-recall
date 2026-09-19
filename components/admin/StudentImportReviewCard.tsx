import React from 'react';
import { AlertTriangle, CheckCircle2, BookOpen } from 'lucide-react';
import { StudentImportAnalysis, StudentImportMissingField } from '../../types/studentImport';
import Button from '../ui/Button';

interface StudentImportReviewCardProps {
  analysis: StudentImportAnalysis;
  onChange: (analysis: StudentImportAnalysis) => void;
  onLessonDateChange: (index: number, date: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  isSaving: boolean;
}

const FIELD_ORDER: StudentImportMissingField[] = ['fullName', 'email', 'level', 'lessonDates'];

/**
 * Karta weryfikacji dla "Smart Student Onboarding" — pokazuje, co model
 * odnalazł w pliku, i wymusza ręczne uzupełnienie krytycznych braków
 * (imię i nazwisko, e-mail) przed utworzeniem konta.
 */
const StudentImportReviewCard: React.FC<StudentImportReviewCardProps> = ({
  analysis,
  onChange,
  onLessonDateChange,
  onConfirm,
  onCancel,
  isSaving,
}) => {
  const { extractedData, missingFields } = analysis;
  const missingByField = new Map(missingFields.map((m) => [m.field, m]));
  const hasCriticalMissing = missingFields.some((m) => m.severity === 'critical');

  const updateField = <K extends keyof typeof extractedData>(key: K, value: (typeof extractedData)[K]) => {
    onChange({ ...analysis, extractedData: { ...extractedData, [key]: value } });
  };

  const fieldStyle = (field: StudentImportMissingField) => {
    const missing = missingByField.get(field);
    if (!missing) return 'border-emerald-500/40 focus:border-emerald-500';
    return missing.severity === 'critical'
      ? 'border-danger/60 focus:border-danger'
      : 'border-amber-500/60 focus:border-amber-500';
  };

  return (
    <div className="space-y-4">
      <div
        className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
          hasCriticalMissing
            ? 'bg-danger/10 border-danger/30 text-danger'
            : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'
        }`}
      >
        {hasCriticalMissing ? <AlertTriangle size={16} className="shrink-0 mt-0.5" /> : <CheckCircle2 size={16} className="shrink-0 mt-0.5" />}
        <span className="text-text-hi/90">{analysis.aiComment}</span>
      </div>

      {FIELD_ORDER.filter((f) => missingByField.has(f)).length > 0 && (
        <ul className="space-y-1">
          {FIELD_ORDER.filter((f) => missingByField.has(f)).map((field) => {
            const missing = missingByField.get(field)!;
            return (
              <li
                key={field}
                className={`text-xs font-semibold flex items-center gap-1.5 ${
                  missing.severity === 'critical' ? 'text-danger' : 'text-amber-500'
                }`}
              >
                <AlertTriangle size={12} />
                <span>Uzupełnij: {missing.label}</span>
              </li>
            );
          })}
        </ul>
      )}

      <div>
        <label className="block text-xs font-bold text-content-muted mb-1">
          Imię i nazwisko kursanta <span className="text-primary">*</span>
        </label>
        <input
          type="text"
          value={extractedData.fullName || ''}
          onChange={(e) => updateField('fullName', e.target.value)}
          placeholder="np. Jan Kowalski"
          className={`w-full px-3 py-2 bg-base-100 border rounded-xl text-text-hi text-sm focus:outline-none ${fieldStyle('fullName')}`}
        />
      </div>

      <div>
        <label className="block text-xs font-bold text-content-muted mb-1">
          Adres e-mail <span className="text-primary">*</span>
        </label>
        <input
          type="email"
          value={extractedData.email || ''}
          onChange={(e) => updateField('email', e.target.value)}
          placeholder="kursant@firma.pl"
          className={`w-full px-3 py-2 bg-base-100 border rounded-xl text-text-hi text-sm focus:outline-none ${fieldStyle('email')}`}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-bold text-content-muted mb-1">Poziom (CEFR)</label>
          <select
            value={extractedData.level || ''}
            onChange={(e) => updateField('level', (e.target.value || undefined) as any)}
            className={`w-full px-3 py-2 bg-base-100 border rounded-xl text-text-hi text-sm focus:outline-none ${fieldStyle('level')}`}
          >
            <option value="">— brak —</option>
            {['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map((lvl) => (
              <option key={lvl} value={lvl}>{lvl}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-content-muted mb-1">Branża</label>
          <input
            type="text"
            value={extractedData.industry || ''}
            onChange={(e) => updateField('industry', e.target.value)}
            className="w-full px-3 py-2 bg-base-100 border border-line-strong rounded-xl text-text-hi text-sm focus:border-primary focus:outline-none"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-bold text-content-muted mb-1">Cele nauki</label>
        <textarea
          value={extractedData.targetGoals || ''}
          onChange={(e) => updateField('targetGoals', e.target.value)}
          rows={2}
          className="w-full px-3 py-2 bg-base-100 border border-line-strong rounded-xl text-text-hi text-sm focus:border-primary focus:outline-none resize-none"
        />
      </div>

      {extractedData.historicalLessons.length > 0 && (
        <div>
          <label className="block text-xs font-bold text-content-muted mb-2 flex items-center gap-1.5">
            <BookOpen size={14} className="text-primary" />
            Historia lekcji ({extractedData.historicalLessons.length})
          </label>
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {extractedData.historicalLessons.map((lesson, idx) => (
              <div key={idx} className="p-2.5 bg-base-100 border border-line-strong rounded-lg text-xs space-y-1.5">
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={lesson.date}
                    onChange={(e) => onLessonDateChange(idx, e.target.value)}
                    className={`px-2 py-1 bg-base-200 border rounded-lg text-text-hi text-xs focus:outline-none ${
                      lesson.dateAmbiguous ? 'border-amber-500/60' : 'border-line-strong'
                    }`}
                  />
                  {lesson.dateAmbiguous && (
                    <span className="text-amber-500 font-semibold flex items-center gap-1">
                      <AlertTriangle size={11} /> Zweryfikuj datę
                    </span>
                  )}
                </div>
                {lesson.summary && <p className="text-content-muted">{lesson.summary}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-end gap-2 pt-3 border-t border-line-strong">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Anuluj
        </Button>
        <Button
          type="button"
          onClick={onConfirm}
          isLoading={isSaving}
          disabled={hasCriticalMissing}
          className="bg-primary text-accent-ink font-bold shadow-btn"
        >
          Zatwierdź i utwórz kursanta
        </Button>
      </div>
    </div>
  );
};

export default StudentImportReviewCard;
