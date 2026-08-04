const fs = require('fs');
let code = fs.readFileSync('services/geminiService.ts', 'utf8');

const oldOutputFormatRegex = /OUTPUT FORMAT \(Strict JSON\):\nReturn ONLY a valid JSON object matching the requested schema with an array "evaluations"\.`;/m;

const newOutputFormat = `OUTPUT FORMAT (Strict JSON):
Return ONLY a valid JSON object matching this schema. No markdown, no extra conversational text:
{
  "evaluations": [
    {
      "polishSentence": "Polish text",
      "correctTranslation": "English text",
      "studentAnswer": "Student text",
      "isCorrect": true/false,
      "score": 0-100,
      "explanation": "Brief explanation",
      "suggested_better_version": "Better translation",
      "feedbackSyntax": "Syntax feedback",
      "feedbackVocab": "Vocab feedback",
      "feedbackRule": "Rule feedback",
      "breakdown": {
        "meaning_score": 0-40,
        "grammar_score": 0-40,
        "vocabulary_score": 0-20
      }
    }
  ]
}\`;`;

code = code.replace(oldOutputFormatRegex, newOutputFormat);

fs.writeFileSync('services/geminiService.ts', code);
