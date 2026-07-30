const fs = require('fs');
let code = fs.readFileSync('components/admin/TopicDatabaseScreen.tsx', 'utf-8');

const target = `const DEFAULT_CHAPTERS: GrammarChapter[] = Array.from({ length: 6 }, (_, chapterIndex) => ({
  id: \`chapter-\${chapterIndex + 1}\`,
  name: \`Gramatyka \${chapterIndex + 1}\`,
  topics: getTopicsForChapter(chapterIndex).map((topicName, topicIndex) => {
    return {
      id: \`chapter-\${chapterIndex + 1}-topic-\${topicIndex + 1}\`,
      name: topicName,
      sentences: \`Wykorzystaj przykłady zdań z danego rozdziału np. \${topicName} i wygeneruj podobne zdania na tym samym poziomie\`
    };
  })
}));`;

const replacement = `const DEFAULT_CHAPTERS: GrammarChapter[] = [
  {
    id: 'chapter-grammar',
    name: 'Gramatyka',
    topics: Array.from({ length: 6 }, (_, chapterIndex) => 
      getTopicsForChapter(chapterIndex).map((topicName, topicIndex) => ({
        id: \`chapter-\${chapterIndex + 1}-topic-\${topicIndex + 1}\`,
        name: \`[Gramatyka \${chapterIndex + 1}] \${topicName}\`,
        sentences: \`Wykorzystaj przykłady zdań z danego rozdziału np. \${topicName} i wygeneruj podobne zdania na tym samym poziomie\`
      }))
    ).flat()
  }
];`;

if (code.includes(target)) {
    code = code.replace(target, replacement);
    fs.writeFileSync('components/admin/TopicDatabaseScreen.tsx', code);
    console.log("Patched TopicDatabaseScreen.tsx (Merged Grammar)");
} else {
    console.log("Target not found");
}
