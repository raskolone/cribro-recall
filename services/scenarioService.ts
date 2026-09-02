import { db } from '../firebase';
import { collection, doc, getDocs, getDoc, setDoc, deleteDoc, query, orderBy, where, serverTimestamp } from 'firebase/firestore';
import { GeneratedLessonScenario, LessonScenarioStage } from '../types';

const LOCAL_STORAGE_SCENARIOS_KEY = 'cribro_generated_lesson_scenarios_v1';

export function parseScenarioStages(content: string): {
  title: string;
  topic: string;
  stages: LessonScenarioStage[];
  vocabularyText: string;
  summary: string;
  followUp: string;
} {
  if (!content) {
    return {
      title: 'Scenariusz lekcji',
      topic: 'Scenariusz lekcji',
      stages: [],
      vocabularyText: '',
      summary: '',
      followUp: ''
    };
  }

  const lines = content.split('\n');
  let title = '';
  let topic = '';
  const stages: LessonScenarioStage[] = [];
  let currentStage: LessonScenarioStage | null = null;
  const bodyLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Check for main title
    if (!title && (trimmed.startsWith('# ') || trimmed.toLowerCase().startsWith('scenariusz:') || trimmed.toLowerCase().startsWith('**scenariusz:'))) {
      const rawTitle = trimmed
        .replace(/^#+\s*/, '')
        .replace(/^\*\*scenariusz:\*\*/i, '')
        .replace(/^scenariusz:\s*/i, '')
        .replace(/\*\*/g, '')
        .trim();
      title = rawTitle.toLowerCase().startsWith('scenariusz') ? rawTitle : `Scenariusz: ${rawTitle}`;
      topic = rawTitle.replace(/^scenariusz:\s*/i, '').trim();
      continue;
    }

    // Check for section header
    const isHeaderMatch = 
      trimmed.startsWith('## ') || 
      trimmed.startsWith('### ') || 
      /^(\*\*)?\s*(\d+\.|\d+\))\s+[A-Za-zĄ-ź\s–-]+(\(\d+.*?\))?(\*\*)?:?$/.test(trimmed) ||
      (trimmed.startsWith('**') && trimmed.endsWith('**') && trimmed.length < 80 && (trimmed.includes('min') || /^\*\*\d+\./.test(trimmed)));

    if (isHeaderMatch) {
      if (currentStage) {
        currentStage.body = bodyLines.join('\n').trim();
        stages.push(currentStage);
        bodyLines.length = 0;
      }

      const rawTitle = trimmed
        .replace(/^#+\s*/, '')
        .replace(/\*\*/g, '')
        .replace(/:$/, '')
        .trim();

      const durationMatch = rawTitle.match(/\((.*?min.*?)\)/i);
      const duration = durationMatch ? durationMatch[1] : undefined;

      currentStage = {
        id: `stage-${stages.length + 1}-${rawTitle.slice(0, 15).replace(/\s+/g, '-')}`,
        title: rawTitle,
        duration,
        body: ''
      };
      continue;
    }

    if (currentStage) {
      bodyLines.push(line);
    } else if (trimmed && !title) {
      title = `Scenariusz: ${trimmed.slice(0, 50)}`;
      topic = trimmed.slice(0, 50);
    }
  }

  if (currentStage) {
    currentStage.body = bodyLines.join('\n').trim();
    stages.push(currentStage);
  }

  if (!title) {
    title = 'Scenariusz lekcji';
    topic = 'Scenariusz lekcji';
  }
  if (!topic) {
    topic = title.replace(/^Scenariusz:\s*/i, '').trim();
  }

  // Extract vocabulary
  let vocabularyText = '';
  const vocabStage = stages.find(s => 
    s.title.toLowerCase().includes('language focus') || 
    s.title.toLowerCase().includes('słownictwo') || 
    s.title.toLowerCase().includes('vocabulary') ||
    s.title.toLowerCase().includes('idiom') ||
    s.title.toLowerCase().includes('zwroty')
  );
  if (vocabStage) {
    const vocabLines = vocabStage.body.split('\n')
      .map(l => l.trim())
      .filter(l => (l.startsWith('-') || l.startsWith('*') || /^\d+\./.test(l)) && (l.includes(' - ') || l.includes(' – ') || l.includes(':') || l.includes('—')));
    vocabularyText = vocabLines.map(l => l.replace(/^[-*\d.]+\s*/, '').replace(/\*\*/g, '').trim()).join('\n');
  }

  // Extract summary and follow up
  let summary = '';
  const warmUp = stages.find(s => s.title.toLowerCase().includes('warm up') || s.title.toLowerCase().includes('revision'));
  const mainTopic = stages.find(s => s.title.toLowerCase().includes('main topic') || s.title.toLowerCase().includes('główny'));
  const practice = stages.find(s => s.title.toLowerCase().includes('practice') || s.title.toLowerCase().includes('ćwiczeni') || s.title.toLowerCase().includes('role-play'));

  const summaryParts: string[] = [];
  if (warmUp) summaryParts.push(`• Warm Up: ${warmUp.body.slice(0, 150)}...`);
  if (mainTopic) summaryParts.push(`• Main Topic: ${mainTopic.body.slice(0, 200)}...`);
  if (practice) summaryParts.push(`• Practice: ${practice.body.slice(0, 150)}...`);
  summary = summaryParts.join('\n');

  let followUp = '';
  const hwStage = stages.find(s => s.title.toLowerCase().includes('homework') || s.title.toLowerCase().includes('praca domowa') || s.title.toLowerCase().includes('zadanie'));
  if (hwStage) {
    followUp = hwStage.body;
  }

  return { title, topic, stages, vocabularyText, summary, followUp };
}

