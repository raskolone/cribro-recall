// Global AI & API Key activity monitor service (for Admin inspection)
import { formatAIModelName } from './geminiService';

export interface AIActivityEvent {
  id: string;
  taskName: string;
  category?: 'sentence-gen' | 'evaluation' | 'flashcards' | 'test' | 'summary' | 'tts' | 'chat' | 'stats' | 'general' | 'autocomplete';
  currentModel: string;
  modelUsed?: string;
  status: 'pending' | 'retrying' | 'success' | 'error';
  statusMessage: string;
  provider?: 'OpenAI' | 'Google Gemini' | 'Google Cloud' | 'Server Proxy' | 'Native' | 'Web Speech';
  startedAt: number;
  completedAt?: number;
  durationMs?: number;
  promptSnippet?: string;
  error?: string;
  attemptHistory?: Array<{ model: string; timestamp: number; error?: string }>;
}

type ActivityListener = (events: AIActivityEvent[], activeCount: number) => void;

const STORAGE_KEY = 'cribro_admin_ai_monitor_history_v1';

class AIMonitorService {
  private events: Map<string, AIActivityEvent> = new Map();
  private listeners: Set<ActivityListener> = new Set();
  private maxHistory = 35;

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        const raw = sessionStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed: AIActivityEvent[] = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            parsed.forEach(evt => {
              // If an old event was left in pending when reloaded, mark as completed
              if (evt.status === 'pending' || evt.status === 'retrying') {
                evt.status = 'success';
                evt.completedAt = evt.completedAt || (evt.startedAt + 1200);
              }
              this.events.set(evt.id, evt);
            });
          }
        }
      } catch (e) {
        console.warn('Failed to restore AI Monitor session history:', e);
      }
    }
  }

  private saveToStorage() {
    if (typeof window === 'undefined') return;
    try {
      const list = this.getAllEvents().slice(0, this.maxHistory);
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch {}
  }

  public subscribe(listener: ActivityListener): () => void {
    this.listeners.add(listener);
    listener(this.getAllEvents(), this.getActiveCount());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const list = this.getAllEvents();
    const active = this.getActiveCount();
    this.saveToStorage();
    this.listeners.forEach(fn => {
      try {
        fn(list, active);
      } catch (err) {
        console.error('AIMonitor listener error:', err);
      }
    });
  }

  public getAllEvents(): AIActivityEvent[] {
    return Array.from(this.events.values()).sort((a, b) => b.startedAt - a.startedAt);
  }

  public getActiveCount(): number {
    let count = 0;
    for (const evt of this.events.values()) {
      if (evt.status === 'pending' || evt.status === 'retrying') count++;
    }
    return count;
  }

  public startRequest(params: {
    id?: string;
    taskName: string;
    initialModel?: string;
    category?: AIActivityEvent['category'];
    provider?: AIActivityEvent['provider'];
    promptSnippet?: string;
    statusMessage?: string;
  }): string {
    const id = params.id || `req_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const model = params.initialModel || 'openai/gpt-4o-mini';
    const provider = params.provider || (
      model.includes('tts') || model.startsWith('openai') 
        ? 'OpenAI' 
        : model.includes('Speech') 
        ? 'Native' 
        : 'Google Gemini'
    );

    const newEvent: AIActivityEvent = {
      id,
      taskName: params.taskName,
      category: params.category || 'general',
      currentModel: model,
      status: 'pending',
      statusMessage: params.statusMessage || `Odpytywanie modelu: ${formatAIModelName(model)}...`,
      provider,
      startedAt: Date.now(),
      promptSnippet: params.promptSnippet ? params.promptSnippet.slice(0, 150) : undefined,
      attemptHistory: [{ model, timestamp: Date.now() }]
    };

    // Trim old events if capacity reached
    if (this.events.size >= this.maxHistory) {
      const oldestId = Array.from(this.events.keys())[0];
      this.events.delete(oldestId);
    }

    this.events.set(id, newEvent);
    this.notify();
    return id;
  }

  public updateModelAttempt(id: string, model: string, statusMessage?: string) {
    const evt = this.events.get(id);
    if (!evt) return;

    const provider = model.includes('tts') || model.startsWith('openai')
      ? 'OpenAI'
      : model.includes('Speech') || model.includes('Browser')
      ? 'Native'
      : 'Google Gemini';

    evt.currentModel = model;
    evt.provider = provider;
    evt.status = 'retrying';
    evt.statusMessage = statusMessage || `Przełączanie na model: ${formatAIModelName(model)}...`;
    if (!evt.attemptHistory) evt.attemptHistory = [];
    evt.attemptHistory.push({ model, timestamp: Date.now() });

    this.notify();
  }

  public updateStatus(id: string, statusMessage: string) {
    const evt = this.events.get(id);
    if (!evt) return;
    evt.statusMessage = statusMessage;
    this.notify();
  }

  public completeRequest(id: string, result?: { modelUsed?: string; message?: string }) {
    const evt = this.events.get(id);
    if (!evt) return;

    const now = Date.now();
    evt.status = 'success';
    evt.completedAt = now;
    evt.durationMs = Math.max(1, now - evt.startedAt);
    if (result?.modelUsed) {
      evt.modelUsed = result.modelUsed;
      evt.currentModel = result.modelUsed;
    }
    const finalModel = evt.modelUsed || evt.currentModel;
    evt.statusMessage = result?.message || `Odpowiedź odebrana pomyślnie z ${formatAIModelName(finalModel)} (${(evt.durationMs / 1000).toFixed(1)}s)`;

    this.notify();
  }

  public failRequest(id: string, errorMsg: string) {
    const evt = this.events.get(id);
    if (!evt) return;

    const now = Date.now();
    evt.status = 'error';
    evt.completedAt = now;
    evt.durationMs = Math.max(1, now - evt.startedAt);
    evt.error = errorMsg;
    evt.statusMessage = `Błąd zapytania: ${errorMsg.slice(0, 100)}`;

    this.notify();
  }

  public clearHistory() {
    this.events.clear();
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.removeItem(STORAGE_KEY);
      } catch {}
    }
    this.notify();
  }
}

export const aiMonitor = new AIMonitorService();
