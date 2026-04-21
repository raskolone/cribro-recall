import fs from 'fs';
const stats = fs.statSync('public/lekcja1.mp3');
console.log('Size:', stats.size);
