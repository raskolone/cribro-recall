import React, { useEffect, useState } from 'react';
import { Check, Loader2, MessageSquare, Save, Users } from 'lucide-react';
import {
  AiProvider,
  PROVIDER_META,
  SELECTABLE_MODELS,
} from '../../services/aiModels';
import {
  CouncilConfig,
  DEFAULT_COUNCIL,
  MAX_COUNCIL_SEATS,
  normalizeCouncil,
} from '../../services/aiCouncil';
import { getAiConfig, invalidateAiConfig, saveAiCouncil } from '../../services/aiConfigService';

/**
 * NARADA MODELI — ustawienia wyłącznie dla administratora.
 *
 * ══ CO TU SIĘ USTAWIA ══
 *
 * Kto siedzi przy stole, gdy Planer lekcji układa scenariusz. Miejsce
 * pierwsze PISZE, pozostałe RECENZUJĄ — i tego się nie przestawia:
 * bez autora nie ma czego recenzować, a dwóch autorów to dwa niezależne
 * teksty, nie narada.
 *
 * Modele można dowolnie miksować pomiędzy dostawcami: Google Gemini,
 * OpenAI, Anthropic Claude oraz DeepSeek.
 *
 * ══ DLACZEGO CZTERY MIEJSCA, A NIE DOWOLNIE WIELE ══
 *
 * Każdy głos to osobne wywołanie modelu, czyli osobny koszt i osobne
 * kilkanaście sekund czekania. Przy dwóch recenzentach uwagi zaczynają się
 * powtarzać, przy trzech powtarzają się prawie w całości. Cztery miejsca to
 * sufit postawiony po to, żeby nie dało się przez przypadek zbudować narady,
 * która kosztuje pięć razy więcej i nie wnosi nic ponad naradę dwóch.
 *
 * Klucze API są w sekcji obok (Modele AI) — narada używa tych samych.
 */

const SEAT_LABELS = ['Autor', 'Recenzent 1', 'Recenzent 2', 'Recenzent 3'];

const PROVIDER_GROUPS: { provider: AiProvider; label: string }[] = [
  { provider: 'gemini', label: 'Google Gemini' },
  { provider: 'openai', label: 'OpenAI' },
  { provider: 'anthropic', label: 'Anthropic Claude' },
  { provider: 'deepseek', label: 'DeepSeek' },
];

