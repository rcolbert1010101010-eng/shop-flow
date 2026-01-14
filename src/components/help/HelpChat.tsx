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
    sales_orders: [
      'When should I use a quote vs an order?',
      'How do I change UOM correctly?',
      "Why doesn't my total match my line items?",
      'What happens when I invoice?',
      'How do partial payments work?',
    ],
    purchase_orders: [
      'How do I receive a partial shipment?',
      'Why is Remaining not zero?',
      'Should I change unit cost when the invoice differs?',
      'When should I close a PO?',
      'How does PO receiving affect QOH?',
      'How do I link a PO to a WO or SO?',
    ],
    receiving: [
      'When should I receive vs Adjust QOH?',
      'How do partial receives work?',
      'Should I update unit cost if the invoice differs?',
      'Why is my QOH not what I expected?',
      'How do I receive sheet metal correctly?',
      'Where do I record freight/fees?',
    ],
    work_orders: [
      "What's the best way to write concern/notes?",
      'How do labor hours affect totals?',
      'Why did adding parts change QOH?',
      'When should I invoice a WO?',
      'How do I correct a parts quantity mistake?',
      'What does negative QOH mean for the shop?',
    ],
    invoices: [
      'When should I create an invoice from a WO or SO?',
      'What does balance due mean?',
      'How do partial payments work?',
      'What should I do if an invoice is wrong?',
      'Why is an invoice marked overdue?',
      'How do I find unpaid invoices quickly?',
    ],
    payments: [
      'How do I apply a payment to the right invoice?',
      'What happens when I record a partial payment?',
      'How do I void a payment and re-enter it?',
      'Why does the balance due look wrong?',
      'How do I see unpaid balances by customer?',
      'What should I put in payment notes?',
    ],
    scheduling: [
      'How do I avoid overbooking?',
      'What should I put in scheduling notes?',
      'How do I handle waiting parts?',
      'How do I reschedule without losing track?',
      'Why should I link schedule to the WO?',
      "What's the best daily scheduling routine?",
    ],
    warranty_returns: [
      'When should I restock a return?',
      'How do I tie a return to the original invoice?',
      'What should I put in return notes?',
      'How do vendor RMAs work?',
      'How do I track warranty claim status?',
      'Does a return affect QOH automatically?',
    ],
    manufacturing: [
      "What's the best way to write a traveler?",
      'How do I link manufacturing work to a WO or SO?',
      'What should I track for time and profitability?',
      'How do I plan capacity for next week?',
      'What statuses should we use for fab work?',
      'How do plasma/brake/weld jobs differ in tracking?',
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
