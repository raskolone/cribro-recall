const fs = require('fs');
const text = fs.readFileSync('vocab.txt', 'utf8');

const lines = text.split('\n').map(l => l.trim()).filter(l => l);

const sets = [];
let currentLevelGroup = '';
let currentLevelName = '';
let currentLevelBadge = '';
let currentSet = null;
let currentWords = [];
let wordIdCounter = 1000;

for (let line of lines) {
  if (line.includes('Baza słownictwa') || line.includes('Zasada pracy:')) continue;

  if (line.match(/^[A-C][1-2]–?[A-C]?[1-2]? —/)) {
    // Level header
    if (line.startsWith('A1–A2')) {
      currentLevelGroup = 'a1_a2';
      currentLevelName = 'Fundamenty Codziennej Komunikacji';
      currentLevelBadge = 'A1-A2';
    } else if (line.startsWith('B1–B2')) {
      currentLevelGroup = 'b1_b2';
      currentLevelName = 'Samodzielność i Precyzja';
      currentLevelBadge = 'B1-B2';
    } else if (line.startsWith('C1')) {
      currentLevelGroup = 'c1_c2';
      currentLevelName = 'Nuanse, Styl i Profesjonalna Komunikacja';
      currentLevelBadge = 'C1';
    }
    continue;
  }

  if (line.match(/^\d+\.\s/)) {
    // New category
    if (currentSet) {
      currentSet.words = currentWords;
      sets.push(currentSet);
    }
    const title = line.replace(/^\d+\.\s/, '').trim();
    const idPrefix = currentLevelGroup === 'a1_a2' ? 'a' : (currentLevelGroup === 'b1_b2' ? 'b' : 'c');
    const categoryNumber = line.match(/^(\d+)/)[1];
    
    currentSet = {
      id: `gen-${idPrefix}-${categoryNumber}`,
      title: title,
      levelGroup: currentLevelGroup,
      levelName: currentLevelName,
      levelBadge: currentLevelBadge,
      description: `Słownictwo z kategorii: ${title}`,
      isGeneral: true
    };
    currentWords = [];
    continue;
  }

  // Word line: english — polish
  if (line.includes('—')) {
    const [english, polish] = line.split('—').map(s => s.trim());
    if (english && polish) {
      currentWords.push({
        id: `gw-${wordIdCounter++}`,
        english,
        polish
      });
    }
  }
}

if (currentSet) {
  currentSet.words = currentWords;
  sets.push(currentSet);
}

fs.writeFileSync('newSets.json', JSON.stringify(sets, null, 2));
console.log('Parsed', sets.length, 'sets');
