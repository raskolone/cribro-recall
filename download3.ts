import https from 'https';
import fs from 'fs';
import path from 'path';

function downloadFile(url: string, dest: string) {
  https.get(url, (res) => {
    if (res.statusCode === 302 || res.statusCode === 303) {
      console.log('Redirecting to:', res.headers.location);
      if (res.headers.location) {
          downloadFile(res.headers.location, dest);
      }
      return;
    }
    
    console.log('Status Code:', res.statusCode);
    
    const file = fs.createWriteStream(dest);
    res.pipe(file);
    file.on('finish', () => {
      file.close();
      console.log('File written, checking size...');
      console.log('Size:', fs.statSync(dest).size);
    });
  }).on('error', (err) => {
      console.error(err);
  });
}

downloadFile('https://docs.google.com/uc?export=download&id=1HmLz7ilIE4bq0dA-JTm80-3UR8zutTIm', path.join(process.cwd(), 'public', 'lekcja1.mp3'));
