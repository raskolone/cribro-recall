import { db } from '../firebase';
import { collection, doc, getDocs, setDoc, deleteDoc, query, where, orderBy } from 'firebase/firestore';
import { Presentation, Slide, SlideLayoutTemplateId } from '../types/presentation';

const LOCAL_STORAGE_KEY = 'cribro_teacher_presentations_studio_v1';

/**
 * Gotowe szablony układów slajdów (Treść i Szablony)
 */
export function getLayoutTemplateSlides(): { id: SlideLayoutTemplateId; name: string; desc: string; template: Slide }[] {
  return [
    {
      id: 'title_points',
      name: 'Tytuł + Punkty',
      desc: 'Nagłówek tematu, kluczowe założenia w punktach i miejsce na dyskusję',
      template: {
        id: 'tmpl-title-points',
        title: 'Mastering Diplomatic Phrasing',
        notes: 'Wprowadź cel lekcji: jak złagodzić krytykę i wyrazić odmienne zdanie bez tworzenia napięcia.',
        layoutTemplate: 'title_points',
        elements: [
          {
            id: 'el-title-1',
            type: 'text',
            content: '# Mastering Diplomatic Phrasing\nHow to soften direct disagreement in professional discourse',
            position: { x: 8, y: 12 },
            style: { fontSize: 24, fontWeight: 'black', color: '#72f0b4' }
          },
          {
            id: 'el-points-1',
            type: 'text',
            content: '• **With respect...** (Used to signal polite pushback)\n• **I am not entirely convinced that...** (Soft disagreement)\n• **Could we explore an alternative perspective?** (Collaborative pivot)\n• **Having said that...** (Nuanced transition)',
            position: { x: 8, y: 38 },
            style: { fontSize: 16, fontWeight: 'normal', color: '#f3f4f6' }
          }
        ]
      }
    },
    {
      id: 'dialogue',
      name: 'Dialog',
      desc: 'Konwersacja między dwoma rozmówcami (Role-play)',
      template: {
        id: 'tmpl-dialogue',
        title: 'Negotiation Role-play: Budget Review',
        notes: 'Przećwicz z kursantem role: Lektor (Client) vs Kursant (Project Lead). Zwróć uwagę na intonację.',
        layoutTemplate: 'dialogue',
        elements: [
          {
            id: 'el-dlg-title',
            type: 'text',
            content: '### Negotiation Scenario: Budget Constraints',
            position: { x: 8, y: 10 },
            style: { fontSize: 22, fontWeight: 'bold', color: '#60a5fa' }
          },
          {
            id: 'el-dlg-speaker-a',
            type: 'text',
            content: '👤 **Client:** "We need this delivered by Q3, but we cannot increase the initial budget."',
            position: { x: 8, y: 30 },
            style: { fontSize: 16, backgroundColor: 'rgba(30, 41, 59, 0.85)', padding: 12, borderRadius: 12 }
          },
          {
            id: 'el-dlg-speaker-b',
            type: 'text',
            content: '💼 **You (Project Lead):** "I see your constraints. If Q3 is non-negotiable, could we trim the secondary scope to fit the allocated resources?"',
            position: { x: 8, y: 55 },
            style: { fontSize: 16, backgroundColor: 'rgba(16, 185, 129, 0.15)', padding: 12, borderRadius: 12, border: '1px solid rgba(16, 185, 129, 0.4)' }
          }
        ]
      }
    },
    {
      id: 'vocabulary',
      name: 'Słownictwo',
      desc: 'Karty kluczowych zwrotów, tłumaczenia i zdania przykładowe',
      template: {
        id: 'tmpl-vocab',
        title: 'Essential Vocabulary & Collocations',
        notes: 'Poproś kursanta o ułożenie własnego zdania z wybranym zwrotem.',
        layoutTemplate: 'vocabulary',
        elements: [
          {
            id: 'el-voc-title',
            type: 'text',
            content: '### Target Vocabulary & Phrasal Verbs',
            position: { x: 8, y: 10 },
            style: { fontSize: 22, fontWeight: 'bold', color: '#fbbf24' }
          },
          {
            id: 'el-voc-cards',
            type: 'vocabulary',
            content: '',
            position: { x: 8, y: 28 },
            vocabularyData: [
              { term: 'play devil\'s advocate', translation: 'być adwokatem diabła', example: 'Let me play devil\'s advocate here to stress-test your proposal.' },
              { term: 'iron out the details', translation: 'dopiąć szczegóły', example: 'We still need to iron out a few contract clauses before signing.' },
              { term: 'touch base', translation: 'skontaktować się na krótko', example: 'Let\'s touch base on Thursday to review the prototypes.' }
            ]
          }
        ]
      }
    },
    {
      id: 'image_exercise',
      name: 'Ćwiczenie ze zdjęciem',
      desc: 'Ilustracja lub schemat z dedykowanym zadaniem dyskusyjnym',
      template: {
        id: 'tmpl-img-ex',
        title: 'Visual Analysis & Critical Thinking',
        notes: 'Kursant analizuje grafikę i odpowiada na pytania problemowe.',
        layoutTemplate: 'image_exercise',
        elements: [
          {
            id: 'el-img-title',
            type: 'text',
            content: '### Visual Speaking Exercise',
            position: { x: 8, y: 10 },
            style: { fontSize: 22, fontWeight: 'bold', color: '#f43f5e' }
          },
          {
            id: 'el-img-placeholder',
            type: 'image',
            content: 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=800&q=80',
            position: { x: 8, y: 26 },
            style: { width: 42, borderRadius: 16, shadow: true }
          },
          {
            id: 'el-img-questions',
            type: 'exercise',
            content: '',
            position: { x: 54, y: 26 },
            exerciseData: {
              instruction: 'Analyze the workplace dynamic shown on the image.',
              prompt: '1. What non-verbal cues indicate high engagement vs fatigue?\n2. What strategy would you implement as a moderator to re-energize this team meeting?'
            }
          }
        ]
      }
    }
  ];
}

