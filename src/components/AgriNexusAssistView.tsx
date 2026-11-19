import React, { useState } from 'react';
import {
  AlertCircle,
  Headphones,
  Mic,
  MicOff,
  Send,
  Volume2,
  WifiOff,
} from 'lucide-react';
import { api } from '../services/api';
import { ChatMessage, EnrichedBatch, Language, MarketPrice } from '../types';
import { t } from '../utils/i18n';
import { buildOfflineTemplateReply } from '../utils/offlineAssist';

interface AgriNexusAssistViewProps {
  language: Language;
  batches: EnrichedBatch[];
  marketPrices: MarketPrice[];
  offlineMode: boolean;
  initialBatchId?: string;
  initialMessages: ChatMessage[];
  onMessagesChange: (messages: ChatMessage[]) => void;
}

export const AgriNexusAssistView: React.FC<AgriNexusAssistViewProps> = ({
  language,
  batches,
  marketPrices,
  offlineMode,
  initialBatchId,
  initialMessages,
  onMessagesChange,
}) => {
  const isHi = language === 'hi';
  const [selectedBatchId, setSelectedBatchId] = useState(
    initialBatchId || batches[0]?.id || ''
  );
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [helpdeskTicket, setHelpdeskTicket] = useState<string | null>(null);

  const activeBatch = batches.find((b) => b.id === selectedBatchId) ?? batches[0];

  const suggestedQuestions = isHi
    ? [
        'इस बैच के लिए यही सुझाव क्यों दिया गया है?',
        'मेरी फसल की वर्तमान गुणवत्ता और शेल्फ लाइफ क्या है?',
        'नजदीकी मंडी का ताज़ा भाव क्या चल रहा है?',
      ]
    : [
        'Why is this action recommended for my batch?',
        'What is my current quality score and remaining shelf life?',
        'Which mandi currently offers the best price for this crop?',
      ];

  async function sendQuestion(questionText: string) {
    const trimmed = questionText.trim();
    if (!trimmed || loading) return;

    setError(null);
    setInput('');

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}-u`,
      role: 'user',
      text: trimmed,
      language,
      mode: offlineMode ? 'offline_template' : 'gemini_rag',
      createdAt: new Date().toISOString(),
    };

    const nextWithUser = [...initialMessages, userMsg];
    onMessagesChange(nextWithUser);

    if (offlineMode) {
      const offlineRes = buildOfflineTemplateReply(
        trimmed,
        language,
        activeBatch,
        marketPrices
      );
      const assistantMsg: ChatMessage = {
        id: `msg-${Date.now()}-a`,
        role: 'assistant',
        text: offlineRes.text,
        language,
        mode: 'offline_template',
        uncertain: offlineRes.uncertain,
        escalateHelpdesk: offlineRes.escalateHelpdesk,
        createdAt: new Date().toISOString(),
      };
      onMessagesChange([...nextWithUser, assistantMsg]);
      return;
    }

    setLoading(true);
    try {
      const res = await api.askAssist({
        message: trimmed,
        batchId: activeBatch?.id,
        language,
      });
      onMessagesChange([...nextWithUser, res.message]);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Unable to reach AgriNexus Assist.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  function handleVoiceInput() {
    const win = window as unknown as {
      SpeechRecognition?: new () => {
        lang: string;
        interimResults: boolean;
        onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
        onerror: () => void;
        onend: () => void;
        start: () => void;
      };
      webkitSpeechRecognition?: new () => {
        lang: string;
        interimResults: boolean;
        onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
        onerror: () => void;
        onend: () => void;
        start: () => void;
      };
    };

    const SpeechRec = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!SpeechRec) {
      setError(
        isHi
          ? 'इस ब्राउज़र में वॉइस इनपुट उपलब्ध नहीं है। कृपया टाइप करें।'
          : 'Browser speech recognition is not supported here. Please type your question.'
      );
      return;
    }

    const rec = new SpeechRec();
    rec.lang = language === 'hi' ? 'hi-IN' : 'en-IN';
    rec.interimResults = false;
    setListening(true);
    rec.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript ?? '';
      if (transcript) {
        setInput(transcript);
      }
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    rec.start();
  }

  function speakText(text: string) {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = language === 'hi' ? 'hi-IN' : 'en-IN';
    window.speechSynthesis.speak(utter);
  }

  async function handleEscalate(question: string) {
    if (offlineMode) {
      setHelpdeskTicket('OFFLINE-PENDING');
      return;
    }
    try {
      const res = await api.escalateHelpdesk({
        question,
        batchId: activeBatch?.id,
      });
      setHelpdeskTicket(res.ticketId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to escalate to helpdesk.');
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#141A15]">
            {t(language, 'navAssist')}
          </h1>
          <p className="text-sm text-[#4B554D] mt-0.5">
            {isHi
              ? 'आपके लाइव बैच डेटा और मंडी भाव पर आधारित एआई सहायक (हिंदी / अंग्रेजी)'
              : 'RAG-grounded agricultural assistant anchored to your live batch digital twin and mandi feeds.'}
          </p>
        </div>

        <select
          aria-label="Ground assistant on batch"
          value={activeBatch?.id ?? ''}
          onChange={(e) => setSelectedBatchId(e.target.value)}
          className="px-3.5 py-2 text-sm font-medium bg-white border border-[#D4D9D0] rounded-lg"
        >
          {batches.map((b) => (
            <option key={b.id} value={b.id}>
              Context: {b.id} · {b.crop} ({b.quantityKg} kg)
            </option>
          ))}
        </select>
      </div>

      {offlineMode && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex items-center gap-2.5 text-xs text-amber-900">
          <WifiOff className="w-4 h-4 shrink-0" />
          <span>{t(language, 'offlineAssistNotice')}</span>
        </div>
      )}

      {helpdeskTicket && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 text-xs text-emerald-900">
          {isHi
            ? `आपका प्रश्न FPO हेल्पडेस्क (टिकट: ${helpdeskTicket}) को भेज दिया गया है।`
            : `Escalated to Sahyadri FPO Helpdesk (Ticket ${helpdeskTicket}). An advisor will follow up shortly.`}
        </div>
      )}

      {/* Grounding Summary Strip */}
      {activeBatch && (
        <div className="bg-white border border-[#E2E6DF] rounded-xl px-4 py-3 text-xs text-[#4B554D] flex flex-wrap items-center gap-x-4 gap-y-1 font-mono tabular-nums">
          <span className="font-sans font-semibold text-[#141A15]">
            Live Batch Context:
          </span>
          <span>{activeBatch.id} ({activeBatch.crop})</span>
          <span>Quality {activeBatch.digitalTwin.qualityScore}%</span>
          <span>Shelf Life {activeBatch.digitalTwin.remainingShelfLifeHours}h</span>
          <span>
            Recommended: {activeBatch.recommendation.recommendedAction.toUpperCase()} (₹
            {activeBatch.recommendation.expectedValue.toLocaleString('en-IN')})
          </span>
        </div>
      )}

      {/* Chat Thread */}
      <div className="bg-white border border-[#E2E6DF] rounded-xl flex flex-col min-h-[400px]">
        <div className="flex-1 p-5 space-y-4 overflow-y-auto max-h-[440px]">
          {initialMessages.length === 0 ? (
            <div className="py-8 text-center space-y-4">
              <p className="text-sm text-[#4B554D] max-w-md mx-auto">
                {isHi
                  ? 'नीचे दिए गए प्रश्नों में से चुनें या अपना सवाल लिखें / बोलें।'
                  : 'Ask any question about your active batch quality, spoilage risk, mandi rates, or why a specific decision was recommended.'}
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {suggestedQuestions.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => sendQuestion(q)}
                    className="px-3.5 py-2 text-xs font-medium bg-[#F7F8F6] border border-[#D4D9D0] rounded-lg hover:bg-[#EDF0EA] text-[#141A15] transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            initialMessages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${
                  msg.role === 'user' ? 'items-end' : 'items-start'
                }`}
              >
                <div
                  className={`max-w-[85%] rounded-xl px-4 py-3 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-emerald-700 text-white'
                      : 'bg-[#F7F8F6] border border-[#E2E6DF] text-[#141A15]'
                  }`}
                >
                  <p>{msg.text}</p>

                  {msg.role === 'assistant' && (
                    <div className="mt-2.5 pt-2 border-t border-[#E2E6DF] flex flex-wrap items-center justify-between gap-3 text-xs text-[#647066]">
                      <span>
                        {msg.mode === 'offline_template'
                          ? 'Offline Template'
                          : 'Grounded AI Assistant'}
                        {msg.uncertain ? ' · Uncertain' : ''}
                      </span>

                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => speakText(msg.text)}
                          className="inline-flex items-center gap-1 text-[#141A15] hover:underline"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                          {t(language, 'speakReply')}
                        </button>
                        {msg.escalateHelpdesk && (
                          <button
                            type="button"
                            onClick={() => handleEscalate(msg.text)}
                            className="inline-flex items-center gap-1 text-emerald-800 font-semibold hover:underline"
                          >
                            <Headphones className="w-3.5 h-3.5" />
                            {t(language, 'contactHelpdesk')}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}

          {loading && (
            <div className="text-xs text-[#647066] italic">
              {isHi
                ? 'आपके बैच डेटा के आधार पर उत्तर तैयार किया जा रहा है...'
                : 'Analysing live batch digital twin and mandi context...'}
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="p-3 bg-red-50 border border-red-200 text-red-800 text-xs rounded-lg flex items-center justify-between gap-3"
            >
              <span className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </span>
              <button
                type="button"
                onClick={() => handleEscalate(input || 'Assistant error fallback')}
                className="underline font-semibold whitespace-nowrap"
              >
                {t(language, 'contactHelpdesk')}
              </button>
            </div>
          )}
        </div>

        {/* Input Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendQuestion(input);
          }}
          className="p-4 border-t border-[#E2E6DF] flex items-center gap-2"
        >
          <button
            type="button"
            onClick={handleVoiceInput}
            aria-label={t(language, 'voiceInput')}
            className={`p-2.5 rounded-lg border transition-colors ${
              listening
                ? 'bg-red-50 border-red-300 text-red-700'
                : 'bg-[#F7F8F6] border-[#D4D9D0] text-[#4B554D] hover:text-[#141A15]'
            }`}
          >
            {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          <input
            type="text"
            aria-label="Ask AgriNexus Assist"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t(language, 'askPlaceholder')}
            className="flex-1 px-3.5 py-2.5 text-sm bg-white border border-[#D4D9D0] rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700"
          />

          <button
            type="submit"
            disabled={loading || !input.trim()}
            aria-label="Send message"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-emerald-700 text-white text-xs font-semibold rounded-lg hover:bg-emerald-800 disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{isHi ? 'भेजें' : 'Send'}</span>
          </button>
        </form>
      </div>
    </div>
  );
};
