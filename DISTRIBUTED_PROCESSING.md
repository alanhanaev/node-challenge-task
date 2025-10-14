# Distributed Token Price Processing

This document explains how the token price update service works with multiple instances.

## Architecture

The service uses PostgreSQL distributed locking to coordinate multiple instances processing tokens in parallel.

### Key Components:

1. **token_processing_state table** - Stores processing state
2. **Distributed locking** - PostgreSQL `FOR UPDATE` locks
3. **Heartbeat mechanism** - Detects dead instances
4. **Cleanup task** - Recovers from failures

## How It Works

### 1. Processing Flow

```
┌─────────────┐
│ Instance 1  │──► Get lock ──► Reserve batch [1-100]  ──► Release lock
└─────────────┘                                                  │
                                                                 ▼
┌─────────────┐                                          Process tokens
│ Instance 2  │──► Wait for lock ──► Reserve batch [101-200] ──► Done
└─────────────┘         ▲                                        │
                        │                                        ▼
                   Get lock                              Confirm processing
                        │                                        │
┌─────────────┐         │                                        ▼
│ Instance 3  │─────────┘          Reserve batch [201-300]     Loop
└─────────────┘                            │                    until
                                           ▼                    no more
                                    Process tokens              tokens
```
