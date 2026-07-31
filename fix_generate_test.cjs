const fs = require('fs');
let code = fs.readFileSync('services/geminiService.ts', 'utf8');

const generateTestRegex = /export const generateTest = async \([\s\S]*?body: JSON.stringify\(\{[\s\S]*?\}\)\n  \}\);/m;

const match = code.match(generateTestRegex);
if (match) {
  const replacement = `export const generateTest = async (
  level: string,
  testTitle: string,
  scope: string,
  studentProfile: string,
  lessonContext: string,
  allLessonsContext: string,
  tasksCount: number,
  attemptsLimit: number,
  selectedTypes: string[] = ['multiple_choice', 'fill_in_blank', 'translation'],
  fileData?: { data: string; mimeType: string } | null,
  driveFile?: { id: string, mimeType: string, token: string },
  typeCounts?: Record<string, number>
): Promise<any[]> => {
  const user = auth.currentUser;
  const token = user ? await user.getIdToken() : '';
  
  const payload = {
      level,
      testTitle,
      scope,
      studentProfile,
      lessonContext,
      allLessonsContext,
      tasksCount,
      attemptsLimit,
      selectedTypes,
      typeCounts,
      fileData,
      driveFile
    };

  // Try DeepSeek first if no files attached
  if (!fileData && !driveFile) {
    try {
      console.log('Attempting generateTest via DeepSeek...');
      const resDs = await fetch('/api/deepseek/generate-test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': \`Bearer \${token}\`
        },
        body: JSON.stringify(payload)
      });
      if (resDs.ok) {
         const data = await resDs.json();
         return data.questions;
      }
    } catch (e) {
      console.warn('DeepSeek test generation failed, falling back to Gemini', e);
    }
  }

  const res = await fetch('/api/gemini/generate-test', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': \`Bearer \${token}\`
    },
    body: JSON.stringify(payload)
  });`;

  code = code.replace(generateTestRegex, replacement);
  fs.writeFileSync('services/geminiService.ts', code);
}
