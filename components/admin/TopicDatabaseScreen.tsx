import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Database, Plus, Save, Trash2, Edit2, ChevronDown, ChevronUp, ChevronRight } from 'lucide-react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import i18n from "i18next";
import { db } from '../../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';

interface GrammarTopic {
  id: string;
  name: string;
  sentences: string;
}

interface GrammarChapter {
  id: string;
  name: string;
  topics: GrammarTopic[];
}

const GRAMMAR_1_TOPICS = [
  "Useful expressions",
  "The verb to be",
  "This & that",
  "Numbers & plural nouns",
  "These & those",
  "Possessive adjectives",
  "Days, months & time",
  "Questions",
  "Prepositions of place",
  "Present Simple",
  "The verb to have",
  "The verbs: to like, to want",
  "Object pronouns",
  "Frequency adverbs",
  "There is / There are",
  "Imperative",
  "Present Continuous",
  "Can",
  "Saxon genitive",
  "Preposition of",
  "Countable & uncountable nouns; much, many, a lot of",
  "Some, any, no",
  "Must & have to",
  "Possessive pronouns",
  "Comparative adjectives",
  "Adverbs",
  "Reflexive pronouns",
  "Articles",
  "To be going to do something",
  "Asking questions",
  "Negative questions",
  "Gerund & infinitive",
  "Conjunctions",
  "Prepositions, part 1",
  "Expressions, part 1",
  "Review",
];

const GRAMMAR_3_TOPICS = [
  "Tenses review",
  "Past Simple vs. Past Continuous",
  "Comparison",
  "Present Perfect",
  "Present Perfect",
  "Present Perfect",
  "Present Perfect",
  "Present Perfect Continuous",
  "Present Perfect Simple vs. Continuous",
  "Irregular verbs",
  "Indirect questions, part 1",
  "Modal verbs",
  "Some, any, no",
  "It takes…, part 1",
  "Used to",
  "Want somebody to do something",
  "Indirect imperatives",
  "Make & do, part 1",
  "First conditional & time clauses",
  "Second conditional",
  "Get",
  "All, none, both, neither, either, most",
  "Make somebody do something",
  "The use of one/ones",
  "Passive voice, part 1",
  "Countable & uncountable nouns",
  "Use of present tenses",
  "Question tags",
  "Adjectives & adverbs",
  "Articles",
  "Future Simple & Future Continuous",
  "Subject & object questions",
  "Prepositions of time & place",
  "Prepositions, part 3",
  "Expressions, part 3",
  "Review",
];

const getTopicsForChapter = (chapterIndex: number) => {
  if (chapterIndex === 0) return GRAMMAR_1_TOPICS;
  if (chapterIndex === 2) return GRAMMAR_3_TOPICS;
  return Array.from({ length: 36 }, (_, topicIndex) => `Temat ${topicIndex + 1}`);
};

const DEFAULT_CHAPTERS: GrammarChapter[] = Array.from({ length: 6 }, (_, chapterIndex) => ({
  id: `chapter-${chapterIndex + 1}`,
  name: `Gramatyka ${chapterIndex + 1}`,
  topics: getTopicsForChapter(chapterIndex).map((topicName, topicIndex) => {
    return {
      id: `chapter-${chapterIndex + 1}-topic-${topicIndex + 1}`,
      name: topicName,
      sentences: `Wykorzystaj przykłady zdań z danego rozdziału np. ${topicName} i wygeneruj podobne zdania na tym samym poziomie`
    };
  })
}));

