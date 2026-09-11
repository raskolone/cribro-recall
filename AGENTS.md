# CRIBRO ENGLISH — Wytyczne dla Asystentów AI (AGENTS.md)

Dokument dla każdego asystenta i edytora AI (Antigravity, Cursor, Windsurf, Claude Code, Copilot, Aider) rozpoczynającego nową sesję pracy z tym repozytorium.

---

## ⚡ 1. Obowiązkowy Pierwszy Krok
Przed przystąpieniem do jakichkolwiek modyfikacji kodu lub analizy, **bezwzględnie zapoznaj się z plikiem [CHANGELOG.md](./CHANGELOG.md)** oraz **[ELEARNING_CLASSROOM_PLAN.md](./ELEARNING_CLASSROOM_PLAN.md)** (dla prac związanych z e-learningiem i prezentacjami).
Zawierają one:
- Pełny przegląd funkcjonalności platformy i ról użytkowników (`user`, `teacher`, `admin`),
- Architekturę techniczną i integracje (Firebase, Notion, Resend, Gemini/OpenAI, TTS, LiveSession PIN),
- Kompletny rejestr zmian wdrożonych w ciągu ostatnich 24 godzin (Mailing, Notion sync, format 4 bloków, prace domowe, sesje live na PIN),
- Spis kluczowych plików źródłowych oraz roadmapę modułu e-learningu.

⚠️ **Zacznij od sekcji „3. Znane Ograniczenia i Dług Techniczny" w CHANGELOG.md.** Opisuje rzeczy, których nie widać w kodzie na pierwszy rzut oka (otwarte reguły Firestore dla brudnopisu, brak scalania równoczesnych zmian, zakres nieprzetestowany wizualnie), a które zmieniają sposób podejścia do zadania.


---

## 🛠 2. Standardowe Polecenia Weryfikacji
Przed zatwierdzeniem jakichkolwiek zmian uruchom:
```bash
# Sprawdzenie błędów typowania TypeScript:
npx tsc --noEmit

# Uruchomienie testów jednostkowych (163 testy):
npm test

# Sprawdzenie poprawnego budowania bundle:
npm run build
```

### Wdrożenia Firebase — zawsze przez skrypty npm
Firebase CLI to skrypt `#!/usr/bin/env node`, więc bierze **pierwszy `node` z PATH**. Na systemowym node 26 zrywa połączenia i zgłasza to jako **mylący błąd logowania** (`Failed to authenticate, have you run firebase login?`), nawet gdy poświadczenia są w porządku. Dlatego każdy skrypt `firebase:*` i `deploy:*` wymusza `node@22` — nie wywołuj `firebase` bezpośrednio.
```bash
npm run firebase:whoami     # kto jest zalogowany
npm run firebase:login      # logowanie (interaktywne, otwiera przeglądarkę)
npm run deploy:rules        # reguły i indeksy Firestore
npm run deploy:functions    # Cloud Functions (import z Notion)
```

---

## 🛡️ 3. Kluczowe Zasady Projektu
1. **Bezpieczeństwo**: Nigdy nie umieszczaj kluczy API (Resend, Notion, OpenAI, Gemini) po stronie frontendu. Wszystkie operacje wrażliwe realizowane są przez endpointy Express w `server.ts` pod ścieżką `/api/*` z weryfikacją Firebase Bearer token.
2. **Format lekcji**: Wszelkie operacje na lekcjach muszą respektować podział na 4 standardowe bloki Notion (`Words & Phrases`, `Grammar & Accuracy`, `Pronunciation`, `Homework`). Do operacji na blokach używaj funkcji z `utils/lessonBlocks.ts`.
3. **Mailing i e-maile**:
   - Klucz Resend API konfigurowany jest w Ustawieniach Administratora (`SettingsScreen.tsx`), nie w widoku Mailingu.
   - Wysyłka prac domowych przez e-mail wymaga wcześniejszego potwierdzenia lektora w oknie `HomeworkEmailConfirmationModal.tsx`.
   - Oficjalne adresy nadawców: `wyrozumski@maciej.pro` oraz `maciej@learnwithmaciej.com`.
