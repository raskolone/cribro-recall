import {
  CANVAS_BLOCK_IDS,
  CANVAS_DURATION_BUDGETS,
  CanvasAuditorOutput,
  CanvasAuditorPatchItem,
  CanvasBlock,
  CanvasBlockId,
  CanvasItem,
  CanvasModelBlock,
  CanvasPlannerOutput,
  CanvasRefreshOutput,
  ScenarioCanvasV2,
} from '../types/scenarioCanvas';
import { ScenarioDurationMin, ScenarioMode } from '../types/scenario';

/**
 * Bloki, które model ma faktycznie wypełnić dla danej lekcji — backend
 * decyduje o pominięciu, model nigdy nie decyduje sam. `grammar_review`
 * pomijany przy braku kontekstu gramatycznego, `older_lesson_refresh`
 * pomijany przy cold starcie (brak wcześniejszych lekcji).
 */
export function computeApplicableCanvasBlockIds(mode: ScenarioMode, hasGrammarContext: boolean): CanvasBlockId[] {
  return CANVAS_BLOCK_IDS.filter((id) => {
    if (id === 'grammar_review') return hasGrammarContext;
    if (id === 'older_lesson_refresh') return mode === 'returning';
    return true;
  });
}

/**
 * Waliduje odpowiedź Plannera przed nadaniem czasów/ID: dokładnie tyle
 * bloków, ile backend zażądał (`applicableBlockIds`), w tej samej
 * kolejności, z niepustym celem i 1-6 niepustymi punktami. `main_topic`
 * musi mieć 2-3 `rescue_question` oraz dokładnie 1 `wind_down_question`.
 */
export function validateCanvasPlannerOutput(
  parsed: CanvasPlannerOutput | null | undefined,
  applicableBlockIds: CanvasBlockId[]
): void {
  if (!parsed || !Array.isArray(parsed.blocks) || parsed.blocks.length !== applicableBlockIds.length) {
    throw new Error('Model (Planner) zwrócił nieprawidłową liczbę bloków canvasu.');
  }

  for (let i = 0; i < applicableBlockIds.length; i++) {
    const expectedId = applicableBlockIds[i];
    const block = parsed.blocks[i];
    if (!block || block.blockId !== expectedId) {
      throw new Error(`Nieprawidłowa kolejność lub identyfikator bloku na pozycji ${i}: oczekiwano "${expectedId}".`);
    }
    if (!block.objective || !String(block.objective).trim()) {
      throw new Error(`Blok "${expectedId}" nie ma celu (objective).`);
    }
    if (!Array.isArray(block.items) || block.items.length < 1 || block.items.length > 6) {
      throw new Error(`Blok "${expectedId}" musi mieć od 1 do 6 punktów.`);
    }
    for (const item of block.items) {
      if (!item?.text || !String(item.text).trim()) {
        throw new Error(`Blok "${expectedId}" zawiera pusty punkt.`);
      }
    }

    if (expectedId === 'main_topic') {
      const rescueCount = block.items.filter((it) => it.kind === 'rescue_question').length;
      const windDownCount = block.items.filter((it) => it.kind === 'wind_down_question').length;
      if (rescueCount < 2 || rescueCount > 3) {
        throw new Error('Blok "main_topic" musi mieć 2-3 punkty typu "rescue_question".');
      }
      if (windDownCount !== 1) {
        throw new Error('Blok "main_topic" musi mieć dokładnie 1 punkt typu "wind_down_question".');
      }
    }
  }
}

/**
 * Wzbogaca zwalidowaną odpowiedź Plannera o czasy trwania (z budżetu
 * stałego dla wybranej długości lekcji), identyfikatory i stan review —
 * model nigdy ich nie zwraca. Zwraca WSZYSTKIE 9 bloków w stałej
 * kolejności `CANVAS_BLOCK_IDS`, także te pominięte (`skipped: true`).
 */
export function buildScenarioCanvas(
  parsed: CanvasPlannerOutput,
  applicableBlockIds: CanvasBlockId[],
  opts: { studentId: string; durationMin: ScenarioDurationMin; mode: ScenarioMode; generatedAt: string },
  makeId: () => string
): ScenarioCanvasV2 {
  const budgets = CANVAS_DURATION_BUDGETS[opts.durationMin];
  const applicableSet = new Set(applicableBlockIds);
  const modelByBlockId = new Map<CanvasBlockId, CanvasModelBlock>(parsed.blocks.map((b) => [b.blockId, b]));

  const blocks: CanvasBlock[] = CANVAS_BLOCK_IDS.map((blockId) => {
    if (!applicableSet.has(blockId)) {
      return {
        blockId,
        objective: '',
        durationMin: 0,
        items: [],
        skipped: true,
        skipReason: blockId === 'grammar_review' ? 'Brak kontekstu gramatycznego do powtórki.' : 'Kursant nie ma jeszcze historii lekcji (cold start).',
      };
    }

    const mod = modelByBlockId.get(blockId)!;
    const items: CanvasItem[] = mod.items.map((item) => ({
      itemId: makeId(),
      kind: item.kind,
      text: item.text.trim(),
      review: { state: 'pending', rejectionReason: null },
      delivery: {},
      generation: 1,
    }));

    return {
      blockId,
      objective: mod.objective.trim(),
      durationMin: blockId === 'lesson_goal' ? 0 : budgets[blockId],
      items,
      skipped: false,
      ...(mod.teacherNotes ? { teacherNotes: mod.teacherNotes.map((n) => n.trim()) } : {}),
    };
  });

  return {
    version: 2,
    canvasId: makeId(),
    studentId: opts.studentId,
    durationMin: opts.durationMin,
    mode: opts.mode,
    revision: 1,
    blocks,
    generatedAt: opts.generatedAt,
    updatedAt: opts.generatedAt,
  };
}

