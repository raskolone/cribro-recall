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
  "Useful expressions — Przydatne wyrażenia",
  "The verb to be — Czasownik być",
  "This & that — To i tamto",
  "Numbers & plural nouns — Liczby i rzeczowniki w liczbie mnogiej",
  "These & those — Ci i tamci / Te i tamte",
  "Possessive adjectives — Zaimki dzierżawcze przymiotne",
  "Days, months & time — Dni, miesiące i czas",
  "Questions — Pytania",
  "Prepositions of place — Przyimki miejsca",
  "Present Simple — Czas teraźniejszy prosty",
  "The verb to have — Czasownik mieć",
  "The verbs: to like, to want — Czasowniki: lubić, chcieć",
  "Object pronouns — Zaimki dopełnieniowe",
  "Frequency adverbs — Przysłówki wyrażające częstotliwość",
  "There is / There are — Konstrukcje jest/są",
  "Imperative — Tryb rozkazujący",
  "Present Continuous — Czas teraźniejszy ciągły",
  "Can — Móc / umieć / potrafić",
  "Saxon genitive — Dopełniacz saksoński",
  "Preposition of — Przyimek of",
  "Countable & uncountable nouns; much, many, a lot of — Rzeczowniki policzalne i niepoliczalne",
  "Some, any, no — Jakieś, żadne",
  "Must & have to — Musieć",
  "Possessive pronouns — Zaimki dzierżawcze",
  "Comparative adjectives — Stopień wyższy przymiotnika",
  "Adverbs — Przysłówki",
  "Reflexive pronouns — Zaimki zwrotne",
  "Articles — Przedimki",
  "To be going to do something — Wyrażanie zamiaru",
  "Asking questions — Zadawanie pytań",
  "Negative questions — Pytania przeczące",
  "Gerund & infinitive — Czasownik z końcówką -ing oraz bezokolicznik",
  "Conjunctions — Spójniki",
  "Prepositions, part 1 — Przyimki, część 1",
  "Expressions, part 1 — Wyrażenia, część 1",
  "Review — test yourself! — Powtórzenie: sprawdź się!"
];

const GRAMMAR_3_TOPICS = [
  "Tenses review — Powtórka czasów",
  "Past Simple vs. Past Continuous — Czas przeszły prosty vs. ciągły",
  "Comparison — as… as — Porównywanie: tyle… ile, tak… jak",
  "Present Perfect — Czas teraźniejszy dokonany",
  "Present Perfect — ever, never — Użycie ever i never",
  "Present Perfect — already, yet, just — Użycie already, yet i just",
  "Present Perfect — for & since — Użycie for i since",
  "Present Perfect Continuous — Czas teraźniejszy złożony ciągły",
  "Present Perfect Simple vs. Continuous — Porównanie czasów",
  "Irregular verbs — third form — Czasowniki nieregularne: trzecia forma",
  "Indirect questions, part 1 — Pytania zależne, część 1",
  "Modal verbs — Czasowniki modalne",
  "Some, any, no — review — Powtórzenie some, any i no",
  "It takes…, part 1 — Konstrukcja it takes…, część 1",
  "Used to — Przeszłe zwyczaje",
  "Want somebody to do something — Konstrukcja want sb to do sth",
  "Indirect imperatives — Rozkazy pośrednie",
  "Make & do, part 1 — Czasowniki make i do, część 1",
  "First conditional & time clauses — Pierwszy tryb warunkowy i zdania czasowe",
  "Second conditional — Drugi tryb warunkowy",
  "Get — expressions — Zwroty z czasownikiem get",
  "All, none, both, neither, either, most — Zaimki i określniki ilości",
  "Make somebody do something — Sprawić, aby ktoś coś zrobił",
  "The use of one/ones — Użycie one i ones",
  "Passive voice, part 1 — Strona bierna, część 1",
  "Countable & uncountable nouns — Rzeczowniki policzalne i niepoliczalne",
  "Use of present tenses — Użycie czasów teraźniejszych",
  "Question tags — Pytania rozłączne",
  "Adjectives & adverbs — Przymiotniki i przysłówki",
  "Articles — Przedimki",
  "Future Simple & Future Continuous — Czas przyszły prosty i ciągły",
  "Subject & object questions — Pytania o podmiot i dopełnienie",
  "Prepositions of time & place — Przyimki czasu i miejsca",
  "Prepositions, part 3 — Przyimki, część 3",
  "Expressions, part 3 — Wyrażenia, część 3",
  "Review — test yourself — Powtórzenie: sprawdź się"
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
    let prompt = '';
    if (chapterIndex === 0) {
      const parts = topicName.split("—");
      let polishPart = topicName;
      if (parts.length > 1) {
        polishPart = parts[1].trim();
      }
      prompt = 'Wygeneruj zdania po polsku związane z tematem "' + polishPart + '". Skopiuj poniższe zdania (jeśli są dodane poniżej) i lekko zmień ich treść.';
    }
    return {
      id: `chapter-${chapterIndex + 1}-topic-${topicIndex + 1}`,
      name: topicName,
      sentences: prompt
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
