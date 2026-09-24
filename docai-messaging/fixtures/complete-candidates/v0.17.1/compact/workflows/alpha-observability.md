> docai-messaging: 0.17.1 | profile: compact | perspective: storefront | coverage: complete | knowledge: complete | source_refs: all

# Alpha observability guidance

Record synthetic trace evidence for alpha delivery.

## Preconditions

- Synthetic trace collection is enabled

## Steps

1. SEND a.events (a-operation) -- record the synthetic trace identifier

## State Transitions

| From | Trigger | To |
|---|---|---|
| trace.pending | SEND a.events (a-operation) | trace.recorded |

## Failure and Recovery

- On timeout, repeat trace collection with the same synthetic identifier

> docai-identity: set_id: b32:oyezxfn27tfa26o4afxnmsp4by | projection_id: b32:6g66y7tydepom5w7jw22drqql4
