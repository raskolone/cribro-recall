const fs = require('fs');
let content = fs.readFileSync('components/tests/TakeTestScreen.tsx', 'utf8');

if (!content.includes('import Markdown')) {
    content = content.replace("import React, { useState } from 'react';", "import React, { useState } from 'react';\nimport Markdown from 'react-markdown';\nimport { CheckCircle, XCircle } from 'lucide-react';");
}

const successPattern = /<p className="text-content-muted">\{i18n\.t\("Twoje odpowiedzi zostały zapisane\. Oczekuj na pełne sprawdzenie przez nauczyciela\."\)\}<\/p>/;
const newSuccessHtml = `<p className="text-content-muted">{i18n.t("Twoje odpowiedzi zostały zapisane.")}</p>
        
        {gradingResult?.feedback && (
          <div className="mt-8 text-left max-w-3xl mx-auto">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <CheckCircle className="text-primary w-6 h-6" /> {i18n.t("Informacja zwrotna (AI Feedback)")}
            </h3>
            
            {gradingResult.score !== undefined && (
              <div className="mb-4 text-lg">
                <strong>{i18n.t("Wynik:")}</strong> {gradingResult.score} {i18n.t("pkt")}
              </div>
            )}

            <div className="bg-black/30 backdrop-blur-sm border border-white/10 p-6 rounded-2xl prose prose-invert max-w-none text-white/90">
              <Markdown>{gradingResult.feedback}</Markdown>
            </div>
          </div>
        )}`;

content = content.replace(successPattern, newSuccessHtml);

fs.writeFileSync('components/tests/TakeTestScreen.tsx', content);
