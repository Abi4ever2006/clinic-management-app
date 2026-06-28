import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../utils/api';
import useSpeechRecognition from '../hooks/useSpeechRecognition';

const VoiceDictation = ({ onMedicinesExtracted, disabled }) => {
  const [processing, setProcessing] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);

  const {
    isListening,
    transcript,
    interimTranscript,
    error,
    isSupported,
    startListening,
    stopListening,
    resetTranscript,
  } = useSpeechRecognition();

  useEffect(() => {
    if (error) {
      toast.error(error);
    }
  }, [error]);

  const handleStartListening = () => {
    resetTranscript();
    setShowTranscript(true);
    startListening();
    toast('🎤 Listening... Speak your prescription now', {
      duration: 3000,
      icon: '🎤',
    });
  };

  const handleStopAndParse = async () => {
    stopListening();
    const finalTranscript = transcript.trim();

    if (!finalTranscript) {
      toast.error('No speech detected. Please try again.');
      return;
    }

    setProcessing(true);
    toast.loading('🤖 AI is analyzing your speech...', { id: 'voice-parse' });

    try {
      const res = await api.post('/api/voice/parse', {
        transcript: finalTranscript,
      });

      toast.dismiss('voice-parse');
      toast.success(`✅ Extracted ${res.data.count} medicine(s) from voice!`, {
        duration: 4000,
      });

      onMedicinesExtracted(res.data.medicines);
      setShowTranscript(false);
      resetTranscript();
    } catch (err) {
      toast.dismiss('voice-parse');
      toast.error(
        err.response?.data?.message || 'Failed to parse voice. Please try again.'
      );
    } finally {
      setProcessing(false);
    }
  };

  const handleCancel = () => {
    stopListening();
    resetTranscript();
    setShowTranscript(false);
  };

  if (!isSupported) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
        <p className="text-sm text-yellow-700">
          ⚠️ Voice input requires Chrome browser. Please use Chrome to use this feature.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">

      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-sm font-medium text-purple-800">
            🎤 Voice Prescription Dictation
          </p>
          <p className="text-xs text-purple-600 mt-0.5">
            Speak your prescription and AI will fill the form automatically
          </p>
        </div>

        {!isListening && !processing && (
          <button
            type="button"
            onClick={handleStartListening}
            disabled={disabled}
            className="bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            <span>🎤</span>
            Start Dictating
          </button>
        )}

        {isListening && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleStopAndParse}
              className="bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
            >
              <span>✅</span>
              Done — Fill Form
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="bg-red-500 hover:bg-red-600 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors"
            >
              ✕
            </button>
          </div>
        )}

        {processing && (
          <button
            type="button"
            disabled
            className="bg-purple-400 text-white text-sm font-medium px-4 py-2 rounded-lg flex items-center gap-2"
          >
            <span className="animate-spin">⏳</span>
            Analyzing...
          </button>
        )}
      </div>

      {/* Listening Indicator */}
      {isListening && (
        <div className="flex items-center gap-2 mb-2">
          <div className="flex gap-1">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-2 h-2 bg-red-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-2 h-2 bg-red-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
          <span className="text-xs text-red-600 font-medium">
            Recording... Speak now
          </span>
        </div>
      )}

      {/* Transcript Display */}
      {showTranscript && (transcript || interimTranscript) && (
        <div className="bg-white border border-purple-200 rounded-lg p-3 mt-2">
          <p className="text-xs text-purple-500 mb-1 font-medium">
            What I heard:
          </p>
          <p className="text-sm text-gray-800">
            {transcript}
            {interimTranscript && (
              <span className="text-gray-400 italic">{interimTranscript}</span>
            )}
          </p>
        </div>
      )}

      {/* Example Instructions */}
      {!isListening && !showTranscript && (
        <div className="mt-2">
          <p className="text-xs text-purple-600 font-medium mb-1">
            Example phrases you can say:
          </p>
          <div className="space-y-1">
            {[
              '"Paracetamol 500mg three times a day for 5 days after meals"',
              '"Amoxicillin 250mg twice daily for 7 days before food"',
              '"Cetirizine 10mg once at night for 3 days"',
            ].map((example, i) => (
              <p key={i} className="text-xs text-purple-500 italic">
                {example}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default VoiceDictation;