"""
Testing module for streaming AI responses.

Provides test utilities and examples for verifying SSE streaming
functionality with different AI models and scenarios.
"""
import asyncio
import json
from pathlib import Path
from typing import Any

from .streaming import (
    ConnectionFailedError,
    SSEFormatter,
    StreamCancelledError,
    StreamEventType,
    stream_agent_response,
)


async def test_streaming_with_mock_client():
    """
    Test streaming with a mock client for development.

    This simulates streaming without requiring actual AI API access.
    """
    print("Testing streaming with mock data...")

    async def mock_stream():
        """Generate mock stream events for testing."""
        # Simulate text chunks
        await asyncio.sleep(0.1)
        yield {"event": StreamEventType.TEXT, "data": {"text": "Hello"}}
        await asyncio.sleep(0.1)
        yield {"event": StreamEventType.TEXT, "data": {"text": ", there!"}}
        await asyncio.sleep(0.1)
        yield {"event": StreamEventType.TEXT, "data": {"text": " How can I help?"}}

        # Simulate tool use
        await asyncio.sleep(0.1)
        yield {
            "event": StreamEventType.TOOL_START,
            "data": {"name": "Read", "input": {"file_path": "test.txt"}}
        }
        await asyncio.sleep(0.2)
        yield {
            "event": StreamEventType.TOOL_END,
            "data": {"name": "Read", "success": True}
        }

        # Complete
        await asyncio.sleep(0.1)
        yield {
            "event": StreamEventType.DONE,
            "data": {
                "text": "Hello, there! How can I help?",
                "tools_used": ["Read"],
                "tool_count": 1
            }
        }

    # Process mock stream
    async for event in mock_stream():
        print(f"Event: {event.get('event')}: {event.get('data')}")


async def test_sse_formatter():
    """Test SSE message formatting."""
    print("Testing SSE formatting...")

    # Test text event
    text_event = SSEFormatter.format_event(
        StreamEventType.TEXT,
        {"text": "Hello, world!"}
    )
    print("Text event:")
    print(text_event)

    # Test tool start event
    tool_start_event = SSEFormatter.format_event(
        StreamEventType.TOOL_START,
        {"name": "Write", "input": {"file_path": "test.py"}}
    )
    print("Tool start event:")
    print(tool_start_event)

    # Test error event
    error_event = SSEFormatter.format_event(
        StreamEventType.ERROR,
        {"message": "Connection failed", "code": "CONNECTION_FAILED", "retryable": True}
    )
    print("Error event:")
    print(error_event)

    # Test keep-alive
    keep_alive = SSEFormatter.format_keep_alive()
    print("Keep-alive:")
    print(keep_alive)


async def test_cancellation():
    """Test stream cancellation."""
    print("Testing stream cancellation...")

    from asyncio import Event

    abort_signal = Event()

    # Set abort after a short delay
    async def cancel_after_delay():
        await asyncio.sleep(0.5)
        abort_signal.set()
        print("Abort signal set!")

    # Start cancellation in background
    asyncio.create_task(cancel_after_delay())

    try:
        # Try to stream (will be cancelled)
        async for event in stream_agent_response(
            message="Test message",
            project_dir=Path.cwd(),
            abort_signal=abort_signal
        ):
            print(f"Event: {event}")
    except StreamCancelledError as e:
        print(f"Successfully caught cancellation: {e.code}")
        return True

    return False


