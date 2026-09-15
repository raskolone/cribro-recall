import React, { useEffect, useState } from 'react';
import { AlertTriangle, Check, Cpu, KeyRound, Loader2, Save } from 'lucide-react';
import {
  AI_TASKS,
  AiProvider,
  AiTaskOverrides,
  PROVIDER_META,
  SELECTABLE_MODELS,
  cascadeForTask,
} from '../../services/aiModels';
import {
  AiConfig,
  getAiConfig,
  invalidateAiConfig,
  saveAiKey,
  saveAiModels,
} from '../../services/aiConfigService';

/**
 * Modele AI i klucze API — sekcja wyłącznie dla administratora.
 *
 * ══ CO TU MOŻNA, A CZEGO NIE ══
 *
 * Można wybrać MODEL PIERWSZEGO WYBORU dla każdego rodzaju pracy: generowania
 * zadań, oceniania, czatu i streszczeń. Nie można przestawić zapasów — dalsza
 * część kaskady jest tym, co ratuje sytuację przy awarii dostawcy, i nie jest
 * kwestią gustu. Jest za to pokazana wprost, żeby było widać, co się stanie,
 * gdy wybrany model odmówi.
 *
 * ══ KLUCZE ══
 *
 * Klucz wpisany tutaj trafia do serwera i do bazy, i działa OD RAZU — bez
 * restartu i bez wchodzenia w kod. Klucz ustawiony we wdrożeniu (zmienna
 * środowiskowa) wygrywa z tym z aplikacji i jest opisany jako „ze środowiska",
 * bo inaczej „klucz jest ustawiony" nie mówi nic o tym, gdzie go szukać.
 *
 * Pełnej wartości klucza nie widać nigdzie — serwer zwraca wyłącznie maskę.
 */

type ProviderKeyId = 'gemini' | 'openai' | 'anthropic' | 'deepseek' | 'elevenlabs';

const PROVIDERS: {
  id: ProviderKeyId;
  label: string;
  hint: string;
  badge: string;
  badgeClass: string;
}[] = [
  {
    id: 'gemini',
    label: 'Google Gemini',
    hint: 'Modele Gemini 2.5 Flash, 3.8 Flash, 2.5 Pro (główny silnik platformy).',
    badge: 'Gemini',
    badgeClass: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  },
  {
    id: 'openai',
    label: 'OpenAI',
    hint: 'Modele GPT-4o, GPT-5.6 Luna, o3-mini oraz fallback TTS.',
    badge: 'OpenAI',
    badgeClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  },
  {
    id: 'anthropic',
    label: 'Anthropic Claude',
    hint: 'Modele Claude 3.7 Sonnet, Claude 3.5 Sonnet, Claude 3.5 Haiku.',
    badge: 'Anthropic',
    badgeClass: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    hint: 'Modele DeepSeek V3 (Chat) oraz DeepSeek R1 (Reasoner) — wysoka precyzja, niski koszt.',
    badge: 'DeepSeek',
    badgeClass: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
  },
  {
    id: 'elevenlabs',
    label: 'ElevenLabs',
    hint: 'Głos lektorski w wymowie (pierwszy wybór syntezy audio TTS).',
    badge: 'TTS Audio',
    badgeClass: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  },
];

const PROVIDER_GROUPS: { provider: AiProvider; label: string }[] = [
  { provider: 'gemini', label: 'Google Gemini' },
  { provider: 'openai', label: 'OpenAI' },
  { provider: 'anthropic', label: 'Anthropic Claude' },
  { provider: 'deepseek', label: 'DeepSeek' },
];

