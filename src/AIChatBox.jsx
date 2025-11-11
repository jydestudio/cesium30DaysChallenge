import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Send, User, Bot, Loader2, Globe } from 'lucide-react';
import myGif from './assets/artificial_intelligence.gif';


const systemInstruction = `You are Jyde, a geospatial AI assistant. Your primary role is to help users find locations and provide coordinates.

STRICT OUTPUT FORMAT:
When a user asks about a place, you MUST respond in this exact format:
<<<longitude, latitude>>>

[2-3 sentence interesting summary about the place]

RULES:
1. Always provide coordinates in decimal degrees format (e.g., <<<-0.1276, 51.5074>>>)
2. Longitude comes FIRST, then latitude
3. Keep summaries concise and engaging (max 100 words)
4. If the location is ambiguous or you need clarification, ask a brief follow-up question
5. If the query is not about finding a place, respond naturally but keep it brief
6. For well-known places, use the most popular/central coordinates

EXAMPLES:
User: "I want to visit the Eiffel Tower"
You: <<<2.2945, 48.8584>>>

The Eiffel Tower is Paris's iconic iron landmark, standing 330m tall. Built in 1889, it offers breathtaking city views and sparkling light shows every evening.

User: "Where can I find good pizza in New York?"
You: Which neighborhood in New York are you interested in? Manhattan, Brooklyn, or another area?`;


const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const chat = genAI.getGenerativeModel({ 
    model: 'gemini-2.5-flash-lite',
    systemInstruction: systemInstruction
}).startChat({});

function AIChatBox({ addMarker }) {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);


    function extractCoordinatesAndText(text) {
        const regex = /<<<([^,]+),\s*([^>]+)>>>/;
        const match = text.match(regex);
        
        if (match) {
            const lon = parseFloat(match[1].trim());
            const lat = parseFloat(match[2].trim());
            const cleanedText = text.replace(regex, '').trim();
            
            return {
                coordinates: [lon, lat],
                text: cleanedText
            };
        }
        
        return {
            coordinates: null,
            text: text.trim()
        };
    }



    const sendMessage = async (e) => {
        e.preventDefault();
        if (!input.trim() || loading) return;
        
        const userMessage = { role: 'user', content: input.trim() };
        setMessages((prev) => [...prev, userMessage]);
        setInput('');
        setLoading(true);

        try {
            const result = await chat.sendMessage(userMessage.content);
            const modelResponse = result.response.text();
            
            const { coordinates, text } = extractCoordinatesAndText(modelResponse);
            
            if (coordinates) {
                console.log(coordinates);
                if (typeof addMarker === 'function') {
                    addMarker(coordinates);
                } else {
                    console.error("Marker function (addMarker) is missing or invalid in props."); 
                }
            }
            const aiMessage = { role: 'assistant', content: text };
            setMessages((prev) => [...prev, aiMessage]);
        } catch (error) {
            console.error('Error communicating with Gemini API:', error);
            setMessages((prev) => [...prev, { 
                role: 'assistant', 
                content: 'Sorry, could not connect to Artificial Intelligence' 
            }]);
        } finally {
            setLoading(false);
        }
    };


    const inputRef = useRef(null);

    useEffect(() => {
        if (!loading && inputRef.current) {
            inputRef.current.focus();
        }
    }, [loading]);


    return (
        <div className="flex flex-col h-full relative" style={{ fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>
            <div className="relative z-10 flex flex-col h-full bg-white/5 backdrop-blur-3xl border border-white/10 overflow-hidden shadow-2xl">
                {/* Header */}
                <div className="p-4 border-b border-white/10 bg-white/5 backdrop-blur-xl">
                    <h6 className="text-sm font-semibold text-white/90">Powered by Gemini</h6>
                </div>

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-6 bg-transparent">
                    {messages.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-full text-center">
                            <div className="p-6 bg-white/5 backdrop-blur-xl border border-white/10 mb-4">
                                <Globe className="w-12 h-12 text-white/50" strokeWidth={1.5} />
                            </div>
                            <p className="font-medium text-white/70 text-lg">Start exploring the world</p>
                            <p className="text-white/40 text-sm mt-2">Ask me about any location</p>
                        </div>
                    )}

                    {messages.map((msg, index) => (
                        <div 
                            key={index}
                            className={`mb-4 flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                        >
                            <div className="flex items-center gap-2 mb-2">
                                {msg.role === 'user' ? (
                                    <div className="p-1.5 rounded-full bg-blue-500/20 backdrop-blur-xl border border-blue-400/30">
                                        <User className="w-3.5 h-3.5 text-blue-300" />
                                    </div>
                                ) : (
                                    <div className="p-1.5 rounded-full bg-teal-500/20 backdrop-blur-xl border border-teal-400/30">
                                        <Bot className="w-3.5 h-3.5 text-teal-300" />
                                    </div>
                                )}
                                <span className="text-xs font-semibold text-white/60 uppercase tracking-wider">
                                    {msg.role === 'user' ? 'You' : 'Jyde AI'}
                                </span>
                            </div>
                            <div className={`max-w-[80%] px-5 py-3.5 rounded-2xl text-sm leading-relaxed break-words shadow-2xl backdrop-blur-2xl transition-all hover:scale-[1.02] ${
                                msg.role === 'user' 
                                    ? 'bg-blue-500/15 text-white border border-blue-400/30 rounded-tr-sm' 
                                    : 'bg-white/10 text-white border border-white/20 rounded-tl-sm'
                            }`}>
                                <ReactMarkdown>
                                    {typeof msg.content === 'string' ? msg.content : ''}
                                </ReactMarkdown>
                            </div>
                        </div>
                    ))}

                    {loading && (
                        <div className="flex items-center gap-3 px-5 py-3.5 bg-white/10 backdrop-blur-2xl rounded-2xl rounded-tl-sm max-w-[80%] text-white text-sm shadow-2xl border border-white/20">
                            <Loader2 className="w-4 h-4 animate-spin text-teal-400" />
                            <span className="font-medium">Jyde is thinking...</span>
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>

                {/* Input Form */}
                <div className="p-4 border-t border-white/10 bg-white/5 backdrop-blur-2xl">
                    <form onSubmit={sendMessage} className="flex gap-3">
                        <input 
                            ref={inputRef}
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyPress={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    sendMessage(e);
                                }
                            }}
                            placeholder="Ask about locations, coordinates, places..."
                            disabled={loading}
                            className="flex-1 px-4 py-3 border border-white/20 rounded-xl text-sm outline-none bg-white/10 backdrop-blur-xl text-white placeholder-white/50 transition-all focus:border-blue-400/60 focus:ring-2 focus:ring-blue-400/20 focus:bg-white/15 disabled:opacity-50 shadow-lg"
                        />
                        <button 
                            type="submit"
                            disabled={loading || !input.trim()}
                            className={`px-5 py-3 rounded-xl text-sm font-semibold transition-all shadow-xl backdrop-blur-xl flex items-center gap-2 ${
                                loading || !input.trim()
                                    ? 'bg-white/10 text-white/40 cursor-not-allowed border border-white/20'
                                    : 'bg-gradient-to-r from-blue-500/40 to-teal-500/40 text-white hover:from-blue-500/60 hover:to-teal-500/60 cursor-pointer border border-white/30 hover:scale-105 active:scale-95'
                            }`}
                        >
                            <Send className="w-4 h-4" />
                            <span>{loading ? 'Sending' : 'Send'}</span>
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}

export default AIChatBox;