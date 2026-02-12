/**
 * Tests for useStreamingResponse hook
 */

import { renderHook, waitFor, act } from '@testing-library/react';
import { useStreamingResponse } from '../useStreamingResponse';

// Mock fetch for testing
const mockFetch = jest.fn();

global.fetch = mockFetch as any;

describe('useStreamingResponse', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('initial state', () => {
    it('should have correct initial state', () => {
      const { result } = renderHook(() => useStreamingResponse());

      expect(result.current.state).toEqual({
        content: '',
        isStreaming: false,
        isComplete: false,
        error: null,
        tools_used: [],
        currentTool: null,
        toolResults: [],
      });
    });
  });

  describe('startStreaming', () => {
    it('should start streaming with loading state', async () => {
      const streamData = [
        'event: text\ndata: {"text":"Hello "}\n\n',
        'event: text\ndata: {"text":"World!"}\n\n',
        'event: done\ndata: {"text":"Hello World!","tools_used":[],"tool_count":0}\n\n',
      ].join('');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: {
          getReader: () => ({
            read: async () => {
              await jest.advanceTimersByTime(10);
              const encoder = new TextEncoder();
              return { done: false, value: encoder.encode(streamData) };
            },
          }),
        },
      } as any);

      const { result } = renderHook(() => useStreamingResponse());

      await act(async () => {
        await result.current.startStreaming({
          url: '/api/test',
        });
      });

      expect(result.current.state.isStreaming).toBe(true);
      expect(result.current.state.content).toBe('');
    });

    it('should accumulate text content', async () => {
      const chunks = ['Hello ', 'there!'];
      let chunkIndex = 0;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: {
          getReader: () => ({
            read: async () => {
              await jest.advanceTimersByTime(10);
              if (chunkIndex >= chunks.length) {
                return { done: true, value: new Uint8Array() };
              }
              const encoder = new TextEncoder();
              return {
                done: false,
                value: encoder.encode(`event: text\ndata: {"text":"${chunks[chunkIndex]}"}\n\n`),
              };
            },
          }),
        },
      } as any);

      const { result } = renderHook(() => useStreamingResponse());

      await act(async () => {
        await result.current.startStreaming({ url: '/api/test' });
        await waitFor(() => result.current.state.content === 'Hello there!');
      });

      expect(result.current.state.content).toBe('Hello there!');
    });

    it('should handle streaming errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const onError = jest.fn();
      const { result } = renderHook(() => useStreamingResponse());

      await act(async () => {
        await result.current.startStreaming({
          url: '/api/test',
          onError,
        });
        await waitFor(() => result.current.state.error !== null);
      });

      expect(result.current.state.error).toBe('Network error');
      expect(onError).toHaveBeenCalledWith({
        message: 'Network error',
        code: 'STREAM_ERROR',
        retryable: false,
      });
    });
  });

  describe('cancelStreaming', () => {
    it('should cancel ongoing stream', async () => {
      const abortSpy = jest.spyOn(AbortController.prototype, 'abort');

      const { result } = renderHook(() => useStreamingResponse());

      // Start streaming
      await act(async () => {
        await result.current.startStreaming({ url: '/api/test' });
      });

      // Cancel streaming
      act(() => {
        result.current.cancelStreaming();
      });

      expect(result.current.state.isStreaming).toBe(false);
      expect(result.current.state.isComplete).toBe(true);
      expect(result.current.state.error).toBe('Stream cancelled by user');

      abortSpy.mockRestore();
    });
  });

  describe('reset', () => {
    it('should reset state to initial values', async () => {
      const { result } = renderHook(() => useStreamingResponse());

      // Modify state
      await act(async () => {
        await result.current.startStreaming({ url: '/api/test' });
      });

      // Reset
      act(() => {
        result.current.reset();
      });

      expect(result.current.state).toEqual({
        content: '',
        isStreaming: false,
        isComplete: false,
        error: null,
        tools_used: [],
        currentTool: null,
        toolResults: [],
      });
    });
  });

  describe('retryable errors', () => {
    it('should retry on timeout errors', async () => {
      let callCount = 0;

      mockFetch.mockImplementation(() => {
        callCount++;
        if (callCount < 3) {
          return Promise.reject(new Error('Request timeout'));
        }
        return Promise.resolve({
          ok: true,
          body: {
            getReader: () => ({
              read: async () => ({ done: true, value: new Uint8Array() }),
            }),
          },
        } as any);
      });

      const { result } = renderHook(() => useStreamingResponse());

      await act(async () => {
        await result.current.startStreaming({
          url: '/api/test',
          reconnectMaxAttempts: 3,
        });
        // Wait for retries
        await jest.runAllTimersAsync();
      });

      // Should have retried
      expect(callCount).toBeGreaterThan(1);
    });

    it('should not retry on non-retryable errors', async () => {
      let callCount = 0;

      mockFetch.mockImplementation(() => {
        callCount++;
        return Promise.reject(new Error('Authentication failed'));
      });

      const onError = jest.fn();
      const { result } = renderHook(() => useStreamingResponse());

      await act(async () => {
        await result.current.startStreaming({
          url: '/api/test',
          onError,
          reconnectMaxAttempts: 3,
        });
        await jest.runAllTimersAsync();
      });

      // Should not retry for auth errors
      expect(callCount).toBe(1);
      expect(onError).toHaveBeenCalled();
    });
  });

  describe('callback handlers', () => {
    it('should call onProgress with content', async () => {
      const onProgress = jest.fn();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: {
          getReader: () => ({
            read: async () => {
              await jest.advanceTimersByTime(10);
              const encoder = new TextEncoder();
              return {
                done: false,
                value: encoder.encode('event: text\ndata: {"text":"Test"}\n\n'),
              };
            },
          }),
        },
      } as any);

      const { result } = renderHook(() => useStreamingResponse());

      await act(async () => {
        await result.current.startStreaming({
          url: '/api/test',
          onProgress,
        });
        await waitFor(() => onProgress.mock.calls.length > 0);
      });

      expect(onProgress).toHaveBeenCalledWith('Test');
    });

    it('should call onComplete with final result', async () => {
      const onComplete = jest.fn();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: {
          getReader: () => ({
            read: async () => {
              await jest.advanceTimersByTime(10);
              const encoder = new TextEncoder();
              return {
                done: true,
                value: encoder.encode(
                  'event: done\ndata: {"text":"Final","tools_used":["Read"],"tool_count":1}\n\n'
                ),
              };
            },
          }),
        },
      } as any);

      const { result } = renderHook(() => useStreamingResponse());

      await act(async () => {
        await result.current.startStreaming({
          url: '/api/test',
          onComplete,
        });
        await waitFor(() => result.current.state.isComplete);
      });

      expect(onComplete).toHaveBeenCalledWith({
        text: 'Final',
        tools: ['Read'],
      });
    });
  });
});

