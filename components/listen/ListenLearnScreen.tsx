import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { generateAudioVocabulary, generateAudioTranscript } from '../../services/geminiService';
import { AudioVocabulary } from '../../types';

const PREDEFINED_LESSONS = [
    { 
        id: '2', 
        title: 'Lekcja pierwsza angielski demo', 
        fileUrl: '/Lesson1maciejlingo.mp3',
        transcript: `Witaj w pierwszej lekcji angielskiego demo!

[Oryginalny tekst tej lekcji zostanie tu wyświetlony. Możesz dowolnie edytować ten tekst zapisując poprawne zdania i gramatykę.]
- Hello, how are you?
- I am fine, thank you. And you?
- Nice to meet you!`
    }
];

const ListenLearnScreen: React.FC = () => {
    const { language } = useLanguage();
    const { user, updateUserStreak } = useAuth();
    const audioRef = useRef<HTMLAudioElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isTranscriptOpen, setIsTranscriptOpen] = useState(false);
    const [generatedTranscript, setGeneratedTranscript] = useState<string | null>(null);
    const [isGeneratingTranscript, setIsGeneratingTranscript] = useState(false);
    const [isPlayerFocused, setIsPlayerFocused] = useState(false);
    const [isAudioFinished, setIsAudioFinished] = useState(false);
    const [earnedStreak, setEarnedStreak] = useState<number | null>(null);
    
    // Default to the first lesson in the array
    const [selectedLesson, setSelectedLesson] = useState(PREDEFINED_LESSONS[0]);
    const [currentAudioUrl, setCurrentAudioUrl] = useState<string | null>(null);
    const [fileName, setFileName] = useState<string | null>(PREDEFINED_LESSONS[0].title);
    const [isCustomTrack, setIsCustomTrack] = useState<boolean>(false);
    
    // Vocabulary state
    const [extractedVocab, setExtractedVocab] = useState<AudioVocabulary[] | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isFlashcardMode, setIsFlashcardMode] = useState(false);
    const [currentCardIndex, setCurrentCardIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);

    useEffect(() => {
        // Obchodzimy błędy "no supported sources" ładując utwór przez blob (jeśli nie jest wgrany przez użytkownika)
        const initDefaultTrack = async () => {
             if (isCustomTrack) return;
             
             try {
                 const res = await fetch(selectedLesson.fileUrl);
                 if (!res.ok) throw new Error('Failed to fetch audio');
                 const blob = await res.blob();
                 
                 // Vite w trybie SPA zwraca plik HTML dla brakujących plików. Zapobiegamy błędom odtwarzacza:
                 if (blob.type.includes('text/html')) {
                     alert(language === 'pl' ? `Plik dla lekcji "${selectedLesson.title}" nie istnieje. Upewnij się, że wgrano go do projektu.` : `File for "${selectedLesson.title}" does not exist. Please ensure it is uploaded.`);
                     throw new Error('File not found (returned HTML fallback)');
                 }

                 const objectUrl = URL.createObjectURL(blob);
                 if (currentAudioUrl && currentAudioUrl.startsWith('blob:')) {
                     URL.revokeObjectURL(currentAudioUrl); // Cleanup starego URL
                 }
                 setCurrentAudioUrl(objectUrl);
             } catch (error) {
                 console.error('Error loading default audio:', error);
                 // Clear the URL so the player doesn't try to play a non-existent file
                 setCurrentAudioUrl(null);
             }
        };

        initDefaultTrack();
        
        return () => {
            if (currentAudioUrl && currentAudioUrl.startsWith('blob:')) {
                URL.revokeObjectURL(currentAudioUrl);
            }
        };
    }, [selectedLesson, isCustomTrack]);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
        const handleLoadedMetadata = () => setDuration(audio.duration);
        const handleEnded = () => {
            setIsPlaying(false);
            setIsAudioFinished(true);
        };

        audio.addEventListener('timeupdate', handleTimeUpdate);
        audio.addEventListener('loadedmetadata', handleLoadedMetadata);
        audio.addEventListener('ended', handleEnded);

        return () => {
            audio.removeEventListener('timeupdate', handleTimeUpdate);
            audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
            audio.removeEventListener('ended', handleEnded);
        };
    }, [currentAudioUrl]); // Re-attach when audio url changes

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (audioRef.current) {
                audioRef.current.pause();
            }
            if (currentAudioUrl && isCustomTrack) {
                URL.revokeObjectURL(currentAudioUrl);
            }
            const objectUrl = URL.createObjectURL(file);
            setCurrentAudioUrl(objectUrl);
            setFileName(file.name);
            setIsPlaying(false);
            setCurrentTime(0);
            setIsCustomTrack(true);
            setExtractedVocab(null);
            setIsFlashcardMode(false);
            setIsAudioFinished(false);
            setEarnedStreak(null);
        }
    };

    const handleLessonSelect = (lesson: typeof PREDEFINED_LESSONS[0]) => {
        if (audioRef.current) {
            audioRef.current.pause();
        }
        setIsCustomTrack(false);
        setSelectedLesson(lesson);
        setFileName(lesson.title);
        setIsPlaying(false);
        setCurrentTime(0);
        setExtractedVocab(null);
        setIsFlashcardMode(false);
        setGeneratedTranscript(null);
        setIsTranscriptOpen(false);
        setIsAudioFinished(false);
        setEarnedStreak(null);
    };

    const handleToggleTranscript = async () => {
        if (isTranscriptOpen) {
            setIsTranscriptOpen(false);
            return;
        }

        setIsTranscriptOpen(true);

        // If not already generated and we have audio, generate it via AI
        if (!generatedTranscript && currentAudioUrl) {
            setIsGeneratingTranscript(true);
            try {
                const response = await fetch(currentAudioUrl);
                const blob = await response.blob();
                
                const base64 = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                       const result = reader.result as string;
                       resolve(result.split(',')[1]);
                    };
                    reader.onerror = reject;
                    reader.readAsDataURL(blob);
                });
                
                const mimeType = blob.type || 'audio/mp3';
                const transcriptText = await generateAudioTranscript(base64, mimeType, language === 'pl' ? 'Polish' : 'English');
                setGeneratedTranscript(transcriptText);
            } catch (error) {
                console.error(error);
                alert(language === 'pl' ? 'Błąd podczas generowania transkrypcji.' : 'Failed to generate transcript.');
                // fallback to predefined if generation fails
                if (selectedLesson.transcript && !isCustomTrack) {
                    setGeneratedTranscript(selectedLesson.transcript);
                }
            } finally {
                setIsGeneratingTranscript(false);
            }
        } else if (!generatedTranscript && !currentAudioUrl && selectedLesson.transcript && !isCustomTrack) {
            // fallback if no audio is loaded somehow
            setGeneratedTranscript(selectedLesson.transcript);
        }
    };

    const togglePlay = () => {
        if (!currentAudioUrl) {
            fileInputRef.current?.click();
            return;
        }

        if (audioRef.current) {
            if (isPlaying) {
                audioRef.current.pause();
            } else {
                audioRef.current.play();
                setIsPlayerFocused(true);
            }
            setIsPlaying(!isPlaying);
        }
    };

    const exitFocusMode = () => {
        if (audioRef.current) {
            audioRef.current.pause();
        }
        setIsPlaying(false);
        setIsPlayerFocused(false);
    };

    const skipForward = () => {
        if (audioRef.current && currentAudioUrl) {
            audioRef.current.currentTime = Math.min(audioRef.current.currentTime + 10, duration);
        }
    };

    const skipBackward = () => {
        if (audioRef.current && currentAudioUrl) {
            audioRef.current.currentTime = Math.max(audioRef.current.currentTime - 10, 0);
        }
    };

    const playAgain = () => {
        if (audioRef.current && currentAudioUrl) {
            audioRef.current.currentTime = 0;
            audioRef.current.play();
            setIsPlaying(true);
        }
    };

    const formatTime = (time: number) => {
        if (isNaN(time)) return '0:00';
        const mins = Math.floor(time / 60);
        const secs = Math.floor(time % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const handleExtractVocabulary = async () => {
        if (!currentAudioUrl) return;
        setIsGenerating(true);
        setExtractedVocab(null);
        setIsFlashcardMode(false);
        setCurrentCardIndex(0);
        setIsFlipped(false);
        try {
            const response = await fetch(currentAudioUrl);
            const blob = await response.blob();
            
            const base64 = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                   const result = reader.result as string;
                   resolve(result.split(',')[1]);
                };
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
            
            const mimeType = blob.type || 'audio/mp3';
            const vocabData = await generateAudioVocabulary(base64, mimeType, language === 'pl' ? 'Polish' : 'English');
            setExtractedVocab(vocabData);
        } catch (error) {
            console.error(error);
            alert(language === 'pl' ? 'Błąd podczas ekstrakcji słownictwa.' : 'Failed to extract vocabulary.');
        } finally {
            setIsGenerating(false);
        }
    };

    const nextCard = () => {
        if (!extractedVocab) return;
        setIsFlipped(false);
        setCurrentCardIndex(prev => Math.min(prev + 1, extractedVocab.length - 1));
    };

    const prevCard = () => {
        setIsFlipped(false);
        setCurrentCardIndex(prev => Math.max(prev - 1, 0));
    };

    const handleFinishForToday = async () => {
        setIsPlayerFocused(false);
        setIsAudioFinished(false);
        
        // Fire confetti
        confetti({
            particleCount: 150,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#4ade80', '#22c55e', '#ffffff', '#facc15']
        });

        // Update streak
        const { streakCount, showConfetti } = await updateUserStreak();
        setEarnedStreak(streakCount);

        if (showConfetti) {
             setTimeout(() => {
                 confetti({
                    particleCount: 100,
                    spread: 120,
                    origin: { y: 0.5 },
                 });
             }, 500);
        }
    };

    return (
        <div className="space-y-8 max-w-4xl mx-auto pb-12 relative overflow-hidden">
            <AnimatePresence>
                {!isPlayerFocused && (
                    <motion.h1 
                        key="header-title"
                        initial={{ opacity: 0, height: 0 }} 
                        animate={{ opacity: 1, height: 'auto', marginBottom: '2rem' }} 
                        exit={{ opacity: 0, height: 0, marginBottom: 0, overflow: 'hidden' }}
                        className="text-3xl font-extrabold tracking-tight"
                    >
                        {language === 'pl' ? 'Kurs audio' : 'Audio Course'}
                    </motion.h1>
                )}
            </AnimatePresence>
            
            <motion.div layout className={`w-full relative z-20 flex justify-center transition-all duration-700 ${isPlayerFocused ? 'mt-4 sm:mt-12 md:mt-24' : ''}`}>
                <Card className={`overflow-hidden transition-all duration-700 ease-[cubic-bezier(0.23,1,0.32,1)] ${isPlayerFocused ? 'p-6 sm:p-10 md:p-16 shadow-[0_30px_60px_-15px_rgba(74,222,128,0.3)] relative z-50 bg-base-100/90 backdrop-blur-xl border-2 border-primary/40 w-[95%] sm:w-full max-w-3xl min-h-[40vh] sm:min-h-[50vh] flex flex-col items-center justify-center rounded-3xl' : 'p-6 sm:p-8 shadow-xl border-primary/20 bg-gradient-to-br from-base-100 to-base-200 relative w-full'}`}>
                    
                    {isPlayerFocused && (
                        <button 
                            onClick={exitFocusMode}
                            className="absolute top-4 right-4 sm:top-6 sm:right-6 p-2 sm:p-3 text-content-muted hover:text-white bg-base-200 hover:bg-base-300 rounded-full transition-colors z-50 ring-1 ring-base-300 shadow-md"
                            title={language === 'pl' ? 'Zamknij' : 'Close'}
                        >
                            <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                        </button>
                    )}

                    <div className={`flex flex-col items-center w-full ${isPlayerFocused ? 'max-w-2xl' : 'max-w-xl'} mx-auto space-y-8`}>
                        <AnimatePresence>
                            {!isPlayerFocused && (
                                <motion.div 
                                    key="dropdown-selector"
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1, height: 'auto' }}
                                    exit={{ opacity: 0, scale: 0.95, height: 0, overflow: 'hidden', margin: 0, padding: 0 }}
                                    className="w-full flex flex-col items-center"
                                >
                                    <label className="block text-sm font-medium mb-2 text-content-muted text-center">
                                        {language === 'pl' ? 'Wybierz lekcję:' : 'Select a lesson:'}
                                    </label>
                                    
                                    <div className="w-full relative mb-4">
                                        <select
                                            value={isCustomTrack ? 'custom' : selectedLesson.id}
                                            onChange={(e) => {
                                                if (e.target.value === 'custom') {
                                                    fileInputRef.current?.click();
                                                } else {
                                                    const lesson = PREDEFINED_LESSONS.find(l => l.id === e.target.value);
                                                    if (lesson) handleLessonSelect(lesson);
                                                }
                                            }}
                                            className="w-full bg-base-100 border-2 border-base-300 hover:border-primary/50 transition-colors rounded-xl p-4 font-bold text-lg text-primary appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/50 text-center shadow-inner"
                                        >
                                            {PREDEFINED_LESSONS.map((lesson) => (
                                                <option key={lesson.id} value={lesson.id}>
                                                    {lesson.title}
                                                </option>
                                            ))}
                                            {isCustomTrack && (
                                                <option value="custom">
                                                    {fileName} {language === 'pl' ? '(Własny plik)' : '(Custom file)'}
                                                </option>
                                            )}
                                        </select>
                                        <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center px-2 text-primary">
                                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                        </div>
                                    </div>
                                    
                                    <input 
                                        type="file"
                                        accept="audio/*"
                                        ref={fileInputRef}
                                        onChange={handleFileUpload}
                                        className="hidden"
                                    />
                                    {user?.role === 'admin' && (
                                        <Button
                                            onClick={() => fileInputRef.current?.click()}
                                            variant="secondary"
                                            className="w-full text-sm py-2"
                                        >
                                            {language === 'pl' ? 'Wgraj własny plik audio...' : 'Upload custom audio file...'}
                                        </Button>
                                    )}
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Hidden Audio Element */}
                        {currentAudioUrl && (
                            <audio 
                                ref={audioRef} 
                                src={currentAudioUrl} 
                                preload="metadata"
                            />
                        )}

                        {/* Focused State Track Title */}
                        <AnimatePresence>
                            {isPlayerFocused && (
                                <motion.div 
                                    key="focused-title"
                                    initial={{ opacity: 0, y: -20 }} 
                                    animate={{ opacity: 1, y: 0 }} 
                                    exit={{ opacity: 0, y: -20, height: 0, overflow: 'hidden' }}
                                    className="text-center w-full"
                                >
                                    <h2 className="text-2xl sm:text-4xl font-black text-primary truncate px-8">{fileName}</h2>
                                    <p className="text-content-muted mt-2 tracking-widest uppercase text-sm">{language === 'pl' ? 'Teraz odtwarzane' : 'Now playing'}</p>
                                    
                                    {/* Big pulsating central art or circle */}
                                    <div className="mx-auto w-24 h-24 sm:w-32 sm:h-32 my-6 sm:my-8 rounded-full bg-base-300 flex items-center justify-center relative shadow-inner">
                                        <div className={`absolute inset-0 rounded-full bg-primary/20 scale-125 ${isPlaying ? 'animate-ping' : ''}`} style={{ animationDuration: '3s' }} />
                                        <div className={`absolute inset-0 rounded-full bg-primary/40 scale-100 ${isPlaying ? 'animate-pulse' : ''}`} />
                                        <span className="text-3xl sm:text-4xl relative z-10">🎵</span>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Progress Bar */}
                        <motion.div layout className="w-full max-w-lg space-y-2">
                            <div className="flex justify-between text-xs sm:text-sm font-medium text-content-muted">
                                <span>{formatTime(currentTime)}</span>
                                <span>{formatTime(duration)}</span>
                            </div>
                            <div className="relative w-full h-2 sm:h-3 bg-base-300 rounded-full overflow-hidden">
                                <div 
                                    className={`absolute top-0 left-0 h-full transition-all duration-100 ease-linear ${isPlaying ? 'bg-primary animate-pulse' : 'bg-primary/80'}`}
                                    style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
                                />
                            </div>
                        </motion.div>

                        {/* Controls / Finished Actions */}
                        <AnimatePresence mode="wait">
                            {isAudioFinished ? (
                                <motion.div 
                                    key="finished-controls"
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.9 }}
                                    className="flex flex-col sm:flex-row w-full max-w-lg items-center justify-center gap-4 py-4"
                                >
                                    <Button onClick={handleFinishForToday} className="w-full text-lg shadow-xl outline outline-2 outline-offset-2 outline-green-500">
                                        {language === 'pl' ? '🎉 Koniec na dziś' : '🎉 Done for today'}
                                    </Button>
                                    <Button onClick={handleExtractVocabulary} variant="secondary" className="w-full text-lg shadow-md">
                                        {language === 'pl' ? '🧠 Ćwiczenia z lekcji' : '🧠 Lesson exercises'}
                                    </Button>
                                </motion.div>
                            ) : (
                                <motion.div 
                                    key="playback-controls"
                                    layout 
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="flex items-center justify-center gap-3 sm:gap-6"
                                >
                                    <Button 
                                        variant="secondary" 
                                        onClick={skipBackward}
                                        disabled={!currentAudioUrl}
                                        className="w-12 h-12 sm:w-16 sm:h-16 rounded-full flex items-center justify-center hover:bg-base-300 disabled:opacity-50 disabled:cursor-not-allowed"
                                        title="-10s"
                                    >
                                        <span className="text-lg sm:text-xl font-bold">-10</span>
                                    </Button>
                                    
                                    <Button 
                                        variant="primary" 
                                        onClick={togglePlay}
                                        className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center shadow-lg shadow-primary/30 ${currentAudioUrl && !isPlaying && !isPlayerFocused ? 'animate-pulse ring-4 ring-primary/20' : ''}`}
                                    >
                                        {isPlaying ? (
                                            <span className="text-2xl sm:text-3xl">⏸</span>
                                        ) : (
                                            <span className="text-2xl sm:text-3xl ml-1 sm:ml-2">▶</span>
                                        )}
                                    </Button>

                                    <Button 
                                        variant="secondary" 
                                        onClick={skipForward}
                                        disabled={!currentAudioUrl}
                                        className="w-12 h-12 sm:w-16 sm:h-16 rounded-full flex items-center justify-center hover:bg-base-300 disabled:opacity-50 disabled:cursor-not-allowed"
                                        title="+10s"
                                    >
                                        <span className="text-lg sm:text-xl font-bold">+10</span>
                                    </Button>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <AnimatePresence>
                            {!isPlayerFocused && (
                                <motion.div 
                                    key="transcript-btn"
                                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, height: 0, overflow: 'hidden' }}
                                    className="w-full flex flex-col items-center"
                                >
                                    <Button 
                                        variant="ghost" 
                                        onClick={playAgain}
                                        disabled={!currentAudioUrl}
                                        className="mt-4 text-content-muted hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed hidden sm:flex"
                                    >
                                        🔄 {language === 'pl' ? 'Odtwórz ponownie' : 'Play Again'}
                                    </Button>

                                    <button
                                        onClick={handleToggleTranscript}
                                        className="mt-6 text-sm font-bold text-primary hover:text-primary/80 transition-colors underline disabled:opacity-50"
                                        disabled={isGeneratingTranscript || !currentAudioUrl}
                                    >
                                        {isTranscriptOpen 
                                          ? (language === 'pl' ? 'Ukryj tekst lekcji' : 'Hide lesson text')
                                          : (language === 'pl' ? 'Zobacz cały tekst lekcji (AI)' : 'View full lesson text (AI)')
                                        }
                                    </button>

                                    {isTranscriptOpen && (
                                        <div className="mt-8 w-full bg-base-100 border border-base-300 rounded-xl p-6 text-left shadow-inner max-h-96 overflow-y-auto animate-in fade-in slide-in-from-top-4">
                                            <h3 className="font-bold text-lg mb-4 text-primary flex items-center justify-between">
                                                {language === 'pl' ? 'Transkrypcja AI:' : 'AI Transcript:'}
                                            </h3>
                                            <div className="whitespace-pre-wrap text-content-muted leading-relaxed font-sans text-sm sm:text-base">
                                                {isGeneratingTranscript ? (
                                                    <div className="flex flex-col items-center justify-center py-6 space-y-4">
                                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                                                        <p className="text-sm font-medium animate-pulse">
                                                            {language === 'pl' ? 'AI analizuje nagranie i generuje transkrypcję...' : 'AI is analyzing audio and generating transcript...'}
                                                        </p>
                                                    </div>
                                                ) : (
                                                    generatedTranscript || (language === 'pl' ? 'Brak tekstu.' : 'No text available.')
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </Card>
            </motion.div>

            {/* Backlog Items to hide when focused */}
            <AnimatePresence>
                {!isPlayerFocused && (
                    <motion.div 
                        key="bottom-content"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20, height: 0, overflow: 'hidden' }}
                        className="w-full"
                    >
                        <div className="flex flex-col items-center mt-12 w-full">
                           <Button
                               variant="primary"
                               onClick={handleExtractVocabulary}
                               disabled={isGenerating || !currentAudioUrl}
                               className="w-full max-w-md shadow-lg"
                           >
                               {isGenerating 
                                 ? (language === 'pl' ? 'Wyszukiwanie i generowanie...' : 'Extracting & Generating...') 
                                 : (language === 'pl' ? 'Wyodrębnij słownictwo i stwórz fiszki' : 'Extract vocabulary & create flashcards')}
                           </Button>
                        </div>

            {extractedVocab && !isFlashcardMode && (
                <Card className="p-8 shadow-xl border-primary/20 bg-base-100 mt-8 space-y-8 fade-in">
                    <h2 className="text-2xl font-bold border-b border-base-300 pb-2">
                        {language === 'pl' ? 'Nowe Słownictwo w Nagraniu' : 'New Vocabulary in Recording'}
                    </h2>
                    
                    <div className="space-y-4">
                        {extractedVocab.map((vocab, index) => (
                            <div key={index} className="p-4 bg-base-200 rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div className="flex-1">
                                    <p className="text-lg font-bold text-primary">{vocab.targetWord}</p>
                                    <p className="text-content-muted">{vocab.translation}</p>
                                </div>
                                <div className="flex-1 text-sm italic text-content-muted border-l-2 pl-4 border-primary/30">
                                    "{vocab.contextSentence}"
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="flex justify-center pt-6">
                        <Button
                            variant="primary"
                            onClick={() => setIsFlashcardMode(true)}
                            className="bg-secondary hover:bg-secondary-focus text-white w-full max-w-md"
                        >
                            {language === 'pl' ? 'Rozpocznij naukę z fiszkami' : 'Start learning with Flashcards'}
                        </Button>
                    </div>
                </Card>
            )}

            {extractedVocab && isFlashcardMode && (
                <div className="mt-8 flex flex-col items-center fade-in">
                    <div className="w-full max-w-xl flex justify-between items-center mb-4 text-sm font-bold text-content-muted">
                        <button onClick={() => setIsFlashcardMode(false)} className="hover:text-primary transition-colors">
                            ← {language === 'pl' ? 'Wróć do listy' : 'Back to list'}
                        </button>
                        <span>{currentCardIndex + 1} / {extractedVocab.length}</span>
                    </div>
                    
                    <div 
                        className="w-full max-w-xl h-80 perspective-1000 cursor-pointer"
                        onClick={() => setIsFlipped(!isFlipped)}
                    >
                        <div className={`relative w-full h-full text-center transition-transform duration-500 transform-style-3d ${isFlipped ? 'rotate-y-180' : ''}`}>
                            
                            {/* Front */}
                            <div className="absolute w-full h-full bg-base-100 border-2 border-primary/20 rounded-2xl shadow-xl flex flex-col items-center justify-center p-8 backface-hidden">
                                <span className="text-4xl font-black text-primary mb-2">
                                    {extractedVocab[currentCardIndex].targetWord}
                                </span>
                                <span className="text-sm text-content-muted">
                                    {language === 'pl' ? 'Kliknij, aby odwrócić' : 'Click to flip'}
                                </span>
                            </div>

                            {/* Back */}
                            <div className="absolute w-full h-full bg-primary text-white rounded-2xl shadow-xl flex flex-col items-center justify-center p-8 backface-hidden rotate-y-180">
                                <span className="text-2xl font-bold mb-4">
                                    {extractedVocab[currentCardIndex].translation}
                                </span>
                                <div className="p-4 bg-black/10 rounded-lg text-sm italic">
                                    "{extractedVocab[currentCardIndex].contextSentence}"
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-4 mt-8">
                        <Button 
                            variant="secondary" 
                            onClick={prevCard} 
                            disabled={currentCardIndex === 0}
                            className="w-32"
                        >
                            {language === 'pl' ? 'Poprzednia' : 'Previous'}
                        </Button>
                        <Button 
                            variant="primary" 
                            onClick={nextCard} 
                            disabled={currentCardIndex === extractedVocab.length - 1}
                            className="w-32"
                        >
                            {language === 'pl' ? 'Następna' : 'Next'}
                        </Button>
                    </div>
                </div>
            )}
            </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {earnedStreak !== null && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8, y: 50 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.8, y: -50 }}
                        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
                    >
                        <Card className="w-full max-w-sm p-8 text-center flex flex-col items-center bg-gradient-to-br from-base-100 to-base-200 border border-primary/30 shadow-2xl">
                            <span className="text-8xl mb-6">🏆</span>
                            <h2 className="text-3xl font-extrabold mb-2 text-white">
                                {language === 'pl' ? 'Gratulacje!' : 'Congratulations!'}
                            </h2>
                            <p className="text-content-muted mb-6 text-lg">
                                {language === 'pl' ? 'Lekcja ukończona pomyślnie.' : 'Lesson completed successfully.'}
                            </p>
                            <div className="bg-base-300 rounded-full py-2 px-6 flex items-center gap-2 mb-8 border border-base-content/10">
                                <span className="text-2xl">🔥</span>
                                <span className="font-bold text-xl text-orange-400">{earnedStreak} {language === 'pl' ? 'Dni Z Rzędu' : 'Day Streak'}</span>
                            </div>
                            <Button onClick={() => setEarnedStreak(null)} className="w-full">
                                {language === 'pl' ? 'Kontynuuj' : 'Continue'}
                            </Button>
                        </Card>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default ListenLearnScreen;
