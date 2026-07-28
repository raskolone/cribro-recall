sed -i '/const \[showHints, setShowHints\] = useState<boolean\[\]>(\[\]);/a \
  const [isTopicModalOpen, setIsTopicModalOpen] = useState(false);\n  const [grammarChapters, setGrammarChapters] = useState<any[]>([]);\n  const [isLoadingTopics, setIsLoadingTopics] = useState(false);' components/dashboard/AIExerciseGeneratorScreen.tsx
