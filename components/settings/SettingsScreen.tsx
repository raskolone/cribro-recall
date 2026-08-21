import { auth } from '../../firebase';
import { useAuth } from '../../context/AuthContext';

import React, { useState } from 'react';
import Card from '../ui/Card';
import Select from '../ui/Select';
import Button from '../ui/Button';
import { useVocabulary } from '../../context/VocabularyContext';
import { useSettings } from '../../context/SettingsContext';
import { useLanguage } from '../../context/LanguageContext';
import { FREQUENCIES } from '../../constants';
import { RevisionFrequency, TTSAccent, VoiceGender, VoiceSpeed, SoundEngine, canUserViewAiMonitor } from '../../types';
import { LogOut, Volume2, Play, CheckCircle2, RefreshCw, VolumeX, Sparkles, Sliders, Check } from 'lucide-react';
import { playSpeech } from '../../services/ttsService';
import i18n from "i18next";

const SettingsScreen: React.FC = () => {
    const { frequency, setFrequency, deleteAllWords, words } = useVocabulary();
    const { soundSettings, updateSoundSettings, resetSoundSettings } = useSettings();
    const { language } = useLanguage();
    const { linkGoogleAccount, user, logout } = useAuth();
    const canViewAiModels = canUserViewAiMonitor(user);
    const [isLinkingGoogle, setIsLinkingGoogle] = useState(false);
    const [linkError, setLinkError] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);

    // Audio test state
    const [isTestingAudio, setIsTestingAudio] = useState(false);
    const [audioTestSuccess, setAudioTestSuccess] = useState(false);
    const [saveSuccessMessage, setSaveSuccessMessage] = useState(false);

    React.useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setShowDeleteModal(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const executeDeleteAll = async () => {
        setIsDeleting(true);
        try {
            await deleteAllWords();
        } catch (error) {
            console.error('Failed to delete words:', error);
        } finally {
            setIsDeleting(false);
            setShowDeleteModal(false);
        }
    };

    const handleDeleteClick = () => {
        if (words.length > 0) {
            setShowDeleteModal(true);
        }
    };

    const handleTestVoice = async () => {
        if (isTestingAudio) return;
        setIsTestingAudio(true);
        setAudioTestSuccess(false);

        const sampleText = soundSettings.ttsAccent === 'en-GB'
            ? "Hello! This is your British English voice preview. Everything is working perfectly."
            : "Hello! This is your American English voice preview. Everything is working perfectly.";

        try {
            await playSpeech(sampleText, {
                accent: soundSettings.ttsAccent,
                gender: soundSettings.voiceGender,
                speed: soundSettings.voiceSpeed,
                engine: soundSettings.soundEngine
            });
            setAudioTestSuccess(true);
            setTimeout(() => setAudioTestSuccess(false), 4000);
        } catch (err) {
            console.error("Audio test error:", err);
        } finally {
            setIsTestingAudio(false);
        }
    };

    const handleSettingChange = async (key: string, value: any) => {
        await updateSoundSettings({ [key]: value });
        setSaveSuccessMessage(true);
        setTimeout(() => setSaveSuccessMessage(false), 2500);
    };

    return (
        <div className="space-y-6 max-w-5xl mx-auto pb-12">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-extrabold tracking-tight">{language === 'pl' ? 'Ustawienia Aplikacji' : 'Settings'}</h1>
                {saveSuccessMessage && (
                    <div className="flex items-center gap-1.5 text-xs text-primary font-semibold bg-primary/10 border border-primary/30 px-3 py-1.5 rounded-full animate-fade-in">
                        <Check size={14} />
                        {language === 'pl' ? 'Ustawienia zapisane' : 'Settings saved'}
                    </div>
                )}
            </div>
            
            {/* User Profile Header */}
            <Card className="mb-6">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center justify-center w-16 h-16 rounded-full border-2 border-primary/20 bg-base-300 overflow-hidden shrink-0">
                            {user?.photoURL ? (
                                <img src={user.photoURL} alt={user.username || 'User'} className="w-full h-full object-cover" />
                            ) : (
                                <span className="font-bold text-primary font-mono text-2xl">{user?.username?.[0]?.toUpperCase() || 'U'}</span>
                            )}
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">{user?.displayName || user?.username}</h2>
                            <p className="text-sm text-content-muted">{user?.email || user?.username}</p>
                            <div className="mt-1 flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-base-300 text-content-muted">{i18n.t("Role:")} {user?.role}</span>
                                {user?.level && <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-primary/20 text-primary">{i18n.t("Level:")} {user.level}</span>}
                            </div>
                        </div>
                    </div>
                    <Button variant="secondary" onClick={() => logout()} className="flex items-center gap-2">
                        <LogOut size={16} />
                        {language === 'pl' ? 'Wyloguj się' : 'Logout'}
                    </Button>
                </div>
            </Card>

            {/* DEDICATED SOUND & VOICE SETTINGS CARD */}
            <Card className="border border-primary/30 bg-gradient-to-br from-base-200/90 via-base-200/70 to-primary/20 shadow-lg">
                <div className="flex items-center justify-between pb-4 mb-5 border-b border-white/10">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 text-primary">
                            <Volume2 className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                {language === 'pl' ? 'Ustawienia Dźwięku i Lektora AI' : 'Sound & AI Voice Settings'}
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-primary/20 text-primary uppercase tracking-wider">
                                    {canViewAiModels
                                        ? (soundSettings.soundEngine === 'browser' ? 'Web Speech' : 'Multi-Tier AI')
                                        : 'Lektor AI'}
                                </span>
                            </h2>
                            <p className="text-xs text-content-muted">
                                {language === 'pl' 
                                    ? 'Konfiguracja wymowy słówek, czytania zdań oraz silnika syntezy dźwięku' 
                                    : 'Configure pronunciation, sentence reading speed and speech synthesis engine'}
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={handleTestVoice}
                        disabled={isTestingAudio}
                        className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
                            audioTestSuccess
                                ? 'bg-primary text-accent-ink shadow-[0_0_15px_rgba(16,185,129,0.5)]'
                                : 'bg-primary/20 text-primary border border-primary/40 hover:bg-primary/30'
                        }`}
                        title={language === 'pl' ? 'Odsłuchaj próbkę głosu' : 'Play voice sample'}
                    >
                        {isTestingAudio ? (
                            <>
                                <span className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                <span>{language === 'pl' ? 'Generowanie...' : 'Playing...'}</span>
                            </>
                        ) : audioTestSuccess ? (
                            <>
                                <CheckCircle2 className="w-4 h-4 text-black" />
                                <span>{language === 'pl' ? 'Dźwięk działa!' : 'Audio OK!'}</span>
                            </>
                        ) : (
                            <>
                                <Play className="w-3.5 h-3.5 fill-current" />
                                <span>{language === 'pl' ? 'Przetestuj Głos' : 'Test Voice'}</span>
                            </>
                        )}
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* 1. Kategoria / Silnik Syntezy */}
                    <div>
                        <label className="block text-xs font-semibold text-content uppercase tracking-wider mb-2">
                            {language === 'pl' ? 'Kategoria / Silnik Dźwięku' : 'Audio Engine Category'}
                        </label>
                        {canViewAiModels ? (
                            <select
                                value={soundSettings.soundEngine || 'auto'}
                                onChange={(e) => handleSettingChange('soundEngine', e.target.value as SoundEngine)}
                                className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/15 text-white text-sm focus:outline-none focus:border-primary transition-colors"
                            >
                                <option value="auto">⚡ {language === 'pl' ? 'Automatyczny (OpenAI tts-1 + gpt-4o-mini + Gemini)' : 'Automatic (OpenAI tts-1 + gpt-4o-mini + Gemini)'}</option>
                                <option value="openai">🤖 {language === 'pl' ? 'OpenAI tts-1 (Studyjny & szybki)' : 'OpenAI tts-1 (Studio quality)'}</option>
                                <option value="gpt4o-mini">🎙️ {language === 'pl' ? 'OpenAI GPT-4o-mini Audio' : 'OpenAI GPT-4o-mini Audio'}</option>
                                <option value="gemini">♊ {language === 'pl' ? 'Google Gemini 2.0 Flash Audio' : 'Google Gemini 2.0 Flash Audio'}</option>
                                <option value="browser">🌐 {language === 'pl' ? 'Lokalny Przeglądarki (Web Speech - 100% niezawodny)' : 'Native Browser (Web Speech - 100% reliable)'}</option>
                            </select>
                        ) : (
                            <select
                                value={soundSettings.soundEngine || 'auto'}
                                onChange={(e) => handleSettingChange('soundEngine', e.target.value as SoundEngine)}
                                className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/15 text-white text-sm focus:outline-none focus:border-primary transition-colors"
                            >
                                <option value="auto">⚡ {language === 'pl' ? 'Automatyczny (Rekomendowany - wysoka jakość)' : 'Automatic (Recommended - High quality)'}</option>
                                <option value="openai">🎙️ {language === 'pl' ? 'Studyjny Lektor HD' : 'Studio HD Voice'}</option>
                                <option value="gpt4o-mini">🤖 {language === 'pl' ? 'Zaawansowany Lektor AI' : 'Advanced AI Voice'}</option>
                                <option value="gemini">♊ {language === 'pl' ? 'Ekspresyjny Lektor AI' : 'Expressive AI Voice'}</option>
                                <option value="browser">🌐 {language === 'pl' ? 'Lokalny w Przeglądarce (Web Speech)' : 'Native Browser (Web Speech)'}</option>
                            </select>
                        )}
                        <p className="text-[11px] text-content-muted mt-1.5">
                            {canViewAiModels
                                ? (language === 'pl' 
                                    ? 'Domyślnie system generuje mowę przez OpenAI tts-1, z kaskadowym przełączeniem na gpt-4o-mini, Gemini 2.0 Flash oraz lokalny syntezator przeglądarki.' 
                                    : 'Default engine uses OpenAI tts-1 with fallback to gpt-4o-mini, Gemini 2.0 Flash, and native Web Speech.')
                                : (language === 'pl'
                                    ? 'Domyślny tryb automatyczny inteligentnie dobiera optymalnego lektora dla najwyższej jakości i płynności wymowy.'
                                    : 'The default automatic mode selects the best voice synthesis for high quality and smooth pronunciation.')
                            }
                        </p>
                    </div>

                    {/* 2. Domyślny Akcent */}
                    <div>
                        <label className="block text-xs font-semibold text-content uppercase tracking-wider mb-2">
                            {language === 'pl' ? 'Domyślny Akcent' : 'Default Accent'}
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                type="button"
                                onClick={() => handleSettingChange('ttsAccent', 'en-US')}
                                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-bold transition-all ${
                                    soundSettings.ttsAccent === 'en-US'
                                        ? 'bg-primary/20 text-primary border-primary/50 shadow-[0_0_10px_rgba(6,182,212,0.25)]'
                                        : 'bg-black/30 text-text-2 border-white/10 hover:bg-white/5 hover:text-white'
                                }`}
                            >
                                <span className="text-base">🇺🇸</span>
                                <span>{language === 'pl' ? 'Amerykański (US)' : 'American (US)'}</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => handleSettingChange('ttsAccent', 'en-GB')}
                                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-bold transition-all ${
                                    soundSettings.ttsAccent === 'en-GB'
                                        ? 'bg-primary/20 text-primary border-primary/50 shadow-[0_0_10px_rgba(16,185,129,0.25)]'
                                        : 'bg-black/30 text-text-2 border-white/10 hover:bg-white/5 hover:text-white'
                                }`}
                            >
                                <span className="text-base">🇬🇧</span>
                                <span>{language === 'pl' ? 'Brytyjski (UK)' : 'British (UK)'}</span>
                            </button>
                        </div>
                    </div>

                    {/* 3. Wariant Głosu / Płeć */}
                    <div>
                        <label className="block text-xs font-semibold text-content uppercase tracking-wider mb-2">
                            {language === 'pl' ? 'Głos Lektora' : 'Voice Variant'}
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                type="button"
                                onClick={() => handleSettingChange('voiceGender', 'male')}
                                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-bold transition-all ${
                                    soundSettings.voiceGender === 'male'
                                        ? 'bg-primary/20 text-primary border-primary/50'
                                        : 'bg-black/30 text-text-2 border-white/10 hover:bg-white/5 hover:text-white'
                                }`}
                            >
                                <span>👨</span>
                                <span>{language === 'pl' ? 'Męski' : 'Male'}</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => handleSettingChange('voiceGender', 'female')}
                                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-bold transition-all ${
                                    soundSettings.voiceGender === 'female'
                                        ? 'bg-primary/20 text-primary border-primary/50'
                                        : 'bg-black/30 text-text-2 border-white/10 hover:bg-white/5 hover:text-white'
                                }`}
                            >
                                <span>👩</span>
                                <span>{language === 'pl' ? 'Żeński' : 'Female'}</span>
                            </button>
                        </div>
                    </div>

                    {/* 4. Prędkość Czytania Zdań */}
                    <div>
                        <label className="block text-xs font-semibold text-content uppercase tracking-wider mb-2">
                            {language === 'pl' ? 'Prędkość Czytania Zdań' : 'Sentence Reading Speed'}
                        </label>
                        <select
                            value={soundSettings.voiceSpeed || 1.0}
                            onChange={(e) => handleSettingChange('voiceSpeed', parseFloat(e.target.value) as VoiceSpeed)}
                            className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/15 text-white text-sm focus:outline-none focus:border-primary transition-colors"
                        >
                            <option value={0.75}>0.75x — {language === 'pl' ? 'Bardzo powolna (nauka wymowy)' : 'Slow (Pronunciation learning)'}</option>
                            <option value={0.85}>0.85x — {language === 'pl' ? 'Spokojna lektorska' : 'Relaxed tutor pace'}</option>
                            <option value={1.0}>1.0x — {language === 'pl' ? 'Standardowa (naturalna)' : 'Standard (Natural)'}</option>
                            <option value={1.15}>1.15x — {language === 'pl' ? 'Szybka' : 'Fast'}</option>
                        </select>
                    </div>
                </div>

                {/* 5. Przełączniki Automatycznego Odtwarzania */}
                <div className="mt-5 pt-4 border-t border-white/10 space-y-3">
                    <label className="flex items-center justify-between p-3 rounded-xl bg-black/30 border border-white/5 hover:border-white/15 transition-all cursor-pointer">
                        <div className="pr-4">
                            <span className="text-sm font-semibold text-white block">
                                {language === 'pl' ? 'Automatycznie czytaj poprawne zdanie na głos' : 'Auto-read sentence on feedback'}
                            </span>
                            <span className="text-xs text-content-muted">
                                {language === 'pl' 
                                    ? 'Odtwarza wymowę wzorcowego zdania po zatwierdzeniu tłumaczenia w generatorze ćwiczeń' 
                                    : 'Plays the native audio pronunciation after evaluating each translation exercise'}
                            </span>
                        </div>
                        <input
                            type="checkbox"
                            checked={soundSettings.autoPlaySentence}
                            onChange={(e) => handleSettingChange('autoPlaySentence', e.target.checked)}
                            className="w-5 h-5 rounded border-white/20 bg-black/40 text-primary focus:ring-primary accent-primary cursor-pointer shrink-0"
                        />
                    </label>

                    <label className="flex items-center justify-between p-3 rounded-xl bg-black/30 border border-white/5 hover:border-white/15 transition-all cursor-pointer">
                        <div className="pr-4">
                            <span className="text-sm font-semibold text-white block">
                                {language === 'pl' ? 'Automatycznie czytaj słówko przy obracaniu fiszek' : 'Auto-read word when flipping flashcard'}
                            </span>
                            <span className="text-xs text-content-muted">
                                {language === 'pl' 
                                    ? 'Odtwarza wymowę angielskiego hasła po kliknięciu w fiszkę w trybie nauki' 
                                    : 'Automatically plays English pronunciation when flipping flashcards'}
                            </span>
                        </div>
                        <input
                            type="checkbox"
                            checked={soundSettings.autoPlayFlashcards}
                            onChange={(e) => handleSettingChange('autoPlayFlashcards', e.target.checked)}
                            className="w-5 h-5 rounded border-white/20 bg-black/40 text-primary focus:ring-primary accent-primary cursor-pointer shrink-0"
                        />
                    </label>
                </div>
            </Card>

            {/* AI LIVE MONITOR STATUS & TOGGLE CARD (Visible only to Admin or Permitted Students) */}
            {canViewAiModels && (
                <Card className="border border-primary/30 bg-gradient-to-br from-base-200/90 via-base-200/70 to-primary/20 shadow-lg">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 text-primary">
                                <Sparkles className="w-5 h-5" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                    AI Live Monitor
                                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-primary/20 text-primary uppercase tracking-wider">
                                        {user?.role === 'admin' ? 'Admin' : 'Aktywny'}
                                    </span>
                                </h2>
                                <p className="text-xs text-content-muted">
                                    {language === 'pl'
                                        ? 'Pływający monitor aktywności zapytań AI (TTS, generowanie ćwiczeń, ocenianie, latency).'
                                        : 'Floating real-time AI activity monitor (TTS, exercise generation, grading, latency).'}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2.5 bg-primary/10 border border-primary/30 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-primary shrink-0">
                            <span className="relative flex h-2.5 w-2.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary" />
                            </span>
                            <span>{language === 'pl' ? 'Monitor Aktywny' : 'Monitor Active'}</span>
                        </div>
                    </div>
                </Card>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                    <h2 className="text-xl font-bold mb-4">{language === 'pl' ? 'Konto i Integracje' : 'Account & Integrations'}</h2>
                    <div className="space-y-4">
                        <div>
                            <p className="text-sm text-content-muted mb-2">
                                {language === 'pl' ? 'Powiąż swoje konto z Google, aby móc logować się za jego pomocą i importować słówka z Google Drive i Google Docs.' : 'Link your account with Google to log in via Google and import words from Google Drive and Google Docs.'}
                            </p>
                            {auth.currentUser?.providerData?.some((p: any) => p.providerId === 'google.com') ? (
                                <div className="text-primary font-bold text-sm">✓ {language === 'pl' ? 'Konto połączone z Google' : 'Account linked to Google'}</div>
                            ) : (
                                <Button 
                                    onClick={async () => {
                                        setIsLinkingGoogle(true);
                                        setLinkError(null);
                                        try {
                                            await linkGoogleAccount();
                                        } catch (err: any) {
                                            setLinkError(err.message || 'Error linking account');
                                        } finally {
                                            setIsLinkingGoogle(false);
                                        }
                                    }}
                                    isLoading={isLinkingGoogle}
                                    variant="secondary"
                                >
                                    {language === 'pl' ? 'Połącz z Google' : 'Link with Google'}
                                </Button>
                            )}
                            {linkError && <p className="text-danger text-sm mt-2">{linkError}</p>}
                        </div>
                    </div>
                </Card>

                <Card>
                    <h2 className="text-xl font-bold mb-4">{i18n.t("Revision Program")}</h2>
                    <div className="space-y-4">
                        <Select
                            id="frequency"
                            label={i18n.t("Revision Frequency")}
                            options={FREQUENCIES}
                            value={frequency}
                            onChange={(e) => setFrequency(e.target.value as RevisionFrequency)}
                        />
                        <p className="text-sm text-content-muted">
                            {i18n.t("This setting controls how often you are prompted to revise words you have marked as difficult.")}
                        </p>
                    </div>
                </Card>

                <Card className="border-danger/30 bg-danger/5 md:col-span-2">
                    <h2 className="text-xl font-bold mb-4 text-danger">{i18n.t("Danger Zone")}</h2>
                    <div className="space-y-4">
                        <p className="text-sm text-content-muted">
                            {i18n.t("Permanently delete all generated words from your account. This action cannot be undone.")}
                        </p>
                        <Button 
                            variant="danger" 
                            onClick={handleDeleteClick} 
                            isLoading={isDeleting}
                            disabled={words.length === 0}
                            className="w-full sm:w-auto"
                        >
                            {i18n.t("Clear All Words (")}{words.length})
                        </Button>
                    </div>
                </Card>
            </div>

            {/* Delete Confirmation Modal */}
            {showDeleteModal && (
                <div className="fixed inset-0 bg-base-100/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <Card className="w-full max-w-md shadow-2xl border-primary/20">
                        <h3 className="text-xl font-bold mb-4 text-danger">{i18n.t("Confirm Deletion")}</h3>
                        <p className="mb-6 opacity-80">
                            {i18n.t("Are you sure you want to delete all")} {words.length} {i18n.t("generated words? This action cannot be undone.")}
                        </p>
                        <div className="flex justify-end gap-3">
                            <Button onClick={() => setShowDeleteModal(false)} variant="secondary">
                                {i18n.t("Cancel")}
                            </Button>
                            <Button onClick={executeDeleteAll} variant="danger" isLoading={isDeleting}>
                                {i18n.t("Yes, Delete All")}
                            </Button>
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
};

export default SettingsScreen;
