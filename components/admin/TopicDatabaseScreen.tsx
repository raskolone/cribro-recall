import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Database, Save, ChevronDown, ChevronUp, ChevronRight, BookOpen, 
  Layers, Search, Copy, ArrowLeft, Sparkles, MessageSquareQuote, 
  Zap, Check, Filter 
} from 'lucide-react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import AddResourceModal from './AddResourceModal';
import TTSButtons from '../flashcards/TTSButtons';
import i18n from "i18next";
import { db } from '../../firebase';
import { doc, getDoc, setDoc, getDocs, collection, writeBatch } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { parseVocabularyText } from './AssignVocabularyModal';
import { cleanVocabularyTopic } from '../../utils/vocabulary';
import { GENERAL_VOCABULARY_SETS, LEVEL_GROUPS, GeneralVocabSet } from '../../data/generalVocabulary';

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

interface IdiomItem {
  id: string;
  english: string;
  polish: string;
  meaning: string;
  example: string;
  category: string;
}

interface PhrasalVerbItem {
  id: string;
  verb: string;
  polish: string;
  definition: string;
  example: string;
  level?: string;
}

const GRAMMAR_1_TOPICS = [
  "Useful expressions", "The verb to be", "This & that", "Numbers & plural nouns",
  "These & those", "Possessive adjectives", "Days, months & time", "Questions",
  "Prepositions of place", "Present Simple", "The verb to have", "The verbs: to like, to want",
  "Object pronouns", "Frequency adverbs", "There is / There are", "Imperative",
  "Present Continuous", "Can", "Saxon genitive", "Preposition of",
  "Countable & uncountable nouns; much, many, a lot of", "Some, any, no", "Must & have to",
  "Possessive pronouns", "Comparative adjectives", "Adverbs", "Reflexive pronouns",
  "Articles", "To be going to do something", "Asking questions", "Negative questions",
  "Gerund & infinitive", "Conjunctions", "Prepositions, part 1", "Expressions, part 1", "Review"
];

const GRAMMAR_3_TOPICS = [
  "Tenses review", "Past Simple vs. Past Continuous", "Comparison", "Present Perfect",
  "Present Perfect Simple", "Present Perfect Continuous", "Present Perfect Simple vs. Continuous",
  "Irregular verbs", "Indirect questions, part 1", "Modal verbs", "Some, any, no",
  "It takes…, part 1", "Used to", "Want somebody to do something", "Indirect imperatives",
  "Make & do, part 1", "First conditional & time clauses", "Second conditional", "Get",
  "All, none, both, neither, either, most", "Make somebody do something", "The use of one/ones",
  "Passive voice, part 1", "Countable & uncountable nouns", "Use of present tenses", "Question tags",
  "Adjectives & adverbs", "Articles", "Future Simple & Future Continuous", "Subject & object questions",
  "Prepositions of time & place", "Prepositions, part 3", "Expressions, part 3", "Review"
];

const getTopicsForChapter = (chapterIndex: number) => {
  if (chapterIndex === 0) return GRAMMAR_1_TOPICS;
  if (chapterIndex === 2) return GRAMMAR_3_TOPICS;
  return Array.from({ length: 36 }, (_, topicIndex) => `Temat ${topicIndex + 1}`);
};

const DEFAULT_CHAPTERS: GrammarChapter[] = Array.from({ length: 6 }, (_, chapterIndex) => ({
  id: `chapter-grammar-${chapterIndex + 1}`,
  name: `Gramatyka ${chapterIndex + 1}`,
  topics: getTopicsForChapter(chapterIndex).map((topicName, topicIndex) => ({
    id: `chapter-${chapterIndex + 1}-topic-${topicIndex + 1}`,
    name: topicName,
    sentences: `Wykorzystaj przykłady zdań z danego rozdziału np. ${topicName} i wygeneruj podobne zdania na tym samym poziomie.`
  }))
}));

const IDIOMS_DATABASE: IdiomItem[] = [
  {
    id: 'id-1',
    english: 'A piece of cake',
    polish: 'Bułka z masłem (bardzo łatwe)',
    meaning: 'Something that is very easy to do.',
    example: 'Don’t worry about the English test, it was a piece of cake!',
    category: 'Praca & Nauka'
  },
  {
    id: 'id-2',
    english: 'Bite the bullet',
    polish: 'Zacisnąć zęby / przełknąć gorzką pigułkę',
    meaning: 'To face a difficult situation with courage and get it over with.',
    example: 'I hate going to the dentist, but I just have to bite the bullet.',
    category: 'Życie codzienne'
  },
  {
    id: 'id-3',
    english: 'Break the ice',
    polish: 'Przełamać lody',
    meaning: 'To make people feel more comfortable in a social setting.',
    example: 'He told a quick joke at the beginning of the meeting to break the ice.',
    category: 'Relacje & Rozmowa'
  },
  {
    id: 'id-4',
    english: 'Hit the nail on the head',
    polish: 'Trafić w samo sedno',
    meaning: 'To describe exactly what is causing a situation or problem.',
    example: 'She hit the nail on the head when she identified our main cost problem.',
    category: 'Praca & Biznes'
  },
  {
    id: 'id-5',
    english: 'Under the weather',
    polish: 'Czuć się nieswojo / kiepsko (chory)',
    meaning: 'Slightly unwell or tired.',
    example: 'I won’t be coming to the office today because I’m feeling under the weather.',
    category: 'Zdrowie'
  },
  {
    id: 'id-6',
    english: 'Spill the beans',
    polish: 'Wyadać sekret / puścić farbę',
    meaning: 'To reveal secret information unintentionally or prematurely.',
    example: 'We were planning a surprise party, but my brother spilled the beans!',
    category: 'Sekrety & Emocje'
  },
  {
    id: 'id-7',
    english: 'Once in a blue moon',
    polish: 'Raz na ruski rok (bardzo rzadko)',
    meaning: 'Very rarely.',
    example: 'He lives in Australia, so I only see him once in a blue moon.',
    category: 'Czas'
  },
  {
    id: 'id-8',
    english: 'Cost an arm and a leg',
    polish: 'Kosztować fortunę',
    meaning: 'To be extremely expensive.',
    example: 'Buying that new flagship computer cost me an arm and a leg.',
    category: 'Pieniądze'
  },
  {
    id: 'id-9',
    english: 'Burn the midnight oil',
    polish: 'Pracować do późna w noc / zarywać noc',
    meaning: 'To work or study late into the night.',
    example: 'She burned the midnight oil to finish the project presentation before dawn.',
    category: 'Praca & Nauka'
  },
  {
    id: 'id-10',
    english: 'Blessing in disguise',
    polish: 'Szczęście w nieszczęściu',
    meaning: 'A good outcome from something that initially seemed bad.',
    example: 'Losing that job was a blessing in disguise because I started my own company.',
    category: 'Życie codzienne'
  },
  {
    id: 'id-11',
    english: 'Call it a day',
    polish: 'Zakończyć pracę na dziś',
    meaning: 'To stop working on something for the rest of the day.',
    example: 'We’ve been working for ten hours, let’s call it a day.',
    category: 'Praca & Biznes'
  },
  {
    id: 'id-12',
    english: 'Cut corners',
    polish: 'Iść na skróty / robić coś po łebkach',
    meaning: 'To do something perfunctorily to save time or money.',
    example: 'Don’t cut corners on safety equipment; buy the highest quality.',
    category: 'Praca & Jakość'
  }
];

