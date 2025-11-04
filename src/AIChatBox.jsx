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
    model: 'gemini-2.0-flash',
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
        // Regular expression to match <<<lon, lat>>> format
        const regex = /<<<([^,]+),\s*([^>]+)>>>/;
        const match = text.match(regex);
        
        if (match) {
            const lon = parseFloat(match[1].trim());
            const lat = parseFloat(match[2].trim());
            
            // Remove the coordinate pattern from the text
            const cleanedText = text.replace(regex, '').trim();
            
            return {
                coordinates: [lon, lat],
                text: cleanedText
            };
        }
        
        // If no coordinates found, return null for coordinates and original text
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
                    addMarker(coordinates); // Now, this call is safe!
                } else {
                    // We print an error but the app doesn't crash
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
            <div className="relative z-10 flex flex-col h-full">
                {/* Header */}
                <img 
                    src={myGif}
                    alt="AI gif"
                    style={{ width: '100%', height: '8%', }}
                />

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-4 bg-black/100 backdrop-blur-2xl">
                    {messages.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-full text-center text-white/50 text-sm">
                            <Globe className="w-16 h-16 mb-4 text-white/40" strokeWidth={1.5} />
                            <p className="font-medium text-white/60">Start exploring the world</p>
                        </div>
                    )}

                    {messages.map((msg, index) => (
                        <div 
                            key={index}
                            className={`mb-3 flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                        >
                            <div className="flex items-center gap-1.5 mb-1.5">
                                {msg.role === 'user' ? (
                                    <User className="w-3 h-3 text-white/60" />
                                ) : (
                                    <Bot className="w-3 h-3 text-teal-400/80" />
                                )}
                                <span className="text-xs font-medium text-white/60 uppercase tracking-wide">
                                    {msg.role === 'user' ? 'You' : 'AI'}
                                </span>
                            </div>
                            <div className={`max-w-[85%] px-4 py-2.5 rounded-xl text-sm leading-relaxed break-words shadow-xl backdrop-blur-xl ${
                                msg.role === 'user' 
                                    ? 'bg-blue-500/80 text-white border border-white/20' 
                                    : 'bg-white/90 text-slate-800 border border-white/30'
                            }`}>
                                <ReactMarkdown>{typeof msg.content === 'string' ? msg.content : ''}</ReactMarkdown>
                            </div>
                        </div>
                    ))}

                    {loading && (
                        <div className="flex items-center gap-2 px-4 py-2.5 bg-white/80 backdrop-blur-xl rounded-xl max-w-[85%] text-slate-700 text-sm shadow-xl border border-white/30">
                            <Loader2 className="w-4 h-4 animate-spin text-teal-600" />
                            <span className="font-medium">AI is thinking</span>
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>

                {/* Input Form */}
                <div className="p-3 border-t border-white/10 bg-black/80 backdrop-blur-xl shadow-lg">
                    <div className="flex gap-2">
                        <input 
                            // 3. Attach the ref to the input element
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
                            placeholder="Ask about locations, coordinates, maps..."
                            disabled={loading} // This correctly disables the input while loading
                            className="flex-1 px-3 py-2.5 border border-white/20 rounded-lg text-sm outline-none bg-white/10 backdrop-blur-md text-white placeholder-white/50 transition-all focus:border-blue-400/60 focus:ring-2 focus:ring-blue-400/30 disabled:opacity-50 shadow-lg"
                        />
                        <button 
                            onClick={sendMessage}
                            disabled={loading || !input.trim()}
                            className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all shadow-lg backdrop-blur-md flex items-center gap-2 ${
                                loading || !input.trim()
                                    ? 'bg-white/20 text-white/40 cursor-not-allowed'
                                    : 'bg-blue-500/80 text-white hover:bg-blue-600/80 cursor-pointer border border-white/20'
                            }`}
                        >
                            <Send className="w-4 h-4" />
                            <span>{loading ? 'Sending' : 'Send'}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default AIChatBox;