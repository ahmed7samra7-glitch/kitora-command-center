# KCC Scale-to-Zero Execution Migration

This document tracks the guarded migration from boot-time background loops to externally triggered execution.

## Runtime flags
- `ENABLE_CONTINUOUS_LOOP=false` disables background mission/runtime timers.
- `MISSION_TICK_MAX_TASKS=5` bounds work per mission tick.
- `AGENT_QUEUE_BATCH_SIZE=3` bounds queue work per batch.
- `AGENT_TASK_TIMEOUT_MS=30000` bounds individual agent task execution time.

## Safety
Production should use externally triggered `/api/kcc/loop/tick` and `/api/kcc/agent/process-queue` calls. Existing `startLoop()` and `start()` remain available for development/legacy operation until migration verification is complete.
