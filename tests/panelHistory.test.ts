import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PanelPlace,
  toPlace,
  samePlace,
  toHistoryState,
  readHistoryState,
  decideHistoryAction,
  goBackOr,
} from '../utils/panelHistory';

/**
 * Warstwa historii panelu: miejsce → wpis `history.state` → miejsce, decyzja
 * „dopisz / podmień / nic" i przycisk „Wróć" jako „wstecz".
 */

const home: PanelPlace = {
  view: 'dashboard',
  activeSetId: null,
  adminSelectedUserId: null,
  adminActiveTab: null,
  adminSelectedGroupId: null,
  activeTaskId: null,
  activeTestId: null,
  homeworkFilterStatus: null,
};
const crm: PanelPlace = { ...home, adminActiveTab: 'students' };
const groupCard: PanelPlace = { ...home, adminActiveTab: 'group-detail', adminSelectedGroupId: 'grp_jacobs' };
const member: PanelPlace = { ...groupCard, adminActiveTab: 'profile', adminSelectedUserId: 'usr_marta' };

test('wpis historii odtwarza dokładnie to samo miejsce', () => {
  const entry = readHistoryState(toHistoryState(member, 3));
  assert.ok(entry);
  assert.equal(entry.idx, 3);
  assert.ok(samePlace(entry.place, member));
});

test('wpis jest kopią — późniejsza zmiana miejsca go nie rusza', () => {
  const place = { ...crm };
  const state = toHistoryState(place, 1);
  place.adminActiveTab = 'homework';
  assert.equal(readHistoryState(state)!.place.adminActiveTab, 'students');
});

test('obce i uszkodzone stany nie są miejscem panelu', () => {
  assert.equal(readHistoryState(null), null);
  assert.equal(readHistoryState(undefined), null);
  assert.equal(readHistoryState('x'), null);
  assert.equal(readHistoryState({}), null);
  assert.equal(readHistoryState({ cribroPanel: 1, idx: 2, place: { view: 5 } }), null);
  assert.equal(readHistoryState({ foo: 'bar' }), null);
});

test('pola o złym typie schodzą do null, a numer wpisu do 0', () => {
  const entry = readHistoryState({
    cribroPanel: 1,
    idx: -4,
    place: { view: 'dashboard', adminActiveTab: 7, adminSelectedUserId: '' },
  });
  assert.ok(entry);
  assert.equal(entry.idx, 0);
  assert.equal(entry.place.adminActiveTab, null);
  assert.equal(entry.place.adminSelectedUserId, null);
});

test('dawny wpis { view, activeSetId } nadal daje miejsce, bez numeru wpisu', () => {
  const entry = readHistoryState({ view: 'flashcard-study', activeSetId: 'set1', activeTaskId: null });
  assert.ok(entry);
  assert.equal(entry.idx, null);
  assert.equal(entry.place.view, 'flashcard-study');
  assert.equal(entry.place.activeSetId, 'set1');
  assert.equal(entry.place.adminActiveTab, null);
});

test('toPlace: brak widoku to nie miejsce', () => {
  assert.equal(toPlace({ adminActiveTab: 'students' }), null);
  assert.equal(toPlace(null), null);
  assert.deepEqual(toPlace({ view: 'dashboard' }), home);
});

test('decyzja: to samo miejsce → nic, także tuż po popstate', () => {
  assert.equal(decideHistoryAction(crm, { ...crm }, false), 'none');
  assert.equal(decideHistoryAction(crm, { ...crm }, true), 'none');
});

test('decyzja: nowe miejsce → nowy wpis', () => {
  assert.equal(decideHistoryAction(crm, home, false), 'push');
  assert.equal(decideHistoryAction(member, groupCard, false), 'push');
});

test('decyzja: zmiana tuż po popstate podmienia wpis, nie dopisuje', () => {
  assert.equal(decideHistoryAction(crm, home, true), 'replace');
});

test('decyzja: samo dopisanie groupId do tego samego miejsca to podmiana', () => {
  const beforeGroupKnown = { ...groupCard, adminSelectedGroupId: null };
  assert.equal(decideHistoryAction(groupCard, beforeGroupKnown, false), 'replace');
});

test('decyzja: groupId razem ze zmianą zakładki to nowy wpis', () => {
  assert.equal(decideHistoryAction(groupCard, crm, false), 'push');
});

test('decyzja: zmiana groupId z jednej grupy na drugą to nowy wpis', () => {
  assert.equal(
    decideHistoryAction({ ...groupCard, adminSelectedGroupId: 'grp_b' }, groupCard, false),
    'push'
  );
});

/**
 * Atrapa przeglądarki: lista wpisów + wskaźnik, `popstate` wołany synchronicznie
 * (tak jak w przeglądarce po back/forward). Sterownik robi to samo co Dashboard:
 * po zmianie miejsca pyta `decideHistoryAction`, po popstate ustawia stan
 * i oznacza okno dostrajania.
 */
