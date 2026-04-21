import fs from 'fs';
const stats = fs.statSync('public/lekcja1.mp3');
console.log('Size:', stats.size);
const buffer = Buffer.alloc(100);
const fd = fs.openSync('public/lekcja1.mp3', 'r');
fs.readSync(fd, buffer, 0, 100, 0);
console.log('Header:', buffer.toString('utf8'));
fs.closeSync(fd);
