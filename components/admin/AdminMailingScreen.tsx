import React, { useState, useEffect } from 'react';
import {
  Mail,
  Send,
  CheckCircle2,
  AlertTriangle,
  Users,
  Search,
  RefreshCw,
  Eye,
  Sliders,
  Sparkles,
  Inbox,
  ArrowLeft,
  Calendar,
  ExternalLink,
  ShieldCheck,
  Check,
  X,
  FileText,
  Clock,
  Zap,
  Info,
  Edit2,
  MessageSquare,
  Trash2,
  Reply,
  CheckCheck,
  Settings,
  Key,
  Lock,
  EyeOff
} from 'lucide-react';
import { collection, query, getDocs, getDoc, doc, updateDoc, setDoc, addDoc, deleteDoc, orderBy, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../../firebase';
import { User, EmailTemplate, InboundMessage, MailingSettings } from '../../types';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { useFirebaseAdminApi } from '../../hooks/useFirebaseAdminApi';
import { formatTaskDateTime } from '../dashboard/HomeworkScreen';
import { formatPolishGreeting } from '../../utils/polishVocative';
import { buildWelcomeEmail, INSTRUCTOR_CARD_HTML } from '../../services/homeworkEmail';

interface AdminMailingScreenProps {
  onBack?: () => void;
}

const TEMPLATES: Array<{
  id: string;
  name: string;
  category: 'homework' | 'reminder' | 'feedback' | 'lesson' | 'welcome';
  subject: string;
  description: string;
  status: 'active' | 'draft';
  variables: string[];
  sampleData: Record<string, string | number>;
  renderHtml: (data: any) => string;
  renderText: (data: any) => string;
}> = [
  {
    id: 'welcome_invite',
    name: 'Wiadomość powitalna i zaproszenie do aplikacji',
    category: 'welcome',
    subject: 'Witaj w CRIBRO ENGLISH — Twoje dane logowania',
    description: 'Szablon powitalny dla nowego kursanta z wygenerowanym loginem, hasłem tymczasowym i linkiem do aplikacji.',
    status: 'active',
    variables: ['studentName', 'username', 'tempPassword', 'appUrl', 'unsubscribeUrl'],
    sampleData: {
      studentName: 'Marta',
      username: 'marta_k',
      tempPassword: 'Cribro2026!Pass',
      appUrl: 'https://app.maciej.pro',
      unsubscribeUrl: 'https://app.maciej.pro/unsubscribe?uid=demo&token=sample',
    },
    renderHtml: (data) => {
      const email = buildWelcomeEmail({
        studentName: data.studentName,
        username: String(data.username || ''),
        tempPassword: String(data.tempPassword || ''),
        appUrl: String(data.appUrl || 'https://app.maciej.pro'),
        unsubscribeUrl: String(data.unsubscribeUrl || ''),
      });
      return email.html;
    },
    renderText: (data) => {
      const email = buildWelcomeEmail({
        studentName: data.studentName,
        username: String(data.username || ''),
        tempPassword: String(data.tempPassword || ''),
        appUrl: String(data.appUrl || 'https://app.maciej.pro'),
        unsubscribeUrl: String(data.unsubscribeUrl || ''),
      });
      return email.text;
    },
  },
  {
    id: 'homework_new',
    name: 'Nowa praca domowa',
    category: 'homework',
    subject: 'Nowa praca domowa: {title}',
    description: 'Wysyłane automatycznie przez Cloud Function w chwili dodania zadania w panelu lektora.',
    status: 'active',
    variables: ['studentName', 'title', 'dueDate', 'itemCount', 'assignedBy', 'instructions', 'unsubscribeUrl'],
    sampleData: {
      studentName: 'Anna',
      title: 'Tłumaczenie zdań: Present Perfect vs Past Simple',
      dueDate: '2026-09-15',
      itemCount: 8,
      assignedBy: 'Maciej Wyrozumski',
      instructions: 'Zwróć uwagę na określenia czasu (for, since, ago) i poprawne formy nieregularne.',
      unsubscribeUrl: 'https://app.maciej.pro/unsubscribe?uid=demo&token=sample',
    },
    renderHtml: (data) => {
      const greeting = formatPolishGreeting(data.studentName);
      return `<!doctype html>
<html lang="pl">
  <body style="margin:0;padding:24px;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:540px;margin:0 auto;background:#1e293b;border-radius:16px;border:1px solid #334155;overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,0.4);">
      <tr>
        <td style="background:linear-gradient(90deg, #0d9488, #3b82f6);height:6px;font-size:0;line-height:0;">&nbsp;</td>
      </tr>
      <tr>
        <td style="padding:32px 32px 28px;">
          <div style="margin-bottom:20px;">
            <p style="margin:0;font-size:12px;letter-spacing:0.14em;font-weight:800;text-transform:uppercase;color:#0d9488;">CRIBRO ENGLISH</p>
            <span style="display:inline-block;margin-top:8px;font-size:11px;font-weight:600;background:rgba(13,148,136,0.15);color:#5eead4;border:1px solid rgba(13,148,136,0.3);padding:3px 10px;border-radius:999px;">📝 NOWA PRACA DOMOWA</span>
          </div>

          <h1 style="margin:0 0 14px;font-size:22px;line-height:1.3;color:#f1f5f9;font-weight:800;">
            ${greeting}
          </h1>

          <p style="margin:0;color:#cbd5e1;font-size:15px;line-height:1.65;">
            W systemie została dla Ciebie przypisana nowa praca domowa:
            <strong style="color:#f1f5f9;display:block;margin-top:6px;font-size:17px;font-weight:700;">${data.title}</strong>
          </p>

          ${data.instructions ? `
          <div style="margin:20px 0;background:#0f172a;border-left:3px solid #0d9488;border-radius:0 8px 8px 0;padding:14px 16px;">
            <p style="margin:0 0 6px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#0d9488;">Wskazówki lektora</p>
            <p style="margin:0;color:#cbd5e1;font-size:14px;line-height:1.6;">${data.instructions}</p>
          </div>` : ''}

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;border-top:1px solid #334155;border-bottom:1px solid #334155;">
            <tr>
              <td style="padding:10px 0;color:#94a3b8;font-size:13px;">Ćwiczenia</td>
              <td style="padding:10px 0;color:#f1f5f9;font-size:14px;font-weight:700;text-align:right;">${data.itemCount} zadań</td>
            </tr>
            <tr>
              <td style="padding:10px 0;color:#94a3b8;font-size:13px;">Termin wykonania</td>
              <td style="padding:10px 0;color:#5eead4;font-size:14px;font-weight:700;text-align:right;">${data.dueDate}</td>
            </tr>
            <tr>
              <td style="padding:10px 0;color:#94a3b8;font-size:13px;">Od</td>
              <td style="padding:10px 0;color:#f1f5f9;font-size:14px;font-weight:600;text-align:right;">${data.assignedBy}</td>
            </tr>
          </table>

          <div style="margin:26px 0 0;text-align:center;">
            <a href="https://app.maciej.pro" style="display:inline-block;background:#0d9488;background:linear-gradient(135deg, #0d9488 0%, #0f766e 100%);color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:12px;font-size:15px;font-weight:700;box-shadow:0 4px 14px rgba(13, 148, 136, 0.4);">
              Otwórz zadanie w aplikacji →
            </a>
          </div>

          ${INSTRUCTOR_CARD_HTML}

          <p style="margin:20px 0 0;color:#64748b;font-size:11px;line-height:1.5;text-align:center;">
            Nie chcesz otrzymywać powiadomień?
            <a href="${data.unsubscribeUrl}" style="color:#94a3b8;text-decoration:underline;">Wypisz się z powiadomień e-mail</a>
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
    },
    renderText: (data) => {
      const greeting = formatPolishGreeting(data.studentName);
      return `${greeting}\n\nCzeka na Ciebie nowa praca domowa: „${data.title}".\n\nLiczba ćwiczeń: ${data.itemCount} zadań\nTermin: ${data.dueDate}\nOd: ${data.assignedBy}\nWskazówki: ${data.instructions}\n\nOtwórz aplikację: https://app.maciej.pro\n\nWypisz się z powiadomień: ${data.unsubscribeUrl}\n\n—\nCRIBRO ENGLISH`;
    },
  },
  {
    id: 'homework_reminder_24h',
    name: 'Przypomnienie o terminie zadania (24h)',
    category: 'reminder',
    subject: 'Przypomnienie: Jutro upływa termin pracy domowej ({title})',
    description: 'Przygotowane pod cykliczny automat Cloud Scheduler / cron sprawdzający zbliżające się terminy.',
    status: 'draft',
    variables: ['studentName', 'title', 'dueDate', 'itemCount', 'unsubscribeUrl'],
    sampleData: {
      studentName: 'Piotr',
      title: 'Business English: Słownictwo negocjacyjne',
      dueDate: 'Jutro (23:59)',
      itemCount: 10,
      unsubscribeUrl: 'https://app.maciej.pro/unsubscribe?uid=demo&token=sample',
    },
    renderHtml: (data) => {
      const greeting = formatPolishGreeting(data.studentName);
      return `<!doctype html>
<html lang="pl">
  <body style="margin:0;padding:24px;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:540px;margin:0 auto;background:#1e293b;border-radius:16px;border:1px solid #334155;overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,0.4);">
      <tr>
        <td style="background:linear-gradient(90deg, #f59e0b, #ef4444);height:6px;font-size:0;line-height:0;">&nbsp;</td>
      </tr>
      <tr>
        <td style="padding:32px 32px 28px;">
          <div style="margin-bottom:20px;">
            <p style="margin:0;font-size:12px;letter-spacing:0.14em;font-weight:800;text-transform:uppercase;color:#f59e0b;">CRIBRO ENGLISH</p>
            <span style="display:inline-block;margin-top:8px;font-size:11px;font-weight:600;background:rgba(245,158,11,0.15);color:#fcd34d;border:1px solid rgba(245,158,11,0.3);padding:3px 10px;border-radius:999px;">⏳ PRZYPOMNIENIE O TERMINIE</span>
          </div>

          <h1 style="margin:0 0 14px;font-size:22px;line-height:1.3;color:#f1f5f9;font-weight:800;">
            ${greeting}
          </h1>

          <p style="margin:0;color:#cbd5e1;font-size:15px;line-height:1.65;">
            Przypominamy o zbliżającym się terminie zadania:
            <strong style="color:#f1f5f9;display:block;margin-top:6px;font-size:17px;font-weight:700;">${data.title}</strong>
          </p>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;border-top:1px solid #334155;border-bottom:1px solid #334155;">
            <tr>
              <td style="padding:10px 0;color:#94a3b8;font-size:13px;">Termin</td>
              <td style="padding:10px 0;color:#fbbf24;font-size:15px;font-weight:800;text-align:right;">${data.dueDate}</td>
            </tr>
            <tr>
              <td style="padding:10px 0;color:#94a3b8;font-size:13px;">Liczba zadań</td>
              <td style="padding:10px 0;color:#f1f5f9;font-size:14px;font-weight:700;text-align:right;">${data.itemCount} zadań</td>
            </tr>
          </table>

          <div style="margin:26px 0 0;text-align:center;">
            <a href="https://app.maciej.pro" style="display:inline-block;background:#f59e0b;background:linear-gradient(135deg, #f59e0b 0%, #d97706 100%);color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:12px;font-size:15px;font-weight:700;box-shadow:0 4px 14px rgba(245, 158, 11, 0.4);">
              Dokończ zadanie teraz →
            </a>
          </div>

          ${INSTRUCTOR_CARD_HTML}

          <p style="margin:20px 0 0;color:#64748b;font-size:11px;line-height:1.5;text-align:center;">
            Nie chcesz otrzymywać przypomnień?
            <a href="${data.unsubscribeUrl}" style="color:#94a3b8;text-decoration:underline;">Wypisz się z powiadomień</a>
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
    },
    renderText: (data) => {
      const greeting = formatPolishGreeting(data.studentName);
      return `${greeting}\n\nPrzypominamy, że termin zadania „${data.title}" upływa: ${data.dueDate}.\n\nOtwórz aplikację: https://app.maciej.pro\n\nWypisz się z powiadomień: ${data.unsubscribeUrl}\n\n—\nCRIBRO ENGLISH`;
    },
  },
  {
    id: 'homework_graded',
    name: 'Ocena pracy domowej i feedback',
    category: 'feedback',
    subject: 'Twoja praca domowa została sprawdzona ({title})',
    description: 'Wysyłane, gdy lektor oceni przesłaną pracę domową kursanta.',
    status: 'draft',
    variables: ['studentName', 'title', 'score', 'feedback', 'unsubscribeUrl'],
    sampleData: {
      studentName: 'Marta',
      title: 'Esej: Technology Impact',
      score: '95%',
      feedback: 'Świetna robota! Bogate słownictwo i bardzo płynna struktura argumentów.',
      unsubscribeUrl: 'https://app.maciej.pro/unsubscribe?uid=demo&token=sample',
    },
    renderHtml: (data) => {
      const greeting = formatPolishGreeting(data.studentName);
      return `<!doctype html>
<html lang="pl">
  <body style="margin:0;padding:24px;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:540px;margin:0 auto;background:#1e293b;border-radius:16px;border:1px solid #334155;overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,0.4);">
      <tr>
        <td style="background:linear-gradient(90deg, #10b981, #06b6d4);height:6px;font-size:0;line-height:0;">&nbsp;</td>
      </tr>
      <tr>
        <td style="padding:32px 32px 28px;">
          <div style="margin-bottom:20px;">
            <p style="margin:0;font-size:12px;letter-spacing:0.14em;font-weight:800;text-transform:uppercase;color:#10b981;">CRIBRO ENGLISH</p>
            <span style="display:inline-block;margin-top:8px;font-size:11px;font-weight:600;background:rgba(16,185,129,0.15);color:#6ee7b7;border:1px solid rgba(16,185,129,0.3);padding:3px 10px;border-radius:999px;">🎯 WYNIK PRACY DOMOWEJ</span>
          </div>

          <h1 style="margin:0 0 14px;font-size:22px;line-height:1.3;color:#f1f5f9;font-weight:800;">
            ${greeting}
          </h1>

          <p style="margin:0;color:#cbd5e1;font-size:15px;line-height:1.65;">
            Lektor sprawdził Twoje zadanie:
            <strong style="color:#f1f5f9;display:block;margin-top:6px;font-size:17px;font-weight:700;">${data.title}</strong>
          </p>

          <div style="margin:22px 0;background:#0f172a;border:1px solid #10b981;border-radius:12px;padding:18px 20px;">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
              <span style="font-size:12px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.08em;">Wynik</span>
              <span style="font-size:20px;font-weight:800;color:#10b981;">${data.score}</span>
            </div>
            <p style="margin:8px 0 0;color:#e2e8f0;font-size:14px;line-height:1.6;">${data.feedback}</p>
          </div>

          <div style="margin:26px 0 0;text-align:center;">
            <a href="https://app.maciej.pro" style="display:inline-block;background:#10b981;background:linear-gradient(135deg, #10b981 0%, #059669 100%);color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:12px;font-size:15px;font-weight:700;box-shadow:0 4px 14px rgba(16, 185, 129, 0.4);">
              Zobacz szczegóły w aplikacji →
            </a>
          </div>

          ${INSTRUCTOR_CARD_HTML}

          <p style="margin:20px 0 0;color:#64748b;font-size:11px;line-height:1.5;text-align:center;">
            Nie chcesz otrzymywać powiadomień?
            <a href="${data.unsubscribeUrl}" style="color:#94a3b8;text-decoration:underline;">Wypisz się z powiadomień</a>
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
    },
    renderText: (data) => {
      const greeting = formatPolishGreeting(data.studentName);
      return `${greeting}\n\nTwoja praca domowa „${data.title}" została sprawdzona!\nWynik: ${data.score}\nKomentarz lektora: ${data.feedback}\n\nOtwórz aplikację: https://app.maciej.pro\n\nWypisz się z powiadomień: ${data.unsubscribeUrl}\n\n—\nCRIBRO ENGLISH`;
    },
  },
  {
    id: 'lesson_summary_vocab',
    name: 'Podsumowanie lekcji z Notion i słownictwo',
    category: 'lesson',
    subject: 'Notatki i nowe słówka z ostatniej lekcji',
    description: 'Powiadomienie generowane po zsynchronizowaniu lekcji z bazy Notion.',
    status: 'draft',
    variables: ['studentName', 'lessonTopic', 'wordCount', 'unsubscribeUrl'],
    sampleData: {
      studentName: 'Krzysztof',
      lessonTopic: 'Lekcja 14: Job Interview & Soft Skills',
      wordCount: 12,
      unsubscribeUrl: 'https://app.maciej.pro/unsubscribe?uid=demo&token=sample',
    },
    renderHtml: (data) => {
      const greeting = formatPolishGreeting(data.studentName);
      return `<!doctype html>
<html lang="pl">
  <body style="margin:0;padding:24px;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:540px;margin:0 auto;background:#1e293b;border-radius:16px;border:1px solid #334155;overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,0.4);">
      <tr>
        <td style="background:linear-gradient(90deg, #6366f1, #8b5cf6);height:6px;font-size:0;line-height:0;">&nbsp;</td>
      </tr>
      <tr>
        <td style="padding:32px 32px 28px;">
          <div style="margin-bottom:20px;">
            <p style="margin:0;font-size:12px;letter-spacing:0.14em;font-weight:800;text-transform:uppercase;color:#818cf8;">CRIBRO ENGLISH</p>
            <span style="display:inline-block;margin-top:8px;font-size:11px;font-weight:600;background:rgba(99,102,241,0.15);color:#a5b4fc;border:1px solid rgba(99,102,241,0.3);padding:3px 10px;border-radius:999px;">📚 NOWE MATERIAŁY</span>
          </div>

          <h1 style="margin:0 0 14px;font-size:22px;line-height:1.3;color:#f1f5f9;font-weight:800;">
            ${greeting}
          </h1>

          <p style="margin:0;color:#cbd5e1;font-size:15px;line-height:1.65;">
            W aplikacji czeka podsumowanie lekcji:
            <strong style="color:#f1f5f9;display:block;margin-top:6px;font-size:17px;font-weight:700;">${data.lessonTopic}</strong>
            oraz <strong>${data.wordCount} nowych słówek</strong> do powtórki w systemie fiszek.
          </p>

          <div style="margin:26px 0 0;text-align:center;">
            <a href="https://app.maciej.pro" style="display:inline-block;background:#6366f1;background:linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:12px;font-size:15px;font-weight:700;box-shadow:0 4px 14px rgba(99, 102, 241, 0.4);">
              Przejdź do powtórek →
            </a>
          </div>

          ${INSTRUCTOR_CARD_HTML}

          <p style="margin:20px 0 0;color:#64748b;font-size:11px;line-height:1.5;text-align:center;">
            Nie chcesz otrzymywać powiadomień?
            <a href="${data.unsubscribeUrl}" style="color:#94a3b8;text-decoration:underline;">Wypisz się z powiadomień</a>
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
    },
    renderText: (data) => {
      const greeting = formatPolishGreeting(data.studentName);
      return `${greeting}\n\nW aplikacji czeka podsumowanie lekcji „${data.lessonTopic}" oraz ${data.wordCount} nowych słówek do powtórki.\n\nOtwórz aplikację: https://app.maciej.pro\n\nWypisz się z powiadomień: ${data.unsubscribeUrl}\n\n—\nCRIBRO ENGLISH`;
    },
  },
];

export const AdminMailingScreen: React.FC<AdminMailingScreenProps> = ({ onBack }) => {
  const { language } = useLanguage();
  const { user: currentUser } = useAuth();

  const [activeTab, setActiveTab] = useState<'templates' | 'settings' | 'inbound' | 'students' | 'automation'>('templates');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('homework_new');
  const [previewMode, setPreviewMode] = useState<'html' | 'text'>('html');

  // Mailbox & sending settings
  const [settings, setSettings] = useState<MailingSettings>({
    senderName: 'Maciej Wyrozumski - CRIBRO ENGLISH',
    senderEmail: 'wyrozumski@maciej.pro',
    replyToEmail: 'wyrozumski@maciej.pro',
    enableBccSender: true,
    bccEmail: 'wyrozumski@maciej.pro',
    emailSignature: 'Pozdrawiam serdecznie,\nMaciej Wyrozumski\nCRIBRO ENGLISH',
    enableHomeworkAssigned: true,
    enableHomeworkReviewed: true,
    enableDueDateReminder: true,
    reminderHoursBefore: 24,
    enableNotionSyncNotice: true,
    customTemplates: {},
  });
  const [isLoadingSettings, setIsLoadingSettings] = useState<boolean>(true);
  const [isSavingSettings, setIsSavingSettings] = useState<boolean>(false);
  const [settingsSavedSuccess, setSettingsSavedSuccess] = useState<boolean>(false);

  // Inbound messages (monitoring skrzynki odbiorczej)
  const [inboundMessages, setInboundMessages] = useState<InboundMessage[]>([]);
  const [isLoadingInbound, setIsLoadingInbound] = useState<boolean>(true);
  const [selectedInboundMsg, setSelectedInboundMsg] = useState<InboundMessage | null>(null);
  const [inboundSearch, setInboundSearch] = useState<string>('');
  const [inboundFilter, setInboundFilter] = useState<'all' | 'unread' | 'read'>('all');
  const [isSimulatingInbound, setIsSimulatingInbound] = useState<boolean>(false);

  // Test sending state
  const defaultOwnerEmail = (currentUser?.email && !currentUser.email.includes('@student.') && currentUser.email.includes('@'))
    ? currentUser.email
    : 'wyrozumski@maciej.pro';

  const [testRecipient, setTestRecipient] = useState<string>(currentUser?.email || '');
  const [testSenderEmail, setTestSenderEmail] = useState<string>('wyrozumski@maciej.pro');
  const [enableBcc, setEnableBcc] = useState<boolean>(true);
  const [bccRecipient, setBccRecipient] = useState<string>(defaultOwnerEmail);
  const [isSendingTest, setIsSendingTest] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Students list state
  const [students, setStudents] = useState<User[]>([]);
  const [isLoadingStudents, setIsLoadingStudents] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'enabled' | 'unsubscribed' | 'placeholder'>('all');
  const [updatingStudentId, setUpdatingStudentId] = useState<string | null>(null);

  // Quick edit email modal state
  const { changeUserEmail } = useFirebaseAdminApi();
  const [editingStudent, setEditingStudent] = useState<User | null>(null);
  const [editEmailInput, setEditEmailInput] = useState<string>('');
  const [isSavingEmail, setIsSavingEmail] = useState<boolean>(false);
  const [editEmailError, setEditEmailError] = useState<string>('');

  const selectedTemplate = TEMPLATES.find((t) => t.id === selectedTemplateId) || TEMPLATES[0];

  // Resend API key status (managed in Admin Settings)
  const [serverKeyStatus, setServerKeyStatus] = useState<{
    configured: boolean;
    hasEnvKey?: boolean;
    hasDbKey?: boolean;
    maskedKey?: string | null;
    fromAddress?: string;
  }>({ configured: false });

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
        if (data.bccEmail) setBccRecipient(data.bccEmail);
        if (typeof data.enableBccSender === 'boolean') setEnableBcc(data.enableBccSender);
      }
    } catch (e) {
      console.warn('Nie udało się sprawdzić statusu klucza poczty:', e);
    }
  };

  const fetchSettings = async () => {
    setIsLoadingSettings(true);
    try {
      const snap = await getDoc(doc(db, 'system', 'mailing'));
      if (snap.exists()) {
        const d = snap.data() as MailingSettings;
        setSettings((prev) => ({ ...prev, ...d }));
        if (d.bccEmail) setBccRecipient(d.bccEmail);
        if (typeof d.enableBccSender === 'boolean') setEnableBcc(d.enableBccSender);
      }
    } catch (err) {
      console.warn('Nie udało się pobrać konfiguracji poczty:', err);
    } finally {
      setIsLoadingSettings(false);
    }
  };

  const fetchStudents = async () => {
    setIsLoadingStudents(true);
    try {
      const q = query(collection(db, 'users'));
      const snap = await getDocs(q);
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as User))
        .filter((u) => u.username !== 'Demo User' && u.username !== 'Demo User (Offline)');

      list.sort((a, b) => (a.firstName || a.username || '').localeCompare(b.firstName || b.username || ''));
      setStudents(list);
    } catch (err) {
      console.error('Błąd pobierania listy kursantów:', err);
    } finally {
      setIsLoadingStudents(false);
    }
  };

  const fetchInboundMessagesApi = async () => {
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) return;
      const res = await fetch('/api/mailing/inbound-messages', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.ok && Array.isArray(data.messages)) {
        setInboundMessages(data.messages);
      }
    } catch (err) {
      console.warn('Nie udało się pobrać wiadomości przychodzących przez API:', err);
    }
  };

  useEffect(() => {
    fetchStudents();
    fetchSettings();
    fetchKeyStatus();

    const q = query(collection(db, 'inboundMessages'), orderBy('receivedAt', 'desc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as InboundMessage));
        setInboundMessages(list);
        setIsLoadingInbound(false);
      },
      (err) => {
        console.warn('Błąd odczytu skrzynki odbiorczej z Firestore (próba przez API):', err);
        fetchInboundMessagesApi().finally(() => setIsLoadingInbound(false));
      }
    );

    return () => unsubscribe();
  }, []);

  const handleSaveSettings = async () => {
    setIsSavingSettings(true);
    try {
      await setDoc(
        doc(db, 'system', 'mailing'),
        {
          ...settings,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
      setSettingsSavedSuccess(true);
      setTimeout(() => setSettingsSavedSuccess(false), 3000);
    } catch (err: any) {
      console.error('Błąd zapisu ustawień poczty:', err);
      alert('Nie udało się zapisać ustawień: ' + (err?.message || err));
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleToggleMessageRead = async (msg: InboundMessage) => {
    if (!msg.id) return;
    const newRead = !msg.read;
    try {
      setInboundMessages((prev) =>
        prev.map((m) => (m.id === msg.id ? { ...m, read: newRead } : m))
      );
      if (selectedInboundMsg?.id === msg.id) {
        setSelectedInboundMsg((prev) => (prev ? { ...prev, read: newRead } : null));
      }

      const token = await auth.currentUser?.getIdToken();
      if (token) {
        await fetch(`/api/mailing/inbound-messages/${msg.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ read: newRead }),
        });
      }
      updateDoc(doc(db, 'inboundMessages', msg.id), { read: newRead }).catch(() => {});
    } catch (err: any) {
      console.error('Błąd zmiany statusu odczytu wiadomości:', err);
    }
  };

  const handleDeleteInboundMessage = async (msg: InboundMessage) => {
    if (!msg.id) return;
    if (!confirm('Czy na pewno chcesz usunąć tę wiadomość z monitoringu skrzynki?')) return;
    try {
      setInboundMessages((prev) => prev.filter((m) => m.id !== msg.id));
      if (selectedInboundMsg?.id === msg.id) {
        setSelectedInboundMsg(null);
      }

      const token = await auth.currentUser?.getIdToken();
      if (token) {
        await fetch(`/api/mailing/inbound-messages/${msg.id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
      }
      deleteDoc(doc(db, 'inboundMessages', msg.id)).catch(() => {});
    } catch (err: any) {
      console.error('Błąd usuwania wiadomości:', err);
      alert('Nie udało się usunąć wiadomości: ' + (err?.message || err));
    }
  };

  const handleSimulateInbound = async () => {
    setIsSimulatingInbound(true);
    try {
      const student = students[0];
      const simName = student
        ? (student.firstName ? `${student.firstName} ${student.lastName || ''}`.trim() : student.username)
        : 'Anna Nowak';
      const simEmail =
        student?.email && !student.email.includes('@student.vocabboost.com')
          ? student.email
          : 'kursant@example.com';

      const sampleQueries = [
        'Cześć Maciej, mam pytanie do zdania z czasem Present Perfect. Dlaczego użyliśmy "since" zamiast "for"? Dziękuję za pomoc!',
        'Dzień dobry! Właśnie odesłałem nową pracę domową z tłumaczeń. Proszę o sprawdzenie w wolnej chwili.',
        'Witaj! Czy moglibyśmy na najbliższej lekcji powtórzyć czasowniki frazowe z ostatniego zestawu słówek?',
        'Dziękuję za uwagi do ostatniego zadania domowego, wszystko już rozumiem!'
      ];
      const randomText = sampleQueries[Math.floor(Math.random() * sampleQueries.length)];

      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error('Brak uprawnień administratora.');

      const res = await fetch('/api/mailing/simulate-inbound', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          fromEmail: simEmail,
          fromName: simName,
          subject: `Re: Nowa praca domowa / Pytanie od ${simName}`,
          text: randomText,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Błąd serwera podczas symulacji odpowiedzi.');
      }

      if (data.message) {
        const newMsg: InboundMessage = { id: data.id, ...data.message };
        setInboundMessages((prev) => [newMsg, ...prev.filter((m) => m.id !== data.id)]);
      }
    } catch (err: any) {
      console.error('Błąd symulacji odpowiedzi:', err);
      alert('Nie udało się zasymulować odpowiedzi: ' + (err?.message || err));
    } finally {
      setIsSimulatingInbound(false);
    }
  };

  const handleSendTestEmail = async () => {
    if (!testRecipient || !testRecipient.includes('@')) {
      setTestResult({ success: false, message: 'Podaj prawidłowy adres e-mail do wysyłki testowej.' });
      return;
    }

    setIsSendingTest(true);
    setTestResult(null);

    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error('Brak uprawnień administratora.');

      const subject = selectedTemplate.subject.replace('{title}', String(selectedTemplate.sampleData.title || 'Zadanie testowe'));
      const html = selectedTemplate.renderHtml(selectedTemplate.sampleData);
      const text = selectedTemplate.renderText(selectedTemplate.sampleData);

      const senderEmailToUse = (testSenderEmail || settings.senderEmail || 'wyrozumski@maciej.pro').trim();
      const senderNameToUse = (settings.senderName || 'Maciej Wyrozumski').trim();
      const fromAddressToUse = `${senderNameToUse} <${senderEmailToUse}>`;

      const res = await fetch('/api/mailing/test-send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          to: testRecipient.trim(),
          from: fromAddressToUse,
          subject,
          html,
          text,
          replyTo: settings.replyToEmail || senderEmailToUse,
          bcc: enableBcc && bccRecipient.trim() ? bccRecipient.trim() : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Nie udało się wysłać wiadomości testowej.');
      }

      setTestResult({
        success: true,
        message: `Wiadomość testowa wysłana na adres ${testRecipient}${enableBcc && bccRecipient.trim() ? ` (oraz kopia BCC do: ${bccRecipient.trim()})` : ''}! Identyfikator: ${data.id || 'OK'}`,
      });
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err?.message || 'Błąd wysyłki e-mail.',
      });
    } finally {
      setIsSendingTest(false);
    }
  };

  const handleToggleStudentMailing = async (student: User, disable: boolean) => {
    if (!student.id) return;
    setUpdatingStudentId(student.id);
    try {
      await updateDoc(doc(db, 'users', student.id), {
        emailNotificationsDisabled: disable,
        ...(disable ? { unsubscribedAt: new Date().toISOString() } : { unsubscribedAt: null }),
      });

      setStudents((prev) =>
        prev.map((s) =>
          s.id === student.id
            ? { ...s, emailNotificationsDisabled: disable, unsubscribedAt: disable ? new Date().toISOString() : undefined }
            : s
        )
      );
    } catch (err) {
      console.error('Błąd aktualizacji statusu kursanta:', err);
      alert('Nie udało się zapisać zmiany w bazie.');
    } finally {
      setUpdatingStudentId(null);
    }
  };

  const handleOpenEditEmail = (student: User) => {
    setEditingStudent(student);
    setEditEmailInput(student.email || '');
    setEditEmailError('');
  };

  const handleSaveStudentEmail = async () => {
    if (!editingStudent?.id) return;
    const trimmed = editEmailInput.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!trimmed || !emailRegex.test(trimmed)) {
      setEditEmailError('Wprowadź prawidłowy format adresu e-mail (np. imie.nazwisko@domena.pl).');
      return;
    }

    setIsSavingEmail(true);
    setEditEmailError('');
    try {
      await changeUserEmail(editingStudent.id, trimmed);
      setStudents((prev) =>
        prev.map((s) => (s.id === editingStudent.id ? { ...s, email: trimmed } : s))
      );
      setEditingStudent(null);
    } catch (err: any) {
      setEditEmailError(err?.message || 'Nie udało się zaktualizować adresu e-mail.');
    } finally {
      setIsSavingEmail(false);
    }
  };

  // Deliverability helper
  const isSyntheticEmail = (email?: string) => {
    if (!email) return true;
    return email.includes('@student.vocabboost.com') || !email.includes('.');
  };

  const filteredStudents = students.filter((s) => {
    const matchesSearch =
      (s.firstName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.lastName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.username || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.email || '').toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (filterStatus === 'enabled') return !s.emailNotificationsDisabled && !isSyntheticEmail(s.email);
    if (filterStatus === 'unsubscribed') return !!s.emailNotificationsDisabled;
    if (filterStatus === 'placeholder') return isSyntheticEmail(s.email);
    return true;
  });

  const countEnabled = students.filter((s) => !s.emailNotificationsDisabled && !isSyntheticEmail(s.email)).length;
  const countUnsubscribed = students.filter((s) => !!s.emailNotificationsDisabled).length;
  const countPlaceholder = students.filter((s) => isSyntheticEmail(s.email)).length;

  const unreadInboundCount = inboundMessages.filter((m) => !m.read).length;
  const readInboundCount = inboundMessages.filter((m) => !!m.read).length;

  const filteredInboundMessages = inboundMessages.filter((msg) => {
    const matchesSearch =
      (msg.fromName || '').toLowerCase().includes(inboundSearch.toLowerCase()) ||
      (msg.fromEmail || '').toLowerCase().includes(inboundSearch.toLowerCase()) ||
      (msg.subject || '').toLowerCase().includes(inboundSearch.toLowerCase()) ||
      (msg.text || '').toLowerCase().includes(inboundSearch.toLowerCase()) ||
      (msg.studentName || '').toLowerCase().includes(inboundSearch.toLowerCase());

    if (!matchesSearch) return false;
    if (inboundFilter === 'unread') return !msg.read;
    if (inboundFilter === 'read') return !!msg.read;
    return true;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2.5 rounded-xl bg-ink/72 hover:bg-white/10 text-content-muted hover:text-white border border-white/10 transition-colors"
              title="Wróć do panelu"
            >
              <ArrowLeft size={18} />
            </button>
          )}
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-white flex items-center gap-2.5">
              <Mail className="w-7 h-7 text-primary" />
              Mailing
              <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30 uppercase">
                Resend API
              </span>
            </h1>
            <p className="text-xs text-content-muted mt-1">
              Konfiguracja szablonów wiadomości, wysyłka testowa, zarządzanie rezygnacjami kursantów i automatyzacja Notion.
            </p>
          </div>
        </div>

        {/* Sender Gateway Status pill */}
        <div className="flex items-center gap-3 bg-ink/72 border border-white/10 px-4 py-2 rounded-2xl shrink-0">
          <div className="flex h-3 w-3 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
          </div>
          <div className="text-xs">
            <div className="font-bold text-white flex items-center gap-1.5">
              <span>{settings.senderEmail || 'wyrozumski@maciej.pro'}</span>
              <ShieldCheck size={14} className="text-primary" />
            </div>
            <div className="text-[11px] text-content-muted">Główny adres nadawcy</div>
          </div>
        </div>
      </div>

      {/* Quick Metrics Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="liquid-glass-tile p-4 rounded-2xl border border-white/10 flex items-center justify-between">
          <div>
            <div className="text-xs text-content-muted uppercase font-bold tracking-wider">Odbiorcy aktywni</div>
            <div className="text-2xl font-extrabold text-white mt-1">{countEnabled}</div>
            <div className="text-[11px] text-primary mt-0.5 flex items-center gap-1">
              <CheckCircle2 size={12} /> Otrzymują powiadomienia o zadaniach
            </div>
          </div>
          <div className="p-3 rounded-xl bg-primary/10 text-primary border border-primary/20">
            <Users size={22} />
          </div>
        </div>

        <div className="liquid-glass-tile p-4 rounded-2xl border border-white/10 flex items-center justify-between">
          <div>
            <div className="text-xs text-content-muted uppercase font-bold tracking-wider">Wypisani (Opt-out)</div>
            <div className="text-2xl font-extrabold text-white mt-1">{countUnsubscribed}</div>
            <div className="text-[11px] text-content-muted mt-0.5">
              Wyłączone powiadomienia (brak spamu)
            </div>
          </div>
          <div className="p-3 rounded-xl bg-danger/10 text-danger border border-danger/20">
            <X size={22} />
          </div>
        </div>

        <div className="liquid-glass-tile p-4 rounded-2xl border border-white/10 flex items-center justify-between">
          <div>
            <div className="text-xs text-content-muted uppercase font-bold tracking-wider">Adresy zastępcze</div>
            <div className="text-2xl font-extrabold text-warn mt-1">{countPlaceholder}</div>
            <div className="text-[11px] text-warn/80 mt-0.5">
              @student.vocabboost.com (wymaga e-maila)
            </div>
          </div>
          <div className="p-3 rounded-xl bg-warn/10 text-warn border border-warn/20">
            <AlertTriangle size={22} />
          </div>
        </div>
      </div>

      {/* Sub Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('templates')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 ${
            activeTab === 'templates'
              ? 'bg-primary text-accent-ink shadow-btn'
              : 'text-content-muted hover:text-white hover:bg-white/5'
          }`}
        >
          <FileText size={16} />
          Szablony wiadomości ({TEMPLATES.length})
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 ${
            activeTab === 'settings'
              ? 'bg-primary text-accent-ink shadow-btn'
              : 'text-content-muted hover:text-white hover:bg-white/5'
          }`}
        >
          <Settings size={16} />
          Ustawienia skrzynki i wysyłki
        </button>

        <button
          onClick={() => setActiveTab('inbound')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 ${
            activeTab === 'inbound'
              ? 'bg-primary text-accent-ink shadow-btn'
              : 'text-content-muted hover:text-white hover:bg-white/5'
          }`}
        >
          <Inbox size={16} />
          Skrzynka & Monitoring
          {unreadInboundCount > 0 ? (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-primary text-accent-ink font-bold animate-pulse">
              {unreadInboundCount} nowe
            </span>
          ) : (
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/10 text-content-muted">
              {inboundMessages.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('students')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 ${
            activeTab === 'students'
              ? 'bg-primary text-accent-ink shadow-btn'
              : 'text-content-muted hover:text-white hover:bg-white/5'
          }`}
        >
          <Users size={16} />
          Status kursantów ({students.length})
        </button>

        <button
          onClick={() => setActiveTab('automation')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 ${
            activeTab === 'automation'
              ? 'bg-primary text-accent-ink shadow-btn'
              : 'text-content-muted hover:text-white hover:bg-white/5'
          }`}
        >
          <Zap size={16} />
          Automatyzacja & Notion
        </button>
      </div>

      {/* TAB 1: TEMPLATES */}
      {activeTab === 'templates' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Template List */}
          <div className="lg:col-span-4 space-y-3">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-content-muted">
              Wybierz szablon e-mail
            </h3>

            {TEMPLATES.map((tpl) => {
              const isSelected = tpl.id === selectedTemplateId;
              return (
                <div
                  key={tpl.id}
                  onClick={() => setSelectedTemplateId(tpl.id)}
                  className={`p-4 rounded-2xl cursor-pointer transition-all border ${
                    isSelected
                      ? 'border-primary/80 bg-ink-2 shadow-[0_0_20px_rgba(114,240,180,0.15)] ring-1 ring-primary/40'
                      : 'border-white/10 bg-base-200/50 hover:bg-white/5 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-white flex items-center gap-2">
                      {tpl.name}
                    </span>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-full border uppercase font-bold ${
                        tpl.status === 'active'
                          ? 'bg-primary/20 text-primary border-primary/40'
                          : 'bg-white/5 text-content-muted border-white/10'
                      }`}
                    >
                      {tpl.status === 'active' ? 'Aktywny' : 'Draft'}
                    </span>
                  </div>
                  <p className="text-xs text-content-muted mt-1.5 line-clamp-2 leading-relaxed">
                    {tpl.description}
                  </p>
                </div>
              );
            })}

            {/* Test Send Box */}
            <Card className="mt-6 border border-primary/30 bg-primary/5">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Send size={15} className="text-primary" />
                  Wyślij podgląd testowy (Resend)
                </h4>
                {serverKeyStatus.configured ? (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/40 font-mono font-semibold flex items-center gap-1">
                    <CheckCircle2 size={11} />
                    {serverKeyStatus.maskedKey || 'Aktywny'}
                  </span>
                ) : (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold flex items-center gap-1">
                    <AlertTriangle size={11} />
                    Brak klucza API
                  </span>
                )}
              </div>

              <p className="text-xs text-content-muted mb-3">
                Wysyła prawdziwą wiadomość testową wybranego szablonu z Twojego własnego adresu lektora.
              </p>

              <div className="space-y-3">
                {/* Resend API key alert if not configured */}
                {!serverKeyStatus.configured && (
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
                    <AlertTriangle size={15} className="shrink-0 text-amber-400" />
                    <span>
                      Klucz Resend API nie jest skonfigurowany. Przejdź do <strong>Ustawień</strong>, aby go wprowadzić.
                    </span>
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[11px] font-bold text-content-muted uppercase">
                      Adres nadawcy (Z adresu)
                    </label>
                    <span className="text-[10px] text-primary font-medium">Brak Gmaila</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 mb-2">
                    <button
                      type="button"
                      onClick={() => setTestSenderEmail('wyrozumski@maciej.pro')}
                      className={`px-2 py-1.5 rounded-lg text-[11px] font-medium border text-left truncate transition-colors ${
                        testSenderEmail === 'wyrozumski@maciej.pro'
                          ? 'bg-primary/20 border-primary text-primary font-bold'
                          : 'bg-white/5 border-white/10 text-content-muted hover:text-white'
                      }`}
                      title="wyrozumski@maciej.pro"
                    >
                      wyrozumski@maciej.pro
                    </button>
                    <button
                      type="button"
                      onClick={() => setTestSenderEmail('maciej@learnwithmaciej.com')}
                      className={`px-2 py-1.5 rounded-lg text-[11px] font-medium border text-left truncate transition-colors ${
                        testSenderEmail === 'maciej@learnwithmaciej.com'
                          ? 'bg-primary/20 border-primary text-primary font-bold'
                          : 'bg-white/5 border-white/10 text-content-muted hover:text-white'
                      }`}
                      title="maciej@learnwithmaciej.com"
                    >
                      maciej@learnwithmaciej.com
                    </button>
                  </div>
                  <input
                    type="email"
                    value={testSenderEmail}
                    onChange={(e) => setTestSenderEmail(e.target.value)}
                    placeholder="wyrozumski@maciej.pro"
                    className="w-full px-3.5 py-2 rounded-xl bg-black/40 border border-white/15 text-white text-xs font-mono focus:outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-content-muted block mb-1 uppercase">
                    Adres docelowy (Odbiorca wiadomości)
                  </label>
                  <input
                    type="email"
                    value={testRecipient}
                    onChange={(e) => setTestRecipient(e.target.value)}
                    placeholder="twoj-email@domena.pl lub kursant@gmail.com"
                    className="w-full px-3.5 py-2 rounded-xl bg-black/40 border border-white/15 text-white text-xs focus:outline-none focus:border-primary"
                  />
                </div>

                {/* OPCJA UKRYTEJ KOPII / UKRYTEGO NADAWCY (BCC) */}
                <div className="p-3.5 rounded-xl bg-black/50 border border-white/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-white flex items-center gap-2 uppercase tracking-wider cursor-pointer">
                      <input
                        type="checkbox"
                        checked={enableBcc}
                        onChange={(e) => setEnableBcc(e.target.checked)}
                        className="rounded text-primary focus:ring-0 focus:ring-offset-0 bg-ink-2 border-white/20"
                      />
                      <span>Ukryta kopia (BCC) dla Ciebie</span>
                    </label>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold font-mono ${
                      enableBcc ? 'bg-primary/20 text-primary border border-primary/30' : 'bg-white/5 text-content-muted'
                    }`}>
                      {enableBcc ? 'BCC aktywne' : 'Brak BCC'}
                    </span>
                  </div>

                  {enableBcc && (
                    <div className="space-y-1.5 pt-1">
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={() => setBccRecipient('wyrozumski@maciej.pro')}
                          className={`px-2 py-0.5 rounded-lg text-[10px] font-mono border transition-colors cursor-pointer ${
                            bccRecipient === 'wyrozumski@maciej.pro'
                              ? 'bg-primary/20 border-primary text-primary font-bold'
                              : 'bg-white/5 border-white/10 text-content-muted hover:text-white'
                          }`}
                        >
                          wyrozumski@maciej.pro
                        </button>
                        <button
                          type="button"
                          onClick={() => setBccRecipient('maciej@learnwithmaciej.com')}
                          className={`px-2 py-0.5 rounded-lg text-[10px] font-mono border transition-colors cursor-pointer ${
                            bccRecipient === 'maciej@learnwithmaciej.com'
                              ? 'bg-primary/20 border-primary text-primary font-bold'
                              : 'bg-white/5 border-white/10 text-content-muted hover:text-white'
                          }`}
                        >
                          maciej@learnwithmaciej.com
                        </button>
                      </div>
                      <input
                        type="email"
                        value={bccRecipient}
                        onChange={(e) => setBccRecipient(e.target.value)}
                        placeholder="wyrozumski@maciej.pro"
                        className="w-full px-3 py-1.5 rounded-xl bg-black/40 border border-white/15 text-white text-xs font-mono focus:outline-none focus:border-primary"
                      />
                      <p className="text-[10px] text-content-muted leading-relaxed">
                        Kopia każdej wysłanej wiadomości trafi na Twój e-mail, abyś mógł bezpośrednio zweryfikować czy wiadomości wychodzą.
                      </p>
                    </div>
                  )}
                </div>

                <Button
                  onClick={handleSendTestEmail}
                  isLoading={isSendingTest}
                  disabled={!testRecipient || !serverKeyStatus.configured}
                  className="w-full text-xs font-bold py-2.5 cursor-pointer"
                >
                  <Send size={14} />
                  {enableBcc ? 'Wyślij wiadomość z ukrytą kopią (BCC)' : 'Wyślij wiadomość'}
                </Button>

                {testResult && (
                  <div
                    className={`p-3 rounded-xl text-xs font-semibold flex items-start gap-2 ${
                      testResult.success
                        ? 'bg-primary/20 border border-primary/40 text-primary'
                        : 'bg-danger/20 border border-danger/40 text-danger'
                    }`}
                  >
                    {testResult.success ? <CheckCircle2 size={16} className="shrink-0 mt-0.5" /> : <AlertTriangle size={16} className="shrink-0 mt-0.5" />}
                    <span>{testResult.message}</span>
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* Right Column: Template Preview & Details */}
          <div className="lg:col-span-8 space-y-4">
            <Card className="border border-white/10">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-white/10">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-white">{selectedTemplate.name}</h3>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-full border uppercase font-bold ${
                        selectedTemplate.status === 'active'
                          ? 'bg-primary/20 text-primary border-primary/40'
                          : 'bg-white/5 text-content-muted border-white/10'
                      }`}
                    >
                      {selectedTemplate.status === 'active' ? 'Aktywny produkcyjnie' : 'Projekt (Draft)'}
                    </span>
                  </div>
                  <p className="text-xs text-content-muted mt-1 font-mono">
                    Temat: <span className="text-white">{selectedTemplate.subject}</span>
                  </p>
                </div>

                {/* Switch between HTML and Text */}
                <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/10">
                  <button
                    onClick={() => setPreviewMode('html')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      previewMode === 'html'
                        ? 'bg-primary text-accent-ink'
                        : 'text-content-muted hover:text-white'
                    }`}
                  >
                    Podgląd HTML
                  </button>
                  <button
                    onClick={() => setPreviewMode('text')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      previewMode === 'text'
                        ? 'bg-primary text-accent-ink'
                        : 'text-content-muted hover:text-white'
                    }`}
                  >
                    Wersja Tekstowa
                  </button>
                </div>
              </div>

              {/* Dynamic Variables Badge Row */}
              <div className="py-3 flex items-center gap-2 flex-wrap border-b border-white/5 text-xs">
                <span className="text-content-muted font-bold">Dostępne zmienne:</span>
                {selectedTemplate.variables.map((v) => (
                  <span
                    key={v}
                    className="font-mono text-[11px] px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-primary"
                  >
                    {`{${v}}`}
                  </span>
                ))}
              </div>

              {/* Live Preview Screen */}
              <div className="mt-4">
                {previewMode === 'html' ? (
                  <div className="border border-white/15 rounded-xl overflow-hidden bg-slate-100 shadow-inner">
                    <div className="bg-slate-200 border-b border-slate-300 px-4 py-2 flex items-center justify-between text-xs text-slate-700 font-mono">
                      <span>Nadawca: {settings.senderName || 'Maciej Wyrozumski'} &lt;{testSenderEmail || settings.senderEmail || 'wyrozumski@maciej.pro'}&gt;</span>
                      <span className="text-slate-500">Symulacja klienta poczty</span>
                    </div>
                    <div
                      className="p-4 overflow-auto max-h-[600px]"
                      dangerouslySetInnerHTML={{
                        __html: selectedTemplate.renderHtml(selectedTemplate.sampleData),
                      }}
                    />
                  </div>
                ) : (
                  <div className="border border-white/15 rounded-xl bg-black/60 p-4 font-mono text-xs text-white/90 whitespace-pre-wrap leading-relaxed max-h-[500px] overflow-auto">
                    {selectedTemplate.renderText(selectedTemplate.sampleData)}
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* TAB 2: STUDENTS */}
      {activeTab === 'students' && (
        <Card className="border border-white/10">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-white/10">
            <div>
              <h3 className="text-lg font-bold text-white">Preferencje i status dostarczalności kursantów</h3>
              <p className="text-xs text-content-muted mt-0.5">
                Sprawdź, kto ma włączone powiadomienia, kto zrezygnował (opt-out) oraz kto wymaga uzupełnienia prawdziwego adresu e-mail.
              </p>
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto">
              <div className="relative flex-1 md:w-64">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-content-muted" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Szukaj kursanta..."
                  className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-black/40 border border-white/15 text-white text-xs focus:outline-none focus:border-primary"
                />
              </div>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-white text-xs focus:outline-none focus:border-primary"
              >
                <option value="all">Wszyscy ({students.length})</option>
                <option value="enabled">Aktywne powiadomienia ({countEnabled})</option>
                <option value="unsubscribed">Wypisani ({countUnsubscribed})</option>
                <option value="placeholder">Do uzupełnienia maila ({countPlaceholder})</option>
              </select>

              <button
                onClick={fetchStudents}
                disabled={isLoadingStudents}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-content-muted hover:text-white border border-white/10 transition-colors"
                title="Odśwież listę"
              >
                <RefreshCw size={15} className={isLoadingStudents ? 'animate-spin text-primary' : ''} />
              </button>
            </div>
          </div>

          {/* Students Table */}
          <div className="overflow-x-auto mt-4">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-content-muted uppercase font-mono text-[11px]">
                  <th className="py-3 px-4">Kursant</th>
                  <th className="py-3 px-4">Adres e-mail</th>
                  <th className="py-3 px-4">Dostarczalność</th>
                  <th className="py-3 px-4">Powiadomienia e-mail</th>
                  <th className="py-3 px-4 text-right">Zarządzanie</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-content-muted">
                      Brak kursantów spełniających kryteria wyszukiwania.
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((s) => {
                    const hasPlaceholder = isSyntheticEmail(s.email);
                    const isUnsubscribed = Boolean(s.emailNotificationsDisabled);
                    const isUpdating = updatingStudentId === s.id;

                    return (
                      <tr key={s.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-3 px-4 font-bold text-white">
                          {s.firstName || s.lastName ? `${s.firstName || ''} ${s.lastName || ''}`.trim() : s.username}
                          <span className="text-[11px] font-normal text-content-muted ml-2">(@{s.username})</span>
                        </td>
                        <td className="py-3 px-4 font-mono text-content-muted">
                          {s.email || '—'}
                        </td>
                        <td className="py-3 px-4">
                          {hasPlaceholder ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-warn/20 text-warn border border-warn/30 font-semibold text-[11px]">
                              <AlertTriangle size={12} />
                              Adres zastępczy (pomiń)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30 font-semibold text-[11px]">
                              <CheckCircle2 size={12} />
                              Prawidłowy adres
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {isUnsubscribed ? (
                            <div className="flex flex-col">
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-danger/20 text-danger border border-danger/30 font-semibold text-[11px] w-fit">
                                <X size={12} />
                                Wypisany (brak powiadomień)
                              </span>
                              {s.unsubscribedAt && (
                                <span className="text-[10px] text-content-muted mt-0.5 font-mono">
                                  od: {s.unsubscribedAt.split('T')[0]}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/30 font-semibold text-[11px]">
                              <Check size={12} />
                              Włączone (aktywne)
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleOpenEditEmail(s)}
                              className="px-2.5 py-1 rounded-xl font-semibold text-xs border border-white/10 bg-white/5 hover:bg-white/10 text-white flex items-center gap-1.5 transition-colors cursor-pointer"
                              title="Edytuj adres e-mail kursanta"
                            >
                              <Edit2 size={12} className="text-primary" />
                              Edytuj e-mail
                            </button>
                            <button
                              onClick={() => handleToggleStudentMailing(s, !isUnsubscribed)}
                              disabled={isUpdating}
                              className={`px-3 py-1 rounded-xl font-semibold text-xs border transition-all cursor-pointer ${
                                isUnsubscribed
                                  ? 'bg-primary/20 text-primary border-primary/40 hover:bg-primary/30'
                                  : 'bg-white/5 text-content-muted border-white/10 hover:text-danger hover:border-danger/40'
                              }`}
                            >
                              {isUpdating ? (
                                <RefreshCw size={12} className="animate-spin" />
                              ) : isUnsubscribed ? (
                                'Włącz powiadomienia'
                              ) : (
                                'Wyłącz (wypisz)'
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* TAB 3: AUTOMATION & NOTION */}
      {activeTab === 'automation' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          <Card className="border border-white/10 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-primary/10 text-primary border border-primary/20">
                <RefreshCw size={24} />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Cykliczne automatyzowanie Notion Fetch</h3>
                <p className="text-xs text-content-muted">
                  Pobieranie najnowszych wpisów z historii lekcji z baz Notion bez konieczności ręcznego klikania.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-black/40 border border-white/10 space-y-2 text-xs text-content-muted">
              <div className="flex items-center justify-between text-white font-semibold">
                <span>Konfiguracja Notion API:</span>
                <span className="text-primary font-mono text-[11px]">Zsynchronizowana</span>
              </div>
              <p>
                Aplikacja posiada zaimplementowane funkcje <code>previewNotionSync</code> oraz <code>importNotionSelection</code> w Cloud Functions.
              </p>
              <div className="pt-2 border-t border-white/5 flex flex-col gap-1.5 font-mono text-[11px]">
                <div className="text-white/80">• Lessons DB: 5c6d910b-31b7-83b8-810c-0187aa513b51</div>
                <div className="text-white/80">• Students DB: ca88a293-bd34-4cc7-b09e-f6bd3901ef96</div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-2 text-xs">
              <h4 className="font-bold text-primary flex items-center gap-1.5">
                <Sparkles size={16} />
                Planowany Scheduler (Cron)
              </h4>
              <p className="text-content-muted leading-relaxed">
                Kolejnym krokiem automatyzacji będzie Cloud Scheduler (np. uruchamiany codziennie o 22:00), który automatycznie wykryje nowe lekcje z Notion i powiąże nowe słownictwo z profilami kursantów.
              </p>
            </div>
          </Card>

          <Card className="border border-white/10 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-primary/10 text-primary border border-primary/20">
                <Clock size={24} />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Automatyzacja Przypomnień (Due Date Reminders)</h3>
                <p className="text-xs text-content-muted">
                  System przypominania kursantom o zadaniach, których termin zbliża się ku końcowi.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-black/40 border border-white/10 space-y-2 text-xs text-content-muted">
              <p className="text-white font-semibold">Zasady anty-spamowe:</p>
              <ul className="space-y-1.5 list-disc pl-4 text-xs">
                <li>Przypomnienie wychodzi tylko raz na zadanie (maksymalnie 24h przed <code>dueDate</code>).</li>
                <li>Jeśli kursant już odesłał pracę, przypomnienie jest natychmiast anulowane.</li>
                <li>Jeśli kursant kliknął „Wypisz się”, system całkowicie pomija wysyłkę.</li>
              </ul>
            </div>
          </Card>
        </div>
      )}

      {/* TAB: MAILBOX & SENDING SETTINGS */}
      {activeTab === 'settings' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Settings className="w-5 h-5 text-primary" />
                Ustawienia skrzynki i wysyłanych wiadomości
              </h2>
              <p className="text-xs text-content-muted mt-1">
                Skonfiguruj dane nadawcy, adres do odpowiedzi (reply-to), stopkę lektora oraz reguły wysyłki powiadomień.
              </p>
            </div>

            <Button
              onClick={handleSaveSettings}
              isLoading={isSavingSettings}
              className="font-bold text-xs shrink-0"
            >
              <Check className="w-4 h-4 mr-1.5" />
              Zapisz konfigurację
            </Button>
          </div>

          {settingsSavedSuccess && (
            <div className="p-4 rounded-xl bg-primary/20 border border-primary/40 text-primary text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 size={16} />
              <span>Ustawienia skrzynki i wysyłki zostały pomyślnie zapisane w bazie!</span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            {/* Card 1: Sender & Identity */}
            <Card className="border border-white/10 space-y-4">
              <div className="flex items-center gap-2.5 pb-2 border-b border-white/10">
                <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20">
                  <Mail size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Identyfikacja nadawcy & Skrzynka</h3>
                  <p className="text-[11px] text-content-muted">Dane widoczne dla kursanta w programie pocztowym</p>
                </div>
              </div>

              <div className="space-y-3.5">
                {/* Resend API Key Input & Status */}
                <div className="p-3.5 rounded-xl bg-black/50 border border-white/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-white flex items-center gap-1.5 uppercase tracking-wider">
                      <Key size={14} className="text-primary" />
                      Klucz Resend API (RESEND_API_KEY)
                    </label>
                    {serverKeyStatus.configured ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/40 font-mono font-bold flex items-center gap-1">
                        <CheckCircle2 size={11} /> {serverKeyStatus.maskedKey || 'Skonfigurowany'}
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold flex items-center gap-1">
                        <AlertTriangle size={11} /> Brak klucza
                      </span>
                    )}
                  </div>

                  <p className="text-[11px] text-content-muted leading-relaxed">
                    Klucz do autoryzacji wysyłki e-maili przez API Resend jest konfigurowany w <strong>Ustawieniach konta administratora</strong>.
                  </p>
                </div>

                <div>
                  <label className="text-xs font-bold text-content-muted uppercase tracking-wider block mb-1.5">
                    Nazwa nadawcy (Sender Name)
                  </label>
                  <input
                    type="text"
                    value={settings.senderName}
                    onChange={(e) => setSettings({ ...settings, senderName: e.target.value })}
                    placeholder="np. Maciej Wyrozumski - CRIBRO ENGLISH"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/15 text-white text-xs focus:outline-none focus:border-primary"
                  />
                  <span className="text-[10px] text-content-muted mt-1 block">
                    Ta nazwa wyświetli się jako nadawca e-maila w programie pocztowym kursanta.
                  </span>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-content-muted uppercase tracking-wider">
                      Adres e-mail nadawcy (Sender Email)
                    </label>
                    <span className="text-[10px] text-primary font-bold">Brak wysyłki z Gmaila</span>
                  </div>

                  <div className="flex flex-wrap gap-2 mb-2.5">
                    <button
                      type="button"
                      onClick={() => setSettings({ ...settings, senderEmail: 'wyrozumski@maciej.pro', replyToEmail: 'wyrozumski@maciej.pro' })}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        settings.senderEmail === 'wyrozumski@maciej.pro'
                          ? 'bg-primary/20 border-primary text-primary font-bold'
                          : 'bg-white/5 border-white/10 text-content-muted hover:text-white'
                      }`}
                    >
                      wyrozumski@maciej.pro
                    </button>
                    <button
                      type="button"
                      onClick={() => setSettings({ ...settings, senderEmail: 'maciej@learnwithmaciej.com', replyToEmail: 'maciej@learnwithmaciej.com' })}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        settings.senderEmail === 'maciej@learnwithmaciej.com'
                          ? 'bg-primary/20 border-primary text-primary font-bold'
                          : 'bg-white/5 border-white/10 text-content-muted hover:text-white'
                      }`}
                    >
                      maciej@learnwithmaciej.com
                    </button>
                  </div>

                  <input
                    type="email"
                    value={settings.senderEmail}
                    onChange={(e) => setSettings({ ...settings, senderEmail: e.target.value })}
                    placeholder="wyrozumski@maciej.pro"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/15 text-white text-xs font-mono focus:outline-none focus:border-primary"
                  />
                  <span className="text-[10px] text-content-muted mt-1 block">
                    Wiadomości będą wychodzić z tego adresu z Twoim imieniem i nazwiskiem jako nadawcą.
                  </span>
                </div>

                {/* Anti-spam & Domain Verification Tip */}
                <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 space-y-1.5 text-xs">
                  <div className="flex items-center gap-1.5 font-bold text-primary">
                    <ShieldCheck size={14} />
                    <span>Dostarczalność do Odebranych (Antyspam)</span>
                  </div>
                  <p className="text-[11px] text-content-muted leading-relaxed">
                    Aby e-maile z adresu <strong>{settings.senderEmail || 'wyrozumski@maciej.pro'}</strong> nie lądowały w spamie u odbiorców (np. w Gmailu), domena musi być dodana w panelu{' '}
                    <a href="https://resend.com/domains" target="_blank" rel="noreferrer" className="text-primary underline font-semibold hover:text-white">
                      resend.com/domains
                    </a>. Resend wygeneruje rekordy DKIM (TXT), które wkleja się w strefie DNS domeny w Hostingerze.
                  </p>
                </div>

                <div>
                  <label className="text-xs font-bold text-content-muted uppercase tracking-wider block mb-1.5">
                    Adres do odpowiedzi (Reply-To Email)
                  </label>
                  <input
                    type="email"
                    value={settings.replyToEmail}
                    onChange={(e) => setSettings({ ...settings, replyToEmail: e.target.value })}
                    placeholder="wyrozumski@maciej.pro"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/15 text-white text-xs font-mono focus:outline-none focus:border-primary"
                  />
                  <span className="text-[10px] text-content-muted mt-1 block">
                    Gdy kursant kliknie „Odpowiedz” w swoim programie pocztowym, wiadomość trafi bezpośrednio na ten adres.
                  </span>
                </div>

                {/* Sekcja automatycznej ukrytej kopii (BCC) dla nadawcy */}
                <div className="p-3.5 rounded-xl bg-black/50 border border-white/10 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-white flex items-center gap-2 uppercase tracking-wider cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(settings.enableBccSender)}
                        onChange={(e) => setSettings({ ...settings, enableBccSender: e.target.checked })}
                        className="rounded text-primary focus:ring-0 focus:ring-offset-0 bg-ink-2 border-white/20"
                      />
                      <span>Automatyczna ukryta kopia (BCC) do nadawcy</span>
                    </label>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold font-mono ${
                      settings.enableBccSender ? 'bg-primary/20 text-primary border border-primary/30' : 'bg-white/5 text-content-muted'
                    }`}>
                      {settings.enableBccSender ? 'BCC aktywne' : 'BCC wyłączone'}
                    </span>
                  </div>

                  {settings.enableBccSender && (
                    <div className="space-y-2 pt-1">
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSettings({ ...settings, bccEmail: 'wyrozumski@maciej.pro' })}
                          className={`px-2.5 py-1 rounded-lg text-xs font-mono border transition-colors cursor-pointer ${
                            (settings.bccEmail || 'wyrozumski@maciej.pro') === 'wyrozumski@maciej.pro'
                              ? 'bg-primary/20 border-primary text-primary font-bold'
                              : 'bg-white/5 border-white/10 text-content-muted hover:text-white'
                          }`}
                        >
                          wyrozumski@maciej.pro
                        </button>
                        <button
                          type="button"
                          onClick={() => setSettings({ ...settings, bccEmail: 'maciej@learnwithmaciej.com' })}
                          className={`px-2.5 py-1 rounded-lg text-xs font-mono border transition-colors cursor-pointer ${
                            settings.bccEmail === 'maciej@learnwithmaciej.com'
                              ? 'bg-primary/20 border-primary text-primary font-bold'
                              : 'bg-white/5 border-white/10 text-content-muted hover:text-white'
                          }`}
                        >
                          maciej@learnwithmaciej.com
                        </button>
                      </div>

                      <input
                        type="email"
                        value={settings.bccEmail || 'wyrozumski@maciej.pro'}
                        onChange={(e) => setSettings({ ...settings, bccEmail: e.target.value })}
                        placeholder="wyrozumski@maciej.pro"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/15 text-white text-xs font-mono focus:outline-none focus:border-primary"
                      />
                      <span className="text-[10px] text-content-muted mt-1 block leading-relaxed">
                        Każda wychodząca wiadomość e-mail z platformy (zadania domowe, powiadomienia, testy) otrzyma ukrytą kopię na ten adres, abyś mógł bezpośrednio w skrzynce sprawdzać czy wiadomości wychodzą.
                      </span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-xs font-bold text-content-muted uppercase tracking-wider block mb-1.5">
                    Stopka wiadomości / Podpis lektora
                  </label>
                  <textarea
                    rows={4}
                    value={settings.emailSignature || ''}
                    onChange={(e) => setSettings({ ...settings, emailSignature: e.target.value })}
                    placeholder="Pozdrawiam serdecznie,&#10;Maciej Wyrozumski&#10;CRIBRO ENGLISH"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/15 text-white text-xs focus:outline-none focus:border-primary resize-y font-sans"
                  />
                  <span className="text-[10px] text-content-muted mt-1 block">
                    Dołączana automatycznie na dole każdego generowanego powiadomienia i szablonu.
                  </span>
                </div>
              </div>
            </Card>

            {/* Card 2: Notification triggers */}
            <Card className="border border-white/10 space-y-4">
              <div className="flex items-center gap-2.5 pb-2 border-b border-white/10">
                <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20">
                  <Sliders size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Wyzwalacze powiadomień (Triggery)</h3>
                  <p className="text-[11px] text-content-muted">Wybierz, w jakich sytuacjach system ma wysyłać wiadomości</p>
                </div>
              </div>

              <div className="space-y-3">
                <label className="flex items-start gap-3 p-3 rounded-xl bg-black/30 border border-white/10 cursor-pointer hover:border-white/20 transition-all">
                  <input
                    type="checkbox"
                    checked={settings.enableHomeworkAssigned}
                    onChange={(e) => setSettings({ ...settings, enableHomeworkAssigned: e.target.checked })}
                    className="mt-1 rounded text-primary focus:ring-0 focus:ring-offset-0 bg-ink-2 border-white/20"
                  />
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-white block">Nowa praca domowa (Homework Assigned)</span>
                    <span className="text-[11px] text-content-muted block">
                      Wysyła e-mail do kursanta natychmiast po przypisaniu nowego zadania domowego przez lektora.
                    </span>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3 rounded-xl bg-black/30 border border-white/10 cursor-pointer hover:border-white/20 transition-all">
                  <input
                    type="checkbox"
                    checked={settings.enableHomeworkReviewed}
                    onChange={(e) => setSettings({ ...settings, enableHomeworkReviewed: e.target.checked })}
                    className="mt-1 rounded text-primary focus:ring-0 focus:ring-offset-0 bg-ink-2 border-white/20"
                  />
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-white block">Sprawdzenie pracy domowej (Homework Reviewed)</span>
                    <span className="text-[11px] text-content-muted block">
                      Wysyła e-mail z podsumowaniem i komentarzem, gdy lektor sprawdzi nadesłaną pracę.
                    </span>
                  </div>
                </label>

                <div className="p-3 rounded-xl bg-black/30 border border-white/10 space-y-2">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.enableDueDateReminder}
                      onChange={(e) => setSettings({ ...settings, enableDueDateReminder: e.target.checked })}
                      className="mt-1 rounded text-primary focus:ring-0 focus:ring-offset-0 bg-ink-2 border-white/20"
                    />
                    <div className="space-y-0.5">
                      <span className="text-xs font-bold text-white block flex items-center gap-2">
                        Przypomnienie przed terminem (Due Date Reminder)
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-warn bg-warn/10 border border-warn/30 rounded-full px-2 py-0.5">
                          Wkrótce
                        </span>
                      </span>
                      <span className="text-[11px] text-content-muted block">
                        Automatyczne przypomnienie o zbliżającym się deadline na oddanie pracy —
                        przełącznik jest przygotowany, ale mechanizm (harmonogram) jeszcze nie
                        działa. Włączenie go tutaj na razie nic nie wysyła.
                      </span>
                    </div>
                  </label>

                  {settings.enableDueDateReminder && (
                    <div className="pt-2 pl-7 flex items-center gap-3">
                      <span className="text-[11px] font-semibold text-content-muted">Wyprzedzenie przypomnienia:</span>
                      <select
                        value={settings.reminderHoursBefore || 24}
                        onChange={(e) => setSettings({ ...settings, reminderHoursBefore: Number(e.target.value) })}
                        className="px-2.5 py-1.5 rounded-lg bg-ink-2 border border-white/15 text-white text-xs focus:outline-none focus:border-primary"
                      >
                        <option value={12}>12 godzin przed terminem</option>
                        <option value={24}>24 godziny przed terminem</option>
                        <option value={48}>48 godzin przed terminem</option>
                      </select>
                    </div>
                  )}
                </div>

                <label className="flex items-start gap-3 p-3 rounded-xl bg-black/30 border border-white/10 cursor-pointer hover:border-white/20 transition-all">
                  <input
                    type="checkbox"
                    checked={settings.enableNotionSyncNotice}
                    onChange={(e) => setSettings({ ...settings, enableNotionSyncNotice: e.target.checked })}
                    className="mt-1 rounded text-primary focus:ring-0 focus:ring-offset-0 bg-ink-2 border-white/20"
                  />
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-white block">Nowe materiały z lekcji (Notion Sync Notice)</span>
                    <span className="text-[11px] text-content-muted block">
                      Powiadomienie o dodaniu nowych zestawów słownictwa po zsynchronizowaniu historii lekcji z Notion.
                    </span>
                  </div>
                </label>
              </div>

              <div className="pt-2">
                <Button
                  onClick={handleSaveSettings}
                  isLoading={isSavingSettings}
                  className="w-full font-bold text-xs py-2.5"
                >
                  <Check className="w-4 h-4 mr-1.5" />
                  Zapisz wszystkie ustawienia poczty
                </Button>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* TAB: INBOUND MESSAGES & MONITORING */}
      {activeTab === 'inbound' && (
        <div className="space-y-6">
          {/* Header & Stats Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Inbox className="w-5 h-5 text-primary" />
                Monitoring skrzynki odbiorczej (Odpowiedzi kursantów)
                {unreadInboundCount > 0 && (
                  <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-primary text-accent-ink font-bold animate-pulse">
                    {unreadInboundCount} nowe
                  </span>
                )}
              </h2>
              <p className="text-xs text-content-muted mt-1">
                Odpowiedzi i wiadomości przesyłane przez kursantów na e-mail z powiadomieniem, rejestrowane w czasie rzeczywistym.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="secondary"
                onClick={handleSimulateInbound}
                isLoading={isSimulatingInbound}
                className="text-xs font-bold"
                title="Wstawia przykładową wiadomość od kursanta do celów testowych"
              >
                <Sparkles size={14} className="text-primary mr-1" />
                Symuluj odpowiedź kursanta (Test)
              </Button>
            </div>
          </div>

          {/* Resend Inbound Webhook Info Banner */}
          <div className="p-4 rounded-2xl bg-ink/70 border border-white/10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0">
                <Zap size={20} />
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white">Resend Inbound Webhook</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30 uppercase font-bold">
                    Nasłuch aktywny
                  </span>
                </div>
                <div className="text-[11px] text-content-muted font-mono break-all">
                  Endpoint: <span className="text-white/90">https://app.maciej.pro/api/mailing/inbound-webhook</span>
                </div>
              </div>
            </div>
            <div className="text-[11px] text-content-muted shrink-0">
              Wiadomości przychodzące są automatycznie wiązane z profilami kursantów na podstawie adresu e-mail.
            </div>
          </div>

          {/* Filter Bar & Search */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 p-1 bg-black/30 border border-white/10 rounded-xl w-fit">
              <button
                onClick={() => setInboundFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  inboundFilter === 'all'
                    ? 'bg-primary text-accent-ink shadow-btn'
                    : 'text-content-muted hover:text-white'
                }`}
              >
                Wszystkie ({inboundMessages.length})
              </button>
              <button
                onClick={() => setInboundFilter('unread')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  inboundFilter === 'unread'
                    ? 'bg-primary text-accent-ink shadow-btn'
                    : 'text-content-muted hover:text-white'
                }`}
              >
                Nieprzeczytane ({unreadInboundCount})
              </button>
              <button
                onClick={() => setInboundFilter('read')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  inboundFilter === 'read'
                    ? 'bg-primary text-accent-ink shadow-btn'
                    : 'text-content-muted hover:text-white'
                }`}
              >
                Przeczytane ({readInboundCount})
              </button>
            </div>

            <div className="relative w-full sm:w-72">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-content-muted" />
              <input
                type="text"
                value={inboundSearch}
                onChange={(e) => setInboundSearch(e.target.value)}
                placeholder="Szukaj w wiadomościach..."
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-black/40 border border-white/15 text-white text-xs focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          {/* Inbound Messages List */}
          {isLoadingInbound ? (
            <div className="text-center py-12 text-content-muted text-xs flex items-center justify-center gap-2">
              <RefreshCw size={16} className="animate-spin text-primary" />
              Ładowanie skrzynki odbiorczej...
            </div>
          ) : filteredInboundMessages.length === 0 ? (
            <Card className="border border-white/10 py-12 text-center max-w-xl mx-auto space-y-3">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/5 text-content-muted border border-white/10">
                <Inbox size={28} />
              </div>
              <h3 className="text-base font-bold text-white">Brak wiadomości w skrzynce</h3>
              <p className="text-xs text-content-muted max-w-sm mx-auto">
                {inboundSearch
                  ? 'Brak wiadomości pasujących do wpisanej frazy wyszukiwania.'
                  : inboundFilter === 'unread'
                  ? 'Nie masz żadnych nieprzeczytanych wiadomości od kursantów!'
                  : 'Gdy kursant odpowie na powiadomienie e-mail, jego wiadomość pojawi się tutaj automatycznie.'}
              </p>
              <div className="pt-2">
                <Button
                  variant="secondary"
                  onClick={handleSimulateInbound}
                  isLoading={isSimulatingInbound}
                  className="text-xs"
                >
                  <Sparkles size={14} className="text-primary mr-1.5" />
                  Przetestuj dodanie wiadomości
                </Button>
              </div>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredInboundMessages.map((msg) => {
                const isUnread = !msg.read;
                return (
                  <div
                    key={msg.id}
                    className={`p-4 rounded-2xl border transition-all ${
                      isUnread
                        ? 'border-primary/40 bg-ink-2 shadow-[0_0_15px_rgba(114,240,180,0.08)] ring-1 ring-primary/20'
                        : 'border-white/10 bg-base-200/40 hover:bg-white/5 hover:border-white/20'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-white/5">
                      <div className="flex items-center gap-2.5">
                        {isUnread ? (
                          <span className="w-2.5 h-2.5 rounded-full bg-primary shrink-0 animate-pulse" title="Nieprzeczytana" />
                        ) : (
                          <span className="w-2.5 h-2.5 rounded-full bg-white/20 shrink-0" title="Przeczytana" />
                        )}
                        <span className="font-bold text-sm text-white flex items-center gap-2">
                          {msg.fromName || msg.fromEmail}
                          {msg.studentName && (
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30 uppercase font-bold">
                              Kursant: {msg.studentName}
                            </span>
                          )}
                        </span>
                        <span className="text-xs text-content-muted font-mono hidden md:inline">
                          &lt;{msg.fromEmail}&gt;
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-content-muted shrink-0">
                        <Clock size={12} className="text-primary" />
                        <span>{formatTaskDateTime(msg.receivedAt)}</span>
                      </div>
                    </div>

                    {/* Subject & Preview Snippet */}
                    <div
                      onClick={() => setSelectedInboundMsg(msg)}
                      className="cursor-pointer group py-2.5 space-y-1"
                    >
                      <h4 className="text-sm font-semibold text-white group-hover:text-primary transition-colors flex items-center gap-1.5">
                        {msg.subject || '(Brak tematu)'}
                      </h4>
                      <p className="text-xs text-content-muted line-clamp-2 leading-relaxed">
                        {msg.text || '(Brak treści tekstowej)'}
                      </p>
                    </div>

                    {/* Action buttons */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/5">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setSelectedInboundMsg(msg)}
                          className="px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
                        >
                          <Eye size={13} className="text-primary" />
                          Czytaj całość
                        </button>

                        <button
                          onClick={() => handleToggleMessageRead(msg)}
                          className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                            msg.read
                              ? 'bg-white/5 hover:bg-white/10 text-content-muted'
                              : 'bg-primary/20 text-primary hover:bg-primary/30'
                          }`}
                        >
                          <CheckCheck size={13} />
                          {msg.read ? 'Oznacz jako nieprzeczytaną' : 'Oznacz jako przeczytaną'}
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        <a
                          href={`mailto:${msg.fromEmail}?subject=${encodeURIComponent(
                            msg.subject.startsWith('Re:') ? msg.subject : `Re: ${msg.subject}`
                          )}`}
                          className="px-3 py-1 rounded-lg bg-primary text-accent-ink text-xs font-bold flex items-center gap-1.5 hover:bg-primary/90 transition-colors shadow-btn"
                        >
                          <Reply size={13} />
                          Odpowiedz kursantowi
                        </a>

                        <button
                          onClick={() => handleDeleteInboundMessage(msg)}
                          className="p-1.5 rounded-lg hover:bg-danger/20 text-content-muted hover:text-danger transition-colors"
                          title="Usuń wiadomość"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modal: Selected Inbound Message Detail */}
      {selectedInboundMsg && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-base-100 border border-white/15 rounded-2xl p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-start justify-between pb-3 border-b border-white/10 shrink-0">
              <div className="space-y-1">
                <span className="text-xs font-mono text-primary font-bold uppercase tracking-wider block">
                  Odpowiedź od kursanta
                </span>
                <h3 className="font-extrabold text-lg text-white">
                  {selectedInboundMsg.subject || '(Brak tematu)'}
                </h3>
              </div>
              <button
                onClick={() => setSelectedInboundMsg(null)}
                className="p-1.5 rounded-lg hover:bg-white/10 text-content-muted hover:text-white transition-colors shrink-0"
              >
                <X size={18} />
              </button>
            </div>

            {/* Sender & timestamp details */}
            <div className="p-3.5 rounded-xl bg-black/40 border border-white/10 space-y-2 text-xs shrink-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <div className="text-white font-bold flex items-center gap-2">
                    <span>{selectedInboundMsg.fromName || selectedInboundMsg.fromEmail}</span>
                    {selectedInboundMsg.studentName && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30 uppercase font-bold">
                        Kursant: {selectedInboundMsg.studentName}
                      </span>
                    )}
                  </div>
                  <div className="text-content-muted font-mono">{selectedInboundMsg.fromEmail}</div>
                </div>

                <div className="text-right space-y-0.5">
                  <div className="text-white/80 flex items-center gap-1.5 justify-end">
                    <Clock size={12} className="text-primary" />
                    <span>{formatTaskDateTime(selectedInboundMsg.receivedAt)}</span>
                  </div>
                  <div className="text-[11px] text-content-muted">
                    Do: <span className="font-mono">{selectedInboundMsg.toEmail}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Message Body */}
            <div className="flex-1 overflow-y-auto p-4 rounded-xl bg-ink/60 border border-white/10 text-xs text-white/90 leading-relaxed space-y-3 whitespace-pre-wrap font-sans">
              {selectedInboundMsg.text || (
                <div
                  dangerouslySetInnerHTML={{ __html: selectedInboundMsg.html || '' }}
                  className="prose prose-invert max-w-none text-xs"
                />
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between gap-3 pt-3 border-t border-white/10 shrink-0">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleToggleMessageRead(selectedInboundMsg)}
                  className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-white font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <CheckCheck size={14} className="text-primary" />
                  {selectedInboundMsg.read ? 'Oznacz jako nieprzeczytaną' : 'Oznacz jako przeczytaną'}
                </button>

                <button
                  onClick={() => handleDeleteInboundMessage(selectedInboundMsg)}
                  className="px-3 py-2 rounded-xl bg-danger/10 hover:bg-danger/20 text-xs text-danger font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <Trash2 size={14} />
                  Usuń
                </button>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  onClick={() => setSelectedInboundMsg(null)}
                >
                  Zamknij
                </Button>

                <a
                  href={`mailto:${selectedInboundMsg.fromEmail}?subject=${encodeURIComponent(
                    selectedInboundMsg.subject.startsWith('Re:')
                      ? selectedInboundMsg.subject
                      : `Re: ${selectedInboundMsg.subject}`
                  )}`}
                  className="px-4 py-2.5 rounded-xl bg-primary text-accent-ink text-xs font-bold flex items-center gap-1.5 hover:bg-primary/90 transition-colors shadow-btn"
                >
                  <Reply size={14} />
                  Odpowiedz e-mailem
                </a>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* Edit Student Email Modal */}
      {editingStudent && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-base-100 border border-white/15 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20">
                  <Mail size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">Edytuj adres e-mail kursanta</h3>
                  <p className="text-xs text-content-muted">
                    {editingStudent.firstName || editingStudent.lastName
                      ? `${editingStudent.firstName || ''} ${editingStudent.lastName || ''}`.trim()
                      : editingStudent.username}{' '}
                    <span className="font-mono">(@{editingStudent.username})</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingStudent(null)}
                className="p-1 rounded-lg hover:bg-white/10 text-content-muted hover:text-white transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {editEmailError && (
              <div className="p-3 bg-danger/10 border border-danger/20 text-danger rounded-xl text-xs flex items-center gap-2">
                <AlertTriangle size={14} className="shrink-0" />
                <span>{editEmailError}</span>
              </div>
            )}

            <div className="space-y-2">
              <label className="block text-xs font-bold text-content-muted uppercase tracking-wider">
                Adres e-mail kursanta
              </label>
              <input
                type="email"
                value={editEmailInput}
                onChange={(e) => setEditEmailInput(e.target.value)}
                placeholder="np. jan.kowalski@gmail.com"
                className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/15 text-white font-mono text-xs focus:outline-none focus:border-primary"
                autoFocus
              />
              <div className="text-[11px] text-content-muted space-y-1 pt-1">
                <p>
                  • Zmiana adresu zaktualizuje profil kursanta w bazie Firestore oraz konto uwierzytelniania Firebase Auth.
                </p>
                <p>
                  • Umożliwi wysyłkę powiadomień o zadaniach przez serwis Resend (adresy zastępcze <code>@student.vocabboost.com</code> są automatycznie pomijane).
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
              <Button
                variant="secondary"
                onClick={() => setEditingStudent(null)}
                disabled={isSavingEmail}
              >
                Anuluj
              </Button>
              <Button
                onClick={handleSaveStudentEmail}
                isLoading={isSavingEmail}
                disabled={!editEmailInput.trim()}
              >
                Zapisz e-mail
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminMailingScreen;