const AiCouncilSettings: React.FC = () => {
  const [council, setCouncil] = useState<CouncilConfig>(DEFAULT_COUNCIL);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    invalidateAiConfig();
    getAiConfig()
      .then(loaded => setCouncil(normalizeCouncil(loaded.council)))
      .finally(() => setIsLoading(false));
  }, []);

  const updateSeat = (index: number, patch: Partial<CouncilConfig['seats'][number]>) => {
    setCouncil(prev => ({
      ...prev,
      seats: prev.seats.map((seat, i) => (i === index ? { ...seat, ...patch } : seat)),
    }));
    setSaved(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError('');
    try {
      await saveAiCouncil(council);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err: any) {
      setError(err?.message || 'Nie udało się zapisać składu narady.');
    } finally {
      setIsSaving(false);
    }
  };

  const activeCount = council.seats.filter(seat => seat.enabled).length;
  const reviewerCount = council.enabled ? Math.max(0, activeCount - 1) : 0;
  // Autor mówi raz, każdy recenzent raz, a jeśli padły uwagi — autor jeszcze
  // raz. Lektor ma widzieć ten rachunek PRZED włączeniem czterech miejsc.
  const callCount = 1 + reviewerCount + (reviewerCount > 0 ? 1 : 0);

  return (
    <section className="rounded-2xl border border-line-strong bg-base-200/60 shadow-ambient-sm overflow-hidden">
      <header className="px-4 sm:px-5 py-3.5 border-b border-line-strong bg-base-100/40 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="p-1.5 rounded-lg bg-primary/12 text-primary border border-primary/25 shrink-0">
            <Users size={16} />
          </span>
          <div className="min-w-0">
            <h3 className="text-sm sm:text-base font-bold text-text-hi">Narada modeli — Planer lekcji</h3>
            <p className="text-[11px] text-content-muted mt-0.5">
              Wybierz modele od Google Gemini, OpenAI, Anthropic Claude lub DeepSeek do pisania i recenzowania scenariusza
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving || isLoading}
          className="px-3.5 py-2 rounded-xl bg-primary text-accent-ink text-xs sm:text-sm font-bold hover:brightness-110 transition-all flex items-center gap-1.5 cursor-pointer shadow-btn disabled:opacity-50"
        >
          {isSaving ? <Loader2 size={15} className="animate-spin" /> : saved ? <Check size={15} /> : <Save size={15} />}
          {saved ? 'Zapisano' : 'Zapisz skład'}
        </button>
      </header>

      <div className="p-4 sm:p-5 space-y-4">
        {error && (
          <p className="text-xs font-semibold text-danger bg-danger/10 border border-danger/25 rounded-xl px-3 py-2">
            {error}
          </p>
        )}

        <label className="flex items-start gap-3 rounded-xl border border-line-strong bg-base-100/40 px-3.5 py-3 cursor-pointer">
          <input
            type="checkbox"
            checked={council.enabled}
            onChange={e => {
              setCouncil(prev => ({ ...prev, enabled: e.target.checked }));
              setSaved(false);
            }}
            className="mt-0.5 accent-[var(--accent)] w-4 h-4 shrink-0"
          />
          <span className="min-w-0">
            <span className="block text-sm font-bold text-text-hi">Narada włączona</span>
            <span className="block text-[11px] text-content-muted mt-0.5">
              Wyłączona: scenariusz układa wyłącznie model z pierwszego miejsca — szybciej i taniej,
              ale bez sprawdzenia twardych liczb i Testu naturalności przez drugi model.
            </span>
          </span>
        </label>

        <div className="space-y-2.5">
          {council.seats.slice(0, MAX_COUNCIL_SEATS).map((seat, index) => {
            const isAuthor = index === 0;
            const isActive = isAuthor || seat.enabled;
            const isDimmed = !isActive || (!council.enabled && !isAuthor);
            const currentModelMeta = SELECTABLE_MODELS.find(m => m.id === seat.model);
            const pMeta = currentModelMeta ? PROVIDER_META[currentModelMeta.provider] : null;

            return (
              <div
                key={seat.id}
                className={`rounded-xl border px-3.5 py-3 flex flex-wrap items-center gap-3 transition-colors ${
                  isDimmed
                    ? 'border-line bg-base-100/20 opacity-60'
                    : 'border-line-strong bg-base-100/45'
                }`}
              >
                <span className="flex items-center gap-2 w-32 shrink-0">
                  <input
                    type="checkbox"
                    checked={isActive}
                    // Autor nie ma czego wyłączać — bez niego nie ma scenariusza.
                    disabled={isAuthor || !council.enabled}
                    onChange={e => updateSeat(index, { enabled: e.target.checked })}
                    className="accent-[var(--accent)] w-4 h-4 disabled:opacity-40"
                  />
                  <span
                    className={`text-xs font-bold ${isAuthor ? 'text-primary' : 'text-text-hi'}`}
                  >
                    {SEAT_LABELS[index]}
                  </span>
                </span>

                <div className="flex-1 min-w-[13rem] flex items-center gap-2">
                  <select
                    value={seat.model}
                    onChange={e => updateSeat(index, { model: e.target.value })}
                    className="flex-1 bg-base-100/70 border border-line-strong rounded-lg px-3 py-2 text-sm text-text-hi outline-none focus:border-primary cursor-pointer"
                  >
                    {PROVIDER_GROUPS.map(grp => {
                      const grpModels = SELECTABLE_MODELS.filter(m => m.provider === grp.provider);
                      if (grpModels.length === 0) return null;
                      return (
                        <optgroup key={grp.provider} label={grp.label}>
                          {grpModels.map(model => (
                            <option key={model.id} value={model.id}>
                              {model.label} {model.tag ? `(${model.tag})` : ''}
                            </option>
                          ))}
                        </optgroup>
                      );
                    })}
                  </select>

                  {pMeta && (
                    <span
                      className={`hidden sm:inline-flex text-[10px] font-semibold px-2 py-1 rounded-lg border shrink-0 ${pMeta.bgClass} ${pMeta.textClass} ${pMeta.borderClass}`}
                    >
                      {pMeta.name.split(' ')[0]}
                    </span>
                  )}
                </div>

                <span className="text-[11px] text-content-muted w-full sm:w-auto sm:max-w-[15rem]">
                  {isAuthor
                    ? 'Pisze scenariusz i ma ostatnie słowo po recenzjach.'
                    : 'Czyta cudzą wersję i wypisuje maksymalnie 6 zastrzeżeń. Nie pisze własnej.'}
                </span>
              </div>
            );
          })}
        </div>

        <div className="rounded-xl border border-line bg-base-100/25 px-3.5 py-3 flex items-start gap-2.5">
          <MessageSquare size={15} className="text-primary shrink-0 mt-0.5" />
          <p className="text-[11px] text-content-muted leading-relaxed">
            Przy tym składzie jedno generowanie to{' '}
            <strong className="text-text-hi">
              {callCount} {callCount === 1 ? 'wywołanie modelu' : callCount < 5 ? 'wywołania modelu' : 'wywołań modelu'}
            </strong>{' '}
            {reviewerCount > 0
              ? '(autor pisze, recenzenci zgłaszają uwagi, autor poprawia).'
              : '(sam autor, bez recenzji).'}{' '}
            Klucze API dostawców (Gemini, OpenAI, Anthropic, DeepSeek) ustawia się w sekcji „Modele AI" obok — narada korzysta z tych samych.
          </p>
        </div>
      </div>
    </section>
  );
};

export default AiCouncilSettings;
