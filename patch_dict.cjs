const fs = require('fs');
let en = JSON.parse(fs.readFileSync('en.json', 'utf8'));
let pl = JSON.parse(fs.readFileSync('pl.json', 'utf8'));

en["Przeczytaj zdanie"] = "Read the sentence";
pl["Przeczytaj zdanie"] = "Przeczytaj zdanie";

en["Wymowa brytyjska"] = "British pronunciation";
pl["Wymowa brytyjska"] = "Wymowa brytyjska";

en["Wymowa amerykańska"] = "American pronunciation";
pl["Wymowa amerykańska"] = "Wymowa amerykańska";

fs.writeFileSync('en.json', JSON.stringify(en, null, 2));
fs.writeFileSync('pl.json', JSON.stringify(pl, null, 2));
