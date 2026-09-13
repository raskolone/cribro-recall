#!/usr/bin/env bash
#
# Kopia zapasowa kont z Firebase Auth.
#
# ══ PO CO TO ISTNIEJE ══
#
# Zarządzany backup Firestore obejmuje BAZĘ, nie listę użytkowników. Konta żyją
# w Firebase Auth, który jest osobną usługą i nie ma własnego harmonogramu kopii.
# Skasowane konto zostawia więc profil `users/{uid}` bez loginu — dane są, ale
# nikt się do nich nie zaloguje, a UID nowego konta będzie inny, więc samo
# założenie konta na ten sam e-mail niczego nie odzyska.
#
# Eksport zawiera hashe haseł razem z parametrami scrypta (`hash_config` w
# osobnym pliku), więc przywrócone konta logują się TYMI SAMYMI hasłami.
# Bez parametrów hashowania hashe są bezużyteczne — dlatego lecą razem.
#
# ══ GDZIE LĄDUJE ══
#
# Domyślnie w iCloud Drive, czyli poza tym dyskiem i poza repo. Katalog można
# nadpisać zmienną CRIBRO_BACKUP_DIR.
#
# Plik zawiera hashe haseł i adresy e-mail wszystkich kursantów — traktuj go
# jak hasło, nie jak zwykły plik. Nigdy w repo (patrz .gitignore).
#
# Użycie:  npm run firebase:auth:export
#
set -euo pipefail

PROJECT="gen-lang-client-0425391821"
DEST="${CRIBRO_BACKUP_DIR:-$HOME/Library/Mobile Documents/com~apple~CloudDocs/Cribro Backup}"
STAMP="$(date +%Y-%m-%d-%H%M)"
KEEP=12   # ile ostatnich eksportów zostaje

export PATH="/opt/homebrew/opt/node@22/bin:$PATH"

mkdir -p "$DEST"
chmod 700 "$DEST"

OUT="$DEST/auth-users-$STAMP.json"

echo "→ Eksport kont z Firebase Auth (projekt $PROJECT)"
firebase auth:export "$OUT" --format=json --project "$PROJECT"
chmod 600 "$OUT"

COUNT="$(node -e "const u=require('$OUT').users||[];console.log(u.length)")"

if [ "$COUNT" -eq 0 ]; then
  # Pusty eksport to prawie na pewno awaria, nie projekt bez użytkowników.
  # Zostawienie go jako „najnowsza kopia" byłoby gorsze niż brak kopii.
  echo "✖ Eksport ma zero kont — coś poszło nie tak. Plik usuwam, poprzednie kopie zostają." >&2
  rm -f "$OUT"
  exit 1
fi

echo "✓ Zapisano $COUNT kont → $OUT"

# ══ PARAMETRY HASHOWANIA — bez nich hasła są bezużyteczne ══
#
# `auth:export` oddaje `passwordHash` i `salt` każdego konta, ale NIE oddaje
# parametrów scrypta projektu (klucz podpisujący, separator soli, rounds,
# memoryCost). Przy `auth:import` trzeba je podać z ręki — bez nich konta
# wjadą, ale żadne stare hasło nie zadziała i wszyscy kursanci muszą je
# resetować. Firebase CLI nie ma polecenia, które je pobiera; są wyłącznie
# w konsoli, jednorazowo, i się nie zmieniają.
PARAMS="$DEST/hash-config.json"
if [ ! -f "$PARAMS" ]; then
  echo ""
  echo "⚠  BRAKUJE PARAMETRÓW HASHOWANIA — kopia haseł jest na razie niepełna."
  echo "   Jednorazowo: konsola Firebase → Authentication → Users → ⋮ (prawy górny róg)"
  echo "   → „Password hash parameters\". Skopiuj cztery wartości do pliku:"
  echo "   $PARAMS"
  echo ""
  echo '   {"algorithm":"SCRYPT","base64_signer_key":"…","base64_salt_separator":"…","rounds":8,"mem_cost":14}'
  echo ""
else
  chmod 600 "$PARAMS"
  echo "✓ Parametry hashowania na miejscu → $PARAMS"
fi

# Sprzątanie starych kopii — zostaje $KEEP najnowszych.
ls -1t "$DEST"/auth-users-*.json 2>/dev/null | tail -n +$((KEEP + 1)) | while read -r old; do
  echo "  usuwam starą kopię: $(basename "$old")"
  rm -f "$old"
done
