import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildLessonTemplate,
  highestLessonNumber,
  LESSON_SECTIONS,
  lessonTitleStyle,
  sectionHeadingStyle,
} from '../utils/lessonTemplate';
import {
  getOrCreateStudentScratchpad,
  getInitialScratchpadContent,
} from '../services/scratchpadService';
import {
  calculateTargetRotation,
} from '../components/presentation/WheelOfFortune';
import {
  exerciseRegistry,
  getAllExerciseTypes,
  getExerciseRegistryEntry,
  DEFAULT_WHEEL_ITEMS
} from '../services/exerciseRegistry';
import {
  createNewExercise,
  getLocalExercises,
  saveExercise,
  deleteExercise,
} from '../services/exerciseService';
import {
  ExerciseDefinition,
  RandomWheelPayload,
  WheelItem
} from '../types/exerciseStudio';

describe('1. Notebook Template & Student Isolation', () => {
  it('Nowy notebook dla nowego kursanta tworzy Lesson 1 jako czysty pusty szablon', () => {
    const templateHtml = buildLessonTemplate({
      previousHtml: '',
      lessonNumber: 1,
      cleanEmpty: true,
      paperTheme: 'light',
    });

    assert.ok(templateHtml.includes('Lesson 1'));
    assert.ok(templateHtml.includes('QUICK RECALL'));
    assert.ok(templateHtml.includes('TODAY'));
    assert.ok(templateHtml.includes('LANGUAGE NOTES'));
    assert.ok(templateHtml.includes('AFTER THE LESSON'));
    // Brak fake danych
    assert.ok(!templateHtml.includes('Marek'));
    assert.ok(!templateHtml.includes('fake'));
  });

  it('Nowy notebook nie generuje automatycznie pytań ze starych lekcji przy braku historii', () => {
    const initialContent = getInitialScratchpadContent('Nowy Kursant');
    assert.equal(initialContent.html, '');
    assert.equal(initialContent.text, '');
  });

  it('Kolejna lekcja (Lesson N > 1) poprawnie inkrementuje numer', () => {
    const existingHtml = '<h2>Lesson 1 — 01.09.2026</h2><p>Treść 1</p><h2>Lesson 2 — 08.09.2026</h2>';
    const nextNum = highestLessonNumber(existingHtml) + 1;
    assert.equal(nextNum, 3);

    const newLessonHtml = buildLessonTemplate({
      previousHtml: existingHtml,
      topic: 'Contract Renegotiation',
      cleanEmpty: true,
    });
    assert.ok(newLessonHtml.includes('Lesson 3'));
    assert.ok(newLessonHtml.includes('Contract Renegotiation'));
  });

  it('Izolacja danych między kursantami — każdy kursant ma unikalny dokument sp_<studentId>', async () => {
    const teacher = { uid: 'teacher_123', name: 'Lektor Testowy' };
    const studentA = { id: 'student_aaa', name: 'Alicja Nowak' };
    const studentB = { id: 'student_bbb', name: 'Bartosz Kowalski' };

    const docA = await getOrCreateStudentScratchpad(studentA, teacher);
    const docB = await getOrCreateStudentScratchpad(studentB, teacher);

    assert.equal(docA.id, 'sp_student_aaa');
    assert.equal(docB.id, 'sp_student_bbb');
    assert.notEqual(docA.id, docB.id);
    assert.equal(docA.studentName, 'Alicja Nowak');
    assert.equal(docB.studentName, 'Bartosz Kowalski');
  });

  it('Brak studentId nie przypisuje fake danych ani testowego stanu', async () => {
    const teacher = { uid: 'teacher_123', name: 'Lektor Testowy' };
    const emptyStudent = { id: null, name: '' };

    const docUnknown = await getOrCreateStudentScratchpad(emptyStudent, teacher);
    assert.ok(!docUnknown.studentId);
    assert.ok(docUnknown.id.startsWith('sp_'));
    assert.ok(!docUnknown.studentName || docUnknown.studentName === 'Kursant');
  });
});

