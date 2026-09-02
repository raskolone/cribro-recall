import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from '../firebase';
import { generateLessonPlannerAI, extractJSON } from './geminiService';

export const GMAIL_SCOPES = [
  'https://mail.google.com/',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/gmail.labels',
  'https://www.googleapis.com/auth/gmail.metadata',
  'https://www.googleapis.com/auth/gmail.insert',
  'https://www.googleapis.com/auth/gmail.settings.basic',
  'https://www.googleapis.com/auth/gmail.settings.sharing',
  'https://www.googleapis.com/auth/gmail.addons.current.action.compose',
  'https://www.googleapis.com/auth/gmail.addons.current.message.action',
  'https://www.googleapis.com/auth/gmail.addons.current.message.metadata',
  'https://www.googleapis.com/auth/gmail.addons.current.message.readonly'
];

let cachedGmailToken: string | null = null;

export interface GmailProfile {
  emailAddress: string;
  messagesTotal: number;
  threadsTotal: number;
  historyId: string;
}

export interface GmailMessage {
  id: string;
  threadId: string;
  snippet: string;
  subject: string;
  from: string;
  to: string;
  date: string;
  timestamp: number;
  bodyText: string;
  bodyHtml?: string;
  labelIds: string[];
  isUnread: boolean;
  isStarred: boolean;
}

export interface GmailSendParams {
  to: string;
  subject: string;
  body: string;
  isHtml?: boolean;
  cc?: string;
  bcc?: string;
  threadId?: string;
  inReplyTo?: string;
  references?: string;
}

export interface ExtractedEmailVocab {
  term: string;
  ipa?: string;
  definition: string;
  contextSentence: string;
  category: 'idiom' | 'phrasal_verb' | 'collocation' | 'business_formal' | 'grammar_pattern';
  level?: string;
}

export interface EmailProofreadResult {
  improvedText: string;
  overallScore: number;
  toneAssessment: string;
  corrections: Array<{
    original: string;
    correction: string;
    explanation: string;
    category: 'grammar' | 'style' | 'vocabulary' | 'tone';
  }>;
  suggestedPhrases: Array<{
    phrase: string;
    useCase: string;
  }>;
}

/**
 * Pobiera bieżący token dostępu Gmail z pamięci
 */
export const getGmailAccessToken = (): string | null => {
  if (cachedGmailToken) return cachedGmailToken;
  try {
    const saved = localStorage.getItem('gmail_cached_access_token');
    if (saved) {
      cachedGmailToken = saved;
      return saved;
    }
  } catch (e) {}
  return null;
};

/**
 * Ustawia token dostępu w pamięci
 */
export const setGmailAccessToken = (token: string | null) => {
  cachedGmailToken = token;
  try {
    if (token) {
      localStorage.setItem('gmail_cached_access_token', token);
    } else {
      localStorage.removeItem('gmail_cached_access_token');
    }
  } catch (e) {}
};

/**
 * Sprawdza czy Gmail jest połączony
 */
export const isGmailConnected = (): boolean => {
  return !!getGmailAccessToken();
};

/**
 * Rozłącza sesję Gmail
 */
export const disconnectGmail = () => {
  setGmailAccessToken(null);
};

/**
 * Łączy konto z Gmail przez Google OAuth popup
 */
export const connectGmail = async (): Promise<string> => {
  try {
    const provider = new GoogleAuthProvider();
    GMAIL_SCOPES.forEach(scope => provider.addScope(scope));
    provider.setCustomParameters({
      prompt: 'consent',
      access_type: 'offline'
    });

    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);

    if (!credential?.accessToken) {
      throw new Error('Nie udało się uzyskać tokenu dostępu OAuth dla Gmail.');
    }

    setGmailAccessToken(credential.accessToken);
    return credential.accessToken;
  } catch (error: any) {
    if (error.code !== 'auth/popup-closed-by-user') {
      console.error('Błąd połączenia z Gmail:', error);
    }
    throw error;
  }
};

/**
 * Pomocniczy fetch z autoryzacją Gmail i obsługą 401
 */
