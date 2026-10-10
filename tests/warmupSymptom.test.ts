import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../i18n';
import { buildWarmupRounds } from '../utils/warmupRounds';

/**
 * H3 — dane z objawu (zrzuty z telefonu): polecenie „Chciałbym mieć hamak na moim przestronnym
 * balkonie.”, dostępne frazy „I would like”, „simple furniture”, „We chose”, „for our small,”,
 * „cramped apartment.”. Z zestawu pasuje tylko „I would like”; reszta to kawałki drugiego zdania.
 */
const HAMMOCK = 'I would like to have a hammock on my spacious balcony.';
const FURNITURE = 'We chose simple furniture for our small, cramped apartment.';
const HAMMOCK_PL = 'Chciałbym mieć hamak na moim przestronnym balkonie.';
const FURNITURE_PL = 'Wybraliśmy proste meble do naszego małego, ciasnego mieszkania.';

const hammockItem = { chunks: ['I would like', 'to have a hammock', 'on my spacious balcony.'], correctSentence: HAMMOCK, polishTranslation: HAMMOCK_PL };
const furnitureItem = { chunks: ['We chose', 'simple furniture', 'for our small,', 'cramped apartment.'], correctSentence: FURNITURE, polishTranslation: FURNITURE_PL };

const words = (text: string) => text.toLowerCase().replace(/[.,!?]/g, '').split(/\s+/).filter(Boolean);

test('żaden kafelek rundy nie jest kawałkiem INNEGO zdania zadania', () => {
  const rounds = buildWarmupRounds([], { warmup: [furnitureItem, hammockItem] });
  assert.equal(rounds.length, 2);
  for (const round of rounds) {
    const foreign = rounds.filter((r) => r !== round).flatMap((r) => r.chunks);
    for (const tile of [...round.chunks, ...round.distractors]) {
      assert.ok(
        !foreign.includes(tile),
        `kafelek „${tile}” w rundzie „${round.sourceLabel}” pochodzi z innego zdania`
      );
    }
    assert.ok(round.distractors.length <= 1);
  }
});

test('objaw: polecenie o hamaku + kafelki zdania o meblach (pary rozjechane) nie dochodzi do kursanta', () => {
  // Model przepisał polskie tłumaczenie z drugiego elementu do pierwszego: dwa różne zdania
  // angielskie z tym samym poleceniem. Którego z nich oczekuje polecenie — nie wiadomo.
  const rounds = buildWarmupRounds([], {
    warmup: [{ ...furnitureItem, polishTranslation: HAMMOCK_PL }, hammockItem],
  });
  const shown = rounds.map((r) => ({ prompt: r.sourceLabel, tiles: [...r.chunks, ...r.distractors].flatMap(words) }));
  const mismatched = shown.filter((r) => r.prompt === HAMMOCK_PL && r.tiles.includes('chose'));
  assert.equal(mismatched.length, 0, 'polecenie o hamaku nie może dostać kafelków „We chose…”');
});
