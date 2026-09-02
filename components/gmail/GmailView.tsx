import React, { useState, useEffect, useRef } from 'react';
import { 
  Mail, 
  Inbox, 
  Send, 
  Star, 
  RefreshCw, 
  Trash2, 
  Sparkles, 
  Wand2, 
  CheckCircle2, 
  AlertCircle, 
  Search, 
  FileText, 
  ArrowLeft, 
  Reply, 
  ExternalLink,
  BookOpen,
  Edit3,
  ShieldCheck,
  Check,
  Languages,
  User,
  Paperclip,
  Clock,
  ChevronRight,
  LogOut
} from 'lucide-react';
import { 
  connectGmail, 
  disconnectGmail, 
  isGmailConnected, 
  listGmailMessages, 
  sendGmailMessage, 
  createGmailDraft, 
  markGmailMessageAsRead, 
  toggleGmailStarred, 
  trashGmailMessage, 
  extractVocabularyFromEmail, 
  generateEmailReplyAI, 
  proofreadEmailDraftAI,
  GmailMessage, 
  ExtractedEmailVocab,
  EmailProofreadResult
} from '../../services/gmailService';
import { useAuth } from '../../context/AuthContext';
import { SendConfirmationModal } from './SendConfirmationModal';
import { EmailVocabModal } from './EmailVocabModal';
import Button from '../ui/Button';