const gmailFetch = async (endpoint: string, options: RequestInit = {}): Promise<any> => {
  const token = getGmailAccessToken();
  if (!token) {
    throw new Error('Brak aktywnego połączenia z Gmail. Zaloguj się przez konto Google.');
  }

  const url = endpoint.startsWith('http') ? endpoint : `https://gmail.googleapis.com/gmail/v1/users/me${endpoint}`;
  
  const headers = new Headers(options.headers || {});
  headers.set('Authorization', `Bearer ${token}`);
  if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, {
    ...options,
    headers
  });

  if (response.status === 401) {
    disconnectGmail();
    throw new Error('Sesja Gmail wygasła (401). Połącz konto Google ponownie.');
  }

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    const message = errData?.error?.message || `Błąd Gmail API (${response.status}): ${response.statusText}`;
    throw new Error(message);
  }

  if (response.status === 204) {
    return { success: true };
  }

  return await response.json();
};

/**
 * Pobiera profil użytkownika Gmail
 */
export const getGmailProfile = async (): Promise<GmailProfile> => {
  return await gmailFetch('/profile');
};

/**
 * Dekoduje tekst z base64 URL safe
 */
const decodeBase64Url = (str: string): string => {
  try {
    const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder('utf-8').decode(bytes);
  } catch (e) {
    try {
      return atob(str.replace(/-/g, '+').replace(/_/g, '/'));
    } catch {
      return '';
    }
  }
};

/**
 * Koduje tekst w standardzie base64 URL safe
 */
const encodeBase64Url = (str: string): string => {
  const utf8Bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < utf8Bytes.length; i++) {
    binary += String.fromCharCode(utf8Bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
};

/**
 * Rekurencyjnie parsuje części wiadomości multipart
 */
const parseMessagePayload = (payload: any): { bodyText: string; bodyHtml?: string } => {
  let bodyText = '';
  let bodyHtml = '';

  if (!payload) return { bodyText: '', bodyHtml: '' };

  if (payload.body?.data) {
    const decoded = decodeBase64Url(payload.body.data);
    if (payload.mimeType === 'text/html') {
      bodyHtml = decoded;
      // Stwórz prosty fallback plain text
      bodyText = decoded.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    } else {
      bodyText = decoded;
    }
  }

  if (payload.parts && Array.isArray(payload.parts)) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        bodyText = decodeBase64Url(part.body.data);
      } else if (part.mimeType === 'text/html' && part.body?.data) {
        bodyHtml = decodeBase64Url(part.body.data);
      } else if (part.parts) {
        const nested = parseMessagePayload(part);
        if (nested.bodyText && !bodyText) bodyText = nested.bodyText;
        if (nested.bodyHtml && !bodyHtml) bodyHtml = nested.bodyHtml;
      }
    }
  }

  if (!bodyText && bodyHtml) {
    bodyText = bodyHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  return { bodyText: bodyText.trim(), bodyHtml };
};

/**
 * Pobiera listę wiadomości Gmail
 */
