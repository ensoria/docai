> docai-messaging: 0.17.1 | profile: compact | perspective: storefront | coverage: complete | knowledge: complete | source_refs: all

# Alpha delivery across operation boundaries

Deliver the alpha event and record the correlated middle event.

## Preconditions

- Alpha event data is validated

## Steps

1. SEND a.events (a-operation) -- retain the alpha event identifier
2. SEND m.events (m-operation) -- record the correlated middle event

## State Transitions

| From | Trigger | To |
|---|---|---|
| alpha.ready | SEND a.events (a-operation) | alpha.sent |
| alpha.sent | SEND m.events (m-operation) | middle.recorded |

## Failure and Recovery

- On timeout, retry with the retained alpha event identifier

> docai-identity: set_id: b32:26yz6sr2e5uoszbbex4vkm663a | projection_id: b32:edqbodvg6sp75kl3lpsrh37bfy
