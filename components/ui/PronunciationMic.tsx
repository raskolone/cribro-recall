import React, { useState, useRef } from 'react';

interface PronunciationMicProps {
  targetWord: string;
}

const PronunciationMic: React.FC<PronunciationMicProps> = ({ targetWord }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        handleAnalysis();
      };

      mediaRecorder.start();
      setIsRecording(true);
      setFeedback(null);
    } catch (err) {
      console.error("Microphone access denied or error:", err);
      alert("Failed to access microphone. Please check permissions.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleAnalysis = () => {
    setIsAnalyzing(true);
    // Mock API delay for pronunciation analysis
    setTimeout(() => {
      setIsAnalyzing(false);
      // Generate some dynamic mock feedback based on word length for fun
      const mockScore = Math.floor(Math.random() * 20) + 75; // 75-95 score
      const issues = ["try to focus on the long vowels", "watch the ending consonants", "a bit more stress on the first syllable", "almost perfect, just round your lips more"];
      const randomIssue = issues[Math.floor(Math.random() * issues.length)];
      
      if (mockScore > 90) {
         setFeedback(`Score: ${mockScore}% - Excellent pronunciation!`);
      } else {
         setFeedback(`Score: ${mockScore}% - Good, but ${randomIssue}`);
      }
    }, 1500);
  };

  return (
    <div className="relative inline-flex flex-col items-end">
      <button
        onClick={isRecording ? stopRecording : startRecording}
        className={`p-2 rounded-full transition-all flex items-center justify-center
          ${isRecording 
            ? 'bg-red-500/20 text-red-500 animate-pulse border border-red-500/50' 
            : 'bg-primary/10 text-primary hover:bg-primary/20 border border-transparent'}
        `}
        title={isRecording ? "Stop recording" : "Test Pronunciation"}
      >
        {isRecording ? (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
             <path fillRule="evenodd" d="M3 5a2 2 0 012-2h10a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V5zm3 2a1 1 0 00-1 1v4a1 1 0 001 1h8a1 1 0 001-1V8a1 1 0 00-1-1H6z" clipRule="evenodd" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2z" clipRule="evenodd" />
          </svg>
        )}
      </button>

      {/* Feedback popover */}
      {(isAnalyzing || feedback) && (
        <div className="absolute top-10 right-0 w-64 p-3 bg-base-100 border border-base-300 rounded-lg shadow-xl z-50 animate-in fade-in slide-in-from-top-2">
          {isAnalyzing ? (
             <div className="flex items-center gap-3">
               <svg className="animate-spin h-4 w-4 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
              </svg>
              <span className="text-xs font-mono text-content-muted">Analyzing pronunciation...</span>
             </div>
          ) : (
             <div className="flex flex-col gap-1">
               <div className="flex justify-between items-center">
                 <span className="text-xs font-bold text-primary">Analysis Result</span>
                 <button onClick={() => setFeedback(null)} className="text-content-muted hover:text-white">
                   <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                     <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                   </svg>
                 </button>
               </div>
               <p className="text-sm text-content-muted">{feedback}</p>
             </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PronunciationMic;