export const listGmailMessages = async ({
  query = 'in:inbox',
  maxResults = 15,
  pageToken
}: {
  query?: string;
  maxResults?: number;
  pageToken?: string;
} = {}): Promise<{ messages: GmailMessage[]; nextPageToken?: string; resultSizeEstimate?: number }> => {
  const params = new URLSearchParams();
  if (query) params.set('q', query);
  params.set('maxResults', String(maxResults));
  if (pageToken) params.set('pageToken', pageToken);

  const listData = await gmailFetch(`/messages?${params.toString()}`);
  const messageItems: any[] = listData.messages || [];

  if (messageItems.length === 0) {
    return { messages: [], nextPageToken: undefined, resultSizeEstimate: 0 };
  }

  // Pobierz szczegóły każdej wiadomości równolegle (max 15 naraz)
  const detailsPromises = messageItems.map(async (item) => {
    try {
      const msg = await gmailFetch(`/messages/${item.id}?format=full`);
      const headers = msg.payload?.headers || [];
      const getHeader = (name: string) => {
        const found = headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase());
        return found ? found.value : '';
      };

      const { bodyText, bodyHtml } = parseMessagePayload(msg.payload);
      const labelIds: string[] = msg.labelIds || [];

      const parsedDate = getHeader('Date');
      const timestamp = parseInt(msg.internalDate || '0', 10) || (parsedDate ? new Date(parsedDate).getTime() : Date.now());

      return {
        id: msg.id,
        threadId: msg.threadId,
        snippet: msg.snippet || '',
        subject: getHeader('Subject') || '(Brak tematu)',
        from: getHeader('From') || '(Nieznany nadawca)',
        to: getHeader('To') || '',
        date: parsedDate || new Date(timestamp).toLocaleString(),
        timestamp,
        bodyText,
        bodyHtml,
        labelIds,
        isUnread: labelIds.includes('UNREAD'),
        isStarred: labelIds.includes('STARRED')
      } as GmailMessage;
    } catch (err) {
      console.warn(`Nie udało się pobrać szczegółów wiadomości ${item.id}:`, err);
      return null;
    }
  });

  const resolved = await Promise.all(detailsPromises);
  const messages = resolved.filter((m): m is GmailMessage => m !== null);

  return {
    messages,
    nextPageToken: listData.nextPageToken,
    resultSizeEstimate: listData.resultSizeEstimate
  };
};

/**
 * Tworzy surową treść wiadomości RFC 2822
 */
const buildRfc2822Email = (params: GmailSendParams): string => {
  const lines: string[] = [];
  lines.push(`To: ${params.to}`);
  if (params.cc) lines.push(`Cc: ${params.cc}`);
  if (params.bcc) lines.push(`Bcc: ${params.bcc}`);
  
  // Zakoduj temat jeśli zawiera znaki nie-ASCII
  const encodedSubject = `=?UTF-8?B?${btoa(unescape(encodeURIComponent(params.subject)))}?=`;
  lines.push(`Subject: ${encodedSubject}`);

  if (params.inReplyTo) {
    lines.push(`In-Reply-To: ${params.inReplyTo}`);
  }
  if (params.references) {
    lines.push(`References: ${params.references}`);
  }

  lines.push('MIME-Version: 1.0');
  lines.push(params.isHtml ? 'Content-Type: text/html; charset=UTF-8' : 'Content-Type: text/plain; charset=UTF-8');
  lines.push('Content-Transfer-Encoding: 7bit');
  lines.push('');
  lines.push(params.body);

  return lines.join('\r\n');
};

/**
 * Wysyła wiadomość email przez Gmail API
 */
