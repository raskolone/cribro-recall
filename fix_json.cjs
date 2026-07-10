const fs = require('fs');
let code = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf-8'));

code.firestoreDatabaseId = "ai-studio-520a4841-33d0-41ef-829a-838ebc44072d";

fs.writeFileSync('firebase-applet-config.json', JSON.stringify(code, null, 2));
