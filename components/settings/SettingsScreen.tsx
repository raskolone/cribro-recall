import { auth, db } from '../../firebase';
import { doc, updateDoc, deleteField } from 'firebase/firestore';
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
import AiModelsSettings from './AiModelsSettings';
import AiCouncilSettings from './AiCouncilSettings';
import { LogOut, Volume2, Play, CheckCircle2, RefreshCw, VolumeX, Sparkles, Sliders, Check, Flame, Mail, Key, Eye, EyeOff, AlertTriangle, Database, Search, Unlink, ExternalLink, Layers, Table, ClipboardPaste, X } from 'lucide-react';
import { playSpeech } from '../../services/ttsService';
import i18n from "i18next";
import { useEscapeModal } from '../../hooks/useEscapeModal';

function cleanNotionId(val: string): string {
    if (!val || typeof val !== 'string') return '';
    const trimmed = val.trim();
    const match = trimmed.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}|[a-f0-9]{32})/i);
    if (match) {
        const clean = match[1].replace(/-/g, '').toLowerCase();
        return `${clean.slice(0, 8)}-${clean.slice(8, 12)}-${clean.slice(12, 16)}-${clean.slice(16, 20)}-${clean.slice(20)}`;
    }
    return trimmed;
}

const SettingsScreen: React.FC = () => {
    const { frequency, setFrequency, deleteAllWords, words } = useVocabulary();
    const { soundSettings, updateSoundSettings, resetSoundSettings } = useSettings();
    const { language } = useLanguage();
    const { linkGoogleAccount, user, logout } = useAuth();
    const canViewAiModels = canUserViewAiMonitor(user);
    const isTeacherOrAdmin = user?.role === 'admin' || user?.role === 'teacher';

    // Resend API key state for Admin / Teacher
    const [resendApiKeyInput, setResendApiKeyInput] = useState<string>('');
    const [showResendApiKey, setShowResendApiKey] = useState<boolean>(false);
    const [isSavingApiKey, setIsSavingApiKey] = useState<boolean>(false);
    const [apiKeySaveSuccess, setApiKeySaveSuccess] = useState<boolean>(false);
    const [apiKeyError, setApiKeyError] = useState<string | null>(null);
    const [serverKeyStatus, setServerKeyStatus] = useState<{
        configured: boolean;
        maskedKey?: string | null;
        fromAddress?: string;
    }>({ configured: false });

    // Fetch Resend API key status on mount for admin/teacher
    React.useEffect(() => {
        if (!isTeacherOrAdmin) return;
        const fetchKeyStatus = async () => {
            try {
                const token = await auth.currentUser?.getIdToken();
                if (!token) return;
                const res = await fetch('/api/mailing/status', {
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (res.ok) {
                    const data = await res.json();
                    setServerKeyStatus(data);
                }
            } catch (e) {
                console.warn('Nie udało się sprawdzić statusu klucza poczty:', e);
            }
        };
        fetchKeyStatus();
    }, [isTeacherOrAdmin]);

    const handleSaveResendKey = async () => {
        const cleanKey = resendApiKeyInput.trim();
        if (!cleanKey || !cleanKey.startsWith('re_')) {
            setApiKeyError(language === 'pl' ? 'Podaj prawidłowy klucz Resend API (zaczyna się od "re_").' : 'Enter a valid Resend API key starting with "re_".');
            return;
        }
        setIsSavingApiKey(true);
        setApiKeyError(null);
        try {
            const token = await auth.currentUser?.getIdToken();
            if (!token) throw new Error('Brak uprawnień administratora.');

            const res = await fetch('/api/mailing/save-key', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ apiKey: cleanKey }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || 'Błąd zapisu klucza.');

            setServerKeyStatus({
                configured: true,
                maskedKey: data.maskedKey || `${cleanKey.slice(0, 6)}••••${cleanKey.slice(-4)}`,
            });
            setApiKeySaveSuccess(true);
            setResendApiKeyInput('');
            setTimeout(() => setApiKeySaveSuccess(false), 4000);
        } catch (err: any) {
            console.error('Błąd zapisu klucza Resend:', err);
            setApiKeyError(err?.message || 'Nie udało się zapisać klucza Resend.');
        } finally {
            setIsSavingApiKey(false);
        }
    };

    // Notion Integration State
    const [notionTokenInput, setNotionTokenInput] = useState<string>('');
    const [showNotionToken, setShowNotionToken] = useState<boolean>(false);
    const [meetingNotesDbInput, setMeetingNotesDbInput] = useState<string>('');
    const [autoFetchEnabledInput, setAutoFetchEnabledInput] = useState<boolean>(false);
    const [autoFetchIntervalInput, setAutoFetchIntervalInput] = useState<number>(30);
    const [notionConfigStatus, setNotionConfigStatus] = useState<{
        configured: boolean;
        maskedToken?: string | null;
        meetingNotesDbId?: string;
        autoFetchEnabled?: boolean;
        autoFetchIntervalMinutes?: number;
        lastFetchTime?: string | null;
        lastFetchStatus?: string | null;
    }>({ configured: false });
    const [isSavingNotion, setIsSavingNotion] = useState(false);
    const [notionSaveSuccess, setNotionSaveSuccess] = useState(false);
    const [notionError, setNotionError] = useState<string | null>(null);
    const [isTestingNotion, setIsTestingNotion] = useState(false);
    const [notionTestResult, setNotionTestResult] = useState<{
        ok: boolean;
        botName?: string;
        workspaceName?: string;
        meetingDbTitle?: string;
        studentsDbTitle?: string;
        message?: string;
    } | null>(null);
    const [isFetchingNotion, setIsFetchingNotion] = useState(false);
    const [notionFetchResult, setNotionFetchResult] = useState<{
        ok: boolean;
        found?: number;
        processed?: number;
        items?: any[];
        message?: string;
    } | null>(null);

    // Auto-discovery & Disconnect state
    const [isSearchingDatabases, setIsSearchingDatabases] = useState(false);
    const [discoveredDatabases, setDiscoveredDatabases] = useState<Array<{
        id: string;
        title: string;
        description?: string;
        icon?: string | null;
        url?: string;
        properties?: string[];
        lastEditedTime?: string | null;
    }>>([]);
    const [isClearingNotion, setIsClearingNotion] = useState(false);
    const [notionClearSuccess, setNotionClearSuccess] = useState(false);

    // Fetch Notion config on mount for admin/teacher
    React.useEffect(() => {
        if (!isTeacherOrAdmin) return;
        const fetchNotionStatus = async () => {
            try {
                const token = await auth.currentUser?.getIdToken();
                if (!token) return;
                const res = await fetch('/api/notion/config', {
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (res.ok) {
                    const data = await res.json();
                    setNotionConfigStatus(data);
                    if (data.meetingNotesDbId) setMeetingNotesDbInput(data.meetingNotesDbId);
                    if (typeof data.autoFetchEnabled === 'boolean') setAutoFetchEnabledInput(data.autoFetchEnabled);
                    if (typeof data.autoFetchIntervalMinutes === 'number') setAutoFetchIntervalInput(data.autoFetchIntervalMinutes);
                }
            } catch (e) {
                console.warn('Nie udało się sprawdzić konfiguracji Notion:', e);
            }
        };
        fetchNotionStatus();
    }, [isTeacherOrAdmin]);

    const hasUnsavedNotionChanges = Boolean(
        (notionTokenInput.trim() !== '') ||
        (cleanNotionId(meetingNotesDbInput) !== cleanNotionId(notionConfigStatus.meetingNotesDbId || '')) ||
        (autoFetchEnabledInput !== Boolean(notionConfigStatus.autoFetchEnabled)) ||
        (autoFetchIntervalInput !== (notionConfigStatus.autoFetchIntervalMinutes || 30))
    );

    const handlePasteNotionToken = async () => {
        try {
            const text = await navigator.clipboard.readText();
            if (text) {
                setNotionTokenInput(text.trim().replace(/["']/g, ''));
                setNotionError(null);
            }
        } catch (e) {
            console.warn('Nie udało się odczytać ze schowka:', e);
        }
    };

    const handleSaveNotionConfig = async () => {
        setIsSavingNotion(true);
        setNotionError(null);
        setNotionSaveSuccess(false);
        try {
            const token = await auth.currentUser?.getIdToken();
            if (!token) throw new Error('Brak uprawnień administratora.');

            const cleanToken = notionTokenInput.trim().replace(/["']/g, '');
            const cleanMeetingId = cleanNotionId(meetingNotesDbInput);

            const res = await fetch('/api/notion/save-config', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    token: cleanToken || undefined,
                    meetingNotesDbId: cleanMeetingId || undefined,
                    autoFetchEnabled: autoFetchEnabledInput,
                    autoFetchIntervalMinutes: autoFetchIntervalInput,
                }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || 'Błąd zapisu konfiguracji Notion.');

            setNotionConfigStatus({
                configured: true,
                maskedToken: data.maskedToken || (cleanToken ? `${cleanToken.slice(0, 8)}••••` : notionConfigStatus.maskedToken),
                meetingNotesDbId: data.meetingNotesDbId || cleanMeetingId,
                autoFetchEnabled: data.autoFetchEnabled,
                autoFetchIntervalMinutes: data.autoFetchIntervalMinutes,
                lastFetchTime: notionConfigStatus.lastFetchTime,
                lastFetchStatus: notionConfigStatus.lastFetchStatus,
            });
            if (data.meetingNotesDbId) setMeetingNotesDbInput(data.meetingNotesDbId);
            setNotionSaveSuccess(true);
            setNotionTokenInput('');
            setTimeout(() => setNotionSaveSuccess(false), 4000);
        } catch (err: any) {
            console.error('Błąd zapisu konfiguracji Notion:', err);
            setNotionError(err?.message || 'Nie udało się zapisać konfiguracji Notion.');
        } finally {
            setIsSavingNotion(false);
        }
    };

    const handleTestNotionConnection = async () => {
        setIsTestingNotion(true);
        setNotionError(null);
        setNotionTestResult(null);
        try {
            const token = await auth.currentUser?.getIdToken();
            if (!token) throw new Error('Brak uprawnień administratora.');

            const cleanToken = notionTokenInput.trim().replace(/["']/g, '');
            const cleanMeetingId = cleanNotionId(meetingNotesDbInput);

            const res = await fetch('/api/notion/test-connection', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    token: cleanToken || undefined,
                    meetingNotesDbId: cleanMeetingId || undefined,
                }),
            });

            const data = await res.json();
            if (!res.ok) {
                setNotionTestResult({ ok: false, message: data?.error || 'Nie udało się nawiązać połączenia z Notion.' });
            } else {
                setNotionTestResult({
                    ok: true,
                    botName: data.botName,
                    workspaceName: data.workspaceName,
                    meetingDbTitle: data.meetingDbTitle,
                    studentsDbTitle: data.studentsDbTitle,
                    message: data.message || 'Połączenie z Notion udane!',
                });
            }
        } catch (err: any) {
            setNotionTestResult({ ok: false, message: err?.message || 'Błąd testu połączenia.' });
        } finally {
            setIsTestingNotion(false);
        }
    };

    const handleFetchNotionTranscripts = async () => {
        setIsFetchingNotion(true);
        setNotionFetchResult(null);
        setNotionError(null);
        try {
            const token = await auth.currentUser?.getIdToken();
            if (!token) throw new Error('Brak uprawnień administratora.');

            const res = await fetch('/api/notion/fetch-transcripts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || 'Błąd pobierania transkrypcji z Notion.');

            setNotionFetchResult({
                ok: true,
                found: data.found,
                processed: data.processed,
                items: data.items,
                message: `Pobrano ${data.processed || 0} z ${data.found || 0} znalezionych stron w Notion.`,
            });
            if (data.lastFetchTime) {
                setNotionConfigStatus(prev => ({
                    ...prev,
                    lastFetchTime: data.lastFetchTime,
                    lastFetchStatus: `Przetworzono ${data.processed || 0} stron`,
                }));
            }
        } catch (err: any) {
            console.error('Błąd pobierania transkrypcji:', err);
            setNotionError(err?.message || 'Nie udało się pobrać transkrypcji z Notion.');
        } finally {
            setIsFetchingNotion(false);
        }
    };

    const handleSearchNotionDatabases = async () => {
        setIsSearchingDatabases(true);
        setNotionError(null);
        try {
            const token = await auth.currentUser?.getIdToken();
            if (!token) throw new Error('Brak uprawnień administratora.');

            const cleanToken = notionTokenInput.trim().replace(/["']/g, '');
            const res = await fetch('/api/notion/search-databases', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    token: cleanToken || undefined,
                }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || 'Nie udało się przeszukać baz w Notion.');

            setDiscoveredDatabases(data.databases || []);
            if ((data.databases || []).length === 0) {
                setNotionError('Nie znaleziono żadnych baz danych. Upewnij się, że w Notion udostępniłeś integracji odpowiednie bazy (opcja "Add connections" w menu bazy w Notion).');
            }
        } catch (err: any) {
            console.error('Błąd wyszukiwania baz Notion:', err);
            setNotionError(err?.message || 'Błąd podczas wyszukiwania baz Notion.');
        } finally {
            setIsSearchingDatabases(false);
        }
    };

    const handleClearNotionConfig = async () => {
        if (!window.confirm(language === 'pl'
            ? 'Czy na pewno chcesz rozłączyć integrację Notion i wyczyścić zapisane tokeny oraz ID baz danych?'
            : 'Are you sure you want to disconnect Notion integration and wipe stored tokens and database IDs?')) {
            return;
        }
        setIsClearingNotion(true);
        setNotionError(null);
        setNotionTestResult(null);
        setNotionFetchResult(null);
        setDiscoveredDatabases([]);
        try {
            const token = await auth.currentUser?.getIdToken();
            if (!token) throw new Error('Brak uprawnień administratora.');

            const res = await fetch('/api/notion/clear-config', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || 'Błąd rozłączania Notion.');

            setNotionTokenInput('');
            setMeetingNotesDbInput('');
            setNotionConfigStatus({
                configured: false,
                maskedToken: null,
                meetingNotesDbId: '',
                autoFetchEnabled: false,
                lastFetchTime: null,
                lastFetchStatus: null,
            });
            setNotionClearSuccess(true);
            setTimeout(() => setNotionClearSuccess(false), 5000);
        } catch (err: any) {
            console.error('Błąd rozłączania Notion:', err);
            setNotionError(err?.message || 'Nie udało się rozłączyć konfiguracji Notion.');
        } finally {
            setIsClearingNotion(false);
        }
    };

    const [isSavingStreakPref, setIsSavingStreakPref] = useState(false);
    const [isSavingEmailPref, setIsSavingEmailPref] = useState(false);
    const [isLinkingGoogle, setIsLinkingGoogle] = useState(false);
    const [linkError, setLinkError] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);

    useEscapeModal(showDeleteModal, () => setShowDeleteModal(false));

    // Audio test state
    const [isTestingAudio, setIsTestingAudio] = useState(false);
    const [audioTestSuccess, setAudioTestSuccess] = useState(false);
    const [saveSuccessMessage, setSaveSuccessMessage] = useState(false);

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

    const handleToggleStreakVisibility = async (hidden: boolean) => {
        if (!user?.id) return;
        setIsSavingStreakPref(true);
        try {
            await updateDoc(doc(db, 'users', user.id), { streakHidden: hidden });
        } catch (error) {
            console.error('Nie udało się zapisać ustawienia passy:', error);
        } finally {
            setIsSavingStreakPref(false);
        }
    };

    const handleToggleEmailNotifications = async (disabled: boolean) => {
        if (!user?.id) return;
        setIsSavingEmailPref(true);
        try {
            await updateDoc(doc(db, 'users', user.id), {
                emailNotificationsDisabled: disabled,
                ...(disabled ? { unsubscribedAt: new Date().toISOString() } : { unsubscribedAt: null })
            });
            setSaveSuccessMessage(true);
            setTimeout(() => setSaveSuccessMessage(false), 2500);
        } catch (error) {
            console.error('Nie udało się zapisać preferencji powiadomień e-mail:', error);
        } finally {
            setIsSavingEmailPref(false);
        }
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
                                {language === 'pl' ? 'Ustawienia Dźwięku i Lektora' : 'Sound & Voice Settings'}
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-primary/20 text-primary uppercase tracking-wider">
                                    {canViewAiModels
                                        ? (soundSettings.soundEngine === 'browser' ? 'Web Speech' : 'Multi-Tier AI')
                                        : 'Lektor'}
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
                                ? 'bg-primary text-accent-ink shadow-[0_0_15px_rgba(114, 240, 180,0.5)]'
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
                                <option value="gpt4o-mini">✨ {language === 'pl' ? 'Zaawansowany Lektor (Płynny)' : 'Advanced Natural Voice'}</option>
                                <option value="gemini">🎙️ {language === 'pl' ? 'Ekspresyjny Lektor (Dynamiczny)' : 'Expressive Dynamic Voice'}</option>
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
                                        ? 'bg-primary/20 text-primary border-primary/50 shadow-[0_0_10px_rgba(114, 240, 180,0.25)]'
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
                                        ? 'bg-primary/20 text-primary border-primary/50 shadow-[0_0_10px_rgba(114, 240, 180,0.25)]'
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
                                            if (user?.id) {
                                                await updateDoc(doc(db, 'users', user.id), {
                                                    requirePasswordChange: false,
                                                    passwordChangeDismissed: true,
                                                    tempPassword: deleteField(),
                                                });
                                            }
                                        } catch (err: any) {
                                            if (err?.code !== 'auth/popup-closed-by-user' && err?.code !== 'auth/cancelled-popup-request') {
                                                setLinkError(err.message || 'Error linking account');
                                            }
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

                <Card>
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                        <Flame className="w-5 h-5 text-warn" />
                        {language === 'pl' ? 'Passa (streak)' : 'Streak'}
                    </h2>
                    <label className="flex items-center justify-between p-3 rounded-xl bg-black/30 border border-white/5 hover:border-white/15 transition-all cursor-pointer">
                        <div className="pr-4">
                            <span className="text-sm font-semibold text-white block">
                                {language === 'pl' ? 'Pokazuj ikonę passy w panelu' : 'Show streak icon in panel'}
                            </span>
                            <span className="text-xs text-content-muted">
                                {language === 'pl'
                                    ? 'Mała ikonka z liczbą dni z rzędu nauki obok paska postępu. Wyłączenie chowa tylko ikonę — passa dalej się liczy.'
                                    : 'A small icon with your current day streak next to the progress bar. Turning it off only hides the icon — the streak keeps counting.'}
                            </span>
                        </div>
                        <input
                            type="checkbox"
                            checked={!user?.streakHidden}
                            disabled={isSavingStreakPref}
                            onChange={(e) => handleToggleStreakVisibility(!e.target.checked)}
                            className="w-5 h-5 rounded border-white/20 bg-black/40 text-primary focus:ring-primary accent-primary cursor-pointer shrink-0"
                        />
                    </label>
                </Card>

                <Card>
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                        <Mail className="w-5 h-5 text-primary" />
                        {language === 'pl' ? 'Powiadomienia e-mail' : 'Email Notifications'}
                    </h2>
                    <label className="flex items-center justify-between p-3 rounded-xl bg-black/30 border border-white/5 hover:border-white/15 transition-all cursor-pointer">
                        <div className="pr-4">
                            <span className="text-sm font-semibold text-white block">
                                {language === 'pl' ? 'Powiadomienia o pracach domowych i zadaniach' : 'Homework & task notifications'}
                            </span>
                            <span className="text-xs text-content-muted">
                                {language === 'pl'
                                    ? 'Otrzymuj e-mail, gdy nauczyciel zada nową pracę domową lub pojawi się ważne przypomnienie. Nikogo nie chcemy spamować — wyłączenie natychmiast zatrzymuje wysyłkę.'
                                    : 'Receive emails when your teacher assigns new homework. Disabling this stops all automatic notification emails.'}
                            </span>
                        </div>
                        <input
                            type="checkbox"
                            checked={!user?.emailNotificationsDisabled}
                            disabled={isSavingEmailPref}
                            onChange={(e) => handleToggleEmailNotifications(!e.target.checked)}
                            className="w-5 h-5 rounded border-white/20 bg-black/40 text-primary focus:ring-primary accent-primary cursor-pointer shrink-0"
                        />
                    </label>
                </Card>

                {/* TYLKO ADMINISTRATOR: modele AI i klucze dostawców.

                    Świadomie węziej niż `isTeacherOrAdmin` obok: wybór modelu
                    zmienia koszt i jakość WSZYSTKIM kursantom naraz, a klucz API
                    to dostęp do rachunku. Lektor prowadzi lekcje i tego nie
                    potrzebuje. */}
                {isTeacherOrAdmin && (
                    <div className="md:col-span-2 space-y-6">
                        <AiModelsSettings />
                        {/* Narada modeli stoi OSOBNO, a nie w sekcji modeli AI:
                            tamta odpowiada na pytanie „czym liczyć", ta na
                            „ilu głosami". Zlanie ich w jedno dawało ekran,
                            na którym wybór modelu do oceny prac domowych
                            sąsiadował z obsadą recenzentów planera. */}
                        <AiCouncilSettings />
                    </div>
                )}

                {/* ADMIN ONLY: RESEND API CONFIGURATION */}
                {isTeacherOrAdmin && (
                    <Card className="border border-primary/30 bg-gradient-to-br from-base-200/90 via-base-200/70 to-primary/10 shadow-lg md:col-span-2">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 mb-4 border-b border-white/10">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 text-primary">
                                    <Key className="w-5 h-5" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                        {language === 'pl' ? 'Konfiguracja Resend API (Mailing)' : 'Resend API Configuration'}
                                        {serverKeyStatus.configured ? (
                                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30 uppercase tracking-wider flex items-center gap-1 font-bold">
                                                <CheckCircle2 size={11} /> {serverKeyStatus.maskedKey || 'Skonfigurowany'}
                                            </span>
                                        ) : (
                                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase tracking-wider font-bold">
                                                {language === 'pl' ? 'Wymagany klucz' : 'Key required'}
                                            </span>
                                        )}
                                    </h2>
                                    <p className="text-xs text-content-muted">
                                        {language === 'pl'
                                            ? 'Klucz do wysyłki e-maili i powiadomień o pracach domowych z platformy CRIBRO ENGLISH'
                                            : 'API key for sending emails and homework notifications from CRIBRO ENGLISH'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <p className="text-xs text-content-muted leading-relaxed">
                                Klucz API pobierzesz z panelu{' '}
                                <a
                                    href="https://resend.com/api-keys"
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-primary underline font-semibold hover:text-white"
                                >
                                    resend.com/api-keys
                                </a>. Wklej poniżej klucz rozpoczynający się od <code>re_</code>.
                            </p>

                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                                <div className="relative flex-1">
                                    <input
                                        type={showResendApiKey ? 'text' : 'password'}
                                        value={resendApiKeyInput}
                                        onChange={(e) => {
                                            setResendApiKeyInput(e.target.value);
                                            setApiKeyError(null);
                                        }}
                                        placeholder="re_123456789abcdef..."
                                        className="w-full px-3.5 py-2.5 rounded-xl bg-black/60 border border-white/15 text-white text-xs font-mono focus:outline-none focus:border-primary pr-10"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowResendApiKey(!showResendApiKey)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-content-muted hover:text-white"
                                        title={showResendApiKey ? 'Ukryj' : 'Pokaż'}
                                    >
                                        {showResendApiKey ? <EyeOff size={15} /> : <Eye size={15} />}
                                    </button>
                                </div>

                                <Button
                                    onClick={handleSaveResendKey}
                                    disabled={isSavingApiKey || !resendApiKeyInput.trim().startsWith('re_')}
                                    isLoading={isSavingApiKey}
                                    className="shrink-0"
                                >
                                    {language === 'pl' ? 'Zapisz klucz API' : 'Save API Key'}
                                </Button>
                            </div>

                            {apiKeyError && (
                                <p className="text-xs text-danger font-semibold flex items-center gap-1 mt-1">
                                    <AlertTriangle size={13} /> {apiKeyError}
                                </p>
                            )}

                            {apiKeySaveSuccess && (
                                <p className="text-xs text-primary font-semibold flex items-center gap-1 mt-1 animate-fade-in">
                                    <CheckCircle2 size={14} />
                                    {language === 'pl'
                                        ? 'Klucz Resend API został pomyślnie zapisany w pliku .env oraz w bazie danych!'
                                        : 'Resend API key saved successfully in .env and Firestore!'}
                                </p>
                            )}
                        </div>
                    </Card>
                )}

                {/* ADMIN ONLY: NOTION INTEGRATION & TRANSCRIPTS CONFIGURATION */}
                {isTeacherOrAdmin && (
                    <Card className="border border-primary/30 bg-gradient-to-br from-base-200/90 via-base-200/70 to-primary/10 shadow-lg md:col-span-2">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 mb-4 border-b border-white/10">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 text-primary">
                                    <Sparkles className="w-5 h-5" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                        {language === 'pl' ? 'Integracja z Notion (Transkrypcje & Kursanci)' : 'Notion Integration & Transcripts'}
                                        {notionConfigStatus.configured ? (
                                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30 uppercase tracking-wider flex items-center gap-1 font-bold">
                                                <CheckCircle2 size={11} /> {notionConfigStatus.maskedToken || 'Połączono'}
                                            </span>
                                        ) : (
                                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase tracking-wider font-bold">
                                                {language === 'pl' ? 'Rozłączono / Wymagana konfiguracja' : 'Disconnected / Setup required'}
                                            </span>
                                        )}
                                    </h2>
                                    <p className="text-xs text-content-muted">
                                        {language === 'pl'
                                            ? 'Połączenie z workspace Notion do automatycznego pobierania transkrypcji spotkań AI i bazy kursantów'
                                            : 'Connect to Notion workspace to fetch meeting transcripts and student database'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            {/* Token */}
                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <label className="text-xs font-semibold text-content uppercase tracking-wider">
                                        {language === 'pl' ? 'Klucz / Token Integracji Notion (API Secret)' : 'Notion Integration Token (API Secret)'}
                                    </label>
                                    {notionConfigStatus.configured && (
                                        <span className="text-[11px] text-primary flex items-center gap-1 font-mono">
                                            <CheckCircle2 size={12} />
                                            {language === 'pl' ? 'Zapisany:' : 'Stored:'} {notionConfigStatus.maskedToken}
                                        </span>
                                    )}
                                </div>

                                {notionConfigStatus.configured && !notionTokenInput && (
                                    <div className="flex items-center justify-between text-[11px] px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20 text-primary mb-2">
                                        <span className="flex items-center gap-1.5 font-medium">
                                            <CheckCircle2 size={13} />
                                            {language === 'pl' ? 'W systemie działa aktywny token Notion' : 'Active Notion token configured'}
                                            <strong className="font-mono text-white tracking-wider">({notionConfigStatus.maskedToken})</strong>
                                        </span>
                                        <span className="text-[10px] text-content-muted">
                                            {language === 'pl' ? 'Wpisz poniżej nowy klucz tylko, jeśli chcesz go zmienić' : 'Enter a new key below only to update'}
                                        </span>
                                    </div>
                                )}

                                <div className="relative flex items-center">
                                    <input
                                        type={showNotionToken ? 'text' : 'password'}
                                        name="notion_secret_token_override"
                                        autoComplete="new-password"
                                        data-1p-ignore="true"
                                        data-lpignore="true"
                                        autoCapitalize="off"
                                        autoCorrect="off"
                                        spellCheck="false"
                                        value={notionTokenInput}
                                        onChange={(e) => {
                                            setNotionTokenInput(e.target.value.replace(/["']/g, ''));
                                            setNotionError(null);
                                        }}
                                        placeholder={notionConfigStatus.configured ? (language === 'pl' ? "Pozostaw puste, aby zachować aktywny token..." : "Leave blank to keep active token...") : "ntn_... lub secret_..."}
                                        className="w-full px-3.5 py-2.5 rounded-xl bg-black/60 border border-white/15 text-white text-xs font-mono focus:outline-none focus:border-primary pr-24"
                                    />
                                    <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                                        {notionTokenInput ? (
                                            <button
                                                type="button"
                                                onClick={() => setNotionTokenInput('')}
                                                className="p-1 text-content-muted hover:text-white rounded hover:bg-white/10"
                                                title={language === 'pl' ? 'Wyczyść pole' : 'Clear'}
                                            >
                                                <X size={14} />
                                            </button>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={handlePasteNotionToken}
                                                className="p-1 text-primary hover:text-primary-hover rounded hover:bg-primary/10 flex items-center gap-1 text-[10px] font-semibold"
                                                title={language === 'pl' ? 'Wklej ze schowka' : 'Paste from clipboard'}
                                            >
                                                <ClipboardPaste size={13} />
                                                <span className="hidden sm:inline">{language === 'pl' ? 'Wklej' : 'Paste'}</span>
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => setShowNotionToken(!showNotionToken)}
                                            className="p-1 text-content-muted hover:text-white rounded hover:bg-white/10"
                                            title={showNotionToken ? 'Ukryj' : 'Pokaż'}
                                        >
                                            {showNotionToken ? <EyeOff size={15} /> : <Eye size={15} />}
                                        </button>
                                    </div>
                                </div>

                                {notionTokenInput.trim() && (
                                    <div className="flex items-center justify-between text-[11px] px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 mt-2 animate-fade-in">
                                        <span className="flex items-center gap-1.5 font-medium">
                                            <Sparkles size={13} />
                                            {language === 'pl' ? 'Wprowadzono nowy token (niezapisany)' : 'New unsaved token entered'}
                                            <span className="font-mono text-[10px] text-white/80">({notionTokenInput.trim().length} zn.)</span>
                                        </span>
                                        <span className="text-[10px] text-amber-200/90">
                                            {language === 'pl' ? 'Możesz teraz wyszukać bazy lub zapisać konfigurację' : 'You can now discover databases or save'}
                                        </span>
                                    </div>
                                )}

                                <p className="text-[11px] text-content-muted mt-1.5">
                                    {language === 'pl' ? (
                                        <>Klucz utworzysz na <a href="https://www.notion.so/profile/integrations" target="_blank" rel="noreferrer" className="text-primary underline">notion.so/profile/integrations</a> (zaczyna się od <code className="text-white font-mono">ntn_</code> lub <code className="text-white font-mono">secret_</code>). Pamiętaj, aby w Notion dodać połączenie (<em>Add connections</em>) do baz danych, które chcesz zsynchronizować.</>
                                    ) : (
                                        <>Create token at <a href="https://www.notion.so/profile/integrations" target="_blank" rel="noreferrer" className="text-primary underline">notion.so/profile/integrations</a> (starts with <code className="text-white font-mono">ntn_</code> or <code className="text-white font-mono">secret_</code>). Make sure to share target databases via <em>Add connections</em> in Notion.</>
                                    )}
                                </p>
                            </div>

                            {/* AUTO-DISCOVERY: Wyszukiwarka baz w Notion */}
                            <div className="p-3.5 rounded-xl bg-black/30 border border-primary/20 space-y-3">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                    <div>
                                        <h4 className="text-xs font-bold text-primary flex items-center gap-1.5 uppercase tracking-wider">
                                            <Search size={14} />
                                            {language === 'pl' ? 'Automatyczne wykrywanie baz w Notion' : 'Notion Database Auto-Discovery'}
                                        </h4>
                                        <p className="text-[11px] text-content-muted">
                                            {language === 'pl'
                                                ? 'Wyszukaj bazy udostępnione Twojej integracji i przypisz je jednym kliknięciem bez ręcznego kopiowania ID'
                                                : 'Search databases shared with your integration and assign them in 1 click'}
                                        </p>
                                    </div>
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        onClick={handleSearchNotionDatabases}
                                        isLoading={isSearchingDatabases}
                                        className="shrink-0 flex items-center gap-1.5 text-xs"
                                    >
                                        <Database size={13} className={isSearchingDatabases ? 'animate-pulse' : ''} />
                                        {language === 'pl' ? 'Wyszukaj bazy w Notion' : 'Discover Databases'}
                                    </Button>
                                </div>

                                {discoveredDatabases.length > 0 && (
                                    <div className="space-y-2 pt-2 border-t border-white/10">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                                            <p className="text-[11px] font-semibold text-white">
                                                Znaleziono {discoveredDatabases.length} {discoveredDatabases.length === 1 ? 'bazę' : 'baz(y)'} w Twoim Notion:
                                            </p>
                                            <span className="text-[10px] text-content-muted">Kliknij przycisk na kafelku bazy, aby przypisać jej rolę</span>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-72 overflow-y-auto pr-1">
                                            {discoveredDatabases.map((db) => {
                                                const isMeetingSelected = cleanNotionId(meetingNotesDbInput) === cleanNotionId(db.id);

                                                return (
                                                    <div
                                                        key={db.id}
                                                        className={`p-3 rounded-xl border transition-all ${
                                                            isMeetingSelected
                                                                ? 'bg-emerald-500/10 border-emerald-500/40 shadow-sm'
                                                                : 'bg-black/50 border-white/10 hover:border-white/20'
                                                        }`}
                                                    >
                                                        <div className="flex items-start justify-between gap-2">
                                                            <div className="min-w-0 flex-1">
                                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                                    <h5 className="text-xs font-bold text-white flex items-center gap-1.5 truncate">
                                                                        {db.icon ? (
                                                                            <span className="text-sm">{db.icon}</span>
                                                                        ) : (
                                                                            <Table size={13} className="text-primary shrink-0" />
                                                                        )}
                                                                        <span className="truncate">{db.title}</span>
                                                                    </h5>
                                                                    {isMeetingSelected && (
                                                                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold uppercase tracking-wider">
                                                                            🎯 Transkrypcje
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                {db.description && (
                                                                    <p className="text-[10px] text-content-muted truncate mt-0.5">{db.description}</p>
                                                                )}
                                                                <p className="text-[9px] font-mono text-content-muted truncate mt-1">
                                                                    ID: {db.id}
                                                                </p>
                                                            </div>
                                                            {db.url && (
                                                                <a
                                                                    href={db.url}
                                                                    target="_blank"
                                                                    rel="noreferrer"
                                                                    className="text-content-muted hover:text-white shrink-0 p-1"
                                                                    title="Otwórz w Notion"
                                                                >
                                                                    <ExternalLink size={12} />
                                                                </a>
                                                            )}
                                                        </div>

                                                        {Array.isArray(db.properties) && db.properties.length > 0 && (
                                                            <div className="flex flex-wrap gap-1 mt-2">
                                                                {db.properties.slice(0, 4).map((prop, idx) => (
                                                                    <span key={idx} className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-content-muted font-mono">
                                                                        {prop}
                                                                    </span>
                                                                ))}
                                                                {db.properties.length > 4 && (
                                                                    <span className="text-[9px] px-1 py-0.5 text-content-muted font-mono">
                                                                        +{db.properties.length - 4}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}

                                                        <div className="mt-2.5 pt-2 border-t border-white/5 flex justify-end">
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setMeetingNotesDbInput(db.id);
                                                                    setNotionError(null);
                                                                }}
                                                                className={`w-full px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-all text-center flex items-center justify-center gap-1.5 cursor-pointer ${
                                                                    isMeetingSelected
                                                                        ? 'bg-emerald-500 text-black font-bold shadow-xs'
                                                                        : 'bg-white/5 hover:bg-emerald-500/20 text-content border border-white/10 hover:text-white hover:border-emerald-500/30'
                                                                }`}
                                                            >
                                                                {isMeetingSelected ? <Check size={12} /> : <span>🎯</span>}
                                                                {isMeetingSelected ? 'Wybrana do transkrypcji ✓' : 'Wybierz jako bazę transkrypcji'}
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Database IDs (Quick Dropdown from Discovered or Manual/Paste) */}
                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <label className="block text-xs font-semibold text-content uppercase tracking-wider">
                                        {language === 'pl' ? 'ID Bazy Spotkań & Transkrypcji' : 'Meeting Notes Database ID'}
                                    </label>
                                    {meetingNotesDbInput && (
                                        <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-0.5">
                                            <Check size={10} /> {language === 'pl' ? 'Ustawiona' : 'Set'}
                                        </span>
                                    )}
                                </div>
                                {discoveredDatabases.length > 0 && (
                                    <select
                                        value={discoveredDatabases.some(d => cleanNotionId(d.id) === cleanNotionId(meetingNotesDbInput)) ? cleanNotionId(meetingNotesDbInput) : ''}
                                        onChange={(e) => {
                                            if (e.target.value) {
                                                setMeetingNotesDbInput(e.target.value);
                                                setNotionError(null);
                                            }
                                        }}
                                        className="w-full px-3 py-2 rounded-xl bg-black/70 border border-emerald-500/30 text-white text-xs focus:outline-none focus:border-emerald-500 mb-1"
                                    >
                                        <option value="">-- Wybierz z wykrytych baz w Notion ({discoveredDatabases.length}) --</option>
                                        {discoveredDatabases.map(d => (
                                            <option key={d.id} value={cleanNotionId(d.id)}>
                                                {d.icon ? `${d.icon} ` : ''}{d.title} ({d.id.slice(0, 8)}...)
                                            </option>
                                        ))}
                                    </select>
                                )}
                                <input
                                    type="text"
                                    value={meetingNotesDbInput}
                                    onChange={(e) => {
                                        setMeetingNotesDbInput(cleanNotionId(e.target.value));
                                        setNotionError(null);
                                    }}
                                    placeholder="Wklej ID lub link do bazy spotkań w Notion..."
                                    className="w-full px-3.5 py-2.5 rounded-xl bg-black/60 border border-white/15 text-white text-xs font-mono focus:outline-none focus:border-primary"
                                />
                                <p className="text-[10px] text-content-muted">
                                    {language === 'pl' ? 'Baza ze spotkaniami i transkrypcjami AI z lekcji.' : 'Database with meeting notes and AI transcripts.'}
                                </p>
                            </div>

                            {/* Auto fetch toggle & interval */}
                            <div className="p-3.5 rounded-xl bg-black/40 border border-white/10 space-y-3">
                                <label className="flex items-center justify-between cursor-pointer">
                                    <div className="pr-4">
                                        <span className="text-sm font-semibold text-white block">
                                            {language === 'pl' ? 'Automatyczne cykliczne pobieranie w tle (Notion Fetch)' : 'Automatic background polling (Notion Fetch)'}
                                        </span>
                                        <span className="text-xs text-content-muted">
                                            {language === 'pl'
                                                ? 'System regularnie sprawdza bazę spotkań w Notion i automatycznie przypisuje nowe transkrypcje do właściwych kursantów i grup'
                                                : 'Regularly queries Notion database and matches new transcripts to students and groups'}
                                        </span>
                                    </div>
                                    <input
                                        type="checkbox"
                                        checked={autoFetchEnabledInput}
                                        onChange={(e) => setAutoFetchEnabledInput(e.target.checked)}
                                        className="w-5 h-5 rounded border-white/20 bg-black/40 text-primary focus:ring-primary accent-primary cursor-pointer shrink-0"
                                    />
                                </label>

                                {autoFetchEnabledInput && (
                                    <div className="flex items-center gap-3 pt-2 border-t border-white/5">
                                        <label className="text-xs text-content-muted shrink-0">
                                            {language === 'pl' ? 'Częstotliwość sprawdzania:' : 'Check interval:'}
                                        </label>
                                        <select
                                            value={autoFetchIntervalInput}
                                            onChange={(e) => setAutoFetchIntervalInput(Number(e.target.value))}
                                            className="px-3 py-1.5 rounded-lg bg-black/60 border border-white/15 text-white text-xs focus:outline-none focus:border-primary"
                                        >
                                            <option value={15}>{language === 'pl' ? 'Co 15 minut' : 'Every 15 minutes'}</option>
                                            <option value={30}>{language === 'pl' ? 'Co 30 minut (zalecane)' : 'Every 30 minutes (recommended)'}</option>
                                            <option value={60}>{language === 'pl' ? 'Co 1 godzinę' : 'Every 1 hour'}</option>
                                            <option value={120}>{language === 'pl' ? 'Co 2 godziny' : 'Every 2 hours'}</option>
                                        </select>
                                    </div>
                                )}
                            </div>

                            {/* Unsaved changes alert */}
                            {hasUnsavedNotionChanges && (
                                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center justify-between gap-2 animate-fade-in">
                                    <span className="flex items-center gap-1.5 font-medium">
                                        <Sparkles size={14} className="text-amber-400 shrink-0" />
                                        {language === 'pl'
                                            ? 'Masz niezapisane zmiany konfiguracji Notion (token lub bazy). Kliknij "Zapisz konfigurację Notion", aby je zastosować.'
                                            : 'You have unsaved Notion changes. Click "Save Notion Config" to apply.'}
                                    </span>
                                </div>
                            )}

                            {/* Action Buttons */}
                            <div className="flex flex-wrap items-center gap-2 pt-1">
                                <Button
                                    onClick={handleSaveNotionConfig}
                                    isLoading={isSavingNotion}
                                    className={`shrink-0 ${hasUnsavedNotionChanges ? 'ring-2 ring-primary ring-offset-2 ring-offset-base-200' : ''}`}
                                >
                                    {language === 'pl' ? 'Zapisz konfigurację Notion' : 'Save Notion Config'}
                                </Button>

                                <Button
                                    variant="secondary"
                                    onClick={handleTestNotionConnection}
                                    isLoading={isTestingNotion}
                                    className="shrink-0"
                                >
                                    {language === 'pl' ? 'Testuj połączenie' : 'Test Connection'}
                                </Button>

                                <Button
                                    variant="secondary"
                                    onClick={handleFetchNotionTranscripts}
                                    isLoading={isFetchingNotion}
                                    className="shrink-0 flex items-center gap-1.5"
                                >
                                    <RefreshCw size={14} className={isFetchingNotion ? 'animate-spin' : ''} />
                                    {language === 'pl' ? 'Pobierz transkrypcje teraz' : 'Fetch Transcripts Now'}
                                </Button>

                                <Button
                                    variant="danger"
                                    onClick={handleClearNotionConfig}
                                    isLoading={isClearingNotion}
                                    className="shrink-0 flex items-center gap-1.5"
                                >
                                    <Unlink size={14} />
                                    {language === 'pl' ? 'Rozłącz i wyczyść Notion' : 'Disconnect & Reset'}
                                </Button>
                            </div>

                            {/* Error & Success notices */}
                            {notionError && (
                                <p className="text-xs text-danger font-semibold flex items-center gap-1 mt-1">
                                    <AlertTriangle size={13} /> {notionError}
                                </p>
                            )}

                            {notionClearSuccess && (
                                <p className="text-xs text-emerald-400 font-semibold flex items-center gap-1 mt-1 animate-fade-in">
                                    <CheckCircle2 size={14} />
                                    {language === 'pl'
                                        ? 'Konfiguracja Notion została wyczyszczona. Połączenie zostało przerwane — możesz teraz wkleić nowy token i przypisać bazy.'
                                        : 'Notion configuration wiped and disconnected successfully.'}
                                </p>
                            )}

                            {notionSaveSuccess && (
                                <p className="text-xs text-primary font-semibold flex items-center gap-1 mt-1 animate-fade-in">
                                    <CheckCircle2 size={14} />
                                    {language === 'pl'
                                        ? 'Konfiguracja Notion została pomyślnie zapisana!'
                                        : 'Notion configuration saved!'}
                                </p>
                            )}

                            {notionTestResult && (
                                <div className={`p-3 rounded-xl border text-xs ${notionTestResult.ok ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-danger/10 border-danger/30 text-danger'} animate-fade-in`}>
                                    <p className="font-semibold flex items-center gap-1.5">
                                        {notionTestResult.ok ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
                                        {notionTestResult.message || (notionTestResult.ok ? 'Połączenie z Notion działa poprawnie!' : 'Błąd połączenia z Notion')}
                                    </p>
                                    {notionTestResult.workspaceName && (
                                        <p className="text-content-muted mt-1">
                                            Workspace: <strong className="text-white">{notionTestResult.workspaceName}</strong> | Bot: <strong className="text-white">{notionTestResult.botName}</strong>
                                        </p>
                                    )}
                                    {notionTestResult.meetingDbTitle && (
                                        <p className="text-content-muted mt-0.5">
                                            Baza spotkań: <strong className="text-white">{notionTestResult.meetingDbTitle}</strong>
                                        </p>
                                    )}
                                    {notionTestResult.studentsDbTitle && (
                                        <p className="text-content-muted mt-0.5">
                                            Baza kursantów: <strong className="text-white">{notionTestResult.studentsDbTitle}</strong>
                                        </p>
                                    )}
                                </div>
                            )}

                            {notionFetchResult && (
                                <div className="p-3 rounded-xl bg-primary/10 border border-primary/30 text-xs text-white space-y-1.5 animate-fade-in">
                                    <p className="font-bold text-primary flex items-center gap-1.5">
                                        <CheckCircle2 size={14} /> {notionFetchResult.message}
                                    </p>
                                    {Array.isArray(notionFetchResult.items) && notionFetchResult.items.length > 0 && (
                                        <div className="max-h-36 overflow-y-auto space-y-1 mt-2 pr-1">
                                            {notionFetchResult.items.map((it, idx) => (
                                                <div key={idx} className="flex items-center justify-between p-1.5 rounded bg-black/40 border border-white/5 text-[11px]">
                                                    <span className="font-medium truncate max-w-[200px]">{it.title}</span>
                                                    <span className="text-primary truncate">{it.studentName}</span>
                                                    <span className="text-[10px] text-content-muted font-mono">{it.status}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Status info */}
                            {notionConfigStatus.lastFetchTime && (
                                <p className="text-[11px] text-content-muted pt-1">
                                    Ostatnia synchronizacja: {new Date(notionConfigStatus.lastFetchTime).toLocaleString()} ({notionConfigStatus.lastFetchStatus || 'Brak uwag'})
                                </p>
                            )}
                        </div>
                    </Card>
                )}

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
                <div className="fixed inset-0 bg-ink/72 backdrop-blur-sm z-50 flex items-center justify-center p-4">
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
