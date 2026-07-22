const fs = require('fs');
let code = fs.readFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', 'utf8');

// The replacement we did blindly replaced ALL instances.
// We have:
// {exerciseFormat === 'puzzle' ? (language === 'pl' ? 'Zakończ rozgrzewkę' : 'Finish warmup') : (language === 'pl' ? 'Zakończ i podsumuj' : 'Finish & Summarize')}

// There are 4 of them. Let's find them and replace them.
// Inside `exerciseFormat === 'puzzle' ? (` which starts at line ~1750:
// 1st one: Should be "Zakończ rozgrzewkę"
// 2nd one (inside `evaluationStatuses[activeSentenceIndex] !== 'evaluated' ? ...` which is the else block): Should be "Zakończ i podsumuj"
// 3rd one (inside the else block of the previous one): Should be "Zakończ i podsumuj"

code = code.replace(
    /\{exerciseFormat === 'puzzle' \? \(language === 'pl' \? 'Zakończ rozgrzewkę' : 'Finish warmup'\) : \(language === 'pl' \? 'Zakończ i podsumuj' : 'Finish & Summarize'\)\}/g,
    (match, offset, string) => {
        // If we look at the characters just before it... it's inside AILoadingButton.
        // Actually, we can just replace the first one with warmup, and the rest with summarize.
        return match;
    }
);

// Better way: split the file, first occurrence is puzzle block, the rest are typing blocks.
let parts = code.split(`{exerciseFormat === 'puzzle' ? (language === 'pl' ? 'Zakończ rozgrzewkę' : 'Finish warmup') : (language === 'pl' ? 'Zakończ i podsumuj' : 'Finish & Summarize')}`);
if (parts.length === 4) {
    code = parts[0] + 
           `{language === 'pl' ? 'Zakończ rozgrzewkę' : 'Finish warmup'}` + 
           parts[1] + 
           `{language === 'pl' ? 'Zakończ i podsumuj' : 'Finish & Summarize'}` + 
           parts[2] + 
           `{language === 'pl' ? 'Zakończ i podsumuj' : 'Finish & Summarize'}` + 
           parts[3];
    console.log("Patched 3 occurrences");
} else {
    console.log("Found " + (parts.length - 1) + " occurrences. Doing regex with count.");
    let count = 0;
    code = code.replace(
        /\{exerciseFormat === 'puzzle' \? \(language === 'pl' \? 'Zakończ rozgrzewkę' : 'Finish warmup'\) : \(language === 'pl' \? 'Zakończ i podsumuj' : 'Finish & Summarize'\)\}/g,
        () => {
            count++;
            if (count === 1) return `{language === 'pl' ? 'Zakończ rozgrzewkę' : 'Finish warmup'}`;
            return `{language === 'pl' ? 'Zakończ i podsumuj' : 'Finish & Summarize'}`;
        }
    );
}

fs.writeFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', code);
