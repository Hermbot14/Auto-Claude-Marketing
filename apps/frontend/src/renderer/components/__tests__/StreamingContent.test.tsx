/**
 * Tests for StreamingContent component
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { StreamingContent } from '../StreamingContent';

// Mock the useStreamingResponse hook
jest.mock('../hooks/useStreamingResponse', () => ({
  useStreamingResponse: () => ({
    state: {
      content: '',
      isStreaming: false,
      isComplete: false,
      error: null,
      tools_used: [],
      currentTool: null,
      toolResults: [],
    },
    startStreaming: jest.fn(),
    cancelStreaming: jest.fn(),
    retryStreaming: jest.fn(),
    reset: jest.fn(),
  }),
}));

const mockUseStreamingResponse = jest.requireMock('../hooks/useStreamingResponse');

describe('StreamingContent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render with placeholder when not streaming', () => {
      render(
        <StreamingContent
          url="/api/test"
          placeholder="Ask me anything..."
        />
      );

      expect(screen.getByText('Ask me anything...')).toBeInTheDocument();
    });

    it('should show loading indicator when streaming', async () => {
      render(
        <StreamingContent url="/api/test" />
      );

      // Simulate streaming state
      mockUseStreamingResponse.useStreamingResponse.mockReturnValue({
        state: {
          content: '',
          isStreaming: true,
          isComplete: false,
          error: null,
          tools_used: [],
          currentTool: null,
          toolResults: [],
        },
        startStreaming: jest.fn(),
        cancelStreaming: jest.fn(),
        retryStreaming: jest.fn(),
        reset: jest.fn(),
      });

      const { rerender } = render(
        <StreamingContent url="/api/test" />
      );

      // Update mock state and rerender
      mockUseStreamingResponse.useStreamingResponse.mockReturnValue({
        state: {
          content: '',
          isStreaming: true,
          isComplete: false,
          error: null,
          tools_used: [],
          currentTool: null,
          toolResults: [],
        },
        startStreaming: jest.fn(),
        cancelStreaming: jest.fn(),
        retryStreaming: jest.fn(),
        reset: jest.fn(),
      });

      rerender(<StreamingContent url="/api/test" />);

      expect(screen.getByText(/connecting/i)).toBeInTheDocument();
    });

    it('should render markdown content', () => {
      const markdown = `# Heading
Some text
\`\`\`javascript
console.log('code');
\`\`\`
`;

      mockUseStreamingResponse.useStreamingResponse.mockReturnValue({
        state: {
          content: markdown,
          isStreaming: false,
          isComplete: true,
          error: null,
          tools_used: [],
          currentTool: null,
          toolResults: [],
        },
        startStreaming: jest.fn(),
        cancelStreaming: jest.fn(),
        retryStreaming: jest.fn(),
        reset: jest.fn(),
      });

      render(<StreamingContent url="/api/test" />);

      expect(screen.getByText('Heading')).toBeInTheDocument();
      expect(screen.getByText('Some text')).toBeInTheDocument();
      expect(screen.getByText(/console\.log/)).toBeInTheDocument();
    });
  });

  describe('cancel button', () => {
    it('should show cancel button when streaming', () => {
      mockUseStreamingResponse.useStreamingResponse.mockReturnValue({
        state: {
          content: '',
          isStreaming: true,
          isComplete: false,
          error: null,
          tools_used: [],
          currentTool: null,
          toolResults: [],
        },
        startStreaming: jest.fn(),
        cancelStreaming: jest.fn(),
        retryStreaming: jest.fn(),
        reset: jest.fn(),
      });

      render(<StreamingContent url="/api/test" showCancel />);

      const cancelButton = screen.getByLabelText(/cancel/i);
      expect(cancelButton).toBeInTheDocument();
    });

    it('should not show cancel button when showCancel is false', () => {
      mockUseStreamingResponse.useStreamingResponse.mockReturnValue({
        state: {
          content: '',
          isStreaming: true,
          isComplete: false,
          error: null,
          tools_used: [],
          currentTool: null,
          toolResults: [],
        },
        startStreaming: jest.fn(),
        cancelStreaming: jest.fn(),
        retryStreaming: jest.fn(),
        reset: jest.fn(),
      });

      render(<StreamingContent url="/api/test" showCancel={false} />);

      expect(screen.queryByLabelText(/cancel/i)).not.toBeInTheDocument();
    });

    it('should call cancelStreaming when cancel button clicked', async () => {
      const cancelMock = jest.fn();
      const onCancelMock = jest.fn();

      mockUseStreamingResponse.useStreamingResponse.mockReturnValue({
        state: {
          content: '',
          isStreaming: true,
          isComplete: false,
          error: null,
          tools_used: [],
          currentTool: null,
          toolResults: [],
        },
        startStreaming: jest.fn(),
        cancelStreaming: cancelMock,
        retryStreaming: jest.fn(),
        reset: jest.fn(),
      });

      render(
        <StreamingContent
          url="/api/test"
          showCancel
          onCancel={onCancelMock}
        />
      );

      const cancelButton = screen.getByLabelText(/cancel/i);
      fireEvent.click(cancelButton);

      expect(cancelMock).toHaveBeenCalled();
      expect(onCancelMock).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should render error message', () => {
      const errorMessage = 'Connection failed';

      mockUseStreamingResponse.useStreamingResponse.mockReturnValue({
        state: {
          content: '',
          isStreaming: false,
          isComplete: true,
          error: errorMessage,
          tools_used: [],
          currentTool: null,
          toolResults: [],
        },
        startStreaming: jest.fn(),
        cancelStreaming: jest.fn(),
        retryStreaming: jest.fn(),
        reset: jest.fn(),
      });

      render(<StreamingContent url="/api/test" />);

      expect(screen.getByText(/streaming error/i)).toBeInTheDocument();
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });

    it('should call onError callback when error occurs', () => {
      const onErrorMock = jest.fn();
      const error = { message: 'Network error', code: 'STREAM_ERROR' };

      mockUseStreamingResponse.useStreamingResponse.mockReturnValue({
        state: {
          content: '',
          isStreaming: false,
          isComplete: true,
          error: 'Network error',
          tools_used: [],
          currentTool: null,
          toolResults: [],
        },
        startStreaming: jest.fn(),
        cancelStreaming: jest.fn(),
        retryStreaming: jest.fn(),
        reset: jest.fn(),
      });

      render(
        <StreamingContent
          url="/api/test"
          onError={onErrorMock}
        />
      );

      expect(onErrorMock).toHaveBeenCalledWith(error);
    });
  });

  describe('tool indicators', () => {
    it('should display tools used', () => {
      mockUseStreamingResponse.useStreamingResponse.mockReturnValue({
        state: {
          content: 'Response text',
          isStreaming: false,
          isComplete: true,
          error: null,
          tools_used: [
            { name: 'Read', input: { file_path: 'test.txt' } },
            { name: 'Write', input: { file_path: 'out.txt' } },
          ],
          currentTool: null,
          toolResults: [
            { name: 'Read', success: true },
            { name: 'Write', success: true },
          ],
        },
        startStreaming: jest.fn(),
        cancelStreaming: jest.fn(),
        retryStreaming: jest.fn(),
        reset: jest.fn(),
      });

      render(<StreamingContent url="/api/test" />);

      expect(screen.getByText(/tools used/i)).toBeInTheDocument();
      expect(screen.getByText('Read')).toBeInTheDocument();
      expect(screen.getByText('Write')).toBeInTheDocument();
    });

    it('should show running indicator for active tool', () => {
      mockUseStreamingResponse.useStreamingResponse.mockReturnValue({
        state: {
          content: 'Response text',
          isStreaming: true,
          isComplete: false,
          error: null,
          tools_used: [{ name: 'Read', input: {} }],
          currentTool: 'Read',
          toolResults: [],
        },
        startStreaming: jest.fn(),
        cancelStreaming: jest.fn(),
        retryStreaming: jest.fn(),
        reset: jest.fn(),
      });

      render(<StreamingContent url="/api/test" />);

      expect(screen.getByText(/running/i)).toBeInTheDocument();
    });
  });

  describe('latency metrics', () => {
    it('should show latency reduction when streaming', () => {
      mockUseStreamingResponse.useStreamingResponse.mockReturnValue({
        state: {
          content: 'Partial content',
          isStreaming: true,
          isComplete: false,
          error: null,
          tools_used: [],
          currentTool: null,
          toolResults: [],
        },
        startStreaming: jest.fn(),
        cancelStreaming: jest.fn(),
        retryStreaming: jest.fn(),
        reset: jest.fn(),
      });

      // Mock latency calculation
      jest.spyOn(jest.requireMock('../hooks/useStreamingResponse'), 'calculateLatencyReduction')
        .mockReturnValue(60);

      render(<StreamingContent url="/api/test" showMetrics />);

      expect(screen.getByText(/60%/)).toBeInTheDocument();
    });

    it('should not show metrics when showMetrics is false', () => {
      mockUseStreamingResponse.useStreamingResponse.mockReturnValue({
        state: {
          content: 'Partial content',
          isStreaming: true,
          isComplete: false,
          error: null,
          tools_used: [],
          currentTool: null,
          toolResults: [],
        },
        startStreaming: jest.fn(),
        cancelStreaming: jest.fn(),
        retryStreaming: jest.fn(),
        reset: jest.fn(),
      });

      render(<StreamingContent url="/api/test" showMetrics={false} />);

      expect(screen.queryByText(/latency reduced/i)).not.toBeInTheDocument();
    });
  });

  describe('callbacks', () => {
    it('should call onComplete when stream completes', () => {
      const onCompleteMock = jest.fn();

      mockUseStreamingResponse.useStreamingResponse.mockReturnValue({
        state: {
          content: 'Final response',
          isStreaming: false,
          isComplete: true,
          error: null,
          tools_used: [{ name: 'Read', input: {} }],
          currentTool: null,
          toolResults: [{ name: 'Read', success: true }],
        },
        startStreaming: jest.fn(),
        cancelStreaming: jest.fn(),
        retryStreaming: jest.fn(),
        reset: jest.fn(),
      });

      render(
        <StreamingContent
          url="/api/test"
          onComplete={onCompleteMock}
        />
      );

      expect(onCompleteMock).toHaveBeenCalledWith({
        text: 'Final response',
        tools: ['Read'],
      });
    });
  });

  describe('styling', () => {
    it('should apply custom className', () => {
      mockUseStreamingResponse.useStreamingResponse.mockReturnValue({
        state: {
          content: 'Content',
          isStreaming: false,
          isComplete: true,
          error: null,
          tools_used: [],
          currentTool: null,
          toolResults: [],
        },
        startStreaming: jest.fn(),
        cancelStreaming: jest.fn(),
        retryStreaming: jest.fn(),
        reset: jest.fn(),
      });

      const { container } = render(
        <StreamingContent
          url="/api/test"
          className="custom-class"
        />
      );

      expect(container.firstChild).toHaveClass('custom-class');
    });

    it('should accept custom headers', () => {
      const startMock = jest.fn();

      mockUseStreamingResponse.useStreamingResponse.mockReturnValue({
        state: {
          content: 'Content',
          isStreaming: false,
          isComplete: true,
          error: null,
          tools_used: [],
          currentTool: null,
          toolResults: [],
        },
        startStreaming: startMock,
        cancelStreaming: jest.fn(),
        retryStreaming: jest.fn(),
        reset: jest.fn(),
      });

      const customHeaders = { 'X-Custom': 'value' };

      render(
        <StreamingContent
          url="/api/test"
          headers={customHeaders}
        />
      );

      expect(startMock).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: customHeaders,
        })
      );
    });
  });
});