function makeBrowser(start: PanelPlace) {
  const entries: unknown[] = [toHistoryState(start, 0)];
  let at = 0;
  let current = start;
  let committed = start;
  let idx = 0;
  let settling = false;
  let pushes = 0;
  let popHandled = 0;

  const hist = {
    get state() {
      return entries[at];
    },
    back() {
      if (at > 0) {
        at -= 1;
        pop();
      }
    },
  };
  const pop = () => {
    const entry = readHistoryState(entries[at]);
    if (!entry) return;
    popHandled += 1;
    committed = entry.place;
    idx = entry.idx ?? idx;
    settling = true;
    current = entry.place; // popstate wpisuje wpis do zmiennych
    flush();
  };
  /** Odpowiednik efektu zatwierdzającego po zmianie miejsca. */
  const flush = () => {
    const action = decideHistoryAction(current, committed, settling);
    if (action === 'none') return;
    if (action === 'push') {
      idx += 1;
      entries.length = at + 1; // dopisanie ucina wpisy „do przodu"
      entries.push(toHistoryState(current, idx));
      at += 1;
      pushes += 1;
    } else {
      entries[at] = toHistoryState(current, idx);
    }
    committed = current;
  };
  return {
    hist,
    go(place: PanelPlace) {
      current = place;
      flush();
    },
    /** Wywołanie tej samej zmiany po raz drugi (np. dwa efekty z jedną wartością). */
    goAgain(place: PanelPlace) {
      current = place;
      flush();
    },
    settle() {
      settling = false;
    },
    forward() {
      if (at < entries.length - 1) {
        at += 1;
        pop();
      }
    },
    get here() {
      return current;
    },
    get length() {
      return entries.length;
    },
    get at() {
      return at;
    },
    get pushes() {
      return pushes;
    },
    get popHandled() {
      return popHandled;
    },
  };
}

test('scenariusz: CRM → karta grupy → profil członka → Wstecz → Wstecz → Do przodu', () => {
  const b = makeBrowser(home);
  b.go(crm);
  b.settle();
  b.go(groupCard);
  b.settle();
  b.go(member);
  assert.equal(b.length, 4);

  b.hist.back();
  assert.ok(samePlace(b.here, groupCard), 'wstecz z profilu wraca do karty grupy');
  b.settle();
  b.hist.back();
  assert.ok(samePlace(b.here, crm), 'wstecz z karty grupy wraca do CRM');
  b.settle();
  b.forward();
  assert.ok(samePlace(b.here, groupCard), 'do przodu wraca na kartę grupy');

  assert.equal(b.length, 4, 'nawigacja po historii niczego nie dopisała ani nie ucięła');
  assert.equal(b.pushes, 3);
});

test('brak pętli: popstate nie wywołuje pushState, a powtórzone miejsce nie dubluje wpisu', () => {
  const b = makeBrowser(home);
  b.go(crm);
  b.go(crm);
  b.goAgain(crm);
  assert.equal(b.length, 2);
  assert.equal(b.pushes, 1);

  b.settle();
  b.hist.back();
  assert.equal(b.pushes, 1, 'cofnięcie nie dopisało wpisu');
  assert.equal(b.length, 2);
  assert.equal(b.popHandled, 1, 'popstate obsłużony raz');
});

test('dostrojenie po popstate (inna zakładka w tym samym oknie) podmienia wpis i nie tnie „do przodu"', () => {
  const b = makeBrowser(home);
  b.go(crm);
  b.settle();
  b.go(groupCard);
  b.settle();
  b.hist.back(); // jesteśmy na CRM, karta grupy czeka z przodu
  // AdminPanel dostraja się w oknie dostrajania — np. dopisuje kursanta
  b.go({ ...crm, adminSelectedUserId: null, adminActiveTab: 'students' });
  b.go({ ...crm, activeTaskId: 'task1' });
  assert.equal(b.length, 3, 'wpisy do przodu przetrwały');
  b.settle();
  b.forward();
  assert.ok(samePlace(b.here, groupCard));
});

test('nowa nawigacja po cofnięciu (poza oknem dostrajania) ucina wpisy do przodu', () => {
  const b = makeBrowser(home);
  b.go(crm);
  b.settle();
  b.go(groupCard);
  b.settle();
  b.hist.back();
  b.settle();
  b.go({ ...home, adminActiveTab: 'homework' });
  assert.equal(b.length, 3);
  b.forward(); // nie ma dokąd
  assert.equal(b.at, 2);
});

test('groupId poznane po wejściu w zakładkę nie robi dodatkowego wpisu', () => {
  const b = makeBrowser(home);
  b.go(crm);
  b.settle();
  b.go({ ...groupCard, adminSelectedGroupId: null });
  b.go(groupCard);
  assert.equal(b.length, 3, 'jedno wejście w kartę grupy = jeden wpis');
  assert.equal(readHistoryState(b.hist.state)!.place.adminSelectedGroupId, 'grp_jacobs', 'wpis niesie już groupId');
});

test('goBackOr: jest poprzedni wpis aplikacji → history.back(), fallback nietknięty', () => {
  let backs = 0;
  let fell = 0;
  const hist = { state: toHistoryState(crm, 2), back: () => { backs += 1; } };
  const went = goBackOr(() => { fell += 1; }, hist);
  assert.equal(went, true);
  assert.equal(backs, 1);
  assert.equal(fell, 0);
});

test('goBackOr: pierwszy wpis (świeże wejście / brak historii) → dotychczasowe zachowanie', () => {
  let backs = 0;
  let fell = 0;
  const hist = { state: toHistoryState(home, 0), back: () => { backs += 1; } };
  assert.equal(goBackOr(() => { fell += 1; }, hist), false);
  assert.equal(backs, 0);
  assert.equal(fell, 1);
});

test('goBackOr: stan obcy, dawny albo pusty → fallback (nie zgadujemy, że jest dokąd wracać)', () => {
  for (const state of [null, undefined, {}, { foo: 1 }, { view: 'dashboard' }]) {
    let fell = 0;
    let backs = 0;
    assert.equal(goBackOr(() => { fell += 1; }, { state, back: () => { backs += 1; } }), false);
    assert.equal(fell, 1);
    assert.equal(backs, 0);
  }
});

test('goBackOr: bez obiektu historii wołany jest fallback', () => {
  let fell = 0;
  assert.equal(goBackOr(() => { fell += 1; }, undefined), false);
  assert.equal(fell, 1);
});
