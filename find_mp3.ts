import fs from 'fs';
import path from 'path';

function walk(dir: string, done: (err: Error | null, results?: string[]) => void) {
  let results: string[] = [];
  fs.readdir(dir, function(err, list) {
    if (err) return done(err);
    let pending = list.length;
    if (!pending) return done(null, results);
    list.forEach(function(file) {
      if (file === 'node_modules' || file === '.git') {
        if (!--pending) done(null, results);
        return;
      }
      file = path.resolve(dir, file);
      fs.stat(file, function(err, stat) {
        if (stat && stat.isDirectory()) {
          walk(file, function(err, res) {
            if (res) results = results.concat(res);
            if (!--pending) done(null, results);
          });
        } else {
          if (file.endsWith('.mp3')) results.push(file);
          if (!--pending) done(null, results);
        }
      });
    });
  });
}

walk('.', function(err, results) {
  if (err) throw err;
  console.log('MP3 files:', results);
});
