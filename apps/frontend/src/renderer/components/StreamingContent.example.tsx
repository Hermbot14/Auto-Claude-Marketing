/**
 * Example usage of StreamingContent component
 *
 * Demonstrates how to integrate streaming AI responses
 * in your application for various use cases.
 */

import { StreamingContent } from './StreamingContent';
import { useTranslation } from 'react-i18next';

// ============================================================================
// Example 1: Simple AI Chat Response
// ============================================================================

export function SimpleChatExample() {
  const { t } = useTranslation(['common']);

  return (
    <StreamingContent
      url="/api/chat/stream"
      body={{
        message: "Explain React hooks in simple terms",
        model: "claude-sonnet-4-5-20250514"
      }}
      placeholder="Ask me anything..."
      onComplete={(result) => {
        console.log('Chat completed:', result.text);
        console.log('Tools used:', result.tools);
      }}
      onError={(error) => {
        console.error('Chat error:', error.message);
      }}
    />
  );
}

// ============================================================================
// Example 2: Code Generation with Streaming
// ============================================================================

export function CodeGenerationExample() {
  const { t } = useTranslation(['common']);

  return (
    <StreamingContent
      url="/api/generate/stream"
      body={{
        task: "Create a React component for a TODO list",
        language: "typescript"
      }}
      placeholder="Generating code..."
      showCancel={true}
      showMetrics={true}
      onComplete={(result) => {
        // Display generated code with syntax highlighting
        console.log('Generated code:', result.text);
      }}
      onCancel={() => {
        console.log('User cancelled code generation');
      }}
    />
  );
}

// ============================================================================
// Example 3: Analysis with Tool Execution
// ============================================================================

export function AnalysisExample() {
  const { t } = useTranslation(['common']);

  return (
    <div className="space-y-4">
      <h2>Project Analysis</h2>
      <StreamingContent
        url="/api/analyze/stream"
        body={{
          projectPath: "/path/to/project",
          analysisTypes: ["security", "performance", "code-quality"]
        }}
        placeholder="Starting analysis..."
        onComplete={(result) => {
          // Save analysis results
          saveAnalysis(result.text);
          showResults(result.tools);
        }}
      />
    </div>
  );
}

function saveAnalysis(text: string) {
  // Save to file or state
}

function showResults(tools: string[]) {
  // Display what tools were used
}

// ============================================================================
// Example 4: Multi-turn Conversation
// ============================================================================

export function ConversationExample() {
  const { t } = useTranslation(['common']);
  const [messages, setMessages] = useState<Array<{
    role: 'user' | 'assistant';
    content: string;
  }>>([]);

  const [isStreaming, setIsStreaming] = useState(false);

  const handleUserMessage = (content: string) => {
    setMessages(prev => [...prev, { role: 'user', content }]);
    setIsStreaming(true);
  };

  return (
    <div className="space-y-4">
      {messages.map((msg, i) => (
        <div key={i} className={msg.role === 'user' ? 'text-right' : 'text-left'}>
          <div className="inline-block rounded-lg bg-muted px-4 py-2 max-w-md">
            {msg.content}
          </div>
        </div>
      ))}

      {isStreaming && (
        <div className="text-left">
          <div className="inline-block rounded-lg bg-primary/10 px-4 py-2 max-w-md">
            <StreamingContent
              url="/api/chat/stream"
              body={{
                message: messages[messages.length - 1]?.content,
                history: messages.slice(-5) // Last 5 messages for context
              }}
              placeholder="..."
              onComplete={(result) => {
                setMessages(prev => [
                  ...prev,
                  { role: 'assistant', content: result.text }
                ]);
                setIsStreaming(false);
              }}
              onError={() => {
                setIsStreaming(false);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Example 5: Custom Styling
// ============================================================================

export function StyledExample() {
  return (
    <StreamingContent
      url="/api/chat/stream"
      body={{ message: "Hello" }}
      className="custom-streaming-styles"
      headers={{
        'X-Custom-Header': 'value'
      }}
      onComplete={(result) => {
        // Access full streaming state via custom hook
        console.log('Final content:', result.text);
      }}
    />
  );
}

// ============================================================================
// Example 6: Error Handling with Retry
// ============================================================================

export function ErrorHandlingExample() {
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg bg-destructive/10 p-4">
          <p className="text-destructive">{error}</p>
          <button
            onClick={() => {
              setError(null);
              setRetryCount(prev => prev + 1);
            }}
            className="mt-2 rounded bg-destructive px-4 py-2 text-white"
          >
            Retry ({retryCount})
          </button>
        </div>
      )}

      {!error && (
        <StreamingContent
          url="/api/chat/stream"
          body={{ message: "Hello" }}
          onError={(err) => {
            setError(err.message);
          }}
        />
      )}
    </div>
  );
}
