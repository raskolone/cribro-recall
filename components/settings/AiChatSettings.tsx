import React, { useEffect, useState } from 'react';
import { Bot, Check, Loader2, Plus, RotateCcw, Save, Sparkles, Trash2, Wrench } from 'lucide-react';
import {
  AiChatConfig,
  DEFAULT_CHAT_SYSTEM_PROMPT,
  getAiConfig,
  invalidateAiConfig,
  saveAiChatConfig,
} from '../../services/aiConfigService';
import { ASSISTANT_SKILLS, AssistantSkill } from '../../services/teacherAssistant';

const AiChatSettings: React.FC = () => {
  const [systemPrompt, setSystemPrompt] = useState<string>('');
  const [skills, setSkills] = useState<AssistantSkill[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  // Nowy skill formularz
  const [newSkill, setNewSkill] = useState<Partial<AssistantSkill>>({
    command: '',
    name: '',
    description: '',
    category: 'Planowanie',
    template: '',
    badge: 'Skill',
    adminOnly: false,
  });
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    invalidateAiConfig();
    getAiConfig()
      .then((loaded) => {
        if (loaded.chatConfig?.customSystemPrompt !== undefined) {
          setSystemPrompt(loaded.chatConfig.customSystemPrompt);
        } else {
          setSystemPrompt('');
        }

        if (loaded.chatConfig?.customSkills && loaded.chatConfig.customSkills.length > 0) {
          setSkills(loaded.chatConfig.customSkills);
        } else {
          setSkills(ASSISTANT_SKILLS);
        }
      })
      .catch((err) => {
        console.warn('Nie udało się pobrać konfiguracji czatu AI:', err);
        setSkills(ASSISTANT_SKILLS);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    setError('');
    setSaved(false);
    try {
      const payload: AiChatConfig = {
        customSystemPrompt: systemPrompt.trim() || undefined,
        customSkills: skills,
      };
      await saveAiChatConfig(payload);
      setSaved(true);
      setTimeout(() => setSaved(false), 3500);
    } catch (e: any) {
      setError(e?.message || 'Nie udało się zapisać konfiguracji czatu AI.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetPrompt = () => {
    setSystemPrompt('');
  };

  const handleResetSkills = () => {
    setSkills(ASSISTANT_SKILLS);
  };

  const handleRemoveSkill = (id: string) => {
    setSkills((prev) => prev.filter((s) => s.id !== id));
  };

  const handleAddSkill = () => {
    if (!newSkill.command || !newSkill.name || !newSkill.template) {
      setError('Wypełnij komendę (np. /cwiczenie), nazwę i treść szablonu skilla.');
      return;
    }

    const cleanCommand = newSkill.command.startsWith('/') ? newSkill.command.trim() : `/${newSkill.command.trim()}`;
    const id = cleanCommand.replace('/', '').toLowerCase().replace(/[^a-z0-9]/g, '_');

    const created: AssistantSkill = {
      id,
      command: cleanCommand,
      name: newSkill.name.trim(),
      description: newSkill.description?.trim() || newSkill.name.trim(),
      icon: 'sparkles',
      category: (newSkill.category as any) || 'Planowanie',
      template: newSkill.template.trim(),
      badge: newSkill.badge?.trim() || 'Skill',
      adminOnly: Boolean(newSkill.adminOnly),
    };

    setSkills((prev) => [...prev.filter((s) => s.id !== id && s.command !== cleanCommand), created]);
    setNewSkill({
      command: '',
      name: '',
      description: '',
      category: 'Planowanie',
      template: '',
      badge: 'Skill',
      adminOnly: false,
    });
    setShowAddForm(false);
    setError('');
  };

  if (isLoading) {
    return (
      <div className="p-6 flex items-center gap-2 text-sm text-content-muted">
        <Loader2 size={15} className="animate-spin" /> Wczytuję konfigurację Czatu AI…
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-line-strong bg-base-200/50 p-5 space-y-6">
      {/* Nagłówek sekcji */}
      <div className="flex items-center justify-between gap-3 flex-wrap border-b border-line pb-3">
        <div className="flex items-center gap-2.5">
          <span className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20">
            <Bot size={18} />
          </span>
          <div>
            <h3 className="font-bold text-text-hi text-base flex items-center gap-2">
              Konfiguracja Czatu AI & Asystenta
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30 uppercase tracking-wider font-bold">
                Workspace AI
              </span>
            </h3>
            <p className="text-xs text-content-muted mt-0.5">
              Dostosuj instrukcje systemowe (System Prompt) oraz komendy i szablony narzędzi (Skills).
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {saved && (
            <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
              <Check size={14} /> Zapisano konfigurację
            </span>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="h-9 px-4 rounded-xl bg-primary text-accent-ink text-xs font-bold flex items-center gap-1.5 shadow-btn hover:brightness-110 transition-all cursor-pointer disabled:opacity-50"
          >
            {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Zapisz konfigurację Czatu AI
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-danger/10 border border-danger/30 text-danger text-xs font-semibold">
          {error}
        </div>
      )}

      {/* 1. Custom System Prompt */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <h4 className="text-sm font-bold text-text-hi flex items-center gap-1.5">
              <Sparkles size={14} className="text-primary" />
              Niestandardowy System Prompt (Dodatkowe Wytyczne Asystenta)
            </h4>
            <p className="text-xs text-content-muted mt-0.5">
              Wpisz dodatkowe instrukcje behawioralne, reguły językowe lub preferowany styl lektorski.
              Zostaną one doklejone do bazowego promptu systemowego w kodzie.
            </p>
          </div>
          <button
            type="button"
            onClick={handleResetPrompt}
            className="text-[11px] font-medium text-text-2 hover:text-text-hi flex items-center gap-1 px-2.5 py-1 rounded-lg border border-line bg-base-100 transition-colors"
            title="Wyczyść niestandardowe wytyczne"
          >
            <RotateCcw size={11} />
            Wyczyść dodatkowy prompt
          </button>
        </div>

        <div className="relative">
          <textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            rows={4}
            placeholder={`Wpisz własne instrukcje dla asystenta (np. Zawsze kładź nacisk na słownictwo biznesowe w branży e-commerce i logistyce...)`}
            className="w-full px-3.5 py-2.5 rounded-xl bg-black/60 border border-white/15 text-white text-xs font-mono focus:outline-none focus:border-primary leading-relaxed"
          />
        </div>
        <div className="p-2.5 rounded-xl bg-base-100/60 border border-line-soft text-[11px] text-content-muted leading-relaxed">
          💡 <strong className="text-text-hi">Wskazówka:</strong> Kod aplikacji zawsze wstrzykuje twardy fundament (zakaz ścian tekstu, zwięzłość, punktorowy styl i 2-3 sugestie follow-up).
        </div>
      </div>

      {/* 2. Skills & Komendy Asystenta */}
      <div className="space-y-4 pt-2 border-t border-line">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <h4 className="text-sm font-bold text-text-hi flex items-center gap-1.5">
              <Wrench size={14} className="text-primary" />
              Zdefiniowane Komendy i Szablony (Skills: {skills.length})
            </h4>
            <p className="text-xs text-content-muted mt-0.5">
              Komendy wywoływane w czacie za pomocą znaku <code className="text-primary font-mono font-bold">/</code>.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetSkills}
              className="text-[11px] font-medium text-text-2 hover:text-text-hi flex items-center gap-1 px-2.5 py-1 rounded-lg border border-line bg-base-100 transition-colors"
              title="Przywróć domyślną listę skilli"
            >
              <RotateCcw size={11} />
              Domyślne skille
            </button>
            <button
              type="button"
              onClick={() => setShowAddForm(!showAddForm)}
              className="text-[11px] font-bold text-slate-950 bg-primary hover:bg-primary-hover flex items-center gap-1 px-3 py-1 rounded-lg transition-colors shadow-sm"
            >
              <Plus size={13} />
              Dodaj nowy skill
            </button>
          </div>
        </div>

        {/* Formularz dodawania nowego skilla */}
        {showAddForm && (
          <div className="p-4 rounded-xl bg-base-100/90 border border-primary/40 space-y-3 animate-fadeIn">
            <h5 className="text-xs font-bold text-primary uppercase font-mono tracking-wider">
              Nowy Skill dla Asystenta Lektora
            </h5>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-text-mute uppercase font-mono mb-1">
                  Komenda (np. /cwiczenie)
                </label>
                <input
                  type="text"
                  value={newSkill.command || ''}
                  onChange={(e) => setNewSkill({ ...newSkill, command: e.target.value })}
                  placeholder="/nowa-komenda"
                  className="w-full px-2.5 py-1.5 rounded-lg bg-black/60 border border-white/15 text-white text-xs font-mono focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-text-mute uppercase font-mono mb-1">
                  Nazwa wyświetlana
                </label>
                <input
                  type="text"
                  value={newSkill.name || ''}
                  onChange={(e) => setNewSkill({ ...newSkill, name: e.target.value })}
                  placeholder="np. Ćwiczenie ze słuchu"
                  className="w-full px-2.5 py-1.5 rounded-lg bg-black/60 border border-white/15 text-white text-xs focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-text-mute uppercase font-mono mb-1">
                  Kategoria & Opcje
                </label>
                <div className="flex items-center gap-2">
                  <select
                    value={newSkill.category || 'Planowanie'}
                    onChange={(e) => setNewSkill({ ...newSkill, category: e.target.value as any })}
                    className="flex-1 px-2.5 py-1.5 rounded-lg bg-black/60 border border-white/15 text-white text-xs focus:outline-none focus:border-primary"
                  >
                    <option value="Planowanie">Planowanie</option>
                    <option value="Analiza">Analiza</option>
                    <option value="Ćwiczenia">Ćwiczenia</option>
                    <option value="Komunikacja">Komunikacja</option>
                  </select>
                  <label className="flex items-center gap-1 text-[11px] text-text-2 cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={Boolean(newSkill.adminOnly)}
                      onChange={(e) => setNewSkill({ ...newSkill, adminOnly: e.target.checked })}
                      className="rounded border-line"
                    />
                    <span>Admin</span>
                  </label>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-text-mute uppercase font-mono mb-1">
                Krótki opis (podpowiedź w menu /)
              </label>
              <input
                type="text"
                value={newSkill.description || ''}
                onChange={(e) => setNewSkill({ ...newSkill, description: e.target.value })}
                placeholder="Wygeneruj 5 pytań konwersacyjnych opartych o ostatnią lekcję"
                className="w-full px-2.5 py-1.5 rounded-lg bg-black/60 border border-white/15 text-white text-xs focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-text-mute uppercase font-mono mb-1">
                Szablon promptu wklejany do czatu
              </label>
              <textarea
                value={newSkill.template || ''}
                onChange={(e) => setNewSkill({ ...newSkill, template: e.target.value })}
                rows={2}
                placeholder="Przygotuj ćwiczenie gramatyczne na Past Perfect dla kursanta "
                className="w-full px-2.5 py-1.5 rounded-lg bg-black/60 border border-white/15 text-white text-xs font-mono focus:outline-none focus:border-primary"
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-3 py-1.5 rounded-lg border border-line text-xs font-semibold text-text-2 hover:text-text-hi"
              >
                Anuluj
              </button>
              <button
                type="button"
                onClick={handleAddSkill}
                className="px-3 py-1.5 rounded-lg bg-primary text-slate-950 text-xs font-bold hover:bg-primary-hover shadow-sm"
              >
                Dodaj skill do listy
              </button>
            </div>
          </div>
        )}

        {/* Lista aktualnych skilli */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-[360px] overflow-y-auto pr-1">
          {skills.map((sk) => (
            <div
              key={sk.id || sk.command}
              className="p-3 rounded-xl border border-line bg-base-100/50 flex items-start justify-between gap-2.5 group hover:border-line-strong transition-all"
            >
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-mono text-xs font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded border border-primary/20">
                    {sk.command}
                  </span>
                  <span className="font-semibold text-text-hi text-xs truncate">{sk.name}</span>
                  {sk.badge && (
                    <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-base-200 text-text-mute border border-line">
                      {sk.badge}
                    </span>
                  )}
                  {sk.adminOnly && (
                    <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
                      Admin
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-text-mute line-clamp-1">{sk.description}</p>
                <p className="text-[10px] text-text-3 font-mono line-clamp-1 bg-black/30 px-1.5 py-0.5 rounded">
                  {sk.template}
                </p>
              </div>

              <button
                type="button"
                onClick={() => handleRemoveSkill(sk.id)}
                className="p-1 text-text-mute hover:text-danger rounded hover:bg-base-200 transition-colors shrink-0"
                title="Usuń ten skill"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default AiChatSettings;