const AiModelsSettings: React.FC = () => {
  const [config, setConfig] = useState<AiConfig | null>(null);
  const [models, setModels] = useState<AiTaskOverrides>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const [keyDrafts, setKeyDrafts] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);

  useEffect(() => {
    invalidateAiConfig();
    getAiConfig().then(loaded => {
      setConfig(loaded);
      setModels(loaded.models || {});
    });
  }, []);

  const handleSaveModels = async () => {
    setIsSaving(true);
    setError('');
    try {
      await saveAiModels(models);
      setSaved(true);
      setTimeout(() => setSaved(false), 4000);
    } catch (err: any) {
      setError(err?.message || 'Nie udało się zapisać.');
    } finally {
      setIsSaving(false);
    }
  };

  const [savedKeyProvider, setSavedKeyProvider] = useState<string | null>(null);

  const handleSaveKey = async (provider: ProviderKeyId) => {
    const draft = (keyDrafts[provider] || '').trim();
    if (draft.length < 12) {
      setError('Podaj pełny klucz API.');
      return;
    }
    setSavingKey(provider);
    setError('');
    try {
      const status = await saveAiKey(provider, draft);
      setConfig(prev =>
        prev ? { ...prev, keys: { ...(prev.keys || {}), [provider]: status } } : prev
      );
      setKeyDrafts(prev => ({ ...prev, [provider]: '' }));
      setSavedKeyProvider(provider);
      setTimeout(() => setSavedKeyProvider(null), 4000);
    } catch (err: any) {
      setError(err?.message || 'Nie udało się zapisać klucza.');
    } finally {
      setSavingKey(null);
    }
  };

  if (!config) {
    return (
      <div className="p-6 flex items-center gap-2 text-sm text-content-muted">
        <Loader2 size={15} className="animate-spin" /> Wczytuję konfigurację AI…
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ── MODELE PER ZADANIE ── */}
      <section className="rounded-2xl border border-line-strong bg-base-200/50 p-5 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap border-b border-line pb-3">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-primary/10 text-primary">
              <Cpu size={16} />
            </span>
            <div>
              <h4 className="font-bold text-text-hi text-base">Modele AI dla poszczególnych zadań</h4>
              <p className="text-xs text-content-muted mt-0.5">
                Wybierasz model pierwszego wyboru. Zapasy zostają — to one ratują sytuację przy
                awarii dostawcy.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleSaveModels}
            disabled={isSaving}
            className="h-9 px-4 rounded-xl bg-primary text-accent-ink text-xs font-bold flex items-center gap-1.5 shadow-btn hover:brightness-110 transition-all cursor-pointer disabled:opacity-50"
          >
            {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Zapisz wybór
          </button>
        </div>

        {AI_TASKS.map(task => {
          const chosen = models[task.id] || task.cascade[0];
          const fallbacks = cascadeForTask(task.id, models).slice(1);
          const chosenModelMeta = SELECTABLE_MODELS.find(m => m.id === chosen);
          const providerMeta = chosenModelMeta ? PROVIDER_META[chosenModelMeta.provider] : null;

          return (
            <div key={task.id} className="rounded-xl border border-line bg-base-100/40 p-3.5 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-text-hi flex items-center gap-2">
                    {task.label}
                    {providerMeta && (
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${providerMeta.bgClass} ${providerMeta.textClass} ${providerMeta.borderClass}`}
                      >
                        {providerMeta.name}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-content-muted mt-0.5">{task.description}</p>
                </div>
                <select
                  value={chosen}
                  onChange={event =>
                    setModels(prev => ({ ...prev, [task.id]: event.target.value }))
                  }
                  className="shrink-0 px-3 py-2 rounded-xl bg-ink border border-line-strong text-xs text-content focus:outline-none focus:border-primary/55 cursor-pointer"
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
              </div>

              <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-line-soft">
                <span className="text-[10px] font-bold uppercase tracking-wider text-content-muted">
                  Zapas
                </span>
                {fallbacks.map((model, index) => {
                  const meta = SELECTABLE_MODELS.find(m => m.id === model);
                  const pMeta = meta ? PROVIDER_META[meta.provider] : null;
                  return (
                    <span
                      key={model}
                      className="px-2 py-0.5 rounded-md bg-base-300/60 border border-line text-[11px] font-mono text-text-2 flex items-center gap-1"
                    >
                      <span>{index + 1}. {meta?.label || model}</span>
                      {pMeta && (
                        <span className={`text-[9px] px-1 rounded ${pMeta.textClass}`}>
                          {pMeta.name.split(' ')[0]}
                        </span>
                      )}
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}

        {saved && (
          <p className="text-xs text-primary flex items-center gap-1.5">
            <Check size={13} /> Zapisano. Nowy wybór obowiązuje od następnego zapytania.
          </p>
        )}
      </section>

      {/* ── KLUCZE API ── */}
      <section className="rounded-2xl border border-line-strong bg-base-200/50 p-5 space-y-4">
        <div className="flex items-center gap-2 border-b border-line pb-3">
          <span className="p-1.5 rounded-lg bg-primary/10 text-primary">
            <KeyRound size={16} />
          </span>
          <div>
            <h4 className="font-bold text-text-hi text-base">Klucze API dostawców</h4>
            <p className="text-xs text-content-muted mt-0.5">
              Wprowadź klucze dla Google Gemini, OpenAI, Anthropic Claude, DeepSeek oraz ElevenLabs. Klucz działa natychmiast.
            </p>
          </div>
        </div>

        {PROVIDERS.map(provider => {
          const status = config.keys?.[provider.id];
          return (
            <div key={provider.id} className="rounded-xl border border-line bg-base-100/40 p-3.5 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0 flex items-center gap-2">
                  <div>
                    <div className="text-sm font-semibold text-text-hi flex items-center gap-2">
                      {provider.label}
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${provider.badgeClass}`}>
                        {provider.badge}
                      </span>
                    </div>
                    <p className="text-[11px] text-content-muted mt-0.5">{provider.hint}</p>
                  </div>
                </div>
                {status?.configured ? (
                  <span className="shrink-0 px-2.5 py-1 rounded-lg bg-primary/12 border border-primary/30 text-primary text-[11px] font-semibold flex items-center gap-1.5">
                    <Check size={12} />
                    {status.maskedKey}
                    <span className="text-content-muted font-normal">
                      · {status.source === 'env' ? 'ze środowiska' : 'z aplikacji'}
                    </span>
                  </span>
                ) : (
                  <span className="shrink-0 px-2.5 py-1 rounded-lg bg-warn/12 border border-warn/30 text-warn text-[11px] font-semibold flex items-center gap-1.5">
                    <AlertTriangle size={12} />
                    Brak klucza
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="password"
                  value={keyDrafts[provider.id] || ''}
                  onChange={event =>
                    setKeyDrafts(prev => ({ ...prev, [provider.id]: event.target.value }))
                  }
                  placeholder={status?.configured ? 'Wpisz nowy klucz, żeby podmienić…' : 'Wklej klucz API…'}
                  autoComplete="off"
                  className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-ink border border-line-strong text-xs font-mono text-content placeholder:text-text-faint focus:outline-none focus:border-primary/55"
                />
                <button
                  type="button"
                  onClick={() => handleSaveKey(provider.id)}
                  disabled={savingKey === provider.id || (keyDrafts[provider.id] || '').trim().length < 12}
                  className="shrink-0 h-9 px-3.5 rounded-xl border border-line-strong bg-white/[0.04] text-text-2 hover:text-content hover:bg-white/[0.08] text-xs font-semibold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-default"
                >
                  {savingKey === provider.id ? <Loader2 size={13} className="animate-spin" /> : 'Zapisz'}
                </button>
              </div>

              {savedKeyProvider === provider.id && (
                <p className="text-[11px] text-primary flex items-center gap-1">
                  <Check size={12} /> Klucz został zapisany i jest natychmiast aktywny.
                </p>
              )}
            </div>
          );
        })}

        {error && <p className="text-xs text-danger flex items-center gap-1.5">
          <AlertTriangle size={13} /> {error}
        </p>}
      </section>
    </div>
  );
};

export default AiModelsSettings;