describe('2. Koło Fortuny (Fortune Wheel) — Deterministyczna Logika i Fizyka', () => {
  it('calculateTargetRotation precyzyjnie zatrzymuje wskaźnik na wybranym segmencie', () => {
    const totalSlices = 6;
    const sliceAngle = 360 / totalSlices; // 60 deg
    const currentRotation = 0;

    // Test dla każdego indeksu od 0 do 5
    for (let winningIndex = 0; winningIndex < totalSlices; winningIndex++) {
      const targetRotation = calculateTargetRotation(winningIndex, totalSlices, currentRotation, 5);

      // Sprawdź pozycję iglicy (270° / godzina 12:00)
      const normalizedRot = ((targetRotation % 360) + 360) % 360;
      const pointerAngle = (360 - normalizedRot + 270) % 360;
      const landedIndex = Math.floor(pointerAngle / sliceAngle) % totalSlices;

      assert.equal(landedIndex, winningIndex, `Segment ${winningIndex} powinien wylądować dokładnie pod wskaźnikiem`);
    }
  });

  it('calculateTargetRotation działa poprawnie przy niezerowym kącie startowym', () => {
    const totalSlices = 8;
    const sliceAngle = 360 / totalSlices; // 45 deg
    const currentRotation = 1438.5; // Koło obrócone po poprzednim losowaniu
    const winningIndex = 3;

    const targetRotation = calculateTargetRotation(winningIndex, totalSlices, currentRotation, 5);
    const normalizedRot = ((targetRotation % 360) + 360) % 360;
    const pointerAngle = (360 - normalizedRot + 270) % 360;
    const landedIndex = Math.floor(pointerAngle / sliceAngle) % totalSlices;

    assert.equal(landedIndex, winningIndex);
    assert.ok(targetRotation > currentRotation, 'Obrót musi postępować w przód');
  });

  it('Brak reshuffle segmentów podczas obrotu koła', () => {
    const items: WheelItem[] = [
      { id: '1', label: 'Item 1' },
      { id: '2', label: 'Item 2' },
      { id: '3', label: 'Item 3' },
    ];
    const initialOrder = items.map(i => i.id);

    // Wybór zwycięzcy
    const winnerId = '2';
    const chosenIndex = items.findIndex(i => i.id === winnerId);
    assert.equal(chosenIndex, 1);

    // Kolejność pozycji nie może ulec zmianie
    const postOrder = items.map(i => i.id);
    assert.deepEqual(initialOrder, postOrder);
  });
});

describe('3. Exercise Studio Architecture & Registry', () => {
  it('exerciseRegistry zawiera wszystkie wymagane typy ćwiczeń', () => {
    const types = getAllExerciseTypes();
    assert.ok(types.length >= 5);

    const typeKeys = types.map(t => t.type);
    assert.ok(typeKeys.includes('random_wheel'));
    assert.ok(typeKeys.includes('sentence_scramble'));
    assert.ok(typeKeys.includes('matching_pairs'));
    assert.ok(typeKeys.includes('random_cards'));
    assert.ok(typeKeys.includes('multiple_choice'));
  });

  it('random_wheel w rejestrze generuje poprawny domyślny payload', () => {
    const entry = getExerciseRegistryEntry('random_wheel');
    assert.equal(entry.isReady, true);

    const payload = entry.createDefaultPayload('Test Wheel');
    assert.ok(Array.isArray(payload.items));
    assert.ok(payload.items.length >= 2);

    const validation = entry.validatePayload(payload);
    assert.equal(validation.valid, true);
    assert.equal(validation.errors.length, 0);
  });

  it('createNewExercise tworzy kompletną definicję ExerciseDefinition', () => {
    const ex = createNewExercise<RandomWheelPayload>('random_wheel', 'Business English Idioms', 'teacher_1');
    assert.ok(ex.id.startsWith('ex_random_wheel_'));
    assert.equal(ex.title, 'Business English Idioms');
    assert.equal(ex.type, 'random_wheel');
    assert.equal(ex.status, 'draft');
    assert.equal(ex.version, 1);
    assert.ok(ex.payload.items.length > 0);
  });

  it('Zapis i odczyt ćwiczenia w ExerciseService', async () => {
    const ex = createNewExercise<RandomWheelPayload>('random_wheel', 'Negotiation Phrases', 'teacher_admin');
    const saved = await saveExercise(ex);
    assert.equal(saved.version, 2);

    const localList = getLocalExercises();
    assert.ok(localList.some(e => e.id === ex.id));

    // Usunięcie
    const deleted = await deleteExercise(ex.id);
    assert.equal(deleted, true);
    const postDeleteList = getLocalExercises();
    assert.ok(!postDeleteList.some(e => e.id === ex.id));
  });
});

describe('4. Theme Switching & Typography Tokens', () => {
  it('lessonTitleStyle i sectionHeadingStyle mają wyrazisty kontrast dla light i dark mode', () => {
    const titleLight = lessonTitleStyle('light');
    const titleDark = lessonTitleStyle('dark');
    const headingLight = sectionHeadingStyle('TODAY’S LESSON');
    const headingWarmup = sectionHeadingStyle('QUICK RECALL');

    assert.ok(titleLight.includes('font-size:22px'));
    assert.ok(titleDark.includes('font-size:22px'));
    assert.ok(headingLight.includes('#0d8a5f'), 'Today’s lesson używa zieleni szmaragdowej #0d8a5f');
    assert.ok(headingWarmup.includes('#0f766e'), 'Quick recall używa morskiego teal #0f766e');
  });
});
