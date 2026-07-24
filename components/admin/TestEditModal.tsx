import React, { useState, useEffect } from 'react';
import { StudentTest, TestQuestion, TestQuestionType } from '../../types';
import Button from '../ui/Button';
import { X, Plus, Trash2, ArrowUp, ArrowDown, Save } from 'lucide-react';
import { updateDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase';
import i18n from 'i18next';

interface TestEditModalProps {
  test: StudentTest | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const TestEditModal: React.FC<TestEditModalProps> = ({ test, isOpen, onClose, onSaved }) => {
  const [title, setTitle] = useState('');
  const [scope, setScope] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [attemptsLimit, setAttemptsLimit] = useState(1);
  const [questions, setQuestions] = useState<TestQuestion[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (test) {
      setTitle(test.title || '');
      setScope(test.scope || '');
      setDueDate(test.dueDate || '');
      setAttemptsLimit(test.attemptsLimit || 1);
      setQuestions(test.questions ? JSON.parse(JSON.stringify(test.questions)) : []);
    }
  }, [test]);

  if (!isOpen || !test) return null;

  const handleSave = async () => {
    if (!title.trim()) return alert(i18n.t("Podaj tytuł testu"));
    if (!dueDate) return alert(i18n.t("Wybierz datę wykonania testu"));
    if (questions.length === 0) return alert(i18n.t("Test musi posiadać przynajmniej jedno pytanie"));

    setIsSaving(true);
    try {
      const testRef = doc(db, `users/${test.studentId}/tests`, test.id!);
      await updateDoc(testRef, {
        title: title.trim(),
        scope: scope.trim(),
        dueDate,
        attemptsLimit: Number(attemptsLimit),
        questions,
        maxScore: questions.length
      });

      alert(i18n.t("Zapisano zmiany w teście!"));
      onSaved();
      onClose();
    } catch (err: any) {
      console.error(err);
      alert(i18n.t("Błąd podczas zapisywania zmian w teście: ") + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateQuestion = (index: number, field: keyof TestQuestion, value: any) => {
    const updated = [...questions];
    updated[index] = { ...updated[index], [field]: value };
    setQuestions(updated);
  };

  const handleRemoveQuestion = (index: number) => {
    if (questions.length <= 1) {
      return alert(i18n.t("Test musi zawierać przynajmniej jedno pytanie."));
    }
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const handleMoveQuestion = (index: number, direction: 'up' | 'down') => {
    const newQuestions = [...questions];
    if (direction === 'up' && index > 0) {
      const temp = newQuestions[index];
      newQuestions[index] = newQuestions[index - 1];
      newQuestions[index - 1] = temp;
    } else if (direction === 'down' && index < newQuestions.length - 1) {
      const temp = newQuestions[index];
      newQuestions[index] = newQuestions[index + 1];
      newQuestions[index + 1] = temp;
    }
    setQuestions(newQuestions);
  };

  const handleAddQuestion = () => {
    const newQ: TestQuestion = {
      id: Math.random().toString(36).substring(2, 9),
      type: 'translation',
      instruction: 'Przetłumacz zdanie na język angielski:',
      prompt: 'Wpisz treść pytania...',
      correctAnswer: 'Prawidłowa odpowiedź'
    };
    setQuestions([...questions, newQ]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-base-100 border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden my-auto">
        {/* Header */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between bg-base-200/50">
          <div>
            <h2 className="text-xl font-bold text-white">{i18n.t("Edycja przypisanego testu")}</h2>
            <p className="text-xs text-content-muted mt-0.5">{test.studentName ? `Kursant: ${test.studentName}` : ''}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-content-muted hover:text-white hover:bg-white/10">
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-content-muted mb-1">{i18n.t("Tytuł testu")}</label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full bg-base-200/50 border border-white/10 rounded-xl p-3 outline-none focus:border-primary/50 text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-content-muted mb-1">{i18n.t("Termin wykonania (data)")}</label>
              <input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="w-full bg-base-200/50 border border-white/10 rounded-xl p-3 outline-none focus:border-primary/50 text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-content-muted mb-1">{i18n.t("Limit podejść")}</label>
              <input
                type="number"
                min={1}
                max={10}
                value={attemptsLimit}
                onChange={e => setAttemptsLimit(Number(e.target.value))}
                className="w-full bg-base-200/50 border border-white/10 rounded-xl p-3 outline-none focus:border-primary/50 text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-content-muted mb-1">{i18n.t("Zakres materiału")}</label>
              <input
                type="text"
                value={scope}
                onChange={e => setScope(e.target.value)}
                className="w-full bg-base-200/50 border border-white/10 rounded-xl p-3 outline-none focus:border-primary/50 text-white"
              />
            </div>
          </div>

          {/* Questions Editor */}
          <div className="space-y-4 pt-4 border-t border-white/10">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg text-white">{i18n.t("Lista pytań")} ({questions.length})</h3>
              <Button onClick={handleAddQuestion} size="sm" variant="secondary" className="flex items-center gap-1.5">
                <Plus size={16} /> {i18n.t("Dodaj pytanie")}
              </Button>
            </div>

            {questions.map((q, idx) => (
              <div key={q.id || idx} className="p-4 bg-base-200/40 rounded-xl border border-white/10 space-y-3 relative group">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-primary/20 text-primary font-bold text-xs flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <select
                      value={q.type}
                      onChange={e => handleUpdateQuestion(idx, 'type', e.target.value as TestQuestionType)}
                      className="bg-base-100 border border-white/10 rounded-lg px-2 py-1 text-xs text-white outline-none focus:border-primary/50"
                    >
                      <option value="translation">Tłumaczenie</option>
                      <option value="multiple_choice">Wybór wielokrotny</option>
                      <option value="fill_in_blank">Luka w zdaniu</option>
                      <option value="fill_in_blank_bank">Luka z bankiem słów</option>
                      <option value="matching">Dopasowywanie</option>
                      <option value="writing">Pisanie (Otwarty)</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => handleMoveQuestion(idx, 'up')}
                      className="p-1 rounded bg-white/5 text-content-muted hover:text-white disabled:opacity-30"
                    >
                      <ArrowUp size={14} />
                    </button>
                    <button
                      type="button"
                      disabled={idx === questions.length - 1}
                      onClick={() => handleMoveQuestion(idx, 'down')}
                      className="p-1 rounded bg-white/5 text-content-muted hover:text-white disabled:opacity-30"
                    >
                      <ArrowDown size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveQuestion(idx)}
                      className="p-1.5 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 ml-1"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-content-muted mb-1">{i18n.t("Polecenie / Instrukcja")}</label>
                  <input
                    type="text"
                    value={q.instruction || ''}
                    onChange={e => handleUpdateQuestion(idx, 'instruction', e.target.value)}
                    className="w-full bg-base-100 border border-white/10 rounded-lg p-2 text-xs text-white outline-none focus:border-primary/50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-content-muted mb-1">{i18n.t("Treść pytania / Zdanie")}</label>
                  <textarea
                    rows={2}
                    value={q.prompt}
                    onChange={e => handleUpdateQuestion(idx, 'prompt', e.target.value)}
                    className="w-full bg-base-100 border border-white/10 rounded-lg p-2 text-sm text-white outline-none focus:border-primary/50 resize-y"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-primary mb-1">{i18n.t("Prawidłowa odpowiedź")}</label>
                  <input
                    type="text"
                    value={q.correctAnswer}
                    onChange={e => handleUpdateQuestion(idx, 'correctAnswer', e.target.value)}
                    className="w-full bg-base-100 border border-primary/30 rounded-lg p-2 text-sm font-bold text-primary outline-none focus:border-primary"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 bg-base-200/50 flex justify-end gap-3">
          <Button onClick={onClose} variant="ghost">{i18n.t("Anuluj")}</Button>
          <Button onClick={handleSave} isLoading={isSaving} className="flex items-center gap-2">
            <Save size={16} /> {i18n.t("Zapisz zmiany")}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default TestEditModal;
