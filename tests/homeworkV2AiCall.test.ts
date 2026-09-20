import assert from 'node:assert/strict';
import test from 'node:test';

import { createAiCall } from '../functions/src/homeworkV2/openai';

/**
 * Diagnoza P0 (generateHomeworkV2: 145 s zamiast 3-5 s dla 6 zadań):
 * `createAiCall` wołał Gemini 2.5 Flash bez `thinkingConfig`, więc model
 * dokładał domyślny, niewidoczny budżet rozumowania do KAŻDEGO wywołania —
 * generatora, walidatora i każdej regeneracji. Te testy pilnują, żeby
 * request do Gemini zawsze jawnie wyłączał ten budżet (chyba że wywołujący
 * jawnie poprosi o inny), więc regresja nie wróci po cichu przy następnej
 * zmianie w `openai.ts`.
 */

interface CapturedRequest {
  url: string;
  body: any;
}

function installGeminiFetchStub(responseText: string) {
  const original = globalThis.fetch;
  const captured: CapturedRequest[] = [];

  (globalThis as any).fetch = async (url: string, init: any) => {
    captured.push({ url, body: JSON.parse(init.body) });
    return {
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: responseText }] } }],
        usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5 },
      }),
      text: async () => '',
    } as any;
  };

  return {
    captured,
    restore: () => {
      (globalThis as any).fetch = original;
    },
  };
}

test('createAiCall wyłącza domyślnie budżet myślenia Gemini (thinkingBudget: 0)', async () => {
  const stub = installGeminiFetchStub('{"ok":true}');
  try {
    const call = createAiCall({ geminiApiKey: 'fake-key' });
    await call({ system: 'sys', user: 'user', taskName: 'test' });

    assert.equal(stub.captured.length, 1);
    assert.deepEqual(stub.captured[0].body.generationConfig.thinkingConfig, { thinkingBudget: 0 });
    assert.equal(stub.captured[0].body.generationConfig.responseMimeType, 'application/json');
  } finally {
    stub.restore();
  }
});

test('createAiCall przepuszcza jawnie podany thinkingBudget zamiast domyślnego zera', async () => {
  const stub = installGeminiFetchStub('{"ok":true}');
  try {
    const call = createAiCall({ geminiApiKey: 'fake-key' });
    await call({ system: 'sys', user: 'user', taskName: 'test', thinkingBudget: 512 });

    assert.deepEqual(stub.captured[0].body.generationConfig.thinkingConfig, { thinkingBudget: 512 });
  } finally {
    stub.restore();
  }
});
