import fs from 'fs';
const stats = fs.statSync('Lesson1maciejlingo.mp3');
console.log('Size:', stats.size);
