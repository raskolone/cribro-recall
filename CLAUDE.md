# CLAUDE.md — Cribro (Recall)

Ten plik jest stałym kontekstem dla każdego agenta AI (Claude Code i inne)
pracującego nad tym repozytorium. Wczytaj go w całości przed rozpoczęciem
jakiegokolwiek zadania.

---

## 1. Czym jest ten projekt

Cribro (Recall) to platforma do nauki angielskiego, w której lektor pracuje z
konkretnymi kursantami, a ćwiczenia, fiszki, testy i prace domowe
wywodzą się z realnych notatek z odbytych lekcji — nie z generycznej
bazy słówek. Trzy role: `user` (kursant), `teacher`, `admin`.

Pełny opis logiki systemu i historia zmian: `CHANGELOG.md` w tym repo —
przeczytaj sekcję 3 („Znane Ograniczenia i Dług Techniczny") przed pracą
nad backendem lub UI. Zobacz też `AGENTS.md` (wytyczne dla innych
asystentów AI — spójne z tym plikiem) i `ELEARNING_CLASSROOM_PLAN.md`
(dla prac nad modułem e-learningu/prezentacji).

---

## 2. Architektura — skrót

- **`server.ts`** (Express) — proxy do AI, TTS, zarządzania użytkownikami,
  mailingu. Endpointy pod `/api/*`, autoryzacja przez
  `Authorization: Bearer <Firebase ID token>`.
- **`functions/`** (Firebase Cloud Functions) — reakcje na zdarzenia w
  bazie (np. mailowe powiadomienie o nowej pracy domowej) + wywołania
  `onCall` (import z Notion).
- **Warstwa AI** — kaskada dostawców (Gemini 2.5/3.6 Flash → OpenAI
  GPT-4o-mini/GPT-4o jako fallback), wymuszone schematy JSON.
- **TTS** — kaskada dostawców (ElevenLabs Multilingual V2, OpenAI TTS,
  GCP TTS) + podwójny cache (dysk lokalny + Firebase Storage).
- **Mailing** — Resend API, szablony w `functions/src/emailTemplate.ts`.
  Klucz API konfigurowany w Ustawieniach Administratora
  (`SettingsScreen.tsx`), nie w widoku Mailingu. Wysyłka prac domowych
  wymaga potwierdzenia lektora w `HomeworkEmailConfirmationModal.tsx`.
  Oficjalne adresy nadawców: `wyrozumski@maciej.pro`,
  `maciej@learnwithmaciej.com`.
- **Firestore** — model właściciela dokumentu (`studentUid`/`userId`),
  reguły w `firestore.rules` (32 KB — czytaj uważnie przed zmianą).
- **Notion** — Teacher HQ jest źródłem prawdy dla notatek z lekcji;
  aplikacja tylko czyta i synchronizuje, nigdy nie jest źródłem danych
  kursantów.
- **Format lekcji** — kontrakt 4 bloków (`Words & Phrases`,
  `Grammar & Accuracy`, `Pronunciation`, `Homework`), operacje wyłącznie
  przez `utils/lessonBlocks.ts`.
- **Wdrożenie** — produkcja na Vercelu (`vercel.json`, `api/serverless.ts`),
  DNS w Netlify. Backend (`server.ts`) w obecnej architekturze produkcyjnej
  nigdzie osobno niewystawiony — logika trafia przez `api/`.

---

## 3. Obszary wysokiego ryzyka — wymagają jawnej zgody przed zmianą

Nie modyfikuj poniższego bez wyraźnego polecenia i opisania planu przed
wdrożeniem:

- `firestore.rules` (role, uprawnienia, dostęp bez logowania) — patrz
  świeży przykład realnej dziury i naprawy w `CHANGELOG.md` sekcja 4
  (`scratchpadPins`, przejęcie cudzego PIN-u).
- middleware autoryzacji w `server.ts` (`requireFirebaseAuth`,
  `requireFirebaseAdmin`)
- ścieżki tokenowe bez logowania (`homework/direct/:token`,
  notatnik po PIN — `scratchpads/{id}` + indeks `scratchpadPins/{pin}`)

Jeśli zadanie dotyka tych plików — zatrzymaj się, opisz problem i
proponowane rozwiązanie zamiast działać od razu.

---

## 4. Konwencje kodu

- Frontend: React 19 + TypeScript + Vite + Tailwind CSS 4. Komponenty w
  `components/`, pogrupowane po domenie (`admin/`, `auth/`, `dashboard/`,
  `flashcards/`, `practice/`, `presentation/`, `scratchpad/`, `settings/`,
  `ui/`, `wordSets/`) — nowy komponent trafia do właściwego podkatalogu,
  nie do korzenia `components/`.
- Stan globalny przez React Context w `context/` (`AuthContext`,
  `ThemeContext`, `VocabularyContext`, `SettingsContext`,
  `FlashcardContext`, `LanguageContext`) — nie wprowadzaj kolejnego
  menedżera stanu bez potrzeby.
- Logika domenowa bez UI trafia do `utils/` (np. `lessonBlocks.ts`,
  `homework.ts`, `accessCode.ts`) lub `services/` (integracje zewnętrzne).
- Motyw: kolory przez tokeny (`text-text-hi`, `border-line-strong`,
  `bg-line-soft`, `bg-ink` itd. z `utils/themeTokens.ts`), nie surowe
  klasy typu `text-white` — patrz dług techniczny w sekcji 6.
- Filozofia UI: mniej znaczy lepiej — chowaj rzadziej używane funkcje w
  menu, koloru używaj jako sygnału stanu, nie ozdoby.
- i18n: teksty w `en.json` / `pl.json` przez `i18next`/`react-i18next`,
  nie hardkoduj stringów w komponentach.

---

## 5. Komendy operacyjne

- Dev (frontend + backend): `npm run dev`
- Build produkcyjny: `npm run build` (Vite + esbuild dla `server.ts` i
  `api/serverless.ts`)
- Sprawdzenie typów: `npm run lint` (czyli `tsc --noEmit`)
- Testy jednostkowe: `npm test`
- Emulatory Firebase (Firestore + Auth): `npm run emulators`
- Testy reguł Firestore na emulatorze: `npm run test:rules`
- Deploy reguł/indeksów Firestore: `npm run deploy:rules`
- Deploy Cloud Functions: `npm run deploy:functions`
- Deploy hostingu: `npm run deploy:hosting`

**Firebase CLI zawsze przez skrypty `npm run firebase:*` / `deploy:*` —
nigdy bezpośrednio `firebase ...`.** Firebase CLI to skrypt node, który
bierze pierwszy `node` z PATH; na systemowym node 26 gaxios zrywa
połączenia i zgłasza to jako mylący błąd logowania
(„Failed to authenticate, have you run firebase login?") nawet gdy
poświadczenia są poprawne. Wszystkie skrypty `firebase:*`/`deploy:*` w
`package.json` wymuszają `node@22` przez `PATH=...` — jeśli wywołujesz
`firebase` poza nimi, wymuś to samo ręcznie.

---

## 6. Znany dług techniczny

Pełny, aktualny opis: `CHANGELOG.md` sekcja 3. Stan na 2026-09-12:

- **Wspólna edycja brudnopisu = „ostatni zapis wygrywa"** —
  `ScratchpadEditor` nie ma OT/CRDT. Bufor (`isUserTypingRef`, opóźnienie
  zapisu 600 ms) wystarcza do naprzemiennego pisania, nie do
  jednoczesnego pisania w tym samym miejscu.
- **Tryb dzienny nieobejrzany na ekranach po zalogowaniu** — ekran
  startowy i logowanie sprawdzone w obu motywach; panele lektora,
  administratora i kursanta nie były oglądane w trybie dziennym. Zostaje
  ok. 1169 wystąpień surowego `text-white` w komponentach — część jest
  poprawna (biały tekst na wypełnieniu akcentem), część do zamiany na
  tokeny z `utils/themeTokens.ts`.
- **UI ostatnich zmian nie zweryfikowane w przeglądarce** — pasek
  Prezentacji i Brudnopisu, samouczek z dymkami, zamrożona kolumna w
  Bazie Kursantów, układanka z klocków, przełącznik Easy/Hard: przeszły
  `tsc --noEmit` + testy + `npm run build`, ale nie były sprawdzone
  wzrokowo w działającej aplikacji.

---

## 7. Zasady pracy w repo (obowiązkowe dla każdego agenta AI)

### 7.1 Commituj i pushuj regularnie

Nie zostawiaj dużych, niescalonych zmian w robocie. Po każdym zamkniętym
i przetestowanym kroku (jeden komponent, jeden endpoint, jedna naprawa):

- `git add` + `git commit` z konkretnym opisem (co i dlaczego, nie
  "update"),
- `git push` na bieżąco — nie czekaj do końca sesji.

Przy zadaniach większych niż jeden plik lub dotykających obszaru
wysokiego ryzyka (sekcja 3) — commity cząstkowe co logiczny etap, żeby
dało się cofnąć pojedynczy krok bez utraty reszty pracy.

Nigdy nie zostawiaj repo w stanie, który się nie buduje lub nie odpala.
Jeśli sesja kończy się w trakcie zadania, opisz w logu (patrz 7.2), w
jakim stanie zostawiasz kod.

Uwaga: projekt jest obecnie w fazie testów przez Macieja (po PR-ach
#1–#4) — jeśli zadanie nie jest pilną naprawą, sprawdź z nim zakres przed
dużymi zmianami architektonicznymi.

### 7.2 Prowadź log pracy dla innych agentów

W katalogu głównym utrzymuj plik `AGENT_LOG.md`. Każdy agent AI
pracujący nad projektem dopisuje wpis na końcu:

```
[data] — [model/narzędzie, np. Claude Code / Sonnet]

Zadanie: krótki opis, co miałeś zrobić
Zrobione: co faktycznie zostało zmienione (pliki, funkcje)
Nie dokończone / do sprawdzenia: jeśli coś zostało w połowie
Decyzje architektoniczne: jeśli podjąłeś decyzję niejawną w
  poleceniu — zapisz ją i uzasadnienie
Ryzyka: czy dotknąłeś firestore.rules, autoryzacji, ścieżek
  tokenowych bez logowania — jeśli tak, zaznacz wyraźnie
```

### 7.3 Zanim zaczniesz nowe zadanie

Przeczytaj ostatnie 2-3 wpisy w `AGENT_LOG.md` i sprawdź
`git log --oneline -10`, żeby wiedzieć, w jakim stanie jest repo i czy
nie ma niedokończonej pracy poprzedniego agenta. Po zadaniu uzupełnij
też `CHANGELOG.md` (konwencja tego repo — patrz `AGENTS.md`).

### 7.4 Nie mieszaj zadań w jednym commicie

Jeden commit = jedna logiczna zmiana. Nie łącz naprawy buga z nową
funkcją ani refaktoru z formatowaniem.
