import fs from 'fs';
import https from 'https';
import path from 'path';

const url = 'https://docs.google.com/uc?export=download&id=1HmLz7ilIE4bq0dA-JTm80-3UR8zutTIm';
const dest = path.join(process.cwd(), 'public', 'lekcja1.mp3');

if (!fs.existsSync(path.join(process.cwd(), 'public'))) {
  fs.mkdirSync(path.join(process.cwd(), 'public'));
}

const req = https.get(url, (res) => {
  if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
    // Follow redirect
    https.get(res.headers.location, (redirectRes) => {
      const file = fs.createWriteStream(dest);
      redirectRes.pipe(file);
      file.on('finish', () => {
        file.close();
        console.log('Download complete');
      });
    });
  } else {
    const file = fs.createWriteStream(dest);
    res.pipe(file);
    file.on('finish', () => {
      file.close();
      console.log('Download complete');
    });
  }
});

req.on('error', (err) => {
  console.error('Download error:', err);
});
