import fs from 'fs';
const fd = fs.openSync('public/lekcja1.mp3', 'r');
const buffer = Buffer.alloc(500);
fs.readSync(fd, buffer, 0, 500, 0);
console.log(buffer.toString('utf8'));
fs.closeSync(fd);
