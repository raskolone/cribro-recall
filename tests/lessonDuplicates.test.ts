import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  findDuplicateGroups,
  findExistingDuplicate,
  normalizeTopic,
  recordWeight,
  sortChronologically,
} from '../utils/lessonDuplicates';
import { LessonRecord } from '../types';

const record = (over: Partial<LessonRecord>): LessonRecord =>
  ({
    id: 'x',
    studentId: 's1',
    date: '2026-05-13',
    topic: 'Temat',
    vocabularyText: '',
    createdAt: '2026-05-13T10:00:00.000Z',
    ...over,
  } as LessonRecord);

describe('utils/lessonDuplicates', () => {
  it('normalizeTopic zdejmuje numerację, ogonki i wielkość liter', () => {
    assert.equal(normalizeTopic('12. Życie Zawodowe'), 'zycie zawodowe');
    assert.equal(normalizeTopic('Lekcja 3 — Życie zawodowe'), 'zycie zawodowe');
    assert.equal(normalizeTopic('Życie zawodowe (Lekcja 4)'), 'zycie zawodowe');
  });

  it('ten sam temat i ta sama data to duplikat pewny', () => {
    const groups = findDuplicateGroups([
      record({ id: 'a', topic: 'Work life', lessonSummary: 'coś' }),
      record({ id: 'b', topic: 'Work Life' }),
    ]);
    assert.equal(groups.length, 1);
    assert.equal(groups[0].certain, true);
    // Zostaje bogatszy wpis.
    assert.equal(groups[0].keep.id, 'a');
    assert.deepEqual(groups[0].remove.map(r => r.id), ['b']);
  });

  it('przy równej treści zostaje wpis starszy — to on jest oryginałem', () => {
    const groups = findDuplicateGroups([
      record({ id: 'nowy', createdAt: '2026-05-20T10:00:00.000Z' }),
      record({ id: 'stary', createdAt: '2026-05-13T10:00:00.000Z' }),
    ]);
    assert.equal(groups[0].keep.id, 'stary');
  });

  it('ten sam temat w różnych dniach bez wspólnej treści NIE jest duplikatem', () => {
    const groups = findDuplicateGroups([
      record({ id: 'a', date: '2026-05-13', lessonSummary: 'pierwsze zajęcia' }),
      record({ id: 'b', date: '2026-06-10', lessonSummary: 'zupełnie inny przebieg' }),
    ]);
    assert.equal(groups.length, 0);
  });

  it('ten sam temat, inne daty, ta sama treść to duplikat PODEJRZANY', () => {
    const groups = findDuplicateGroups([
      record({ id: 'a', date: '2026-05-13', lessonSummary: 'identyczny przebieg' }),
      record({ id: 'b', date: '2026-05-15', lessonSummary: 'identyczny przebieg' }),
    ]);
    assert.equal(groups.length, 1);
    assert.equal(groups[0].certain, false);
  });

  it('dwie puste lekcje o tym samym tytule w różnych dniach zostają nietknięte', () => {
    const groups = findDuplicateGroups([
      record({ id: 'a', date: '2026-05-13' }),
      record({ id: 'b', date: '2026-05-20' }),
    ]);
    assert.equal(groups.length, 0);
  });

  it('wpis bez tematu nigdy nie jest duplikatem', () => {
    const groups = findDuplicateGroups([
      record({ id: 'a', topic: '' }),
      record({ id: 'b', topic: '' }),
    ]);
    assert.equal(groups.length, 0);
  });

  it('recordWeight przedkłada liczbę wypełnionych bloków nad objętość', () => {
    const wide = record({ lessonSummary: 'a', vocabularyText: 'b', thingsToImprove: 'c' });
    const long = record({ lessonSummary: 'x'.repeat(5000) });
    assert.ok(recordWeight(wide) > recordWeight(long));
  });

  it('sortChronologically ustawia od najstarszej do najnowszej', () => {
    const sorted = sortChronologically([
      record({ id: 'c', date: '2026-06-01' }),
      record({ id: 'a', date: '2026-05-01' }),
      record({ id: 'b', date: '2026-05-15' }),
    ]);
    assert.deepEqual(sorted.map(r => r.id), ['a', 'b', 'c']);
  });

  it('findExistingDuplicate rozpoznaje powtórzony import przed zapisem', () => {
    const existing = [record({ id: 'a', topic: 'Work life', date: '2026-05-13' })];
    assert.equal(
      findExistingDuplicate(existing, { topic: '12. Work Life', date: '2026-05-13' })?.id,
      'a'
    );
    assert.equal(findExistingDuplicate(existing, { topic: 'Work life', date: '2026-05-20' }), null);
    assert.equal(findExistingDuplicate(existing, { topic: '', date: '2026-05-13' }), null);
  });
});
