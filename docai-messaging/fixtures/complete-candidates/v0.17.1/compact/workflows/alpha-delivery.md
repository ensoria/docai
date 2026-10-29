> docai-messaging: 0.17.1 | profile: compact | perspective: storefront-service | coverage: complete | knowledge: complete | source_refs: complete-contexts

# Alpha delivery across operation boundaries

Deliver the alpha event and record the correlated middle event.

## Preconditions

- Caller-local alpha event data is validated

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

> docai-identity: set_id: b32:54exbpg7qfzv2icycgrmwdmxnq | projection_id: b32:vjb6ukulldji3iam5c3fgnte3e