const PHRASAL_VERBS_DATABASE: PhrasalVerbItem[] = [
  {
    id: 'pv-1',
    verb: 'Give up',
    polish: 'Poddawać się / rzucać nawyk',
    definition: 'To stop doing or trying something.',
    example: 'Never give up on your dreams, no matter how hard it gets.',
    level: 'B1'
  },
  {
    id: 'pv-2',
    verb: 'Look forward to',
    polish: 'Czekać z niecierpliwością na',
    definition: 'To await something with excitement and anticipation.',
    example: 'I’m really looking forward to our weekend trip to London.',
    level: 'B1'
  },
  {
    id: 'pv-3',
    verb: 'Turn down',
    polish: 'Odrzucać (ofertę) / ściszać (głośność)',
    definition: 'To reject an offer, or to reduce volume/intensity.',
    example: 'They offered him the promotion, but he turned it down.',
    level: 'B2'
  },
  {
    id: 'pv-4',
    verb: 'Bring up',
    polish: 'Poruszać temat / wychowywać dzieci',
    definition: 'To introduce a topic into conversation, or raise a child.',
    example: 'Please don’t bring up his ex-wife during dinner.',
    level: 'B2'
  },
  {
    id: 'pv-5',
    verb: 'Carry on',
    polish: 'Kontynuować',
    definition: 'To continue doing something.',
    example: 'Please carry on with your work while I answer the phone.',
    level: 'B1'
  },
  {
    id: 'pv-6',
    verb: 'Figure out',
    polish: 'Zrozumieć / wymyślić rozwiązanie',
    definition: 'To understand or solve a problem through thinking.',
    example: 'We need to figure out why the app is dropping connections.',
    level: 'B2'
  },
  {
    id: 'pv-7',
    verb: 'Run into',
    polish: 'Spotkać kogoś niespodziewanie',
    definition: 'To meet someone unexpectedly.',
    example: 'Guess who I ran into at the supermarket today?',
    level: 'B1'
  },
  {
    id: 'pv-8',
    verb: 'Put off',
    polish: 'Odkładać na później (prokrastynować)',
    definition: 'To postpone an event or task.',
    example: 'Don’t put off until tomorrow what you can do today.',
    level: 'B2'
  },
  {
    id: 'pv-9',
    verb: 'Take off',
    polish: 'Startować (samolot) / odnieść nagły sukces',
    definition: 'To leave the ground (plane), or become successful quickly.',
    example: 'His career really took off after he published his first book.',
    level: 'B1'
  },
  {
    id: 'pv-10',
    verb: 'Break down',
    polish: 'Zepsuć się / załamać się nerwowo',
    definition: 'To stop working (machinery) or lose emotional control.',
    example: 'Our car broke down in the middle of the highway.',
    level: 'B1'
  },
  {
    id: 'pv-11',
    verb: 'Come across',
    polish: 'Napotkać / natknąć się na',
    definition: 'To find or meet something/someone by chance.',
    example: 'I came across an old photo of my grandparents in the attic.',
    level: 'B2'
  },
  {
    id: 'pv-12',
    verb: 'Catch up with',
    polish: 'Nadrobić zaległości z kimś',
    definition: 'To reach the same point or update each other on news.',
    example: 'Let’s grab a coffee tomorrow and catch up with everything!',
    level: 'B1'
  }
];

