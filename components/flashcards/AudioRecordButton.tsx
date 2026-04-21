import React, { useState, useRef, useEffect } from 'react';
import { Mic, Upload, StopCircle, Play, Trash2 } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

interface AudioRecordButtonProps {
  audioUrl?: string | null;
  onAudioUpload: (base64Audio: string) => void;
  onAudioRemove: () => void;
  lang?: string;
  className?: string;
}

const AudioRecordButton: React.FC<AudioRecordButtonProps> = ({ audioUrl, onAudioUpload, onAudioRemove, lang, className }) => {
  const { t, language } = useLanguage();
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (audioUrl) {
      if (!audioRef.current) {
        audioRef.current = new Audio();
        audioRef.current.onended = () => setIsPlaying(false);
      }
      audioRef.current.src = audioUrl;
    }
  }, [audioUrl]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          const base64Audio = reader.result as string;
          onAudioUpload(base64Audio);
        };
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Error accessing microphone:', err);
      alert(language === 'pl' ? 'Nie można połączyć z mikrofonem.' : 'Could not access the microphone.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const playAudio = () => {
    if (audioRef.current && audioUrl) {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('audio/')) {
      alert(language === 'pl' ? 'Proszę wybrać plik audio.' : 'Please select an audio file.');
      return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const base64Audio = reader.result as string;
      onAudioUpload(base64Audio);
    };
    reader.onerror = (error) => {
      console.error('Error reading file:', error);
    };
  };

  if (audioUrl) {
    return (
      <div className={`flex items-center gap-1 bg-base-300 rounded p-1 ${className || ''}`}>
        <button 
          onClick={playAudio} 
          disabled={isPlaying}
          className={`w-8 h-8 flex items-center justify-center rounded text-primary hover:bg-base-200 transition-colors ${isPlaying ? 'opacity-50' : ''}`}
          title={language === 'pl' ? 'Odtwórz' : 'Play'}
        >
          <Play size={16} />
        </button>
        <button 
          onClick={onAudioRemove} 
          className="w-8 h-8 flex items-center justify-center rounded text-red-400 hover:bg-base-200 transition-colors"
          title={language === 'pl' ? 'Usuń audio' : 'Remove audio'}
        >
          <Trash2 size={16} />
        </button>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-1 bg-base-300/30 border border-dashed border-base-300 rounded p-1 ${className || ''}`}>
      <input 
        type="file" 
        accept="audio/*" 
        className="hidden" 
        ref={fileInputRef} 
        onChange={handleFileUpload} 
      />
      {isRecording ? (
        <button 
          onClick={stopRecording} 
          className="w-8 h-8 flex items-center justify-center rounded bg-red-500/20 text-red-500 hover:bg-red-500/30 transition-colors animate-pulse"
          title={language === 'pl' ? 'Zatrzymaj nagrywanie' : 'Stop recording'}
        >
          <StopCircle size={16} />
        </button>
      ) : (
        <button 
          onClick={startRecording} 
          className="w-8 h-8 flex items-center justify-center rounded text-content-muted hover:text-primary hover:bg-base-200 transition-colors"
          title={language === 'pl' ? 'Nagraj podpowiedź' : 'Record pronunciation'}
        >
          <Mic size={16} />
        </button>
      )}
      <div className="w-px h-4 bg-base-300" />
      <button 
        onClick={() => fileInputRef.current?.click()} 
        className="w-8 h-8 flex items-center justify-center rounded text-content-muted hover:text-primary hover:bg-base-200 transition-colors"
        title={language === 'pl' ? 'Wgraj plik audio' : 'Upload audio file'}
      >
        <Upload size={16} />
      </button>
    </div>
  );
};

export default AudioRecordButton;