export const GmailView: React.FC = () => {
  const { user } = useAuth();
  const [isConnected, setIsConnected] = useState<boolean>(isGmailConnected);
  const [isConnecting, setIsConnecting] = useState(false);
  const [messages, setMessages] = useState<GmailMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Filter & Query
  const [activeTab, setActiveTab] = useState<'inbox' | 'unread' | 'starred' | 'sent'>('inbox');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMessage, setSelectedMessage] = useState<GmailMessage | null>(null);

  // Composer
  const [isComposing, setIsComposing] = useState(false);
  const [composeTo, setComposeTo] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [composeThreadId, setComposeThreadId] = useState<string | undefined>(undefined);
  const [composeInReplyTo, setComposeInReplyTo] = useState<string | undefined>(undefined);

  // Confirmation modal
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // AI Vocabulary Extraction
  const [isExtractingVocab, setIsExtractingVocab] = useState(false);
  const [extractedVocab, setExtractedVocab] = useState<ExtractedEmailVocab[]>([]);
  const [isVocabModalOpen, setIsVocabModalOpen] = useState(false);

  // AI Reply Drafter
  const [isGeneratingReply, setIsGeneratingReply] = useState(false);
  const [replyTone, setReplyTone] = useState<'formal_business' | 'friendly_collegial' | 'assertive_negotiation' | 'polite_decline' | 'quick_followup'>('formal_business');
  const [replyInstructions, setReplyInstructions] = useState('');
  const [generatedAiReply, setGeneratedAiReply] = useState<{ subject: string; body: string; polishSummary: string; keyPhrasesUsed: string[] } | null>(null);

  // AI Proofreader
  const [isProofreading, setIsProofreading] = useState(false);
  const [proofreadResult, setProofreadResult] = useState<EmailProofreadResult | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Load messages when tab or connection changes
  const fetchEmails = async (queryOverride?: string) => {
    if (!isGmailConnected()) return;
    setIsLoading(true);
    setError(null);

    let q = 'in:inbox';
    if (queryOverride) {
      q = queryOverride;
    } else if (searchQuery.trim()) {
      q = searchQuery.trim();
    } else if (activeTab === 'unread') {
      q = 'is:unread';
    } else if (activeTab === 'starred') {
      q = 'is:starred';
    } else if (activeTab === 'sent') {
      q = 'in:sent';
    }

    try {
      const res = await listGmailMessages({ query: q, maxResults: 15 });
      setMessages(res.messages);
      if (res.messages.length > 0 && !selectedMessage) {
        setSelectedMessage(res.messages[0]);
      }
    } catch (err: any) {
      console.error('Błąd pobierania wiadomości:', err);
      setError(err.message || 'Nie udało się pobrać wiadomości z Gmail.');
      if (err.message?.includes('401') || err.message?.includes('wygasła')) {
        setIsConnected(false);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isConnected) {
      fetchEmails();
    }
  }, [isConnected, activeTab]);

  const handleConnect = async () => {
    setIsConnecting(true);
    setError(null);
    try {
      await connectGmail();
      setIsConnected(true);
      showToast('Połączono pomyślnie z kontem Gmail!');
      fetchEmails();
    } catch (err: any) {
      if (err.code !== 'auth/popup-closed-by-user') {
        setError(err.message || 'Nie udało się połączyć z Gmail.');
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = () => {
    disconnectGmail();
    setIsConnected(false);
    setMessages([]);
    setSelectedMessage(null);
    showToast('Rozłączono sesję Gmail.');
  };

  const handleSelectMessage = async (msg: GmailMessage) => {
    setSelectedMessage(msg);
    setIsComposing(false);
    setGeneratedAiReply(null);
    setProofreadResult(null);

    // Oznacz jako przeczytane jeśli było nieprzeczytane
    if (msg.isUnread) {
      try {
        await markGmailMessageAsRead(msg.id);
        setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, isUnread: false } : m));
      } catch (e) {
        console.warn('Błąd oznaczania jako przeczytane:', e);
      }
    }
  };

  const handleToggleStar = async (e: React.MouseEvent, msg: GmailMessage) => {
    e.stopPropagation();
    const newStar = !msg.isStarred;
    try {
      await toggleGmailStarred(msg.id, newStar);
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, isStarred: newStar } : m));
      if (selectedMessage?.id === msg.id) {
        setSelectedMessage(prev => prev ? { ...prev, isStarred: newStar } : null);
      }
    } catch (err) {
      console.error('Błąd zmiany gwiazdki:', err);
    }
  };

  const handleTrashMessage = async (msgId: string) => {
    if (!window.confirm('Czy na pewno chcesz przenieść tę wiadomość do kosza w Gmail?')) return;
    try {
      await trashGmailMessage(msgId);
      setMessages(prev => prev.filter(m => m.id !== msgId));
      if (selectedMessage?.id === msgId) {
        setSelectedMessage(messages.find(m => m.id !== msgId) || null);
      }
      showToast('Przeniesiono wiadomość do kosza.');
    } catch (err: any) {
      setError(err.message || 'Nie udało się usunąć wiadomości.');
    }
  };

  // AI Actions
  const handleExtractVocab = async () => {
    if (!selectedMessage) return;
    setIsExtractingVocab(true);
    setIsVocabModalOpen(true);
    try {
      const vocab = await extractVocabularyFromEmail({
        emailSubject: selectedMessage.subject,
        emailBody: selectedMessage.bodyText || selectedMessage.snippet,
        targetLevel: user?.level || 'B2'
      });
      setExtractedVocab(vocab);
    } catch (err: any) {
      console.error('Błąd wyciągania słownictwa:', err);
      showToast('Nie udało się wyodrębnić słownictwa z tej wiadomości.');
    } finally {
      setIsExtractingVocab(false);
    }
  };

  const handleGenerateReplyAI = async () => {
    if (!selectedMessage) return;
    setIsGeneratingReply(true);
    try {
      const reply = await generateEmailReplyAI({
        emailSubject: selectedMessage.subject,
        emailBody: selectedMessage.bodyText || selectedMessage.snippet,
        senderName: selectedMessage.from,
        tone: replyTone,
        instructions: replyInstructions
      });
      setGeneratedAiReply(reply);
    } catch (err: any) {
      console.error('Błąd generowania odpowiedzi AI:', err);
      showToast('Nie udało się wygenerować odpowiedzi AI.');
    } finally {
      setIsGeneratingReply(false);
    }
  };

  const handleApplyAiReplyToComposer = () => {
    if (!generatedAiReply || !selectedMessage) return;
    setComposeTo(selectedMessage.from);
    setComposeSubject(generatedAiReply.subject);
    setComposeBody(generatedAiReply.body);
    setComposeThreadId(selectedMessage.threadId);
    setComposeInReplyTo(selectedMessage.id);
    setIsComposing(true);
  };

  const handleStartReply = () => {
    if (!selectedMessage) return;
    setComposeTo(selectedMessage.from);
    setComposeSubject(selectedMessage.subject.startsWith('Re:') ? selectedMessage.subject : `Re: ${selectedMessage.subject}`);
    setComposeBody(`\n\n--- Oryginalna wiadomość (${selectedMessage.date}) ---\nOd: ${selectedMessage.from}\n${selectedMessage.bodyText || selectedMessage.snippet}`);
    setComposeThreadId(selectedMessage.threadId);
    setComposeInReplyTo(selectedMessage.id);
    setIsComposing(true);
  };

  const handleProofreadDraft = async () => {
    if (!composeBody.trim()) return;
    setIsProofreading(true);
    try {
      const res = await proofreadEmailDraftAI({
        draftText: composeBody,
        desiredTone: 'Professional Business'
      });
      setProofreadResult(res);
    } catch (err: any) {
      console.error('Błąd sprawdzania szkicu:', err);
      showToast('Nie udało się sprawdzić tekstu.');
    } finally {
      setIsProofreading(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!composeTo.trim()) {
      alert('Podaj adresata wiadomości.');
      return;
    }
    try {
      await createGmailDraft({
        to: composeTo,
        subject: composeSubject,
        body: composeBody,
        threadId: composeThreadId
      });
      showToast('Zapisano wersję roboczą (Draft) w Gmail!');
    } catch (err: any) {
      setError(err.message || 'Nie udało się zapisać wersji roboczej.');
    }
  };

  const handleExecuteSend = async () => {
    setIsSending(true);
    try {
      await sendGmailMessage({
        to: composeTo,
        subject: composeSubject,
        body: composeBody,
        threadId: composeThreadId,
        inReplyTo: composeInReplyTo
      });
      setIsConfirmModalOpen(false);
      setIsComposing(false);
      setComposeTo('');
      setComposeSubject('');
      setComposeBody('');
      setGeneratedAiReply(null);
      setProofreadResult(null);
      showToast('Wiadomość została wysłana z Twojego konta Gmail!');
      fetchEmails();
    } catch (err: any) {
      console.error('Błąd wysyłania:', err);
      setError(err.message || 'Nie udało się wysłać wiadomości.');
    } finally {
      setIsSending(false);
    }
  };

  const insertTemplate = (type: 'lesson_recap' | 'schedule_proposal' | 'business_inquiry') => {
    if (type === 'lesson_recap') {
      setComposeSubject('English Lesson Summary & Homework - Cribro Recall');
      setComposeBody(`Dear Student,\n\nGreat job during our English lesson today! Here is a quick summary of what we covered:\n\n1. KEY VOCABULARY & IDIOMS:\n- [Add key words discussed in lesson]\n\n2. GRAMMAR & PRONUNCIATION FOCUS:\n- [Add grammar notes]\n\n3. HOMEWORK & RECALL PRACTICE:\n- Complete your assigned flashcard set in Cribro Recall.\n- Prepare 3 example sentences using today's new idioms.\n\nLooking forward to our next class!\n\nBest regards,\nYour English Tutor`);
    } else if (type === 'schedule_proposal') {
      setComposeSubject('Scheduling our next English session');
      setComposeBody(`Hi,\n\nI would like to propose a schedule for our upcoming English lesson.\n\nWould any of the following time slots work for you?\n- Option 1: Tuesday at 4:00 PM CET\n- Option 2: Thursday at 10:00 AM CET\n\nPlease let me know what suits you best.\n\nKind regards,`);
    } else if (type === 'business_inquiry') {
      setComposeSubject('Inquiry regarding project collaboration');
      setComposeBody(`Dear Team,\n\nI am writing to inquire about the possibility of collaborating on the upcoming project.\n\nCould you please provide more details regarding the timeline and requirements? I would appreciate the opportunity to discuss this further at your earliest convenience.\n\nThank you for your time and consideration.\n\nSincerely,`);
    }
  };

  return (
    <div className="w-full flex-1 flex flex-col p-4 md:p-6 max-w-7xl mx-auto gap-6 animate-in fade-in">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-primary text-black px-4 py-3 rounded-xl font-bold shadow-2xl flex items-center gap-2 animate-in slide-in-from-bottom-2">
          <CheckCircle2 size={18} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400 shadow-glow">
            <Mail size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              Gmail & Asystent Korespondencji Angielskiej
            </h1>
            <p className="text-xs text-content-muted">
              Prawdziwa skrzynka Gmail, wyciąganie słownictwa do fiszek i inteligentny asystent e-mail
            </p>
          </div>
        </div>

        {isConnected ? (
          <div className="flex items-center gap-2.5">
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setIsComposing(true);
                setSelectedMessage(null);
                setComposeTo('');
                setComposeSubject('');
                setComposeBody('');
              }}
              className="bg-primary hover:bg-primary-hover text-black font-bold flex items-center gap-2"
            >
              <Edit3 size={16} />
              <span>Napisz wiadomość</span>
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => fetchEmails()}
              disabled={isLoading}
              className="flex items-center gap-1.5"
              title="Odśwież skrzynkę"
            >
              <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">Odśwież</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDisconnect}
              className="text-xs text-content-muted hover:text-red-400 flex items-center gap-1"
              title="Rozłącz Gmail"
            >
              <LogOut size={14} />
              <span className="hidden md:inline">Rozłącz</span>
            </Button>
          </div>
        ) : null}
      </div>

      {/* Error alert */}
      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm flex items-start gap-3">
          <AlertCircle size={18} className="text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="text-content-muted hover:text-white text-xs">
            Zamknij
          </button>
        </div>
      )}

      {/* Connect State Card (if not connected) */}
      {!isConnected ? (
        <div className="my-8 p-8 max-w-2xl mx-auto rounded-3xl bg-surface border border-white/10 shadow-2xl flex flex-col items-center text-center gap-6">
          <div className="w-16 h-16 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400">
            <Mail size={32} />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-white">Połącz swoje konto Gmail</h2>
            <p className="text-sm text-content-muted max-w-md mx-auto leading-relaxed">
              Integracja z Google Workspace pozwala bezpiecznie odczytywać e-maile, wyciągać z nich zaawansowane słownictwo do powtórek w Cribro Recall oraz tworzyć i wysyłać profesjonalne odpowiedzi w języku angielskim z Twojego konta Gmail.
            </p>
          </div>

          <div className="w-full bg-white/5 p-4 rounded-2xl border border-white/5 text-left text-xs text-content-muted space-y-2">
            <div className="flex items-center gap-2 text-primary font-bold">
              <ShieldCheck size={16} />
              <span>Co zyskujesz po połączeniu Gmail:</span>
            </div>
            <ul className="list-disc list-inside space-y-1 pl-1">
              <li>Bezpośredni podgląd wiadomości e-mail w aplikacji</li>
              <li>1-kliknięciem zamieniaj zwroty z maili od klientów na fiszki do nauki</li>
              <li>Generuj profesjonalne odpowiedzi biznesowe w 5 różnych tonach (CELTA standard)</li>
              <li>Wysyłaj podsumowania lekcji i zadania domowe do uczniów</li>
            </ul>
          </div>

          {/* Official Google Sign-In Button */}
          <button
            onClick={handleConnect}
            disabled={isConnecting}
            className="flex items-center gap-3 px-6 py-3.5 rounded-xl bg-white text-gray-800 hover:bg-gray-100 font-bold text-sm transition-all shadow-lg hover:shadow-xl active:scale-95 disabled:opacity-50"
          >
            <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-5 h-5">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
            </svg>
            <span>{isConnecting ? 'Łączenie z kontem Google...' : 'Połącz z kontem Google (Gmail)'}</span>
          </button>
        </div>
      ) : (
        /* Connected Workspace Layout */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[650px]">
          {/* Left Column: Folders & Message List */}
          <div className="lg:col-span-5 flex flex-col gap-4 bg-surface/80 border border-white/10 rounded-2xl p-4">
            {/* Search Bar */}
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                fetchEmails();
              }}
              className="relative"
            >
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-content-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Szukaj w Gmail (np. from:klient, subject:project)..."
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-content-muted focus:outline-none focus:border-primary"
              />
            </form>

            {/* Tabs */}
            <div className="flex items-center gap-1 p-1 bg-white/5 rounded-xl text-xs font-semibold">
              <button
                onClick={() => { setActiveTab('inbox'); setSearchQuery(''); }}
                className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                  activeTab === 'inbox' && !searchQuery ? 'bg-primary text-black font-bold' : 'text-content-muted hover:text-white'
                }`}
              >
                <Inbox size={14} />
                <span>Odebrane</span>
              </button>
              <button
                onClick={() => { setActiveTab('unread'); setSearchQuery(''); }}
                className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                  activeTab === 'unread' ? 'bg-primary text-black font-bold' : 'text-content-muted hover:text-white'
                }`}
              >
                <Clock size={14} />
                <span>Nieprzeczytane</span>
              </button>
              <button
                onClick={() => { setActiveTab('starred'); setSearchQuery(''); }}
                className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                  activeTab === 'starred' ? 'bg-primary text-black font-bold' : 'text-content-muted hover:text-white'
                }`}
              >
                <Star size={14} />
                <span>Z gwiazdką</span>
              </button>
              <button
                onClick={() => { setActiveTab('sent'); setSearchQuery(''); }}
                className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                  activeTab === 'sent' ? 'bg-primary text-black font-bold' : 'text-content-muted hover:text-white'
                }`}
              >
                <Send size={14} />
                <span>Wysłane</span>
              </button>
            </div>

            {/* Email List */}
            <div className="flex-1 overflow-y-auto max-h-[550px] flex flex-col gap-2 pr-1">
              {isLoading ? (
                <div className="py-16 flex flex-col items-center justify-center gap-2 text-center">
                  <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
                  <span className="text-xs text-content-muted">Ładowanie wiadomości Gmail...</span>
                </div>
              ) : messages.length === 0 ? (
                <div className="py-16 flex flex-col items-center justify-center gap-2 text-center text-content-muted">
                  <Inbox size={32} />
                  <p className="text-xs">Brak wiadomości w tej kategorii.</p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isSelected = selectedMessage?.id === msg.id && !isComposing;
                  return (
                    <div
                      key={msg.id}
                      onClick={() => handleSelectMessage(msg)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col gap-1.5 text-left ${
                        isSelected 
                          ? 'bg-primary/15 border-primary/40 shadow-glow' 
                          : msg.isUnread
                          ? 'bg-white/10 border-white/15 text-white font-semibold'
                          : 'bg-white/5 border-white/5 text-content-muted hover:border-white/15'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-xs truncate ${msg.isUnread ? 'font-bold text-white' : 'font-medium text-content-muted'}`}>
                          {msg.from.replace(/<.*>/, '').trim() || msg.from}
                        </span>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={(e) => handleToggleStar(e, msg)}
                            className={`p-1 hover:text-amber-400 transition-colors ${msg.isStarred ? 'text-amber-400' : 'text-content-muted'}`}
                          >
                            <Star size={14} className={msg.isStarred ? 'fill-amber-400' : ''} />
                          </button>
                          <span className="text-[10px] text-content-muted">
                            {new Date(msg.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                          </span>
                        </div>
                      </div>

                      <div className="text-xs font-bold text-white truncate">
                        {msg.subject}
                      </div>

                      <div className="text-[11px] text-content-muted line-clamp-2 leading-relaxed">
                        {msg.snippet}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Active Viewer OR Composer */}
          <div className="lg:col-span-7 flex flex-col bg-surface/80 border border-white/10 rounded-2xl p-5 gap-4">
            {isComposing ? (
              /* Composer View */
              <div className="flex flex-col gap-4 flex-1">
                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <Edit3 size={18} className="text-primary" />
                    <h3 className="font-bold text-base text-white">Nowa wiadomość e-mail</h3>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Quick templates */}
                    <div className="dropdown relative">
                      <select
                        onChange={(e) => {
                          if (e.target.value) {
                            insertTemplate(e.target.value as any);
                            e.target.value = '';
                          }
                        }}
                        className="bg-white/5 border border-white/10 rounded-lg px-2.5 py-1 text-xs text-content-muted hover:text-white focus:outline-none"
                      >
                        <option value="">+ Wstaw szablon</option>
                        <option value="lesson_recap">Podsumowanie lekcji & praca domowa</option>
                        <option value="schedule_proposal">Propozycja terminu lekcji</option>
                        <option value="business_inquiry">Formalne zapytanie biznesowe</option>
                      </select>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setIsComposing(false);
                        if (messages.length > 0 && !selectedMessage) {
                          setSelectedMessage(messages[0]);
                        }
                      }}
                      className="text-xs text-content-muted hover:text-white"
                    >
                      Anuluj
                    </Button>
                  </div>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block text-content-muted font-semibold mb-1">Do (Adres e-mail):</label>
                    <input
                      type="email"
                      value={composeTo}
                      onChange={(e) => setComposeTo(e.target.value)}
                      placeholder="odbiorca@example.com"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-content-muted font-semibold mb-1">Temat:</label>
                    <input
                      type="text"
                      value={composeSubject}
                      onChange={(e) => setComposeSubject(e.target.value)}
                      placeholder="Temat wiadomości..."
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-primary"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-content-muted font-semibold">Treść wiadomości (English):</label>
                      <button
                        onClick={handleProofreadDraft}
                        disabled={isProofreading || !composeBody.trim()}
                        className="text-primary hover:text-primary-hover flex items-center gap-1 font-bold text-xs"
                      >
                        <Sparkles size={12} />
                        <span>{isProofreading ? 'Audytuję tekst...' : 'Sprawdź angielski & ton (AI)'}</span>
                      </button>
                    </div>
                    <textarea
                      rows={10}
                      value={composeBody}
                      onChange={(e) => setComposeBody(e.target.value)}
                      placeholder="Write your email here in English..."
                      className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-primary font-sans leading-relaxed"
                    />
                  </div>
                </div>

                {/* Proofread results if available */}
                {proofreadResult && (
                  <div className="p-4 rounded-xl bg-primary/10 border border-primary/20 flex flex-col gap-3 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white flex items-center gap-1.5">
                        <Sparkles size={14} className="text-primary" />
                        Ocena poprawności: {proofreadResult.overallScore}/100
                      </span>
                      <span className="text-primary/90 font-medium">{proofreadResult.toneAssessment}</span>
                    </div>

                    {proofreadResult.corrections.length > 0 && (
                      <div className="space-y-1.5">
                        <span className="text-content-muted font-semibold">Sugerowane poprawki gramatyczne:</span>
                        {proofreadResult.corrections.map((corr, idx) => (
                          <div key={idx} className="p-2 rounded-lg bg-black/30 border border-white/5 flex flex-col gap-0.5">
                            <div className="flex items-center gap-2">
                              <span className="text-red-400 line-through">{corr.original}</span>
                              <ChevronRight size={12} className="text-content-muted" />
                              <span className="text-emerald-400 font-bold">{corr.correction}</span>
                            </div>
                            <span className="text-[11px] text-content-muted">{corr.explanation}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center justify-end gap-2 pt-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setComposeBody(proofreadResult.improvedText);
                          setProofreadResult(null);
                          showToast('Zastosowano poprawioną wersję!');
                        }}
                        className="bg-primary/20 text-primary border-primary/30 text-xs"
                      >
                        Zastosuj poprawki AI
                      </Button>
                    </div>
                  </div>
                )}

                {/* Footer Controls */}
                <div className="flex items-center justify-between pt-3 border-t border-white/10 mt-auto">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleSaveDraft}
                    className="flex items-center gap-1.5 text-xs text-content-muted hover:text-white"
                  >
                    <FileText size={14} />
                    <span>Zapisz wersję roboczą</span>
                  </Button>

                  <Button
                    variant="primary"
                    onClick={() => {
                      if (!composeTo.trim()) {
                        alert('Podaj adresata wiadomości.');
                        return;
                      }
                      setIsConfirmModalOpen(true);
                    }}
                    className="bg-primary hover:bg-primary-hover text-black font-bold flex items-center gap-2"
                  >
                    <Send size={16} />
                    <span>Wyślij e-mail</span>
                  </Button>
                </div>
              </div>
            ) : selectedMessage ? (
              /* Message Reader & AI Assistant */
              <div className="flex flex-col gap-4 flex-1">
                {/* Message Header */}
                <div className="flex items-start justify-between gap-4 pb-3 border-b border-white/10">
                  <div className="space-y-1 min-w-0">
                    <h2 className="text-lg font-bold text-white leading-snug break-words">
                      {selectedMessage.subject}
                    </h2>
                    <div className="flex items-center gap-2 text-xs text-content-muted flex-wrap">
                      <span className="font-semibold text-primary">{selectedMessage.from}</span>
                      <span>•</span>
                      <span>{selectedMessage.date}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => handleToggleStar(e, selectedMessage)}
                      className={`p-2 ${selectedMessage.isStarred ? 'text-amber-400' : 'text-content-muted hover:text-white'}`}
                      title="Oznacz gwiazdką"
                    >
                      <Star size={16} className={selectedMessage.isStarred ? 'fill-amber-400' : ''} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleTrashMessage(selectedMessage.id)}
                      className="p-2 text-content-muted hover:text-red-400"
                      title="Usuń do kosza"
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </div>

                {/* AI Quick Actions Bar */}
                <div className="flex items-center gap-2 p-2 rounded-xl bg-white/5 border border-white/5 flex-wrap">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleExtractVocab}
                    disabled={isExtractingVocab}
                    className="text-xs font-bold flex items-center gap-1.5 bg-primary/15 text-primary border-primary/30 hover:bg-primary/25"
                    title="Wyciągnij kluczowe zwroty, idiomy i kolokacje do fiszek"
                  >
                    <Sparkles size={14} />
                    <span>Wyciągnij słownictwo do Recall</span>
                  </Button>

                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      if (!generatedAiReply) {
                        handleGenerateReplyAI();
                      }
                    }}
                    disabled={isGeneratingReply}
                    className="text-xs font-bold flex items-center gap-1.5 bg-purple-500/15 text-purple-300 border-purple-500/30 hover:bg-purple-500/25"
                    title="Wygeneruj profesjonalną odpowiedź w języku angielskim"
                  >
                    <Wand2 size={14} />
                    <span>{isGeneratingReply ? 'Generuję AI...' : 'Asystent odpowiedzi (AI)'}</span>
                  </Button>

                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleStartReply}
                    className="text-xs font-semibold flex items-center gap-1.5 text-content-muted hover:text-white ml-auto"
                  >
                    <Reply size={14} />
                    <span>Odpowiedz ręcznie</span>
                  </Button>
                </div>

                {/* AI Reply Drafter Accordion/Box if active */}
                {generatedAiReply && (
                  <div className="p-4 rounded-xl bg-purple-950/30 border border-purple-500/30 flex flex-col gap-3 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Sparkles size={16} className="text-purple-400" />
                        <span className="font-bold text-white">Szkic odpowiedzi wygenerowany przez AI</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          value={replyTone}
                          onChange={(e) => setReplyTone(e.target.value as any)}
                          className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-[11px] text-white focus:outline-none"
                        >
                          <option value="formal_business">Formalny biznesowy</option>
                          <option value="friendly_collegial">Koleżeński / Zespół</option>
                          <option value="assertive_negotiation">Asertywna negocjacja</option>
                          <option value="polite_decline">Uprzejma odmowa</option>
                          <option value="quick_followup">Krótki follow-up</option>
                        </select>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={handleGenerateReplyAI}
                          disabled={isGeneratingReply}
                          className="text-[11px] p-1 text-purple-300 hover:text-white"
                        >
                          <RefreshCw size={12} className={isGeneratingReply ? 'animate-spin' : ''} />
                        </Button>
                      </div>
                    </div>

                    <div className="p-2 rounded-lg bg-black/40 border border-purple-500/20 text-purple-200">
                      <span className="font-semibold block mb-0.5">Podsumowanie sensu:</span>
                      {generatedAiReply.polishSummary}
                    </div>

                    <div className="p-3 rounded-lg bg-black/50 border border-white/5 text-white font-mono text-xs whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
                      {generatedAiReply.body}
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {generatedAiReply.keyPhrasesUsed.map((phrase, i) => (
                          <span key={i} className="text-[10px] px-2 py-0.5 rounded bg-white/5 border border-white/10 text-content-muted">
                            {phrase}
                          </span>
                        ))}
                      </div>

                      <Button
                        size="sm"
                        variant="primary"
                        onClick={handleApplyAiReplyToComposer}
                        className="bg-purple-500 hover:bg-purple-600 text-white font-bold text-xs flex items-center gap-1.5"
                      >
                        <Send size={12} />
                        <span>Przenieś do edytora & wyślij</span>
                      </Button>
                    </div>
                  </div>
                )}

                {/* Email Body View */}
                <div className="flex-1 overflow-y-auto max-h-[420px] p-4 rounded-xl bg-black/20 border border-white/5 text-content leading-relaxed text-sm whitespace-pre-wrap font-sans">
                  {selectedMessage.bodyText || selectedMessage.snippet || '(Wiadomość nie zawiera treści tekstowej)'}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center text-content-muted py-24">
                <Mail size={40} className="stroke-[1.5]" />
                <p className="text-sm">Wybierz wiadomość z listy po lewej stronie, aby ją przeczytać lub odpowiedzieć.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Confirmation Modal before Sending */}
      <SendConfirmationModal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        onConfirm={handleExecuteSend}
        recipient={composeTo}
        subject={composeSubject}
        bodySnippet={composeBody}
        isSending={isSending}
      />

      {/* Vocabulary Extraction Modal */}
      <EmailVocabModal
        isOpen={isVocabModalOpen}
        onClose={() => setIsVocabModalOpen(false)}
        emailSubject={selectedMessage?.subject || ''}
        vocabList={extractedVocab}
        isLoading={isExtractingVocab}
        onSuccess={(count) => {
          showToast(`Zapisano ${count} nowych fiszek do Cribro Recall!`);
        }}
      />
    </div>
  );
};
export default GmailView;
