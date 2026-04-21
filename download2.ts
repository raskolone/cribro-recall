import https from 'https';
import fs from 'fs';
import path from 'path';

https.get('https://drive.usercontent.google.com/download?id=1HmLz7ilIE4bq0dA-JTm80-3UR8zutTIm&export=download', (res) => {
  console.log('Status Code:', res.statusCode);
  console.log('Headers:', res.headers);
  const dest = path.join(process.cwd(), 'public', 'lekcja1.mp3');
  const file = fs.createWriteStream(dest);
  res.pipe(file);
  file.on('finish', () => {
    file.close();
    console.log('File written, checking size...');
    console.log('Size:', fs.statSync(dest).size);
  });
});
