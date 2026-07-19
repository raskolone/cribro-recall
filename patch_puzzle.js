import fs from 'fs';
let content = fs.readFileSync('components/dashboard/PuzzleExercise.tsx', 'utf-8');

// Replace motion.button with button for the answer area
content = content.replace(/<motion\.button\s+ref=\{\(el\) => \{\s+answerTileRefs\.current\[st\.id\] = el;\s+\}\}\s+exit=\{\{ opacity: 0, scale: 0\.5, transition: \{ duration: 0\.2 \} \}\}\s+layout\s+key=\{st\.id \+ '-ans'\}/g, 
`<button
              ref={(el) => {
                answerTileRefs.current[st.id] = el;
              }}
              key={st.id + '-ans'}`);
              
content = content.replace(/<\/motion\.button>/g, '</button>');

// Replace motion.button with button for the available tiles
content = content.replace(/<motion\.button\s+key=\{tile\.id\}\s+layout\s+initial=\{\{ opacity: 0, scale: 0\.8 \}\}\s+exit=\{\{ opacity: 0, scale: 0\.5, transition: \{ duration: 0\.2 \} \}\}/g, 
`<button
                key={tile.id}`);

content = content.replace(/animate=\{\s+isError \? \{ x: \[-10, 10, -10, 10, 0\], opacity: 1 \} : \{ x: 0, y: 0, scale: 1, opacity: 1 \}\s+\}\s+transition=\{\s+isError \? \{ duration: 0\.4 \} : \{ type: "spring", stiffness: 400, damping: 30 \}\s+\}/g, '');

// Also remove AnimatePresence wrapping them? Not strictly necessary if they are just <button>, but better to replace AnimatePresence with a div or Fragment
content = content.replace(/<AnimatePresence>/g, '<>');
content = content.replace(/<\/AnimatePresence>/g, '</>');

fs.writeFileSync('components/dashboard/PuzzleExercise.tsx', content);
