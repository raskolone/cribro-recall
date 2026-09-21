import React, { useCallback, useEffect, useState } from 'react';
import {
  Check,
  ChevronDown,
  Copy,
  Link2,
  Loader2,
  Power,
  Sparkles,
  Trash2,
  Users,
} from 'lucide-react';
import { PublicTest, PublicTestSubmission } from '../../types';
import {
  deletePublicTest,
  getPublicTestSubmissions,
  getPublicTestsForTeacher,
  setPublicTestActive,
} from '../../services/publicTest';
import { buildPublicTestUrl, formatAccessCode } from '../../utils/accessCode';
import { confirmAsync } from '../../utils/appAlert';
import { gradeTest } from '../../services/geminiService';

/**
 * Testy otwarte w panelu lektora.
 *
 * Jedna lista, a pod każdym testem to, po co lektor tu wchodzi: kod do
 * podyktowania, link do wysłania i podejścia kandydatów. Testy przypisane
 * kursantom z bazy mają własny widok — ten jest wyłącznie dla ludzi, których
 * w bazie jeszcze nie ma.
 *
 * Ocena modelem odpala się stąd, a nie u kandydata: `/api/gemini/grade-test`
 * wymaga zalogowanego konta, a poza tym ocenianie na żądanie kogokolwiek, kto
 * zna kod, byłoby otwartym kranem na koszty.
 */

interface PublicTestPanelProps {
  teacherId: string;
}

