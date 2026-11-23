import React, { useState, useRef, useEffect } from 'react';
import { Bot, Send, User, Sparkles } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { sendChatMessage } from '../../services/geminiService';
import { ChatMessage } from '../../types/assistant';
import { AQI_LEVELS } from '../../utils/aqiScale';

const QUICK_PROMPTS = [
  'Can my 6-year-old with asthma play outside today?',
  'How do I build a DIY box-fan HEPA purifier?',
  'When is the safest time to commute to work today?',
  'Should I open the windows to ventilate this afternoon?',
  'How should we adjust grandmother\'s morning routine?',
  'Are cloth or surgical masks effective in this smog?',
];

export const AssistantView: React.FC = () => {
  const { currentAqi, householdProfile } = useApp();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      content: `Hello ${householdProfile.familyName}! I am **AirAware AI**, your personalized clean air resilience advisor.\n\nI am currently tracking live atmospheric conditions in **${currentAqi?.city || 'your area'}** (AQI **${currentAqi?.currentAqi || '--'}**, ${currentAqi?.severity || ''}) and factoring in your household demographics (${householdProfile.members.length} members, including vulnerable respiratory profiles).\n\nHow can I help protect your family or optimize your day?`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || input).trim();
    if (!text || !currentAqi) return;

    const userMsg: ChatMessage = {
      id: 'usr-' + Date.now(),
      sender: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInput('');
    setIsTyping(true);

    try {
      const response = await sendChatMessage(text, currentAqi, householdProfile);
      const botMsg: ChatMessage = {
        id: 'bot-' + Date.now(),
        sender: 'assistant',
        content: response,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch (err) {
      console.error(err);
      const errorMsg: ChatMessage = {
        id: 'bot-err-' + Date.now(),
        sender: 'assistant',
        content: 'I encountered an issue processing that query. Please verify your connection or try another prompt.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  const aqiMeta = currentAqi ? AQI_LEVELS[currentAqi.severity] : AQI_LEVELS.Moderate;

  return (
    <div className="max-w-5xl mx-auto h-[calc(100vh-130px)] flex flex-col rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden">
      
      {/* Header Context Strip */}
      <div className="px-6 py-4 bg-slate-950/80 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-teal-500 to-cyan-500 flex items-center justify-center p-0.5">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <Bot className="w-5 h-5 text-teal-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white">AirAware Personal Advisor</h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-400 border border-teal-500/30">
                Gemini Powered
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Grounded in live telemetry for {currentAqi?.city} & {householdProfile.familyName}
            </p>
          </div>
        </div>

        {/* Live Status Pill */}
        {currentAqi && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-xs">
            <span
              className="w-2.5 h-2.5 rounded-full animate-pulse"
              style={{ backgroundColor: aqiMeta.color }}
            />
            <span className="text-slate-300 font-medium">
              AQI {currentAqi.currentAqi} ({currentAqi.severity})
            </span>
          </div>
        )}
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.map((msg) => {
          const isBot = msg.sender === 'assistant';
          return (
            <div
              key={msg.id}
              className={`flex gap-3 max-w-3xl ${isBot ? 'mr-auto' : 'ml-auto flex-row-reverse'}`}
            >
              <div
                className={`w-8 h-8 rounded-xl shrink-0 flex items-center justify-center text-xs font-bold ${
                  isBot
                    ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                    : 'bg-slate-700 text-white'
                }`}
              >
                {isBot ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
              </div>

              <div
                className={`rounded-2xl px-5 py-3.5 text-sm leading-relaxed shadow-md ${
                  isBot
                    ? 'bg-slate-950 border border-slate-800 text-slate-200'
                    : 'bg-teal-600 text-white'
                }`}
              >
                <div className="whitespace-pre-wrap prose-invert max-w-none text-xs sm:text-sm">
                  {msg.content}
                </div>
                <div
                  className={`mt-1.5 text-[10px] ${
                    isBot ? 'text-slate-500' : 'text-teal-200 text-right'
                  }`}
                >
                  {msg.timestamp}
                </div>
              </div>
            </div>
          );
        })}

        {isTyping && (
          <div className="flex gap-3 max-w-xl mr-auto items-center">
            <div className="w-8 h-8 rounded-xl bg-teal-500/20 text-teal-300 border border-teal-500/30 flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4" />
            </div>
            <div className="rounded-2xl px-4 py-3 bg-slate-950 border border-slate-800 text-xs text-slate-400 flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-teal-400 animate-spin" />
              <span>Analyzing ambient inversion & calculating protection parameters...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Quick Prompts */}
      <div className="px-6 py-2 bg-slate-950/60 border-t border-slate-800/80">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider shrink-0 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-teal-400" /> Suggestions:
          </span>
          {QUICK_PROMPTS.map((prompt, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(prompt)}
              className="text-xs px-3 py-1.5 rounded-full bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-teal-500/40 text-slate-300 hover:text-white transition-all whitespace-nowrap shrink-0"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      {/* Input Form */}
      <div className="p-4 bg-slate-950 border-t border-slate-800">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Ask AirAware about health hacks, school transit, or indoor filters in ${currentAqi?.city || 'your area'}...`}
            className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-colors"
          />
          <button
            type="submit"
            disabled={!input.trim() || isTyping}
            className="px-5 py-3 rounded-xl bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-slate-950 font-bold transition-all flex items-center gap-2 shrink-0 shadow-lg shadow-teal-500/20"
          >
            <span>Ask</span>
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>

    </div>
  );
};