export default function TopicDatabaseScreen() {
  const { user } = useAuth();

  const allowedEmails = ['maciej.wyrozumski@gmail.com', 'marta.lukaszczyk@gmail.com'];
  if (!user?.email || !allowedEmails.includes(user.email.toLowerCase())) {
    return <div className="p-8 text-center text-red-500 font-bold">Brak dostępu.</div>;
  }

  const [chapters, setChapters] = useState<GrammarChapter[]>(DEFAULT_CHAPTERS);
  const [expandedChapterId, setExpandedChapterId] = useState<string | null>(null);
  const [expandedTopicId, setExpandedTopicId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);



  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const docRef = doc(db, 'system', 'topic_database');
      const snap = await getDoc(docRef);
      if (snap.exists() && snap.data().chapters) {
        // Merge fetched data with defaults
        const fetched = snap.data().chapters as GrammarChapter[];
        setChapters(prevChapters => prevChapters.map(chapter => {
          const foundChapter = fetched.find(f => f.id === chapter.id);
          if (foundChapter) {
            return {
              ...chapter,
              topics: chapter.topics.map(topic => {
                const foundTopic = foundChapter.topics.find(t => t.id === topic.id);
                // If the saved name is just generic "Temat X", overwrite it with the new default name from code
                const isGenericName = /^Temat \d+$/.test(foundTopic.name || '');
                const finalName = isGenericName ? topic.name : (foundTopic.name || topic.name);
                
                return foundTopic ? { ...topic, name: finalName, sentences: foundTopic.sentences || '' } : topic;
              })
            };
          }
          return chapter;
        }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await setDoc(doc(db, 'system', 'topic_database'), { chapters }, { merge: true });
      alert(i18n.t("Zapisano pomyślnie."));
    } catch (err) {
      console.error(err);
      alert(i18n.t("Wystąpił błąd podczas zapisywania."));
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangeTopicName = (chapterId: string, topicId: string, newName: string) => {
    setChapters(prev => prev.map(chapter => {
      if (chapter.id === chapterId) {
        return {
          ...chapter,
          topics: chapter.topics.map(topic => topic.id === topicId ? { ...topic, name: newName } : topic)
        };
      }
      return chapter;
    }));
  };

  const handleChangeSentences = (chapterId: string, topicId: string, newSentences: string) => {
    setChapters(prev => prev.map(chapter => {
      if (chapter.id === chapterId) {
        return {
          ...chapter,
          topics: chapter.topics.map(topic => topic.id === topicId ? { ...topic, sentences: newSentences } : topic)
        };
      }
      return chapter;
    }));
  };

  if (isLoading) {
    return <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-24">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Database className="text-primary" size={32} />
          {i18n.t("Baza Tematów")}
        </h1>
        <Button onClick={handleSave} isLoading={isSaving} className="bg-primary text-black font-bold">
          <Save size={18} className="mr-2" />
          {i18n.t("Zapisz zmiany")}
        </Button>
      </div>

      <p className="text-content-muted">
        {i18n.t("Baza podzielona jest na główne działy. W każdym znajduje się 36 tematów. Zostaną one w przyszłości wykorzystane przez generator AI do tworzenia ćwiczeń dla kursantów. Możesz zmieniać nazwy tematów oraz edytować listę przypisanych zdań.")}
      </p>

      <div className="space-y-4">
        {chapters.map((chapter, cIdx) => (
          <Card key={chapter.id} className="p-0 overflow-hidden liquid-glass-tile border-white/10">
            <div 
              className="p-4 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors"
              onClick={() => {
                setExpandedChapterId(expandedChapterId === chapter.id ? null : chapter.id);
                setExpandedTopicId(null);
              }}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                  {cIdx + 1}
                </div>
                <h3 className="font-bold text-xl text-white">{chapter.name}</h3>
                <span className="text-sm text-content-muted">{chapter.topics.length} tematów</span>
              </div>
              <div>
                {expandedChapterId === chapter.id ? <ChevronUp size={24} className="text-content-muted" /> : <ChevronDown size={24} className="text-content-muted" />}
              </div>
            </div>
            
            <AnimatePresence>
              {expandedChapterId === chapter.id && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="border-t border-white/10 bg-base-200/30 overflow-hidden"
                >
                  <div className="p-2 space-y-1 max-h-[60vh] overflow-y-auto custom-scrollbar">
                    {chapter.topics.map((topic, tIdx) => {
                      const isExpanded = expandedTopicId === topic.id;
                      const sentencesCount = topic.sentences.split('\n').filter(s => s.trim().length > 0).length;
                      
                      return (
                        <div key={topic.id} className="rounded-lg border border-white/5 bg-base-100/50 overflow-hidden">
                          <div 
                            className="p-3 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors"
                            onClick={() => setExpandedTopicId(isExpanded ? null : topic.id)}
                          >
                            <div className="flex items-center gap-3 w-full">
                               <div className="text-content-muted text-xs font-mono w-8 text-right">
                                  {tIdx + 1}.
                               </div>
                               <div className="flex-1 font-medium text-white truncate">
                                  {topic.name}
                               </div>
                               {sentencesCount > 0 && (
                                 <span className="text-xs text-primary font-mono bg-primary/10 px-2 py-0.5 rounded ml-2 whitespace-nowrap">
                                   {sentencesCount} zdań
                                 </span>
                               )}
                               <div className="ml-2">
                                  {isExpanded ? <ChevronDown size={16} className="text-content-muted" /> : <ChevronRight size={16} className="text-content-muted" />}
                               </div>
                            </div>
                          </div>
                          
                          {isExpanded && (
                            <div className="p-4 border-t border-white/5 bg-base-200/80">
                               <div className="mb-4">
                                  <label className="block text-sm font-bold text-content-muted mb-2">
                                    {i18n.t("Nazwa tematu:")}
                                  </label>
                                  <input 
                                     type="text"
                                     value={topic.name}
                                     onChange={(e) => handleChangeTopicName(chapter.id, topic.id, e.target.value)}
                                     className="w-full bg-base-100 border border-white/10 rounded-lg p-3 text-sm text-white focus:border-primary/50 outline-none"
                                  />
                               </div>
                              <div className="mb-2">
                                <label className="block text-sm font-bold text-content-muted mb-2">
                                  {i18n.t("Wklej listę zdań (jedno pod drugim):")}
                                </label>
                                <textarea
                                  value={topic.sentences}
                                  onChange={(e) => handleChangeSentences(chapter.id, topic.id, e.target.value)}
                                  placeholder={i18n.t("Np.\nI am reading a book.\nShe works every day.")}
                                  rows={8}
                                  className="w-full bg-base-100 border border-white/10 rounded-lg p-3 text-sm text-white placeholder:text-content-muted/50 focus:border-primary/50 outline-none resize-y font-mono"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </Card>
        ))}
      </div>
    </div>
  );
}
