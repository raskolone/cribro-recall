const fs = require('fs');

// Read existing TS file
let tsContent = fs.readFileSync('data/generalVocabulary.ts', 'utf8');

// Read new sets
const newSets = JSON.parse(fs.readFileSync('newSets.json', 'utf8'));

// Extract existing sets to check for global word uniqueness if needed
// Actually, "w każdej kategorii jedno pojęcie występuje tylko raz" means uniqueness per CATEGORY, not global.
// Wait, "Nie usuwaj aktualnego słownictwa... a tylko przeanalizuj, czy nie ma powtórek."
// Let's just create a new TS file that includes the existing content plus the new sets, ensuring no duplicates.

// But wait, the easiest way is to parse the TS file into JS, add the new sets, and stringify it back.
// Since it's TS, it has `export const GENERAL_VOCABULARY_SETS: GeneralVocabSet[] = [ ... ];`
// We can use a regex or string manipulation to insert the new objects into the array.

let newObjectsStr = newSets.map(set => {
  let str = `  {\n`;
  str += `    id: '${set.id}',\n`;
  str += `    title: '${set.title}',\n`;
  str += `    levelGroup: '${set.levelGroup}',\n`;
  str += `    levelName: '${set.levelName}',\n`;
  str += `    levelBadge: '${set.levelBadge}',\n`;
  str += `    description: '${set.description}',\n`;
  str += `    isGeneral: ${set.isGeneral},\n`;
  str += `    words: [\n`;
  str += set.words.map(w => `      { id: '${w.id}', english: '${w.english.replace(/'/g, "\\'")}', polish: '${w.polish.replace(/'/g, "\\'")}' }`).join(',\n');
  str += `\n    ]\n  }`;
  return str;
}).join(',\n');

// Find the end of the array `];` in the TS file and insert the new objects.
// Wait, we need to check for duplicates in the new sets themselves just in case.
newSets.forEach(set => {
  const seen = new Set();
  set.words = set.words.filter(w => {
    const key = w.english.toLowerCase() + '|' + w.polish.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
});

let insertIndex = tsContent.lastIndexOf('];');
if (insertIndex !== -1) {
    let before = tsContent.substring(0, insertIndex);
    // Find the last object to check if we need a comma
    if (!before.trim().endsWith(',')) {
        before = before.trimEnd() + ',\n';
    }
    const finalTs = before + newObjectsStr + '\n];\n';
    fs.writeFileSync('data/generalVocabulary.ts', finalTs);
    console.log('Successfully merged');
} else {
    console.log('Could not find ];');
}
