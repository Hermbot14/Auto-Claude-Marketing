import { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, Loader2, Undo, Redo, X } from 'lucide-react';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { ScrollArea } from '../ui/scroll-area';
import { Badge } from '../ui/badge';
import { Card } from '../ui/card';
import { useRoadmapStore, type ChatMessage, type RoadmapOperation } from '../../stores/roadmap-store';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface RoadmapChatProps {
  projectId: string;
}

/**
 * Suggestion chips for common roadmap operations
 */
const SUGGESTION_CHIPS = [
  { label: 'Add context to task', template: 'Add more context to "{task}": {context}' },
  { label: 'Mark as complete', template: 'Mark "{task}" as complete' },
  { label: 'Change priority', template: 'Change "{task}" priority to {priority}' },
  { label: 'Redefine phase', template: 'Redefine phase "{phase}" as "{newName}"' },
  { label: 'Move task', template: 'Move "{task}" to phase "{phase}"' },
  { label: 'Reorder by priority', template: 'Reorder tasks by priority (must, should, could)' },
] as const;

/**
 * RoadmapChat Component
 *
 * Provides an interactive chat interface for manipulating roadmaps
 * using natural language commands.
 */
export function RoadmapChat({ projectId }: RoadmapChatProps) {
  const { t } = useTranslation(['roadmap', 'common']);
  const chatMessages = useRoadmapStore((state) => state.chatMessages);
  const isChatProcessing = useRoadmapStore((state) => state.isChatProcessing);
  const addChatMessage = useRoadmapStore((state) => state.addChatMessage);
  const clearChatMessages = useRoadmapStore((state) => state.clearChatMessages);
  const setChatProcessing = useRoadmapStore((state) => state.setChatProcessing);
  const canUndo = useRoadmapStore((state) => state.canUndo());
  const canRedo = useRoadmapStore((state) => state.canRedo());
  const undo = useRoadmapStore((state) => state.undo);
  const redo = useRoadmapStore((state) => state.redo);

  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages]);

  const handleSend = async () => {
    if (!input.trim() || isChatProcessing) return;

    const userMessage = input.trim();
    setInput('');

    // Add user message to chat
    addChatMessage({
      role: 'user',
      content: userMessage
    });

    // Set processing state
    setChatProcessing(true);

    try {
      // Call the roadmap chat IPC handler to process the command
      const result = await window.electronAPI.processRoadmapChat(projectId, userMessage);

      if (result.success && result.data) {
        // Add assistant response
        addChatMessage({
          role: 'assistant',
          content: result.data.response,
          operations: result.data.operations
        });

        // If operations were returned, they would be applied by the store
        // The backend returns validated operations for the frontend to execute
      } else {
        // Error response
        addChatMessage({
          role: 'assistant',
          content: `I'm sorry, I couldn't process that request. ${result.error || 'Please try again.'}`
        });
      }
    } catch (error) {
      console.error('Chat processing error:', error);
      addChatMessage({
        role: 'assistant',
        content: 'An error occurred while processing your request. Please try again.'
      });
    } finally {
      setChatProcessing(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSuggestionClick = (template: string) => {
    setInput(template);
    textareaRef.current?.focus();
  };

  const handleUndo = () => {
    undo();
    addChatMessage({
      role: 'system',
      content: 'Undo performed.'
    });
  };

  const handleRedo = () => {
    redo();
    addChatMessage({
      role: 'system',
      content: 'Redo performed.'
    });
  };

  const handleClearChat = () => {
    clearChatMessages();
  };

  return (
    <Card className="flex flex-col h-full bg-gradient-to-br from-card to-card/50 border-border/50">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border/50">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">{t('roadmap:chat.title')}</h3>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleUndo}
            disabled={!canUndo}
            title={t('common:actions.undo')}
          >
            <Undo className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRedo}
            disabled={!canRedo}
            title={t('common:actions.redo')}
          >
            <Redo className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearChat}
            disabled={chatMessages.length === 0}
            title={t('common:actions.clear')}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 px-4">
        <div className="py-4 space-y-4">
          {chatMessages.length === 0 ? (
            <div className="text-center py-8">
              <Sparkles className="h-12 w-12 text-primary/50 mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">{t('roadmap:chat.welcome')}</p>
              <div className="text-sm text-muted-foreground">
                <p className="mb-2">{t('roadmap:chat.examples.title')}:</p>
                <ul className="space-y-1 text-left inline-block">
                  <li className="italic">"Mark SEO audit as complete"</li>
                  <li className="italic">"Add context to Q1 planning about budget"</li>
                  <li className="italic">"Move social media strategy to top priority"</li>
                  <li className="italic">"Redefine Q1 as Q1 2026 - Product Launch"</li>
                </ul>
              </div>
            </div>
          ) : (
            chatMessages.map((message) => (
              <ChatMessageBubble key={message.id} message={message} />
            ))
          )}
          {isChatProcessing && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">{t('roadmap:chat.processing')}</span>
            </div>
          )}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      {/* Suggestion Chips */}
      {chatMessages.length === 0 && (
        <div className="px-4 pb-2">
          <div className="flex flex-wrap gap-2">
            {SUGGESTION_CHIPS.map((chip) => (
              <Badge
                key={chip.label}
                variant="outline"
                className="cursor-pointer hover:bg-primary/10 hover:border-primary/50 transition-colors"
                onClick={() => handleSuggestionClick(chip.template)}
              >
                {chip.label}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t border-border/50">
        <div className="flex gap-2">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={t('roadmap:chat.placeholder')}
            disabled={isChatProcessing}
            className="min-h-[60px] max-h-[200px]"
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isChatProcessing}
            size="icon"
            className="shrink-0"
          >
            {isChatProcessing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          {t('roadmap:chat.hint')}
        </p>
      </div>
    </Card>
  );
}

/**
 * ChatMessageBubble Component
 *
 * Displays a single chat message with markdown support
 */
interface ChatMessageBubbleProps {
  message: ChatMessage;
}

function ChatMessageBubble({ message }: ChatMessageBubbleProps) {
  const { t } = useTranslation(['common']);

  if (message.role === 'system') {
    return (
      <div className="flex justify-center">
        <Badge variant="outline" className="text-xs">
          {message.content}
        </Badge>
      </div>
    );
  }

  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-lg px-4 py-2 ${
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-foreground'
        }`}
      >
        {isUser ? (
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="text-sm prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content}
            </ReactMarkdown>
          </div>
        )}

        {/* Operations performed */}
        {message.operations && message.operations.length > 0 && (
          <div className="mt-3 pt-3 border-t border-white/10">
            <p className="text-xs opacity-70 mb-2">
              {t('roadmap:chat.operationsPerformed')}:
            </p>
            <div className="space-y-1">
              {message.operations.map((op, idx) => (
                <div key={idx} className="text-xs flex items-start gap-2">
                  <span className="opacity-50">•</span>
                  <span>{op.description}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Timestamp */}
        <div className={`text-xs mt-1 ${isUser ? 'opacity-70' : 'text-muted-foreground'}`}>
          {new Date(message.timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
          })}
        </div>
      </div>
    </div>
  );
}
