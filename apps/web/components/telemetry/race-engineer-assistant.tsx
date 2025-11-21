'use client';

import { useState, useRef, useEffect } from 'react';
import { useTelemetryStore } from '@/stores/telemetry-store';

interface Message {
  id: string;
  type: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

export function RaceEngineerAssistant() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isAvailable, setIsAvailable] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const data = useTelemetryStore((state) => state.data);
  const strategy = useTelemetryStore((state) => state.strategy);
  const isLive = useTelemetryStore((state) => state.isLive);

  // Check if AI is available
  useEffect(() => {
    checkAvailability();
  }, []);

  const checkAvailability = async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
      const response = await fetch(`${apiUrl}/api/race-engineer/status`);
      const data = await response.json();
      setIsAvailable(data.available);
      if (data.available) {
        addSystemMessage('AI Race Engineer ready. Ask me anything!');
      } else {
        addSystemMessage('AI Race Engineer offline. Ensure Ollama is running on the backend server.');
      }
    } catch {
      setIsAvailable(false);
      addSystemMessage('AI Race Engineer offline. Backend server not reachable.');
    }
  };

  const addSystemMessage = (content: string) => {
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        type: 'system',
        content,
        timestamp: Date.now(),
      },
    ]);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || !isAvailable || !isLive) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: input,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Call backend LLM service
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
      const response = await fetch(`${apiUrl}/api/race-engineer/advice`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: input,
          telemetry: data,
          strategy: strategy,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get advice');
      }

      const { advice } = await response.json();

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: advice,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Race engineer error:', error);
      addSystemMessage('Error getting advice. Check connection.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const getSuggestions = () => {
    if (!isLive || !data) return [];

    const suggestions = [];

    if (strategy && !strategy.fuelStrategy.canFinish) {
      suggestions.push('Should I pit for fuel now?');
    }

    if (strategy && strategy.tireStrategy.changeRecommended) {
      suggestions.push('Are my tires still good?');
    }

    if (strategy && strategy.opportunities.length > 0) {
      suggestions.push('Any undercut opportunities?');
    }

    suggestions.push('How am I doing?');
    suggestions.push('What should I focus on?');

    return suggestions.slice(0, 3);
  };

  return (
    <div className="rounded-lg border bg-card p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold">AI Race Engineer</h2>
        <div
          className={`text-xs px-2 py-1 rounded-full ${
            isAvailable
              ? 'bg-green-500/10 text-green-500 border border-green-500/20'
              : 'bg-red-500/10 text-red-500 border border-red-500/20'
          }`}
        >
          {isAvailable ? '🤖 Online' : '❌ Offline'}
        </div>
      </div>

      {/* Messages */}
      <div className="rounded-lg bg-secondary/50 p-4 h-96 overflow-y-auto mb-4 space-y-3">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            <div className="text-center">
              <div className="text-4xl mb-2">🏎️💨</div>
              <div>Ask me anything about your race!</div>
            </div>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg p-3 ${
                message.type === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : message.type === 'assistant'
                  ? 'bg-green-500/10 border border-green-500/20 text-foreground'
                  : 'bg-blue-500/10 border border-blue-500/20 text-muted-foreground text-sm'
              }`}
            >
              <div className="whitespace-pre-wrap">{message.content}</div>
              <div className="text-xs opacity-50 mt-1">
                {new Date(message.timestamp).toLocaleTimeString()}
              </div>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-secondary border border-border rounded-lg p-3">
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  <div className="w-2 h-2 rounded-full bg-primary animate-bounce" />
                  <div className="w-2 h-2 rounded-full bg-primary animate-bounce [animation-delay:0.2s]" />
                  <div className="w-2 h-2 rounded-full bg-primary animate-bounce [animation-delay:0.4s]" />
                </div>
                <span className="text-sm text-muted-foreground">Analyzing...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Suggestions */}
      {isAvailable && isLive && getSuggestions().length > 0 && (
        <div className="mb-3">
          <div className="text-xs text-muted-foreground mb-2">Quick questions:</div>
          <div className="flex flex-wrap gap-2">
            {getSuggestions().map((suggestion, idx) => (
              <button
                key={idx}
                onClick={() => setInput(suggestion)}
                className="text-xs px-3 py-1 rounded-full bg-secondary hover:bg-secondary/80 border border-border transition-colors"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={
            isAvailable
              ? isLive
                ? 'Ask your race engineer...'
                : 'Waiting for telemetry data...'
              : 'Install Ollama to enable AI'
          }
          disabled={!isAvailable || !isLive || isLoading}
          className="flex-1 px-4 py-2 rounded-lg bg-secondary border border-border focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
        />
        <button
          onClick={sendMessage}
          disabled={!isAvailable || !isLive || isLoading || !input.trim()}
          className="px-6 py-2 rounded-lg bg-primary text-primary-foreground font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          Send
        </button>
      </div>

      {/* Setup Instructions */}
      {!isAvailable && (
        <div className="mt-4 rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-4">
          <div className="text-sm font-semibold text-yellow-600 dark:text-yellow-400 mb-2">
            🤖 AI Race Engineer Unavailable
          </div>
          <div className="text-xs text-muted-foreground space-y-1">
            <div>The AI assistant requires Ollama running on the backend server.</div>
            <div className="mt-2 font-semibold">Backend Setup (Server Administrator):</div>
            <div>1. Install: <code className="bg-secondary px-1 rounded">brew install ollama</code> or <code className="bg-secondary px-1 rounded">curl https://ollama.ai/install.sh | sh</code></div>
            <div>2. Pull model: <code className="bg-secondary px-1 rounded">ollama pull llama3.1:8b</code></div>
            <div>3. Start: <code className="bg-secondary px-1 rounded">ollama serve</code></div>
            <div>4. Restart the backend API server</div>
          </div>
        </div>
      )}
    </div>
  );
}