/**
 * Tworzy pusty slajd
 */
export function createEmptySlide(index: number = 1): Slide {
  return {
    id: `slide-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    title: `Slajd ${index}`,
    notes: '',
    layoutTemplate: 'title_points',
    elements: [
      {
        id: `el-title-${Date.now()}`,
        type: 'text',
        content: `## Nowy Slajd ${index}`,
        position: { x: 8, y: 15 },
        style: { fontSize: 24, fontWeight: 'bold', color: '#72f0b4' }
      },
      {
        id: `el-body-${Date.now()}`,
        type: 'text',
        content: 'Kliknij dwukrotnie lub edytuj w panelu bocznym, aby dodać treść merytoryczną.',
        position: { x: 8, y: 40 },
        style: { fontSize: 16, color: '#9ca3af' }
      }
    ]
  };
}

/**
 * Zapis prezentacji do prywatnej bazy lektora (Firestore + LocalStorage cache)
 */
export async function saveTeacherPresentation(
  presentation: Presentation,
  teacherId: string
): Promise<{ success: boolean; error?: string }> {
  const payload: Presentation = {
    ...presentation,
    teacherId,
    updatedAt: new Date().toISOString(),
    createdAt: presentation.createdAt || new Date().toISOString()
  };

  // 1. Zapis w cache LocalStorage
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    const list: Presentation[] = raw ? JSON.parse(raw) : [];
    const filtered = list.filter(p => p.id !== payload.id);
    filtered.unshift(payload);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(filtered.slice(0, 50)));
  } catch (err) {
    console.warn('[PresentationStudioService] Błąd zapisu LocalStorage:', err);
  }

  // 2. Zapis w prywatnej kolekcji Firestore lektora (`teachers/{teacherId}/presentations/{presId}`)
  try {
    const presRef = doc(db, `teachers/${teacherId}/presentations`, payload.id);
    await setDoc(presRef, payload, { merge: true });
    return { success: true };
  } catch (err: any) {
    console.error('[PresentationStudioService] Błąd zapisu w Firestore:', err);
    return { success: false, error: err?.message || String(err) };
  }
}

/**
 * Pobranie prezentacji lektora z Firestore / LocalStorage
 */
export async function getTeacherPresentations(
  teacherId: string
): Promise<Presentation[]> {
  const results: Presentation[] = [];

  // LocalStorage najpierw (offline resilience)
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const list: Presentation[] = JSON.parse(raw);
      results.push(...list.filter(p => p.teacherId === teacherId));
    }
  } catch (err) {
    console.warn('[PresentationStudioService] Błąd odczytu LocalStorage:', err);
  }

  // Firestore
  try {
    const collRef = collection(db, `teachers/${teacherId}/presentations`);
    const snap = await getDocs(collRef);
    snap.forEach(docSnap => {
      const data = docSnap.data() as Presentation;
      if (!results.some(r => r.id === data.id)) {
        results.push(data);
      }
    });
  } catch (err) {
    console.warn('[PresentationStudioService] Błąd pobierania z Firestore (może brak uprawnień offline):', err);
  }

  return results;
}

/**
 * Przypisanie prezentacji do kursantów lub jako szablon
 */
export async function updatePresentationAssignment(
  presentationId: string,
  teacherId: string,
  assignedStudentIds: string[],
  isTemplate: boolean
): Promise<boolean> {
  try {
    const presRef = doc(db, `teachers/${teacherId}/presentations`, presentationId);
    await setDoc(presRef, {
      assignedStudentIds,
      isTemplate,
      updatedAt: new Date().toISOString()
    }, { merge: true });

    // Zaktualizuj cache lokalny
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const list: Presentation[] = JSON.parse(raw);
      const target = list.find(p => p.id === presentationId);
      if (target) {
        target.assignedStudentIds = assignedStudentIds;
        target.isTemplate = isTemplate;
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
      }
    }
    return true;
  } catch (err) {
    console.error('[PresentationStudioService] Błąd aktualizacji przypisania:', err);
    return false;
  }
}
