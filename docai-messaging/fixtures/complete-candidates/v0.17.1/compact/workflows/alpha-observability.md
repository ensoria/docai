> docai-messaging: 0.17.1 | profile: compact | perspective: storefront-service | coverage: complete | knowledge: complete | source_refs: all

# Alpha observability guidance

Record synthetic trace evidence for alpha delivery.

## Preconditions

- Caller-local synthetic trace collection is enabled

## Steps

1. SEND a.events (a-operation) -- record the synthetic trace identifier

## State Transitions

| From | Trigger | To |
|---|---|---|
| trace.pending | SEND a.events (a-operation) | trace.recorded |

## Failure and Recovery

- On timeout, repeat trace collection with the same synthetic identifier

> docai-identity: set_id: b32:adbabw3k2mxgyspfoxykybb27i | projection_id: b32:gw6dvhi3pw2jw6wf7jgv3ky54q