const PublicTestPanel: React.FC<PublicTestPanelProps> = ({ teacherId }) => {
  const [tests, setTests] = useState<PublicTest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [submissions, setSubmissions] = useState<Record<string, PublicTestSubmission[]>>({});
  const [loadingSubs, setLoadingSubs] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [grading, setGrading] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!teacherId) return;
    setIsLoading(true);
    try {
      setTests(await getPublicTestsForTeacher(teacherId));
    } catch (error) {
      console.error('Nie udało się wczytać testów otwartych:', error);
    } finally {
      setIsLoading(false);
    }
  }, [teacherId]);

  useEffect(() => {
    load();
  }, [load]);

  const openTest = async (test: PublicTest) => {
    if (openId === test.id) {
      setOpenId(null);
      return;
    }
    setOpenId(test.id);
    if (submissions[test.id]) return;

    setLoadingSubs(test.id);
    try {
      const list = await getPublicTestSubmissions(test.id);
      setSubmissions((prev) => ({ ...prev, [test.id]: list }));
    } catch (error) {
      console.error('Nie udało się wczytać podejść:', error);
    } finally {
      setLoadingSubs(null);
    }
  };

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // Schowek bywa zablokowany (brak HTTPS, uprawnienia) — wtedy kod i tak
      // jest na ekranie do przepisania, więc nie robimy z tego błędu.
    }
  };

  const toggleActive = async (test: PublicTest) => {
    const next = !test.isActive;
    setTests((prev) => prev.map((t) => (t.id === test.id ? { ...t, isActive: next } : t)));
    try {
      await setPublicTestActive(test.id, next);
    } catch (error) {
      console.error('Nie udało się zmienić stanu testu:', error);
      setTests((prev) => prev.map((t) => (t.id === test.id ? { ...t, isActive: !next } : t)));
    }
  };

  const remove = async (test: PublicTest) => {
    const count = test.submissionCount || 0;
    const warning = count > 0
      ? `Test „${test.title}" ma ${count} podejść. Usunięcie skasuje je razem z testem. Na pewno?`
      : `Usunąć test „${test.title}"?`;
    if (!(await confirmAsync(warning))) return;

    try {
      await deletePublicTest(test.id);
      setTests((prev) => prev.filter((t) => t.id !== test.id));
    } catch (error) {
      console.error('Nie udało się usunąć testu:', error);
    }
  };

  /** Ocena jednego podejścia modelem — wynik zostaje w widoku, nie w bazie. */
  const gradeSubmission = async (test: PublicTest, submission: PublicTestSubmission) => {
    const key = `${test.id}:${submission.id}`;
    setGrading(key);
    try {
      const result = await gradeTest(test.title, test.questions, submission.answers);
      setSubmissions((prev) => ({
        ...prev,
        [test.id]: (prev[test.id] || []).map((s) =>
          s.id === submission.id
            ? { ...s, score: Number(result.score) || 0, aiFeedback: result.feedback }
            : s
        ),
      }));
    } catch (error) {
      console.error('Nie udało się ocenić podejścia:', error);
    } finally {
      setGrading(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-10 text-content-muted">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }

  if (tests.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-base-200/40 p-6 text-center">
        <h3 className="text-base font-bold text-content">Brak testów otwartych</h3>
        <p className="text-sm text-content-muted mt-2 leading-relaxed">
          Wystaw test w generatorze testów, wybierając „Test otwarty (bez kursanta)". Dostaniesz
          kod i link dla kandydata spoza bazy.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {tests.map((test) => {
        const isOpen = openId === test.id;
        const url = buildPublicTestUrl(test.id);
        const list = submissions[test.id] || [];

        return (
          <section
            key={test.id}
            className="rounded-2xl border border-white/10 bg-base-200/40 overflow-hidden"
          >
            <button
              onClick={() => openTest(test)}
              aria-expanded={isOpen}
              className="w-full min-h-[3.75rem] flex items-center gap-3 px-4 sm:px-5 py-3 text-left active:bg-white/[0.04] transition-colors"
            >
              <span className="font-mono text-lg font-black text-primary tracking-wider shrink-0">
                {formatAccessCode(test.id)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-bold text-white text-[15px] truncate">{test.title}</span>
                <span className="flex items-center gap-2 text-[12px] text-content-muted">
                  <Users size={11} />
                  {test.submissionCount || 0} podejść
                  {!test.isActive && <span className="text-warn">· zamknięty</span>}
                </span>
              </span>
              <ChevronDown
                className={`w-4 h-4 text-content-muted shrink-0 transition-transform ${
                  isOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {isOpen && (
              <div className="px-4 sm:px-5 pb-5 space-y-4 border-t border-white/[0.07] pt-4">
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => copy(test.id, `code-${test.id}`)}
                    className="min-h-[2.75rem] px-4 inline-flex items-center gap-2 rounded-xl border border-white/15 text-sm font-bold text-content"
                  >
                    {copied === `code-${test.id}` ? <Check size={14} /> : <Copy size={14} />}
                    Kopiuj kod
                  </button>
                  <button
                    onClick={() => copy(url, `url-${test.id}`)}
                    className="min-h-[2.75rem] px-4 inline-flex items-center gap-2 rounded-xl bg-primary/15 border border-primary/30 text-sm font-bold text-primary"
                  >
                    {copied === `url-${test.id}` ? <Check size={14} /> : <Link2 size={14} />}
                    Kopiuj link
                  </button>
                  <button
                    onClick={() => toggleActive(test)}
                    className="min-h-[2.75rem] px-4 inline-flex items-center gap-2 rounded-xl border border-white/15 text-sm font-bold text-content-muted"
                  >
                    <Power size={14} />
                    {test.isActive ? 'Zamknij' : 'Otwórz'}
                  </button>
                  <button
                    onClick={() => remove(test)}
                    className="min-h-[2.75rem] px-4 inline-flex items-center gap-2 rounded-xl border border-danger/30 text-sm font-bold text-danger"
                  >
                    <Trash2 size={14} /> Usuń
                  </button>
                </div>

                <p className="font-mono text-[12px] text-content-muted break-all rounded-xl bg-base-100/50 border border-white/[0.07] p-3">
                  {url}
                </p>

                {loadingSubs === test.id ? (
                  <div className="flex justify-center py-6 text-content-muted">
                    <Loader2 className="w-4 h-4 animate-spin" />
                  </div>
                ) : list.length === 0 ? (
                  <p className="text-sm text-content-muted">
                    Nikt jeszcze nie podszedł do tego testu.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {list.map((submission) => {
                      const key = `${test.id}:${submission.id}`;
                      return (
                        <li
                          key={submission.id}
                          className="rounded-xl bg-base-100/50 border border-white/[0.07] p-3 space-y-2"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="font-semibold text-white text-[14px] truncate">
                                {submission.candidateName}
                              </p>
                              <p className="text-[12px] text-content-muted truncate">
                                {submission.candidateEmail || 'bez e-maila'} ·{' '}
                                {new Date(submission.submittedAt).toLocaleDateString('pl-PL', {
                                  day: 'numeric',
                                  month: 'short',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </p>
                            </div>
                            {submission.score !== undefined ? (
                              <span className="font-mono text-sm font-bold text-primary shrink-0">
                                {submission.score}%
                              </span>
                            ) : (
                              <button
                                onClick={() => gradeSubmission(test, submission)}
                                disabled={grading === key}
                                className="min-h-[2.5rem] px-3 inline-flex items-center gap-1.5 rounded-lg border border-primary/30 text-primary text-xs font-bold shrink-0 disabled:opacity-50"
                              >
                                {grading === key ? (
                                  <Loader2 size={12} className="animate-spin" />
                                ) : (
                                  <Sparkles size={12} />
                                )}
                                Oceń
                              </button>
                            )}
                          </div>

                          {submission.aiFeedback && (
                            <p className="prose-justified text-[13px] text-content-muted leading-relaxed border-t border-white/[0.07] pt-2">
                              {submission.aiFeedback}
                            </p>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
};

export default PublicTestPanel;