describe('parseSSEMessage', () => {
  it('should parse event lines', () => {
    // Import the internal function for testing
    const { parseSSEMessage } = require('../useStreamingResponse');

    const result = parseSSEMessage('event: text');
    expect(result).toEqual({ event: 'text', data: null });
  });

  it('should parse data lines', () => {
    const { parseSSEMessage } = require('../useStreamingResponse');
    const result = parseSSEMessage('data: {"text":"Hello"}');
    expect(result).toEqual({ event: '', data: { text: 'Hello' } });
  });

  it('should ignore comment lines', () => {
    const { parseSSEMessage } = require('../useStreamingResponse');
    const result = parseSSEMessage(':keep-alive');
    expect(result).toBeNull();
  });
});

describe('isRetryableError', () => {
  it('should identify timeout as retryable', () => {
    const { isRetryableError } = require('../useStreamingResponse');
    expect(isRetryableError('Request timeout')).toBe(true);
  });

  it('should identify connection errors as retryable', () => {
    const { isRetryableError } = require('../useStreamingResponse');
    expect(isRetryableError('Connection failed')).toBe(true);
  });

  it('should identify rate limits as retryable', () => {
    const { isRetryableError } = require('../useStreamingResponse');
    expect(isRetryableError('Rate limit exceeded')).toBe(true);
  });

  it('should not retry authentication errors', () => {
    const { isRetryableError } = require('../useStreamingResponse');
    expect(isRetryableError('Authentication failed')).toBe(false);
  });

  it('should not retry validation errors', () => {
    const { isRetryableError } = require('../useStreamingResponse');
    expect(isRetryableError('Invalid input')).toBe(false);
  });
});

describe('calculateLatencyReduction', () => {
  it('should calculate 60% reduction correctly', () => {
    const { calculateLatencyReduction } = require('../useStreamingResponse');
    const reduction = calculateLatencyReduction(5000, 2000);
    expect(reduction).toBeCloseTo(60, 0);
  });

  it('should handle edge cases', () => {
    const { calculateLatencyReduction } = require('../useStreamingResponse');
    expect(calculateLatencyReduction(0, 100)).toBe(0);
    expect(calculateLatencyReduction(100, 0)).toBe(0);
    expect(calculateLatencyReduction(100, 200)).toBe(0); // First chunk after baseline
  });
});