export const sendGmailMessage = async (params: GmailSendParams): Promise<{ id: string; threadId: string }> => {
  const rawEmail = buildRfc2822Email(params);
  const rawBase64Url = encodeBase64Url(rawEmail);

  const payload: any = {
    raw: rawBase64Url
  };

  if (params.threadId) {
    payload.threadId = params.threadId;
  }

  return await gmailFetch('/messages/send', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
};

/**
 * Tworzy wersję roboczą (Draft) w Gmail
 */
export const createGmailDraft = async (params: GmailSendParams): Promise<{ id: string; message: any }> => {
  const rawEmail = buildRfc2822Email(params);
  const rawBase64Url = encodeBase64Url(rawEmail);

  const payload: any = {
    message: {
      raw: rawBase64Url
    }
  };

  if (params.threadId) {
    payload.message.threadId = params.threadId;
  }

  return await gmailFetch('/drafts', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
};

/**
 * Oznacza wiadomość jako przeczytaną
 */
export const markGmailMessageAsRead = async (messageId: string): Promise<void> => {
  await gmailFetch(`/messages/${messageId}/modify`, {
    method: 'POST',
    body: JSON.stringify({
      removeLabelIds: ['UNREAD']
    })
  });
};

/**
 * Przełącza gwiazdkę (STARRED)
 */
export const toggleGmailStarred = async (messageId: string, isStarred: boolean): Promise<void> => {
  await gmailFetch(`/messages/${messageId}/modify`, {
    method: 'POST',
    body: JSON.stringify({
      addLabelIds: isStarred ? ['STARRED'] : [],
      removeLabelIds: isStarred ? [] : ['STARRED']
    })
  });
};

/**
 * Przenosi wiadomość do kosza (TRASH)
 */
export const trashGmailMessage = async (messageId: string): Promise<void> => {
  await gmailFetch(`/messages/${messageId}/trash`, {
    method: 'POST'
  });
};

/**
 * AI: Wyciąga słownictwo, kolokacje i frazy biznesowe z treści otrzymanego maila
 */
export const extractVocabularyFromEmail = async ({
  emailSubject,
  emailBody,
  targetLevel = 'B2'
}: {
  emailSubject: string;
  emailBody: string;
  targetLevel?: string;
}): Promise<ExtractedEmailVocab[]> => {
  const prompt = `Jesteś ekspertem dydaktyki języka angielskiego (CELTA / Business English).
Przeanalizuj poniższą prawdziwą wiadomość e-mail z Gmaila i wyodrębnij od 4 do 8 najcenniejszych wyrażeń językowych (kolokacje biznesowe, phrasal verbs, idiomy, zwroty formalne, wzorce gramatyczne) przydatnych dla kursanta na poziomie ${targetLevel}.

Temat maila: "${emailSubject}"
Treść wiadomości:
"""
${emailBody.substring(0, 3000)}
"""

Zwróć odpowiedź WYŁĄCZNIE jako poprawny obiekt JSON (bez markdowna ani tekstu):
{
  "vocabulary": [
    {
      "term": "dokładne wyrażenie po angielsku",
      "ipa": "/wymowa transkrypcja/",
      "definition": "zwięzłe polskie tłumaczenie i znaczenie w tym kontekście",
      "contextSentence": "zdanie z maila lub naturalny przykład użycia",
      "category": "business_formal", 
      "level": "${targetLevel}"
    }
  ]
}

Dopuszczalne wartości 'category': "business_formal", "phrasal_verb", "collocation", "idiom", "grammar_pattern".`;

  const res = await generateLessonPlannerAI({
    prompt,
    systemInstruction: 'Jesteś profesjonalnym lingwistą i metodykiem Business English. Analizujesz e-maile i wyodrębniasz praktyczne słownictwo dla kursantów.',
    preferredModels: ['openai/gpt-4o-mini', 'gemini-3.7-flash', 'gemini-2.5-flash']
  });

  const jsonStr = extractJSON(res.text);
  const parsed = JSON.parse(jsonStr);
  return Array.isArray(parsed.vocabulary) ? parsed.vocabulary : [];
};

/**
 * AI: Generuje profesjonalną odpowiedź na e-mail w wybranym tonie
 */
export const generateEmailReplyAI = async ({
  emailSubject,
  emailBody,
  senderName,
  tone = 'formal_business',
  instructions = '',
  targetLanguage = 'en'
}: {
  emailSubject: string;
  emailBody: string;
  senderName?: string;
  tone?: 'formal_business' | 'friendly_collegial' | 'assertive_negotiation' | 'polite_decline' | 'quick_followup';
  instructions?: string;
  targetLanguage?: string;
}): Promise<{ subject: string; body: string; polishSummary: string; keyPhrasesUsed: string[] }> => {
  const toneDescriptions: Record<string, string> = {
    formal_business: 'Formalny, profesjonalny, uprzejmy język biznesowy zgodny ze standardami UK/US Corporate',
    friendly_collegial: 'Ciepły, bezpośredni, koleżeński i kooperatywny ton zespołowy',
    assertive_negotiation: 'Asertywny, konkretny, profesjonalnie stawiający warunki i granice',
    polite_decline: 'Uprzejma odmowa z dyplomatycznym wyjaśnieniem i alternatywną propozycją',
    quick_followup: 'Krótki, precyzyjny follow-up z prośbą o status lub potwierdzenie terminu'
  };

  const prompt = `Jesteś native speakerem i ekspertem korespondencji biznesowej w języku angielskim.
Napisz profesjonalną odpowiedź na poniższy e-mail z Gmaila.

Dane otrzymanej wiadomości:
- Nadawca: ${senderName || 'Współpracownik / Klient'}
- Temat: "${emailSubject}"
- Treść otrzymana:
"""
${emailBody.substring(0, 3000)}
"""

Wymagania do odpowiedzi:
- Styl i ton: ${toneDescriptions[tone] || toneDescriptions.formal_business}
${instructions ? `- Dodatkowe instrukcje użytkownika: "${instructions}"` : ''}

Zwróć odpowiedź WYŁĄCZNIE jako poprawny JSON:
{
  "subject": "Re: ${emailSubject.replace(/^Re:\s*/i, '')}",
  "body": "Pełna treść odpowiedzi po angielsku z profesjonalnym powitaniem, akapitami i pożegnaniem",
  "polishSummary": "Krótkie (1-2 zdania) podsumowanie po polsku, co dokładnie ta odpowiedź przekazuje",
  "keyPhrasesUsed": ["lista 3-5 kluczowych zwrotów biznesowych użytych w odpowiedzi"]
}`;

  const res = await generateLessonPlannerAI({
    prompt,
    systemInstruction: 'Jesteś ekspertem profesjonalnej komunikacji e-mail po angielsku. Zawsze zwracasz czysty JSON.',
    preferredModels: ['openai/gpt-4o-mini', 'gemini-3.7-flash', 'gemini-2.5-flash']
  });

  const jsonStr = extractJSON(res.text);
  const parsed = JSON.parse(jsonStr);
  return {
    subject: parsed.subject || `Re: ${emailSubject}`,
    body: parsed.body || '',
    polishSummary: parsed.polishSummary || '',
    keyPhrasesUsed: Array.isArray(parsed.keyPhrasesUsed) ? parsed.keyPhrasesUsed : []
  };
};

/**
 * AI: Korekta językowa i analiza tonu szkicu wiadomości
 */
export const proofreadEmailDraftAI = async ({
  draftText,
  desiredTone = 'formal'
}: {
  draftText: string;
  desiredTone?: string;
}): Promise<EmailProofreadResult> => {
  const prompt = `Jesteś native speakerem języka angielskiego i audytorem korespondencji biznesowej.
Dokonaj audytu i korekty językowej poniższego szkicu wiadomości e-mail:

Szkic wiadomości:
"""
${draftText}
"""

Docelowy ton: ${desiredTone}

Zwróć odpowiedź WYŁĄCZNIE jako poprawny JSON:
{
  "improvedText": "Ulepszona, w 100% naturalna i poprawna wersja wiadomości",
  "overallScore": 85,
  "toneAssessment": "Ocena tonu (np. Naturalny i profesjonalny, ale warto doprecyzować call-to-action)",
  "corrections": [
    {
      "original": "fragment z błędem",
      "correction": "poprawiony fragment",
      "explanation": "wyjaśnienie reguły / naturalności po polsku",
      "category": "grammar"
    }
  ],
  "suggestedPhrases": [
    {
      "phrase": "alternatywny zwrot native speakera",
      "useCase": "kiedy go użyć"
    }
  ]
}`;

  const res = await generateLessonPlannerAI({
    prompt,
    systemInstruction: 'Jesteś profesjonalnym edytorem języka angielskiego. Zawsze zwracasz poprawny JSON.',
    preferredModels: ['openai/gpt-4o-mini', 'gemini-3.7-flash']
  });

  const jsonStr = extractJSON(res.text);
  const parsed = JSON.parse(jsonStr);
  return {
    improvedText: parsed.improvedText || draftText,
    overallScore: parsed.overallScore || 80,
    toneAssessment: parsed.toneAssessment || 'Poprawny tekst',
    corrections: Array.isArray(parsed.corrections) ? parsed.corrections : [],
    suggestedPhrases: Array.isArray(parsed.suggestedPhrases) ? parsed.suggestedPhrases : []
  };
};