function allItems(canvas: ScenarioCanvasV2): CanvasItem[] {
  return canvas.blocks.flatMap((b) => b.items);
}

/** Auditor zwraca patch WYŁĄCZNIE po itemId — każdy patchowany ID musi istnieć na canvasie. */
export function validateCanvasAuditorOutput(parsed: CanvasAuditorOutput | null | undefined, canvas: ScenarioCanvasV2): void {
  if (!parsed || !Array.isArray(parsed.patches)) {
    throw new Error('Model (Auditor) zwrócił nieprawidłową odpowiedź.');
  }
  const knownIds = new Set(allItems(canvas).map((it) => it.itemId));
  for (const patch of parsed.patches) {
    if (!patch?.itemId || !knownIds.has(patch.itemId)) {
      throw new Error(`Auditor zwrócił patch dla nieznanego itemId: "${patch?.itemId}".`);
    }
    if (!patch.text || !String(patch.text).trim()) {
      throw new Error(`Auditor zwrócił pusty tekst dla itemId "${patch.itemId}".`);
    }
  }
}

/** Nakłada patch Auditora na canvas — podmienia wyłącznie tekst wskazanych elementów. */
export function applyCanvasAuditorPatch(canvas: ScenarioCanvasV2, patches: CanvasAuditorPatchItem[]): ScenarioCanvasV2 {
  const patchByItemId = new Map(patches.map((p) => [p.itemId, p.text.trim()]));
  if (patchByItemId.size === 0) return canvas;

  return {
    ...canvas,
    blocks: canvas.blocks.map((block) => ({
      ...block,
      items: block.items.map((item) =>
        patchByItemId.has(item.itemId) ? { ...item, text: patchByItemId.get(item.itemId)! } : item
      ),
    })),
  };
}

/** Zbiór itemId aktualnie odrzuconych przez lektora — wejście do Lesson Refresh. */
export function getRejectedItemIds(canvas: ScenarioCanvasV2): string[] {
  return allItems(canvas)
    .filter((it) => it.review.state === 'rejected')
    .map((it) => it.itemId);
}

/**
 * Response schema Lesson Refresh wymaga DOKŁADNEJ równości zbiorów itemId:
 * zwrócone ID muszą być identyczne (jako zbiór) z odrzuconymi ID, którymi
 * model został nakarmiony — ani mniej, ani więcej, ani inne.
 */
export function validateCanvasRefreshOutput(parsed: CanvasRefreshOutput | null | undefined, rejectedItemIds: string[]): void {
  if (!parsed || !Array.isArray(parsed.items)) {
    throw new Error('Model zwrócił nieprawidłową odpowiedź dla Lesson Refresh.');
  }
  const expected = new Set(rejectedItemIds);
  const returned = new Set(parsed.items.map((it) => it.itemId));
  if (expected.size !== returned.size || [...expected].some((id) => !returned.has(id))) {
    throw new Error('Model zwrócił inny zbiór itemId niż odrzucone elementy — Lesson Refresh odrzucony.');
  }
  for (const item of parsed.items) {
    if (!item.text || !String(item.text).trim()) {
      throw new Error(`Model zwrócił pusty tekst dla podmienianego elementu "${item.itemId}".`);
    }
  }
}

/**
 * Podmienia WYŁĄCZNIE odrzucone pozycje treścią z modelu, zwiększa ich
 * `generation`, przestawia stan z powrotem na "pending". Zaakceptowane
 * elementy pozostają nienaruszone. Zwiększa `revision` całego canvasu.
 */
export function applyLessonRefresh(canvas: ScenarioCanvasV2, refreshed: CanvasRefreshOutput, mutationId: string, now: string): ScenarioCanvasV2 {
  const patchByItemId = new Map(refreshed.items.map((it) => [it.itemId, it]));

  return {
    ...canvas,
    revision: canvas.revision + 1,
    updatedAt: now,
    lastMutationId: mutationId,
    blocks: canvas.blocks.map((block) => ({
      ...block,
      items: block.items.map((item) => {
        const patch = patchByItemId.get(item.itemId);
        if (!patch) return item;
        return {
          ...item,
          text: patch.text.trim(),
          kind: patch.kind,
          generation: item.generation + 1,
          review: { state: 'pending', rejectionReason: null },
        };
      }),
    })),
  };
}
