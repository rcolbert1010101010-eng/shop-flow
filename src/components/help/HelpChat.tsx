import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, MessageSquare } from 'lucide-react';
import { respond } from './helpResponder';
import type { ModuleHelpContent } from '@/help/helpRegistry';
import { cn } from '@/lib/utils';

interface Message {
  role: 'user' | 'assistant';
  text: string;
  ts: number;
}

interface HelpChatProps {
  moduleKey: string;
  content: ModuleHelpContent;
}

function getModuleSuggestions(moduleKey: string): string[] {
  const suggestions: Record<string, string[]> = {
    inventory: [
      'When should I use Adjust QOH vs Receive?',
      'What does QOH mean?',
      'How do I import parts?',
    ],
    parts: [
      'What UOM should I choose?',
      'How is sheet SQFT calculated?',
      "What's the difference between cost and price?",
    ],
  };
  return suggestions[moduleKey] || ['How do I get started?', 'What are the key features?'];
}

export function HelpChat({ moduleKey, content }: HelpChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestions = getModuleSuggestions(moduleKey);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = () => {
    const userText = input.trim();
    if (!userText || isLoading) return;

    // Add user message
    const userMessage: Message = {
      role: 'user',
      text: userText,
      ts: Date.now(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    // Simulate async response (even though it's local)
    setTimeout(() => {
      const response = respond(moduleKey, content, userText);
      const assistantMessage: Message = {
        role: 'assistant',
        text: response.answer,
        ts: Date.now(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setIsLoading(false);
      inputRef.current?.focus();
    }, 300);
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto space-y-4 mb-4 min-h-[200px] max-h-[400px]">
        {messages.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-8">
            <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>Ask me anything about {content.title}</p>
            {suggestions.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2 justify-center">
                {suggestions.map((suggestion, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSuggestionClick(suggestion)}
                    className="text-xs px-3 py-1.5 rounded-full border border-border bg-background hover:bg-muted transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={cn(
                  'flex',
                  msg.role === 'user' ? 'justify-end' : 'justify-start'
                )}
              >
                <div
                  className={cn(
                    'max-w-[85%] rounded-lg px-3 py-2 text-sm',
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-foreground'
                  )}
                >
                  <div className="whitespace-pre-wrap break-words">
                    {msg.role === 'assistant' ? (
                      <div className="space-y-1.5">
                        {msg.text.split('\n').map((line, lineIdx) => {
                          // Handle bold text (**text**)
                          const parts: React.ReactNode[] = [];
                          let lastIndex = 0;
                          const boldRegex = /\*\*(.+?)\*\*/g;
                          let match;
                          let key = 0;

                          while ((match = boldRegex.exec(line)) !== null) {
                            if (match.index > lastIndex) {
                              parts.push(
                                <span key={key++}>{line.substring(lastIndex, match.index)}</span>
                              );
                            }
                            parts.push(
                              <strong key={key++} className="font-semibold">
                                {match[1]}
                              </strong>
                            );
                            lastIndex = match.index + match[0].length;
                          }
                          if (lastIndex < line.length) {
                            parts.push(<span key={key++}>{line.substring(lastIndex)}</span>);
                          }

                          // Handle bullet points and numbered lists
                          if (line.trim().startsWith('•') || line.trim().match(/^\d+\./)) {
                            return (
                              <div key={lineIdx} className="pl-2">
                                {parts.length > 0 ? parts : line}
                              </div>
                            );
                          }

                          return (
                            <div key={lineIdx}>
                              {parts.length > 0 ? parts : line || '\u00A0'}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      msg.text
                    )}
                  </div>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-lg px-3 py-2 text-sm text-muted-foreground">
                  Thinking...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      <div className="border-t pt-4">
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question..."
            disabled={isLoading}
            className="flex-1"
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            size="icon"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        {messages.length > 0 && suggestions.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {suggestions.slice(0, 2).map((suggestion, idx) => (
              <button
                key={idx}
                onClick={() => handleSuggestionClick(suggestion)}
                className="text-xs px-2 py-1 rounded border border-border bg-background hover:bg-muted transition-colors"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
