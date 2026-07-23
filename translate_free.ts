import * as fs from 'fs';

const dict = JSON.parse(fs.readFileSync('dictionary.json', 'utf8'));

async function translateKeys() {
    const enDict: Record<string, string> = {};
    const plDict: Record<string, string> = {};
    
    const batchSize = 10;
    for (let i = 0; i < dict.length; i += batchSize) {
        const batch = dict.slice(i, i + batchSize);
        console.log(`Translating batch ${i} to ${i + batchSize}...`);
        
        try {
            // translate one by one to avoid large payloads, or join with newlines
            for (const text of batch) {
                const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=pl&tl=en&dt=t&q=${encodeURIComponent(text)}`;
                const res = await fetch(url);
                const data = await res.json();
                const translated = data[0].map((item: any) => item[0]).join('');
                enDict[text] = translated || text;
                plDict[text] = text;
            }
        } catch (e) {
            console.error(`Error on batch ${i}:`, e);
            for (const key of batch) {
                enDict[key] = key;
                plDict[key] = key;
            }
        }
    }
    
    fs.writeFileSync('en.json', JSON.stringify(enDict, null, 2));
    fs.writeFileSync('pl.json', JSON.stringify(plDict, null, 2));
    console.log('Translations saved.');
}

translateKeys().catch(console.error);