export function getLocalCachedScenarios(): GeneratedLessonScenario[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_SCENARIOS_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.warn('Failed to read scenarios from localStorage:', e);
  }
  return [];
}

export function saveLocalCachedScenarios(scenarios: GeneratedLessonScenario[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_SCENARIOS_KEY, JSON.stringify(scenarios));
  } catch (e) {
    console.warn('Failed to save scenarios to localStorage:', e);
  }
}

export async function saveGeneratedScenario(
  input: {
    id?: string;
    title?: string;
    topic?: string;
    content: string;
    studentId?: string | null;
    studentName?: string | null;
    targetLevel?: string;
    lessonDuration?: string;
    lessonType?: string;
    vocabularyText?: string;
    stages?: LessonScenarioStage[];
    tags?: string[];
  }
): Promise<GeneratedLessonScenario> {
  const parsed = parseScenarioStages(input.content);
  const now = new Date().toISOString();
  const scenarioId = input.id || `scenario-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

  const scenario: GeneratedLessonScenario = {
    id: scenarioId,
    title: input.title || parsed.title,
    topic: input.topic || parsed.topic,
    content: input.content,
    studentId: input.studentId || null,
    studentName: input.studentName || null,
    targetLevel: input.targetLevel || 'B2',
    lessonDuration: input.lessonDuration || '60 min',
    lessonType: input.lessonType || 'Konwersacje i Płynność',
    vocabularyText: input.vocabularyText || parsed.vocabularyText,
    stages: input.stages && input.stages.length > 0 ? input.stages : parsed.stages,
    createdAt: now,
    updatedAt: now,
    tags: input.tags || []
  };

  // 1. Update local cache first
  const localList = getLocalCachedScenarios();
  const existingIdx = localList.findIndex(s => s.id === scenario.id);
  let updatedLocal: GeneratedLessonScenario[];
  if (existingIdx >= 0) {
    updatedLocal = [...localList];
    updatedLocal[existingIdx] = scenario;
  } else {
    updatedLocal = [scenario, ...localList];
  }
  saveLocalCachedScenarios(updatedLocal);

  // 2. Persist to Firestore
  try {
    const docRef = doc(db, 'lessonScenarios', scenario.id);
    await setDoc(docRef, {
      ...scenario,
      updatedAt: now,
      serverCreatedAt: serverTimestamp()
    }, { merge: true });
  } catch (err) {
    console.warn('Could not save scenario to Firestore (using local cache):', err);
  }

  return scenario;
}

export async function getGeneratedScenarios(studentId?: string | null): Promise<GeneratedLessonScenario[]> {
  const localList = getLocalCachedScenarios();

  try {
    const scenariosRef = collection(db, 'lessonScenarios');
    const q = query(scenariosRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    const firestoreList: GeneratedLessonScenario[] = [];

    snapshot.forEach(docSnap => {
      firestoreList.push({ id: docSnap.id, ...docSnap.data() } as GeneratedLessonScenario);
    });

    if (firestoreList.length > 0) {
      // Merge with local list (prefer newest)
      const mergedMap = new Map<string, GeneratedLessonScenario>();
      firestoreList.forEach(s => mergedMap.set(s.id, s));
      localList.forEach(s => {
        if (!mergedMap.has(s.id)) {
          mergedMap.set(s.id, s);
        }
      });
      const combined = Array.from(mergedMap.values());
      combined.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      saveLocalCachedScenarios(combined);

      if (studentId) {
        return combined.filter(s => !s.studentId || s.studentId === studentId);
      }
      return combined;
    }
  } catch (err) {
    console.warn('Could not load scenarios from Firestore (using local cache):', err);
  }

  if (studentId) {
    return localList.filter(s => !s.studentId || s.studentId === studentId);
  }
  return localList;
}

export async function deleteGeneratedScenario(scenarioId: string): Promise<void> {
  // 1. Remove from local cache
  const localList = getLocalCachedScenarios().filter(s => s.id !== scenarioId);
  saveLocalCachedScenarios(localList);

  // 2. Delete from Firestore
  try {
    const docRef = doc(db, 'lessonScenarios', scenarioId);
    await deleteDoc(docRef);
  } catch (err) {
    console.warn('Could not delete scenario from Firestore:', err);
  }
}