export default function TopicDatabaseScreen() {
  const { user } = useAuth();

  const allowedEmails = ['maciej.wyrozumski@gmail.com', 'marta.lukaszczyk@gmail.com'];
  const userEmail = user?.email?.toLowerCase() || '';
  const isAllowed = user?.role === 'admin' || user?.role === 'teacher' || allowedEmails.includes(userEmail);

  if (!user || !isAllowed) {
    return <div className="p-8 text-center text-red-500 font-bold">Brak dostępu.</div>;
  }

  // Section selection: null = 4-tile grid view, 'grammar' | 'vocabulary' | 'idioms' | 'phrasal'
  const [selectedSection, setSelectedSection] = useState<'grammar' | 'vocabulary' | 'idioms' | 'phrasal' | null>(null);

  const [chapters, setChapters] = useState<GrammarChapter[]>(DEFAULT_CHAPTERS);
  const [vocabularySets, setVocabularySets] = useState<any[]>([]);
  const [vocabSearchQuery, setVocabSearchQuery] = useState('');
  const [vocabCategory, setVocabCategory] = useState<'student_lessons' | 'general'>('student_lessons');
  const [selectedUserAssignMap, setSelectedUserAssignMap] = useState<Record<string, string>>({});
  
  const [idiomsSearchQuery, setIdiomsSearchQuery] = useState('');
  const [phrasalSearchQuery, setPhrasalSearchQuery] = useState('');

  const [cart, setCart] = useState<any[]>([]);
  const [expandedVocabSetId, setExpandedVocabSetId] = useState<string | null>(null);
  const [expandedChapterId, setExpandedChapterId] = useState<string | null>(null);
  const [expandedTopicId, setExpandedTopicId] = useState<string | null>(null);
  
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [dbIdioms, setDbIdioms] = useState<IdiomItem[]>([]);
  const [dbPhrasals, setDbPhrasals] = useState<PhrasalVerbItem[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [isAddResourceModalOpen, setIsAddResourceModalOpen] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const handleAssignSetToUser = async (vSet: any, targetUserId: string) => {
    if (!targetUserId) {
      alert('Wybierz kursanta z listy.');
      return;
    }
    const targetUser = allUsers.find(u => u.id === targetUserId);
    try {
      setIsSaving(true);
      const newSetId = `set-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const newSetData = {
        id: newSetId,
        userId: targetUserId,
        title: vSet.name,
        description: `Przypisano przez nauczyciela dla ${targetUser?.name || 'Kursanta'}`,
        isPublic: false,
        cardCount: vSet.words.length,
        assignedByTeacher: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      const batch = writeBatch(db);
      
      batch.set(doc(db, `sets/${newSetId}`), newSetData);
      batch.set(doc(db, `users/${targetUserId}/wordSets/${newSetId}`), newSetData);
      
      vSet.words.forEach((w: any, idx: number) => {
        const cardRef = doc(db, `sets/${newSetId}/flashcards`, `card-${idx}-${Date.now()}`);
        batch.set(cardRef, {
          term: w.english,
          definition: w.polish,
          createdAt: new Date().toISOString()
        });
      });
      
      batch.update(doc(db, 'users', targetUserId), { hasNewVocabulary: true });
      
      await batch.commit();
      alert('Zestaw został przypisany pomyślnie!');
    } catch (e) {
      console.error(e);
      alert('Wystąpił błąd podczas przypisywania.');
    } finally {
      setIsSaving(false);
    }
  };
  
  const fetchData = async () => {
    setIsLoading(true);
    const usersMap: Record<string, string> = {};
    const usersList: any[] = [];
    let usersDocs: any[] = [];

    // 1. Fetch users
    try {
      console.log("Fetching users...");
      const usersSnap = await getDocs(collection(db, 'users'));
      usersDocs = usersSnap.docs;
      usersDocs.forEach(d => {
        const uData = d.data();
        const name = (uData.firstName || uData.lastName)
          ? `${uData.firstName || ''} ${uData.lastName || ''}`.trim()
          : uData.username || 'Kursant';
        usersMap[d.id] = name;
        if(uData.role !== 'admin' && uData.role !== 'teacher') {
           usersList.push({ id: d.id, name });
        }
      });
      setAllUsers(usersList);
      console.log("Users fetched.");
    } catch (e) {
      console.warn("Could not fetch users list:", e);
    }

    const allVocabSets: any[] = [];

    // 2. Fetch global idioms
    try {
      console.log("Fetching idioms...");
      const idiomsSnap = await getDocs(collection(db, 'global_idioms'));
      console.log("Idioms fetched.");
      const fetchedIdioms = idiomsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as IdiomItem));
      setDbIdioms(fetchedIdioms);
    } catch (e) {
      console.warn("Could not fetch global idioms:", e);
    }

    // 3. Fetch global phrasals
    try {
      console.log("Fetching phrasals...");
      const phrasalsSnap = await getDocs(collection(db, 'global_phrasals'));
      console.log("Phrasals fetched.");
      const fetchedPhrasals = phrasalsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as PhrasalVerbItem));
      setDbPhrasals(fetchedPhrasals);
    } catch (e) {
      console.warn("Could not fetch global phrasals:", e);
    }

    // 4. Custom sets in 'sets' collection
    try {
      console.log("Fetching sets...");
      const setsSnap = await getDocs(collection(db, 'sets'));
      console.log("Sets fetched.");
      for (const setDoc of setsSnap.docs) {
        const data = setDoc.data();
        const setId = setDoc.id;
        try {
          const cardsSnap = await getDocs(collection(db, `sets/${setId}/flashcards`));
          const words = cardsSnap.docs.map((cd, idx) => {
            const cData = cd.data();
            return {
              id: cd.id || `card-${idx}`,
              english: cData.english || cData.term || '',
              polish: cData.polish || cData.definition || ''
            };
          }).filter(w => w.english.trim().length > 0);

          if (words.length > 0) {
            allVocabSets.push({
              id: `set-${setId}`,
              name: data.title || 'Zestaw słówek',
              studentName: usersMap[data.userId] || 'System / Admin',
              type: 'set',
              words
            });
          }
        } catch (cardErr) {
          console.warn(`Could not fetch flashcards for set ${setId}:`, cardErr);
        }
      }
    } catch (e) {
      console.warn("Could not fetch sets:", e);
    }

    // 5. Lesson records from users
    if (usersDocs.length > 0) {
      for (const userDoc of usersDocs) {
        const userId = userDoc.id;
        const studentName = usersMap[userId] || 'Kursant';
        try {
          const lessonsSnap = await getDocs(collection(db, `users/${userId}/lessonRecords`));
          lessonsSnap.docs.forEach((lDoc) => {
            const lData = lDoc.data();
            if (lData.vocabularyText && lData.vocabularyText.trim().length > 0) {
              const words = parseVocabularyText(lData.vocabularyText);
              if (words.length > 0) {
                const cleanedTopic = cleanVocabularyTopic(lData.topic);
                const title = cleanedTopic || `Lekcja z dnia ${lData.date || ''}`;
                
                allVocabSets.push({
                  id: `lesson-${lDoc.id}`,
                  name: title,
                  studentName: studentName,
                  type: 'lesson',
                  words
                });
              }
            }
          });
        } catch (lErr) {
          console.warn(`Could not fetch lesson records for user ${userId}:`, lErr);
        }
      }
    }

    setVocabularySets(allVocabSets);

    // 6. Fetch Grammar Chapters from system/topic_database
    try {
      console.log("Fetching topic database...");
      const docRef = doc(db, 'system', 'topic_database');
      const snap = await getDoc(docRef);
      console.log("Topic database fetched.");
      if (snap.exists() && snap.data().chapters) {
        const fetched = snap.data().chapters as GrammarChapter[];
        setChapters(prevChapters => prevChapters.map(chapter => {
          const foundChapter = fetched.find(f => f.id === chapter.id || f.name === chapter.name);
          if (foundChapter) {
            return {
              ...chapter,
              topics: chapter.topics.map(topic => {
                const foundTopic = foundChapter.topics?.find(t => t.id === topic.id);
                const isGenericName = /^Temat \d+$/.test(foundTopic?.name || '');
                const finalName = isGenericName ? topic.name : (foundTopic?.name || topic.name);
                return foundTopic ? { ...topic, name: finalName, sentences: foundTopic.sentences || topic.sentences } : topic;
              })
            };
          }
          return chapter;
        }));
      }
    } catch (err) {
      console.error('Error fetching topic database:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveGrammar = async () => {
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

  const filteredVocabSets = vocabularySets.filter(vSet => {
    if (!vocabSearchQuery.trim()) return true;
    const q = vocabSearchQuery.toLowerCase();
    const matchName = vSet.name.toLowerCase().includes(q);
    const matchStudent = vSet.studentName.toLowerCase().includes(q);
    const matchWord = vSet.words.some((w: any) => w.english.toLowerCase().includes(q) || w.polish.toLowerCase().includes(q));
    return matchName || matchStudent || matchWord;
  });

  const ALL_IDIOMS = [...IDIOMS_DATABASE, ...dbIdioms];
  const filteredIdioms = ALL_IDIOMS.filter(item => {
    if (!idiomsSearchQuery.trim()) return true;
    const q = idiomsSearchQuery.toLowerCase();
    return (
      item.english.toLowerCase().includes(q) ||
      item.polish.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q) ||
      item.meaning.toLowerCase().includes(q)
    );
  });

  const ALL_PHRASALS = [...PHRASAL_VERBS_DATABASE, ...dbPhrasals];
  const filteredPhrasals = ALL_PHRASALS.filter(item => {
    if (!phrasalSearchQuery.trim()) return true;
    const q = phrasalSearchQuery.toLowerCase();
    return (
      item.verb.toLowerCase().includes(q) ||
      item.polish.toLowerCase().includes(q) ||
      item.definition.toLowerCase().includes(q)
    );
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 space-y-4">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
        <p className="text-sm text-content-muted">Ładowanie Zasobów i Bazy Słownictwa...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-24">
      <AddResourceModal
        isOpen={isAddResourceModalOpen}
        onClose={() => setIsAddResourceModalOpen(false)}
        onSuccess={() => {
          fetchData();
        }}
      />
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <Button onClick={() => setIsAddResourceModalOpen(true)} className="bg-primary text-black font-bold shadow-lg shadow-primary/20 flex">
              <Sparkles size={18} className="mr-2" /> Dodaj nowe zasoby
            </Button>
            {selectedSection && (
              <button
                onClick={() => setSelectedSection(null)}
                className="p-2.5 rounded-2xl bg-base-200/80 hover:bg-base-200 border border-white/10 text-gray-300 hover:text-white transition-all duration-300 shadow-md hover:scale-105"
                title="Powrót do menu Zasobów"
              >
                <ArrowLeft size={20} />
              </button>
            )}
            <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
              <Database className="text-primary animate-pulse" size={32} />
              Zasoby
            </h1>
          </div>
          <p className="text-sm text-content-muted mt-1.5">
            Interaktywna baza wiedzy: Gramatyka, Baza Słownictwa, Idiomy i Phrasal Verbs.
          </p>
        </div>

        {selectedSection === 'grammar' && (
          <Button onClick={handleSaveGrammar} isLoading={isSaving} className="bg-primary text-black font-bold shadow-lg shadow-primary/20">
            <Save size={18} className="mr-2" />
            {i18n.t("Zapisz zmiany")}
          </Button>
        )}
      </div>

      {/* 4 LARGE SHINY LIQUID GLASS TILES (Main Grid View) */}
      {!selectedSection && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
          {/* Tile 1: Gramatyka */}
          <div
            onClick={() => setSelectedSection('grammar')}
            className="group relative overflow-hidden rounded-3xl p-8 backdrop-blur-2xl bg-gradient-to-br from-white/10 via-white/5 to-black/50 border border-white/20 hover:border-primary/60 shadow-[0_8px_32px_rgba(0,0,0,0.5)] hover:shadow-[0_16px_48px_rgba(251,191,36,0.25)] transition-all duration-500 hover:-translate-y-2 cursor-pointer flex flex-col justify-between min-h-[220px]"
          >
            {/* Shimmer overlay */}
            <div className="absolute inset-0 bg-gradient-to-tr from-primary/0 via-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
            <div className="absolute -inset-full top-0 block bg-gradient-to-r from-transparent via-white/10 to-transparent transform -skew-x-12 group-hover:animate-shine pointer-events-none" />

            <div className="relative z-10 flex items-start justify-between">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/30 via-primary/10 to-transparent border border-primary/40 flex items-center justify-center text-primary shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)] group-hover:scale-110 transition-transform duration-300">
                <BookOpen size={28} />
              </div>
              <span className="text-xs font-mono font-bold text-primary bg-primary/10 border border-primary/30 px-3 py-1 rounded-full backdrop-blur-md">
                6 Sekcji
              </span>
            </div>

            <div className="relative z-10 mt-6">
              <h2 className="text-2xl font-bold text-white group-hover:text-primary transition-colors flex items-center gap-2">
                Gramatyka
                <ChevronRight size={22} className="text-content-muted group-hover:text-primary group-hover:translate-x-1 transition-all" />
              </h2>
              <p className="text-sm text-content-muted mt-2 line-clamp-2">
                Pełna baza zagadnień gramatycznych od części 1 do 6 z przykładowymi zdaniami dla generatora AI.
              </p>
            </div>
          </div>

          {/* Tile 2: Baza Słownictwa */}
          <div
            onClick={() => setSelectedSection('vocabulary')}
            className="group relative overflow-hidden rounded-3xl p-8 backdrop-blur-2xl bg-gradient-to-br from-white/10 via-white/5 to-black/50 border border-white/20 hover:border-emerald-500/60 shadow-[0_8px_32px_rgba(0,0,0,0.5)] hover:shadow-[0_16px_48px_rgba(16,185,129,0.25)] transition-all duration-500 hover:-translate-y-2 cursor-pointer flex flex-col justify-between min-h-[220px]"
          >
            <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500/0 via-emerald-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />

            <div className="relative z-10 flex items-start justify-between">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500/30 via-emerald-500/10 to-transparent border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)] group-hover:scale-110 transition-transform duration-300">
                <Layers size={28} />
              </div>
              <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 rounded-full backdrop-blur-md">
                {vocabularySets.length} Zestawów
              </span>
            </div>

            <div className="relative z-10 mt-6">
              <h2 className="text-2xl font-bold text-white group-hover:text-emerald-400 transition-colors flex items-center gap-2">
                Baza Słownictwa
                <ChevronRight size={22} className="text-content-muted group-hover:text-emerald-400 group-hover:translate-x-1 transition-all" />
              </h2>
              <p className="text-sm text-content-muted mt-2 line-clamp-2">
                Przeglądaj wszystkie bazy słownictwa i lekcji stworzone dla wszystkich kursantów, kopiuj i przypisuj zestawy.
              </p>
            </div>
          </div>

          {/* Tile 3: Idiomy */}
          <div
            onClick={() => setSelectedSection('idioms')}
            className="group relative overflow-hidden rounded-3xl p-8 backdrop-blur-2xl bg-gradient-to-br from-white/10 via-white/5 to-black/50 border border-white/20 hover:border-purple-500/60 shadow-[0_8px_32px_rgba(0,0,0,0.5)] hover:shadow-[0_16px_48px_rgba(168,85,247,0.25)] transition-all duration-500 hover:-translate-y-2 cursor-pointer flex flex-col justify-between min-h-[220px]"
          >
            <div className="absolute inset-0 bg-gradient-to-tr from-purple-500/0 via-purple-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />

            <div className="relative z-10 flex items-start justify-between">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500/30 via-purple-500/10 to-transparent border border-purple-500/40 flex items-center justify-center text-purple-400 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)] group-hover:scale-110 transition-transform duration-300">
                <MessageSquareQuote size={28} />
              </div>
              <span className="text-xs font-mono font-bold text-purple-400 bg-purple-500/10 border border-purple-500/30 px-3 py-1 rounded-full backdrop-blur-md">
                Popularne Zwroty
              </span>
            </div>

            <div className="relative z-10 mt-6">
              <h2 className="text-2xl font-bold text-white group-hover:text-purple-400 transition-colors flex items-center gap-2">
                Idiomy
                <ChevronRight size={22} className="text-content-muted group-hover:text-purple-400 group-hover:translate-x-1 transition-all" />
              </h2>
              <p className="text-sm text-content-muted mt-2 line-clamp-2">
                Kolekcja idiomów angielskich wraz z polskim tłumaczeniem, kontekstem i przykładowymi zdaniami.
              </p>
            </div>
          </div>

          {/* Tile 4: Phrasal verbs */}
          <div
            onClick={() => setSelectedSection('phrasal')}
            className="group relative overflow-hidden rounded-3xl p-8 backdrop-blur-2xl bg-gradient-to-br from-white/10 via-white/5 to-black/50 border border-white/20 hover:border-cyan-500/60 shadow-[0_8px_32px_rgba(0,0,0,0.5)] hover:shadow-[0_16px_48px_rgba(6,182,212,0.25)] transition-all duration-500 hover:-translate-y-2 cursor-pointer flex flex-col justify-between min-h-[220px]"
          >
            <div className="absolute inset-0 bg-gradient-to-tr from-cyan-500/0 via-cyan-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />

            <div className="relative z-10 flex items-start justify-between">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500/30 via-cyan-500/10 to-transparent border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)] group-hover:scale-110 transition-transform duration-300">
                <Zap size={28} />
              </div>
              <span className="text-xs font-mono font-bold text-cyan-400 bg-cyan-500/10 border border-cyan-500/30 px-3 py-1 rounded-full backdrop-blur-md">
                Czasowniki Złożone
              </span>
            </div>

            <div className="relative z-10 mt-6">
              <h2 className="text-2xl font-bold text-white group-hover:text-cyan-400 transition-colors flex items-center gap-2">
                Phrasal verbs
                <ChevronRight size={22} className="text-content-muted group-hover:text-cyan-400 group-hover:translate-x-1 transition-all" />
              </h2>
              <p className="text-sm text-content-muted mt-2 line-clamp-2">
                Baza najważniejszych czasowników frazowych w języku angielskim z wyjaśnieniem i zastosowaniem.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 1: GRAMATYKA */}
      {selectedSection === 'grammar' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-base-200/50 p-4 rounded-2xl border border-white/10 backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center text-primary font-bold">
                <BookOpen size={20} />
              </div>
              <h2 className="text-lg font-bold text-white">Gramatyka (Części 1 do 6)</h2>
            </div>
            <button
              onClick={() => setSelectedSection(null)}
              className="text-xs text-content-muted hover:text-white flex items-center gap-1 bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-xl border border-white/10 transition-all"
            >
              <ArrowLeft size={14} /> Powrót
            </button>
          </div>

          <div className="space-y-4">
            {chapters.map((chapter, cIdx) => (
              <Card key={chapter.id || cIdx} className="p-0 overflow-hidden liquid-glass-tile border-white/10">
                <div 
                  className="p-4 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors"
                  onClick={() => {
                    setExpandedChapterId(expandedChapterId === chapter.id ? null : chapter.id);
                    setExpandedTopicId(null);
                  }}
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30 flex items-center justify-center text-primary font-bold text-lg shadow-inner">
                      {cIdx + 1}
                    </div>
                    <div>
                      <h3 className="font-bold text-xl text-white">Gramatyka {cIdx + 1}</h3>
                      <span className="text-xs text-content-muted">{chapter.topics.length} tematów gramatycznych</span>
                    </div>
                  </div>
                  <div>
                    {expandedChapterId === chapter.id ? (
                      <ChevronUp size={24} className="text-primary" />
                    ) : (
                      <ChevronDown size={24} className="text-content-muted" />
                    )}
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
                      <div className="p-3 space-y-1.5 max-h-[60vh] overflow-y-auto custom-scrollbar">
                        {chapter.topics.map((topic, tIdx) => {
                          const isExpanded = expandedTopicId === topic.id;
                          const sentencesCount = topic.sentences.split('\n').filter(s => s.trim().length > 0).length;

                          return (
                            <div key={topic.id || tIdx} className="rounded-xl border border-white/5 bg-base-100/50 overflow-hidden">
                              <div 
                                className="p-3 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors"
                                onClick={() => setExpandedTopicId(isExpanded ? null : topic.id)}
                              >
                                <div className="flex items-center gap-3 w-full">
                                  <div className="text-content-muted text-xs font-mono w-7 text-right">
                                    {tIdx + 1}.
                                  </div>
                                  <div className="flex-1 font-semibold text-white text-sm truncate">
                                    {topic.name}
                                  </div>
                                  {sentencesCount > 0 && (
                                    <span className="text-xs text-primary font-mono bg-primary/10 border border-primary/20 px-2.5 py-0.5 rounded-lg whitespace-nowrap">
                                      {sentencesCount} zdań
                                    </span>
                                  )}
                                  <div className="ml-2 text-content-muted">
                                    {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                  </div>
                                </div>
                              </div>

                              {isExpanded && (
                                <div className="p-4 border-t border-white/5 bg-base-200/80 space-y-4">
                                  <div>
                                    <label className="block text-xs font-bold text-content-muted uppercase mb-1.5">
                                      Nazwa tematu:
                                    </label>
                                    <input 
                                      type="text"
                                      value={topic.name}
                                      onChange={(e) => handleChangeTopicName(chapter.id, topic.id, e.target.value)}
                                      className="w-full bg-base-100 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-primary/50 outline-none"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-bold text-content-muted uppercase mb-1.5">
                                      Wklej listę zdań (jedno pod drugim):
                                    </label>
                                    <textarea
                                      value={topic.sentences}
                                      onChange={(e) => handleChangeSentences(chapter.id, topic.id, e.target.value)}
                                      placeholder="Np.\nI am reading a book.\nShe works every day."
                                      rows={6}
                                      className="w-full bg-base-100 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-primary/50 outline-none resize-y font-mono"
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
      )}

      {/* SECTION 2: BAZA SŁOWNICTWA */}
      {selectedSection === 'vocabulary' && (
        <div className="space-y-6">
          {/* Top Bar with Header & Search */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-base-200/50 p-4 rounded-2xl border border-white/10 backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold">
                <Layers size={20} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white leading-tight">Baza Słownictwa</h2>
                <p className="text-xs text-content-muted">Przeglądaj zestawy z lekcji oraz zasoby ogólne</p>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-80">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-content-muted" size={16} />
                <input
                  type="text"
                  placeholder="Szukaj po nazwie, słówku lub kursancie..."
                  value={vocabSearchQuery}
                  onChange={e => setVocabSearchQuery(e.target.value)}
                  className="w-full bg-base-200/80 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm text-white placeholder:text-content-muted focus:border-emerald-500/50 outline-none transition-all"
                />
              </div>

              <button
                onClick={() => setSelectedSection(null)}
                className="text-xs text-content-muted hover:text-white flex items-center gap-1 bg-white/5 hover:bg-white/10 px-3 py-2 rounded-xl border border-white/10 transition-all shrink-0"
              >
                <ArrowLeft size={14} /> Powrót
              </button>
            </div>
          </div>

          {/* Category Tabs: Zestawy z Lekcji vs Słownictwo Ogólne */}
          <div className="flex flex-wrap items-center gap-2 p-1.5 bg-black/40 rounded-2xl border border-white/10 backdrop-blur-md">
            <button
              onClick={() => setVocabCategory('student_lessons')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
                vocabCategory === 'student_lessons'
                  ? 'bg-emerald-500 text-black shadow-[0_0_20px_rgba(16,185,129,0.3)]'
                  : 'text-content-muted hover:text-white hover:bg-white/5'
              }`}
            >
              <BookOpen size={16} />
              Zestawy z Lekcji Kursantów
              <span className={`text-xs px-2 py-0.5 rounded-full font-mono ${
                vocabCategory === 'student_lessons' ? 'bg-black/20 text-black' : 'bg-white/10 text-white'
              }`}>
                {filteredVocabSets.length}
              </span>
            </button>

            <button
              onClick={() => setVocabCategory('general')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
                vocabCategory === 'general'
                  ? 'bg-emerald-500 text-black shadow-[0_0_20px_rgba(16,185,129,0.3)]'
                  : 'text-content-muted hover:text-white hover:bg-white/5'
              }`}
            >
              <Layers size={16} />
              Słownictwo Ogólne (3 Poziomy)
              <span className={`text-xs px-2 py-0.5 rounded-full font-mono ${
                vocabCategory === 'general' ? 'bg-black/20 text-black' : 'bg-white/10 text-white'
              }`}>
                {GENERAL_VOCABULARY_SETS.length}
              </span>
            </button>
          </div>

          {/* Cart banner if words selected */}
          {cart.length > 0 && (
            <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/30 px-4 py-2.5 rounded-xl backdrop-blur-md">
              <span className="text-xs font-bold text-emerald-400 font-mono">
                {cart.length} słówek wybranych w koszyku
              </span>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="secondary" onClick={() => setCart([])}>Wyczyść</Button>
                <Button size="sm" onClick={() => {
                  const wordsStr = cart.map(w => `- ${w.english} (${w.polish})`).join('\n');
                  navigator.clipboard.writeText(wordsStr);
                  alert(`Skopiowano ${cart.length} słówek do schowka!`);
                }} className="bg-emerald-500 text-black font-bold">
                  <Copy size={14} className="mr-1" />
                  Skopiuj słówka
                </Button>
              </div>
            </div>
          )}

          {/* CATEGORY 1: ZESTAWY Z LEKCJI KURSANTÓW (COMPACT LIST VIEW) */}
          {vocabCategory === 'student_lessons' && (
            <div className="space-y-3">
              {filteredVocabSets.map((vSet: any) => {
                const isExpanded = expandedVocabSetId === vSet.id;
                const assignedUserId = selectedUserAssignMap[vSet.id] || '';

                return (
                  <Card key={vSet.id} className="p-0 overflow-hidden liquid-glass-tile border-white/10 transition-all hover:border-white/20">
                    <div className="p-3 sm:p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      {/* Left: Set info */}
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold shrink-0">
                          <BookOpen size={18} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <h3 className="font-bold text-base text-white truncate">{vSet.name}</h3>
                            <span className="text-[10px] bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded font-mono font-bold">
                              {vSet.words?.length || 0} słówek
                            </span>
                            <span className="text-[10px] bg-white/10 text-content-muted px-2 py-0.5 rounded uppercase tracking-wider">
                              {vSet.studentName}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Actions & Student Selector */}
                      <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap shrink-0">
                        <select
                          value={assignedUserId}
                          onChange={(e) => setSelectedUserAssignMap(prev => ({ ...prev, [vSet.id]: e.target.value }))}
                          className="bg-black/50 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white outline-none focus:border-emerald-500/50 max-w-[180px]"
                        >
                          <option value="">Wybierz kursanta...</option>
                          {allUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </select>

                        <button
                          onClick={() => handleAssignSetToUser(vSet, assignedUserId)}
                          disabled={!assignedUserId}
                          className={`text-xs px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all ${
                            assignedUserId
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500 hover:text-black cursor-pointer'
                              : 'bg-white/5 text-content-muted border border-white/5 cursor-not-allowed'
                          }`}
                        >
                          <Sparkles size={14} />
                          Przypisz
                        </button>

                        <button
                          onClick={() => setExpandedVocabSetId(isExpanded ? null : vSet.id)}
                          className="text-xs text-content-muted hover:text-white bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-xl border border-white/10 transition-all flex items-center gap-1 font-semibold"
                        >
                          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          {isExpanded ? 'Ukryj' : 'Pokaż słówka'}
                        </button>
                      </div>
                    </div>

                    {/* Expandable Words Table */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="border-t border-white/10 bg-black/40 overflow-hidden"
                        >
                          <div className="p-4 space-y-2 max-h-[350px] overflow-y-auto custom-scrollbar">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {vSet.words.map((w: any, idx: number) => {
                                const isCartChecked = cart.some(item => item.id === w.id || (item.english === w.english && item.polish === w.polish));
                                return (
                                  <div key={idx} className="flex items-center gap-3 text-xs p-2.5 rounded-xl bg-base-100/40 hover:bg-base-100/70 border border-white/5">
                                    <input
                                      type="checkbox"
                                      className="checkbox checkbox-xs checkbox-emerald rounded"
                                      checked={isCartChecked}
                                      onChange={(e) => {
                                        if (e.target.checked) setCart(prev => [...prev, w]);
                                        else setCart(prev => prev.filter(item => item.id !== w.id && item.english !== w.english));
                                      }}
                                    />
                                    <div className="flex-1 flex items-center justify-between min-w-0 pr-1">
                                      <span className="font-bold text-emerald-400 truncate">{w.english}</span>
                                      <TTSButtons text={w.english} />
                                    </div>
                                    <span className="text-content-muted truncate max-w-[50%]">{w.polish || '—'}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </Card>
                );
              })}

              {filteredVocabSets.length === 0 && (
                <div className="text-center p-12 bg-base-200/30 rounded-2xl border border-white/5 text-content-muted">
                  Brak zapisanych zestawów z lekcji kursantów.
                </div>
              )}
            </div>
          )}

          {/* CATEGORY 2: SŁOWNICTWO OGÓLNE (PODZIELONE NA 3 POZIOMY) */}
          {vocabCategory === 'general' && (
            <div className="space-y-6">
              {LEVEL_GROUPS.map((group) => {
                // Filter general sets belonging to this level group
                const groupSets = GENERAL_VOCABULARY_SETS.filter(s => s.levelGroup === group.key).filter(s => {
                  if (!vocabSearchQuery.trim()) return true;
                  const q = vocabSearchQuery.toLowerCase();
                  return (
                    s.title.toLowerCase().includes(q) ||
                    s.description.toLowerCase().includes(q) ||
                    s.words.some(w => w.english.toLowerCase().includes(q) || w.polish.toLowerCase().includes(q))
                  );
                });

                return (
                  <div key={group.key} className="space-y-3">
                    {/* Level Section Header */}
                    <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-base-200/60 border border-white/10 backdrop-blur-md">
                      <span className={`text-xs font-mono font-bold px-3 py-1 rounded-lg border ${group.badgeClass}`}>
                        Poziom {group.levels}
                      </span>
                      <div>
                        <h3 className="font-bold text-base text-white">{group.name}</h3>
                        <p className="text-xs text-content-muted">{group.description}</p>
                      </div>
                      <span className="ml-auto text-xs font-mono text-content-muted bg-white/5 px-2.5 py-1 rounded-lg border border-white/5 shrink-0">
                        {groupSets.length} zestawów
                      </span>
                    </div>

                    {/* List of sets in this level group */}
                    <div className="space-y-2.5">
                      {groupSets.map((gSet) => {
                        const isExpanded = expandedVocabSetId === gSet.id;
                        const assignedUserId = selectedUserAssignMap[gSet.id] || '';

                        return (
                          <Card key={gSet.id} className="p-0 overflow-hidden liquid-glass-tile border-white/10 transition-all hover:border-white/20">
                            <div className="p-3 sm:p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                              {/* Left: Title & Description */}
                              <div className="flex items-center gap-3 min-w-0">
                                <div className={`w-9 h-9 rounded-xl border flex items-center justify-center font-bold text-xs shrink-0 ${group.badgeClass}`}>
                                  {gSet.levelBadge}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <h4 className="font-bold text-base text-white">{gSet.title}</h4>
                                    <span className="text-[10px] font-mono font-bold bg-white/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded">
                                      {gSet.words.length} słówek
                                    </span>
                                  </div>
                                  <p className="text-xs text-content-muted truncate mt-0.5">{gSet.description}</p>
                                </div>
                              </div>

                              {/* Right: Actions */}
                              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap shrink-0">
                                <select
                                  value={assignedUserId}
                                  onChange={(e) => setSelectedUserAssignMap(prev => ({ ...prev, [gSet.id]: e.target.value }))}
                                  className="bg-black/50 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white outline-none focus:border-emerald-500/50 max-w-[180px]"
                                >
                                  <option value="">Wybierz kursanta...</option>
                                  {allUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                </select>

                                <button
                                  onClick={() => handleAssignSetToUser({ name: gSet.title, words: gSet.words }, assignedUserId)}
                                  disabled={!assignedUserId}
                                  className={`text-xs px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all ${
                                    assignedUserId
                                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500 hover:text-black cursor-pointer'
                                      : 'bg-white/5 text-content-muted border border-white/5 cursor-not-allowed'
                                  }`}
                                >
                                  <Sparkles size={14} />
                                  Przypisz
                                </button>

                                <button
                                  onClick={() => setExpandedVocabSetId(isExpanded ? null : gSet.id)}
                                  className="text-xs text-content-muted hover:text-white bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-xl border border-white/10 transition-all flex items-center gap-1 font-semibold"
                                >
                                  {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                  {isExpanded ? 'Ukryj' : 'Pokaż słówka'}
                                </button>
                              </div>
                            </div>

                            {/* Expandable Words Table */}
                            <AnimatePresence>
                              {isExpanded && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  className="border-t border-white/10 bg-black/40 overflow-hidden"
                                >
                                  <div className="p-4 space-y-2 max-h-[350px] overflow-y-auto custom-scrollbar">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                      {gSet.words.map((w: any, idx: number) => {
                                        const isCartChecked = cart.some(item => item.id === w.id || item.english === w.english);
                                        return (
                                          <div key={idx} className="flex items-center gap-3 text-xs p-2.5 rounded-xl bg-base-100/40 hover:bg-base-100/70 border border-white/5">
                                            <input
                                              type="checkbox"
                                              className="checkbox checkbox-xs checkbox-emerald rounded"
                                              checked={isCartChecked}
                                              onChange={(e) => {
                                                if (e.target.checked) setCart(prev => [...prev, w]);
                                                else setCart(prev => prev.filter(item => item.id !== w.id && item.english !== w.english));
                                              }}
                                            />
                                            <div className="flex-1 flex items-center justify-between min-w-0 pr-1">
                                              <span className="font-bold text-emerald-400 truncate">{w.english}</span>
                                              <TTSButtons text={w.english} />
                                            </div>
                                            <span className="text-content-muted truncate max-w-[50%]">{w.polish || '—'}</span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </Card>
                        );
                      })}

                      {groupSets.length === 0 && (
                        <div className="text-center p-6 bg-base-200/20 rounded-xl border border-white/5 text-content-muted text-xs">
                          Brak zestawów pasujących do kryteriów wyszukiwania w tym poziomie.
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SECTION 3: IDIOMY */}
      {selectedSection === 'idioms' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-base-200/50 p-4 rounded-2xl border border-white/10 backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400 font-bold">
                <MessageSquareQuote size={20} />
              </div>
              <h2 className="text-lg font-bold text-white">Idiomy Angielskie ({ALL_IDIOMS.length})</h2>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-80">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-content-muted" size={16} />
                <input
                  type="text"
                  placeholder="Szukaj idiomu, tłumaczenia lub kategorii..."
                  value={idiomsSearchQuery}
                  onChange={e => setIdiomsSearchQuery(e.target.value)}
                  className="w-full bg-base-200/80 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm text-white placeholder:text-content-muted focus:border-purple-500/50 outline-none"
                />
              </div>

              <button
                onClick={() => setSelectedSection(null)}
                className="text-xs text-content-muted hover:text-white flex items-center gap-1 bg-white/5 hover:bg-white/10 px-3 py-2 rounded-xl border border-white/10 transition-all shrink-0"
              >
                <ArrowLeft size={14} /> Powrót
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredIdioms.map((idiom) => (
              <div
                key={idiom.id}
                className="p-5 rounded-2xl bg-base-200/50 border border-white/10 hover:border-purple-500/40 transition-all space-y-2 relative group overflow-hidden"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-mono font-bold text-purple-400 bg-purple-500/10 border border-purple-500/30 px-2.5 py-0.5 rounded-md">
                    {idiom.category}
                  </span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`${idiom.english} - ${idiom.polish}\nPrzykł.: ${idiom.example}`);
                      alert(`Skopiowano idiom: ${idiom.english}`);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-content-muted hover:text-white transition-all"
                    title="Kopiuj idiom"
                  >
                    <Copy size={14} />
                  </button>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-lg font-bold text-white group-hover:text-purple-300 transition-colors">
                    {idiom.english}
                  </h3>
                  <TTSButtons text={idiom.english} />
                </div>
                <p className="text-sm font-semibold text-purple-400">
                  {idiom.polish}
                </p>
                <p className="text-xs text-content-muted italic">
                  „{idiom.meaning}”
                </p>
                <div className="pt-2 border-t border-white/5 text-xs text-gray-300 font-mono bg-black/20 p-2.5 rounded-xl border border-white/5">
                  <span className="text-purple-400 font-bold">Przykład: </span>
                  {idiom.example}
                </div>
              </div>
            ))}

            {filteredIdioms.length === 0 && (
              <div className="col-span-full text-center p-12 bg-base-200/30 rounded-2xl border border-white/5 text-content-muted">
                Nie znaleziono idiomów pasujących do wyszukiwania.
              </div>
            )}
          </div>
        </div>
      )}

      {/* SECTION 4: PHRASAL VERBS */}
      {selectedSection === 'phrasal' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-base-200/50 p-4 rounded-2xl border border-white/10 backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-bold">
                <Zap size={20} />
              </div>
              <h2 className="text-lg font-bold text-white">Phrasal Verbs ({ALL_PHRASALS.length})</h2>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-80">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-content-muted" size={16} />
                <input
                  type="text"
                  placeholder="Szukaj czasownika frazowego..."
                  value={phrasalSearchQuery}
                  onChange={e => setPhrasalSearchQuery(e.target.value)}
                  className="w-full bg-base-200/80 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm text-white placeholder:text-content-muted focus:border-cyan-500/50 outline-none"
                />
              </div>

              <button
                onClick={() => setSelectedSection(null)}
                className="text-xs text-content-muted hover:text-white flex items-center gap-1 bg-white/5 hover:bg-white/10 px-3 py-2 rounded-xl border border-white/10 transition-all shrink-0"
              >
                <ArrowLeft size={14} /> Powrót
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredPhrasals.map((item) => (
              <div
                key={item.id}
                className="p-5 rounded-2xl bg-base-200/50 border border-white/10 hover:border-cyan-500/40 transition-all space-y-2 relative group overflow-hidden"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-mono font-bold text-cyan-400 bg-cyan-500/10 border border-cyan-500/30 px-2.5 py-0.5 rounded-md">
                    Poziom {item.level || 'B1-B2'}
                  </span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`${item.verb} - ${item.polish}\nPrzykł.: ${item.example}`);
                      alert(`Skopiowano: ${item.verb}`);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-content-muted hover:text-white transition-all"
                    title="Kopiuj czasownik"
                  >
                    <Copy size={14} />
                  </button>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-xl font-extrabold text-white group-hover:text-cyan-300 transition-colors">
                    {item.verb}
                  </h3>
                  <TTSButtons text={item.verb} />
                </div>
                <p className="text-sm font-semibold text-cyan-400">
                  {item.polish}
                </p>
                <p className="text-xs text-content-muted">
                  Definicja: {item.definition}
                </p>
                <div className="pt-2 border-t border-white/5 text-xs text-gray-300 font-mono bg-black/20 p-2.5 rounded-xl border border-white/5">
                  <span className="text-cyan-400 font-bold">Przykład: </span>
                  {item.example}
                </div>
              </div>
            ))}

            {filteredPhrasals.length === 0 && (
              <div className="col-span-full text-center p-12 bg-base-200/30 rounded-2xl border border-white/5 text-content-muted">
                Nie znaleziono czasowników frazowych pasujących do wyszukiwania.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
