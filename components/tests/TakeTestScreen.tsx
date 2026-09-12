import React, { useState, useMemo } from 'react';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { StudentTest } from '../../types';
import { gradeTest } from '../../services/geminiService';
import Card from '../ui/Card';
import ConfirmModal from '../ui/ConfirmModal';
import Button from '../ui/Button';
import Toast, { useToast } from '../ui/Toast';
import TestQuestionFields, { TestQuestionHeader } from './TestQuestionFields';
import { exportTestToPDF } from "../../utils/pdfExport";
import { Download, CheckCircle } from "lucide-react";
import Markdown from "react-markdown";
import i18n from "i18next";

interface TakeTestScreenProps {
  test: StudentTest;
  onBack: () => void;
}

const TakeTestScreen: React.FC<TakeTestScreenProps> = ({ test, onBack }) => {
  const { user, updateUserStreak } = useAuth();
  const { language } = useLanguage();
  const { toast, showToast, dismissToast } = useToast();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  /** Kursant zobaczył ostrzeżenie o pustych pytaniach i może zakończyć mimo to. */
  const [confirmedIncomplete, setConfirmedIncomplete] = useState(false);
  const [confirmModalState, setConfirmModalState] = useState<{isOpen: boolean; title: string; message: string; onConfirm: () => void}>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  const showConfirm = (title: string, message: string, onConfirm: () => void) => {
    setConfirmModalState({ isOpen: true, title, message, onConfirm });
  };

  const closeConfirm = () => {
    setConfirmModalState(prev => ({ ...prev, isOpen: false }));
  };

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [gradingResult, setGradingResult] = useState<{score: number, feedback: string} | null>(null);

  const handleAnswerChange = (questionId: string, answer: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: answer }));
  };

  const handleSubmit = async () => {
    // Zamiast okna systemowego: ostrzeżenie w toaście, a przycisk zmienia się
    // w „zakończ mimo to". Kursant zostaje przy pytaniach i widzi, ile pominął.
    const unanswered = test.questions.filter(q => !answers[q.id]?.trim());
    if (unanswered.length > 0 && !confirmedIncomplete) {
      showToast(
        `Masz ${unanswered.length} nieodpowiedzianych pytań. Dotknij jeszcze raz, żeby zakończyć mimo to.`,
        'warning'
      );
      setConfirmedIncomplete(true);
      return;
    }

    setIsSubmitting(true);
    
    try {
      if (!user?.id || !test.id) throw new Error("Not authenticated");
      
      let gradeResult = { score: 0, feedback: 'Odpowiedzi zostały zapisane i przesłane do weryfikacji.' };
      try {
        gradeResult = await gradeTest(test.title, test.questions, answers);
      } catch (aiErr) {
        console.warn("AI grading error, proceeding with answers saved:", aiErr);
      }
      
      const scoreToSave = (gradeResult.score !== undefined && gradeResult.score !== null && !isNaN(Number(gradeResult.score))) ? Number(gradeResult.score) : 0;
      const newAttemptsUsed = (test.attemptsUsed || 0) + 1;
      
      const testRef = doc(db, `users/${user.id}/tests`, test.id);
      await updateDoc(testRef, {
        status: 'graded',
        studentAnswers: answers,
        score: scoreToSave,
        aiFeedback: gradeResult.feedback,
        attemptsUsed: newAttemptsUsed,
        teacherRead: false,
        completedAt: new Date().toISOString()
      });

      // Also record in practiceLogs for student history & statistics
      try {
        const logId = `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const logRef = doc(db, `users/${user.id}/practiceLogs/${logId}`);
        const qCount = test.questions ? test.questions.length : 1;
        await setDoc(logRef, {
          exerciseType: 'test',
          exerciseFormat: 'test',
          date: new Date().toISOString(),
          isRevisionMode: false,
          score: scoreToSave,
          totalWords: qCount,
          testName: test.title || 'Test',
          setDisplayName: test.title || 'Test',
          exercisesData: `Test: ${test.title} (${scoreToSave}%)`
        });

        if (user?.id) {
          const currentCount = user.translatedSentencesCount || 0;
          updateDoc(doc(db, 'users', user.id), {
            translatedSentencesCount: currentCount + qCount
          }).catch(console.error);
        }
      } catch (logErr) {
        console.warn("Could not save test to practiceLogs:", logErr);
      }

      if (updateUserStreak) {
        updateUserStreak().catch(console.error);
      }

      setGradingResult({ score: scoreToSave, feedback: gradeResult.feedback });
      setSubmitted(true);
    } catch (err) {
      console.error(err);
      showToast('Nie udało się zapisać odpowiedzi. Sprawdź połączenie i spróbuj ponownie.', 'warning');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto text-center space-y-6 pt-12">
        <h2 className="text-3xl font-bold text-primary">{i18n.t("Test Zakończony!")}</h2>
        <p className="text-content-muted">{i18n.t("Twoje odpowiedzi zostały zapisane.")}</p>
        
        {gradingResult?.feedback && (
          <div className="mt-8 text-left max-w-3xl mx-auto">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <CheckCircle className="text-primary w-6 h-6" /> {i18n.t("Informacja zwrotna (AI Feedback)")}
            </h3>
            
            {gradingResult.score !== undefined && (
              <div className="mb-4 text-lg">
                <strong>{i18n.t("Wynik:")}</strong> {Number.isNaN(Number(gradingResult.score)) ? 0 : gradingResult.score} {i18n.t("pkt")}
              </div>
            )}

            <div className="bg-base-200/60 backdrop-blur-sm border border-line-strong p-6 rounded-2xl prose prose-headings:text-text-hi prose-strong:text-text-hi prose-a:text-primary max-w-none text-content">
              <Markdown>{gradingResult.feedback}</Markdown>
            </div>
          </div>
        )}
        <Button onClick={onBack}>{i18n.t("Wróć do listy testów")}</Button>
        <Button 
          onClick={() => {
            exportTestToPDF({
              ...test,
              studentAnswers: answers,
              aiFeedback: gradingResult?.feedback,
              score: gradingResult?.score,
              completedAt: new Date().toISOString()
            }, i18n.t)
          }}
          className="ml-4 bg-transparent border border-white/20 text-white hover:bg-white/10"
        >
          <Download className="w-4 h-4 mr-2 inline" />
          {i18n.t("Pobierz raport (PDF)")}
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      <Toast toast={toast} onDismiss={dismissToast} />
      <div className="flex items-center justify-between mb-8">
        <button onClick={onBack} className="text-content-muted hover:text-white flex items-center gap-2">
          ← {language === 'pl' ? 'Wróć' : 'Back'}
        </button>
        <h1 className="text-2xl font-bold">{test.title}</h1>
      </div>

      <div className="bg-primary/10 text-primary p-4 rounded-lg border border-primary/20 text-sm mb-6">
        <strong>{i18n.t("Zakres:")}</strong> {test.scope}
      </div>
      {test.instructions && (
        <div className="bg-primary/5 text-primary border border-primary/20 p-4 rounded-xl mb-8 whitespace-pre-wrap">
          <strong>{i18n.t("Instrukcje:")}</strong><br/>{test.instructions}
        </div>
      )}

      <div className="space-y-8">
        {test.questions.map((q, idx) => (
          <Card key={q.id} className="p-6 md:p-8 ">
            <div className="flex items-start gap-4 md:gap-6">
              <div className="font-bold text-primary text-lg w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                {idx + 1}
              </div>
              <div className="flex-1 space-y-6 w-full overflow-hidden">
                <TestQuestionHeader question={q} />
                <TestQuestionFields
                  question={q}
                  answer={answers[q.id]}
                  onChange={(ans) => handleAnswerChange(q.id, ans)}
                />
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="pt-8 flex justify-end">
        <Button
          onClick={handleSubmit}
          isLoading={isSubmitting}
          className={`font-bold px-8 py-3 text-lg ${
            confirmedIncomplete
              ? 'bg-warn text-accent-ink hover:bg-warn/90'
              : 'bg-primary text-accent-ink hover:bg-primary/90'
          }`}
        >
          {confirmedIncomplete ? 'Zakończ mimo to' : i18n.t("Zakończ Test")}
        </Button>
      </div>
      <ConfirmModal
        isOpen={confirmModalState.isOpen}
        title={confirmModalState.title}
        message={confirmModalState.message}
        onConfirm={confirmModalState.onConfirm}
        onCancel={closeConfirm}
        confirmText="Zakończ"
        cancelText="Anuluj"
      />
    </div>
  );
};

export default TakeTestScreen;
