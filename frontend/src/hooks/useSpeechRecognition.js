import { useState, useEffect, useRef, useCallback } from "react";

const useSpeechRecognition = () => {
    const [isListening, setIsListening] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [interimTranscript, setInterimTranscript] = useState('');
    const [error, setError] = useState(null);
    const [isSupported, setIsSupported] = useState(false);
    const recognitionRef = useRef(null);
    const isListeningRef = useRef(false);

    useEffect(() => {
        // Check if browser supports Web Speech API
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

        if (SpeechRecognition) {
            setIsSupported(true);

            const recognition = new SpeechRecognition();

            // Configuration
            recognition.continuous = false;      // Keep listening until stopped
            recognition.interimResults = true;  // Show results while speaking
            recognition.lang = 'en-IN';         // Indian English
            recognition.maxAlternatives = 1;

            // When speech is detected and converted
            recognition.onresult = (event) => {
                let finalText = '';
                let interimText = '';

                for(let i = event.resultIndex; i < event.results.length; i++) {
                    const result = event.results[i];
                    if (result.isFinal) {
                        finalText += result[0].transcript + ' ';
                    } else {
                        interimText += result[0].transcript;
                    }
                }

                if (finalText) {
                    setTranscript(finalText.trim());
                }
                setInterimTranscript(interimText);
            };

            // When recognition starts
            recognition.onstart = () => {
                
                setError(null);
            };

            // When recognition ends
            recognition.onend = () => {
                setInterimTranscript('');
                if (isListeningRef.current) {
                    // Restart on mobile since continuous=false
                    try {
                        recognitionRef.current.start();
                    } catch (e) {
                        setIsListening(false);
                    }
                } else {
                    setIsListening(false);
                }
            };

            // Error handling
            recognition.onerror = (event) => {
                console.error('Speech recognition error:', event.error);

                const errorMessages = {
                    'not-allowed': 'Microphone permission denied. Please allow microphone access.',
                    'no-speech': 'No speech detected. Please try again.',
                    'network': 'Network error. Please check your connection.',
                    'audio-capture': 'Microphone not found. Please check your microphone.',
                    'aborted': 'Recognition was stopped.',
                };

                setError(errorMessages[event.error] || `Error: ${event.error}`);
                setIsListening(false);
            };

            recognitionRef.current = recognition;
        } else {
            setIsSupported(false);
            setError('Speech recognition is not supported in this browser. Please use Chrome.');
        }

        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.abort();
            }
        };
    }, []);

    const startListening = useCallback(() => {
        if (recognitionRef.current && !isListeningRef.current) {
            setTranscript('');
            setInterimTranscript('');
            setError(null);
            isListeningRef.current = true;
            setIsListening(true);
            recognitionRef.current.start();
        }
    }, []);

    const stopListening = useCallback(() => {
        if (recognitionRef.current) {
            isListeningRef.current = false;
            setIsListening(false);
            recognitionRef.current.stop();
        }
    }, []);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
    setError(null);
  }, []);

  return {
    isListening,
    transcript,
    interimTranscript,
    error,
    isSupported,
    startListening,
    stopListening,
    resetTranscript,
  };
};

export default useSpeechRecognition;