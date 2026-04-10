'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  [key: number]: { transcript: string };
}

interface SpeechRecognitionResultList {
  length: number;
  [key: number]: SpeechRecognitionResult;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((ev: SpeechRecognitionEvent) => void) | null;
  onerror: ((ev: Event) => void) | null;
  onend: (() => void) | null;
}

interface SpeechRecognitionConstructor {
  new(): SpeechRecognition;
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

export interface VoiceEngineerState {
  supported: boolean;
  listening: boolean;
  transcript: string;
  error: string | null;
}

/**
 * Hands-free voice control for the race engineer using Web Speech API.
 * Wake word: "engineer" — listens for queries after wake word.
 */
export function useVoiceEngineer(onCommand?: (command: string) => void): VoiceEngineerState & {
  start: () => void;
  stop: () => void;
  speak: (text: string) => void;
} {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setSupported(false);
      return;
    }

    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = '';
      for (let i = 0; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        }
      }

      if (finalTranscript) {
        setTranscript(finalTranscript);
        // Wake word detection: must contain "engineer"
        const lowered = finalTranscript.toLowerCase();
        if (lowered.includes('engineer') && onCommand) {
          // Strip wake word from command
          const command = lowered.replace(/.*engineer[,]?\s*/, '').trim();
          if (command.length > 0) {
            onCommand(command);
          }
        }
      }
    };

    recognition.onerror = () => {
      setError('Speech recognition error');
      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
    };

    recognitionRef.current = recognition;
    setSupported(true);

    return () => {
      try {
        recognition.stop();
      } catch {
        // ignore
      }
    };
  }, [onCommand]);

  const start = useCallback(() => {
    if (!recognitionRef.current) return;
    try {
      recognitionRef.current.start();
      setListening(true);
      setError(null);
    } catch {
      // already started
    }
  }, []);

  const stop = useCallback(() => {
    if (!recognitionRef.current) return;
    try {
      recognitionRef.current.stop();
      setListening(false);
    } catch {
      // already stopped
    }
  }, []);

  const speak = useCallback((text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.1;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    window.speechSynthesis.speak(utterance);
  }, []);

  return { supported, listening, transcript, error, start, stop, speak };
}
