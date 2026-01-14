import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, MessageSquare } from 'lucide-react';
import { respond } from './helpResponder';
import type { ModuleHelpContent } from '@/help/helpRegistry';
import type { HelpContext } from '@/help/types';
import { cn } from '@/lib/utils';

interface Message {
  role: 'user' | 'assistant';
  text: string;
  ts: number;
}

interface HelpChatProps {
  moduleKey: string;
  content: ModuleHelpContent;
  context?: HelpContext;
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
    units: [
      'How do I add a new truck for an existing fleet customer?',
      "What should I fill out on a unit if I'm in a hurry?",
      'How do I quickly see all work we have done on this unit?',
    ],
    technicians: [
      'How should I set up tech names for a large shop?',
      "What's the best way to handle inactive or seasonal techs?",
      'How do techs connect to the schedule and work orders?',
    ],
    plasma_projects: [
      'How do I organize multiple cut jobs for the same customer?',
      "What's the difference between a plasma project and a template?",
      'How should I name plasma projects so they are easy to find later?',
    ],
    plasma_templates: [
      'When should I use a plasma template vs a one-off project?',
      'How do I update a template without losing history?',
      'What info should I always fill out on a template?',
    ],
    receiving_history: [
      'How do I see all receipts for a specific part?',
      'How can I check what was received on a particular PO?',
      'How do I use receiving history to audit inventory issues?',
    ],
    vendors: [
      'What vendor info is most important to set up first?',
      'How do vendors tie into purchase orders and receiving?',
      'How should I handle duplicate vendors?',
    ],
    part_categories: [
      'How should I structure part categories for reporting?',
      'How many categories is too many?',
      "What's the impact of changing a part's category?",
    ],
    cycle_counts: [
      'Which parts should I count first?',
      'How often should I run cycle counts?',
      'How do cycle counts affect on-hand quantity?',
    ],
    returns_warranty_report: [
      'How do I see all warranty jobs for the last 30 days?',
      'How can I spot repeat issues with the same part or component?',
      "What's the best way to use this report in a weekly meeting?",
    ],
    settings: [
      'Which settings should I change first when I set up a new shop?',
      'Who should be allowed to edit settings?',
      'How do settings affect inventory and finance behavior?',
    ],
  };
  return suggestions[moduleKey] || ['How do I get started?', 'What are the key features?'];
}

export function HelpChat({ moduleKey, content, context }: HelpChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const explainQuestion = 'Explain this screen';
  const baseSuggestions = getModuleSuggestions(moduleKey);
  const suggestions = (() => {
    const hasExplain = baseSuggestions.some(
      (s) => s.toLowerCase().includes('explain this screen')
    );
    const list = hasExplain ? baseSuggestions : [explainQuestion, ...baseSuggestions];
    return list;
  })();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = (userText: string) => {
    if (!userText.trim() || isLoading) return;

    const cleanText = userText.trim();
    const userMessage: Message = {
      role: 'user',
      text: cleanText,
      ts: Date.now(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    setTimeout(() => {
      const response = respond(moduleKey, content, cleanText, context);
      const assistantMessage: Message = {
        role: 'assistant',
        text: response.answer,
        ts: Date.now(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setIsLoading(false);
      inputRef.current?.focus();
    }, 250);
  };

  const handleSend = () => {
    sendMessage(input);
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInput('');
    sendMessage(suggestion);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {suggestions.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {suggestions.map((suggestion, idx) => (
            <Button
              key={idx}
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => handleSuggestionClick(suggestion)}
            >
              {suggestion}
            </Button>
          ))}
        </div>
      )}

      <div className="space-y-3 mb-3">
        {messages.length === 0 ? (
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <MessageSquare className="w-4 h-4 opacity-60" />
            <span>Ask anything about {content.title}</span>
          </div>
        ) : (
          <>
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}
              >
                <div
                  className={cn(
                    'max-w-[85%] rounded-lg px-3 py-2 text-sm shadow-sm',
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-foreground'
                  )}
                >
                  <div className="text-[11px] font-medium text-muted-foreground mb-1">
                    {msg.role === 'user' ? 'You' : 'ShopFlow'}
                  </div>
                  <div className="whitespace-pre-wrap break-words leading-relaxed">
                    {msg.role === 'assistant' ? (
                      <div className="space-y-1.5">
                        {msg.text.split('\n').map((line, lineIdx) => {
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

      <div className="border-t pt-3 bg-background sticky bottom-0">
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
      </div>
    </div>
  );
}