async def benchmark_streaming(
    num_iterations: int = 10,
    message_length: int = 1000
) -> dict[str, float]:
    """
    Benchmark streaming performance.

    Measures:
    - Time to first chunk (TTFB)
    - Total streaming time
    - Chunks per second

    Args:
        num_iterations: Number of test runs
        message_length: Length of synthetic message

    Returns:
        Dict with performance metrics
    """
    print(f"Running streaming benchmark ({num_iterations} iterations)...")

    import time

    results = {
        "ttfb_sum": 0.0,
        "total_time_sum": 0.0,
        "chunks_sum": 0,
    }

    for _ in range(num_iterations):
        start_time = time.time()
        first_chunk_time = None
        chunk_count = 0

        async def mock_fast_stream():
            nonlocal first_chunk_time
            for i in range(10):  # 10 chunks
                await asyncio.sleep(0.01)  # 10ms per chunk
                chunk_count += 1
                if first_chunk_time is None:
                    first_chunk_time = time.time()
                yield {
                    "event": StreamEventType.TEXT,
                    "data": {"text": "x" * (message_length // 10)}
                }

        async for _ in mock_fast_stream():
            pass  # Consume stream

        total_time = time.time() - start_time
        ttfb = (first_chunk_time - start_time) * 1000 if first_chunk_time else 0

        results["ttfb_sum"] += ttfb
        results["total_time_sum"] += total_time
        results["chunks_sum"] += chunk_count

    return {
        "avg_ttfb_ms": results["ttfb_sum"] / num_iterations,
        "avg_total_time_ms": (results["total_time_sum"] / num_iterations) * 1000,
        "avg_chunks_per_sec": num_iterations / (results["total_time_sum"] / num_iterations),
        "total_chunks": results["chunks_sum"],
    }


# ============================================================================
# Example usage functions
# ============================================================================

async def example_simple_stream():
    """Example: Simple streaming usage."""
    print("\n=== Simple Streaming Example ===\n")

    try:
        async for event in stream_agent_response(
            message="What is React?",
            project_dir=Path.cwd(),
            agent_type="coder",
            model="claude-haiku-4-5-20251001"
        ):
            if event.get("event") == StreamEventType.TEXT:
                print(event.get("data", {}).get("text", ""), end="", flush=True)
            elif event.get("event") == StreamEventType.DONE:
                print("\n[Stream complete]")
                break
    except ConnectionFailedError as e:
        print(f"\n[Error: {e.message}]")
        if e.retryable:
            print("This error is retryable.")


async def example_with_cancellation():
    """Example: Streaming with user cancellation."""
    print("\n=== Streaming with Cancellation Example ===\n")

    from asyncio import Event

    abort_signal = Event()

    # Simulate user cancellation after 2 seconds
    async def cancel_delay():
        await asyncio.sleep(2)
        abort_signal.set()
        print("\n[User cancelled stream]")

    asyncio.create_task(cancel_delay())

    try:
        async for event in stream_agent_response(
            message="Long running task...",
            project_dir=Path.cwd(),
            abort_signal=abort_signal
        ):
            event_type = event.get("event")
            if event_type == StreamEventType.TEXT:
                print(event.get("data", {}).get("text", ""), end="", flush=True)
            elif event_type == StreamEventType.ERROR:
                print(f"\n[Error: {event.get('data')}]")
                break
    except StreamCancelledError:
        print("\n[Stream was successfully cancelled]")


async def example_with_reconnection():
    """Example: Streaming with automatic reconnection."""
    print("\n=== Streaming with Reconnection Example ===\n")

    max_attempts = 3
    attempt = 0

    while attempt < max_attempts:
        attempt += 1
        print(f"Attempt {attempt}/{max_attempts}...")

        try:
            async for event in stream_agent_response(
                message="Test message",
                project_dir=Path.cwd()
            ):
                if event.get("event") == StreamEventType.TEXT:
                    print(event.get("data", {}).get("text", ""), end="", flush=True)
                elif event.get("event") == StreamEventType.DONE:
                    print("\n[Stream complete]")
                    return  # Success, exit retry loop

        except ConnectionFailedError as e:
            print(f"Connection failed: {e.message}")
            if not e.retryable:
                print("Error is not retryable.")
                break

            if attempt >= max_attempts:
                print("Max retry attempts reached.")
                break

            # Exponential backoff
            delay = 2 ** (attempt - 1)
            print(f"Retrying in {delay} seconds...")
            await asyncio.sleep(delay)


if __name__ == "__main__":
    import sys

    command = sys.argv[1] if len(sys.argv) > 1 else "help"

    if command == "test":
        asyncio.run(test_streaming_with_mock_client())
    elif command == "sse":
        asyncio.run(test_sse_formatter())
    elif command == "cancel":
        asyncio.run(test_cancellation())
    elif command == "benchmark":
        results = asyncio.run(benchmark_streaming())
        print("\n=== Benchmark Results ===")
        print(json.dumps(results, indent=2))
    elif command == "example":
        asyncio.run(example_simple_stream())
    elif command == "cancel-example":
        asyncio.run(example_with_cancellation())
    elif command == "reconnect-example":
        asyncio.run(example_with_reconnection())
    else:
        print("""
Streaming Test Commands
======================

Usage: python -m core.streaming_test <command>

Commands:
  test           - Test with mock streaming data
  sse            - Test SSE formatting
  cancel          - Test stream cancellation
  benchmark       - Run performance benchmarks
  example         - Run simple streaming example
  cancel-example  - Example with user cancellation
  reconnect-example - Example with automatic reconnection

Examples:
  python -m core.streaming_test test
  python -m core.streaming_test benchmark
        """)
