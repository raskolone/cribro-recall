import React, { useEffect, useState } from 'react';
import i18n from 'i18next';
import {
  AlertTriangle,
  Calendar,
  Check,
  Clock,
  ExternalLink,
  Layers,
  Loader2,
  Mail,
  Play,
  RefreshCw,
  Send,
  Trash2,
  User as UserIcon,
} from 'lucide-react';
import { auth } from '../../firebase';
import {
  HomeworkSeriesDocument,
  getWarsawDateString,
  isSeriesAutoEmailConfirmed,
  isSlotReadyToRelease,
} from '../../utils/homeworkSeries';
import { getAllUsers } from '../../services/userService';
import { User } from '../../types';
import { formatStudentLabel } from '../../utils/buildHomeworkAssignment';

interface HomeworkSeriesScreenProps {
  onOpenCreator?: () => void;
  initialStudents?: User[];
  initialSeries?: HomeworkSeriesDocument[];
}

export const HomeworkSeriesScreen: React.FC<HomeworkSeriesScreenProps> = ({
  onOpenCreator,
  initialStudents,
  initialSeries,
}) => {
  const [seriesList, setSeriesList] = useState<HomeworkSeriesDocument[]>(initialSeries || []);
  const [students, setStudents] = useState<User[]>(initialStudents || []);
  const [selectedStudentFilter, setSelectedStudentFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(!initialSeries);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isReleasing, setIsReleasing] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Bez tokenu nie ma sensu wołać API — zamiast podstawionego tokenu jawny błąd sesji.
  const requireToken = async (): Promise<string> => {
    const token = await auth.currentUser?.getIdToken?.();
    if (!token) throw new Error(i18n.t('Sesja wygasła — zaloguj się ponownie.'));
    return token;
  };

  const fetchSeries = async () => {
    try {
      const token = await requireToken();
      const url =
        selectedStudentFilter && selectedStudentFilter !== 'all'
          ? `/api/homework-series?studentUid=${encodeURIComponent(selectedStudentFilter)}`
          : '/api/homework-series';

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.series)) {
        setSeriesList(data.series);
      }
    } catch (e: any) {
      console.warn('Błąd ładowania serii:', e);
    }
  };

  useEffect(() => {
    let active = true;
    const init = async () => {
      if (initialSeries !== undefined && initialStudents !== undefined) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      try {
        if (!initialStudents) {
          const users = await getAllUsers();
          if (active) setStudents(users.filter((u) => u.role === 'user' || !u.role));
        }
      } catch (e) {
        console.warn('Błąd ładowania kursantów:', e);
      }
      if (active) {
        await fetchSeries();
        setIsLoading(false);
      }
    };
    init();
    return () => {
      active = false;
    };
  }, [selectedStudentFilter, initialSeries, initialStudents]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchSeries();
    setIsRefreshing(false);
  };

  const handleReleaseNow = async (seriesId: string, itemId?: string) => {
    setIsReleasing(itemId ? `${seriesId}_${itemId}` : seriesId);
    setActionNotice(null);
    try {
      const token = await requireToken();
      const res = await fetch(`/api/homework-series/${seriesId}/release-now`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ itemId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || i18n.t('Nie udało się wydać zadania'));

      // Serwer wydaje najwyżej jedną pozycję na wywołanie; `skipped` = nic nie wyszło
      // (termin jeszcze nie nadszedł albo pozycję wydano równolegle).
      const releasedSomething = itemId
        ? !data.skipped
        : Array.isArray(data.released) && data.released.some((r: any) => r?.success && !r?.skipped);
      setActionNotice(
        releasedSomething
          ? { type: 'success', message: i18n.t('Wydano jedną pozycję kursantowi.') }
          : { type: 'error', message: i18n.t('Nic nie wydano — termin pozycji jeszcze nie nadszedł albo już ją wydano.') }
      );
      await fetchSeries();
    } catch (err: any) {
      setActionNotice({ type: 'error', message: err.message || i18n.t('Nie udało się wydać zadania') });
    } finally {
      setIsReleasing(null);
    }
  };

  const handleDelete = async (seriesId: string) => {
    if (!window.confirm(i18n.t('Usunąć tę serię? Prace już wydane zostaną u kursanta.'))) return;
    try {
      const token = await requireToken();
      const res = await fetch(`/api/homework-series/${seriesId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setSeriesList((prev) => prev.filter((s) => s.id !== seriesId));
        setActionNotice({ type: 'success', message: i18n.t('Seria została usunięta.') });
      } else {
        setActionNotice({ type: 'error', message: i18n.t('Nie udało się usunąć serii') });
      }
    } catch (err: any) {
      setActionNotice({ type: 'error', message: err.message || i18n.t('Nie udało się usunąć serii') });
    }
  };

  const todayWarsaw = getWarsawDateString(new Date());

  const getStudentLabelById = (studentUid: string) => {
    const s = students.find((x) => x.id === studentUid);
    return s ? formatStudentLabel(s) : studentUid;
  };

  return (
    <div className="space-y-6" data-testid="homework-series-screen">
      {/* Pasek nagłówka */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl border border-line-strong bg-surface-flat">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0">
            <Layers size={24} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-text-hi">{i18n.t('Serie prac domowych')}</h1>
            <p className="text-xs text-text-mute mt-0.5">
              {i18n.t('Codziennie rano kursant dostaje najwyżej jedną zaległą lub dzisiejszą pracę z serii.')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto flex-wrap">
          <select
            value={selectedStudentFilter}
            onChange={(e) => setSelectedStudentFilter(e.target.value)}
            className="min-h-[2.5rem] px-3 bg-base-100 dark:bg-base-200 border border-line-strong rounded-xl text-xs text-text-hi focus:border-primary focus:outline-none"
            aria-label={i18n.t('Filtruj po kursancie')}
          >
            <option value="all">{i18n.t('Wszyscy kursanci')}</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {formatStudentLabel(s)}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="min-h-[2.5rem] px-3.5 flex items-center gap-1.5 rounded-xl border border-line-strong bg-base-100 dark:bg-base-200 text-xs font-semibold text-text-hi hover:bg-base-200 transition-colors"
            title={i18n.t('Odśwież listę')}
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">{i18n.t('Odśwież')}</span>
          </button>
        </div>
      </div>

      {/* Komunikat akcji */}
      {actionNotice && (
        <div
          role="status"
          aria-live="polite"
          className={`p-4 rounded-xl text-xs font-semibold flex items-center justify-between ${
            actionNotice.type === 'success'
              ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
              : 'bg-rose-500/10 border border-rose-500/30 text-rose-400'
          }`}
        >
          <span>{actionNotice.message}</span>
          <button
            type="button"
            onClick={() => setActionNotice(null)}
            className="text-text-mute hover:text-text-hi"
            aria-label={i18n.t('Zamknij komunikat')}
          >
            ✕
          </button>
        </div>
      )}

      {/* Lista serii */}
      {isLoading ? (
        <div className="p-12 text-center text-text-mute">
          <Loader2 size={32} className="animate-spin mx-auto mb-2 text-primary" />
          <p className="text-xs">{i18n.t('Ładowanie serii prac domowych…')}</p>
        </div>
      ) : seriesList.length === 0 ? (
        <div
          className="p-8 text-center rounded-2xl border border-line-strong bg-surface-flat space-y-3"
          data-testid="series-empty-state"
        >
          <div className="mx-auto w-12 h-12 rounded-2xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center">
            <Calendar size={24} />
          </div>
          <h2 className="text-base font-bold text-text-hi">{i18n.t('Brak zaplanowanych serii prac domowych')}</h2>
          <p className="text-xs text-text-mute max-w-md mx-auto leading-relaxed">
            {i18n.t('Serię planujesz w kreatorze prac domowych: ułóż zadanie dla jednego kursanta i wybierz „Zaplanuj na dzień”.')}
          </p>
          {onOpenCreator && (
            <button
              type="button"
              data-testid="series-open-creator-btn"
              onClick={onOpenCreator}
              className="mt-2 min-h-[2.5rem] px-4 rounded-xl bg-primary text-accent-ink font-bold text-xs inline-flex items-center gap-1.5"
            >
              {i18n.t('Przejdź do kreatora')}
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4" data-testid="series-list">
          {seriesList.map((series) => {
            const studentName = getStudentLabelById(series.studentUid);
            const dueReadyItems = series.items.filter(
              (it) => it.state === 'ready' && isSlotReadyToRelease(it.slotDate, todayWarsaw)
            );
            const autoEmailOn = isSeriesAutoEmailConfirmed(series);

            return (
              <div
                key={series.id}
                className="rounded-2xl border border-line-strong bg-surface-flat overflow-hidden p-5 space-y-4 transition-all"
                data-testid={`series-card-${series.id}`}
              >
                {/* Górny wiersz karty serii */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-line-weak">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-bold text-base text-text-hi truncate">{series.title}</span>
                      <span
                        className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-full font-bold border ${
                          series.status === 'active'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : series.status === 'completed'
                            ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                            : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                        }`}
                      >
                        {series.status === 'active'
                          ? i18n.t('Aktywna')
                          : series.status === 'completed'
                          ? i18n.t('Ukończona')
                          : series.status === 'paused'
                          ? i18n.t('Wstrzymana')
                          : i18n.t('Zarchiwizowana')}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-text-mute flex-wrap">
                      <span className="flex items-center gap-1">
                        <UserIcon size={12} className="text-primary" /> {studentName}
                      </span>
                      <span>·</span>
                      <span className="flex items-center gap-1">
                        <Mail size={12} className={autoEmailOn ? 'text-emerald-400' : 'text-text-mute'} />
                        {autoEmailOn ? i18n.t('Automatyczny e-mail: włączony') : i18n.t('Automatyczny e-mail: wyłączony')}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                    {dueReadyItems.length > 0 && (
                      <button
                        type="button"
                        onClick={() => handleReleaseNow(series.id)}
                        disabled={isReleasing === series.id}
                        className="min-h-[2.25rem] px-3 rounded-lg border border-primary/30 bg-primary/10 text-primary font-bold text-xs flex items-center gap-1.5 hover:bg-primary/20 transition-colors disabled:opacity-40"
                        title={i18n.t('Wydaj teraz najstarszą zaległą pozycję (najwyżej jedną)')}
                      >
                        {isReleasing === series.id ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <Play size={12} />
                        )}
                        <span>{i18n.t('Wydaj kolejną')}</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDelete(series.id)}
                      className="min-h-[2.25rem] p-2 rounded-lg text-text-mute hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                      title={i18n.t('Usuń serię')}
                      aria-label={i18n.t('Usuń serię {{title}}', { title: series.title })}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                {/* Lista pozycji w serii */}
                <div className="space-y-2">
                  <h3 className="text-[11px] font-mono font-bold uppercase tracking-wider text-text-mute px-1">
                    {i18n.t('Pozycje w harmonogramie ({{count}})', { count: series.items.length })}
                  </h3>

                  <div className="grid grid-cols-1 gap-2">
                    {series.items.map((item, idx) => {
                      const isItemReleasing = isReleasing === `${series.id}_${item.itemId}`;

                      return (
                        <div
                          key={item.itemId}
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-line-strong bg-base-100/60 dark:bg-base-200/50 text-xs"
                          data-testid={`series-item-${item.itemId}`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="w-6 h-6 rounded-lg bg-base-200 dark:bg-base-300 font-mono font-bold text-[11px] flex items-center justify-center text-text-mute shrink-0">
                              {idx + 1}
                            </span>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-text-hi flex items-center gap-1">
                                  <Calendar size={13} className="text-primary" /> {item.slotDate}
                                </span>
                                <span className="text-text-mute text-[11px] flex items-center gap-1">
                                  <Clock size={11} /> {i18n.t('termin: {{days}} dni', { days: item.dueInDays })}
                                </span>
                              </div>
                              {item.releasedAt && (
                                <p className="text-[11px] text-text-mute mt-0.5">
                                  {i18n.t('Wydano: {{date}}', { date: new Date(item.releasedAt).toLocaleString(i18n.language === 'en' ? 'en-GB' : 'pl-PL') })}
                                </p>
                              )}
                              {item.lastError && (
                                <p className="text-[11px] text-rose-400 mt-0.5 flex items-center gap-1">
                                  <AlertTriangle size={11} /> {i18n.t('Błąd: {{message}}', { message: item.lastError })}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                            {/* Odznaka stanu */}
                            <span
                              className={`px-2 py-0.5 rounded-md font-mono text-[10px] font-bold uppercase border ${
                                item.state === 'released'
                                  ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                                  : item.state === 'ready'
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                  : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                              }`}
                            >
                              {item.state === 'released'
                                ? i18n.t('Wydana')
                                : item.state === 'ready'
                                ? i18n.t('Zaplanowana')
                                : i18n.t('Błąd')}
                            </span>

                            {item.releasedDelayed && (
                              <span
                                className="px-1.5 py-0.5 rounded-md font-mono text-[10px] font-bold uppercase bg-amber-500/10 text-amber-400 border border-amber-500/30"
                                title={i18n.t('Wydana po zaplanowanym dniu')}
                              >
                                {i18n.t('Opóźniona')}
                              </span>
                            )}

                            {item.state === 'ready' && isSlotReadyToRelease(item.slotDate, todayWarsaw) && (
                              <button
                                type="button"
                                data-testid={`release-btn-${item.itemId}`}
                                onClick={() => handleReleaseNow(series.id, item.itemId)}
                                disabled={isItemReleasing}
                                className="min-h-[2rem] px-2.5 rounded-lg border border-line-strong hover:border-primary text-text-hi text-[11px] font-semibold flex items-center gap-1 transition-colors disabled:opacity-40"
                              >
                                {isItemReleasing ? (
                                  <Loader2 size={12} className="animate-spin" />
                                ) : (
                                  <Send size={11} />
                                )}
                                <span>{i18n.t('Wydaj')}</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default HomeworkSeriesScreen;
