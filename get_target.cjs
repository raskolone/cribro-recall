const fs = require('fs');
const content = fs.readFileSync('server.ts', 'utf8');
const startMatch = "const handleTTS = async (req: express.Request, res: express.Response) => {";
const endMatch = "  app.get(\"/api/tts\", handleTTS);";

const startIndex = content.indexOf(startMatch);
const endIndex = content.indexOf(endMatch, startIndex);

if (startIndex !== -1 && endIndex !== -1) {
  const targetContent = content.substring(startIndex, endIndex);
  fs.writeFileSync('target_content.txt', targetContent);
  console.log('Saved target content to target_content.txt');
} else {
  console.log('Matches not found!');
}
