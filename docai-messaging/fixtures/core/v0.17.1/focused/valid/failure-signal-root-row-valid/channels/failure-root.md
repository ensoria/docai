> docai-messaging: 0.17.1 | profile: full | perspective: storefront | coverage: complete | knowledge: complete | source_refs: all

## SEND failures.root (publish-with-failure-root)

Publishes a message and records its stable rejection failure signal.

### Behavior

- side_effects: publishes a message
- idempotency: reuse the message identifier when resending
- preconditions: the producer is ready
- authorization: producer credentials permit publishing
- delivery: at-least-once -- retry ambiguous publishes with the same message identifier
- ordering: preserve order per message identifier

### Operation Bindings

none

### Channel

- Parameters: none
- Bindings: none

### Message publish-message

- Headers: none
- Bindings: none
#### Payload

none

### Reply

none

### Failure Handling

| Failure | Signal | Condition | Action |
|---|---|---|---|
| rejected | inline:failure-code | The broker rejects the published message | Record the stable failure code and do not retry the message |

**message_shape**: failure-code

- Headers: none
- Bindings: none
#### Payload

**payload_presence**: always
**media_type**: application/json
**payload_nullable**: no
```json
"rejected"
```
| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| $ | string | always | no | Stable failure code |

### Related

none

> docai-identity: set_id: b32:r6s2abwqhnffhouzsfivx7uv6u | projection_id: b32:2su6l5snggpayed76bebjwuzuy
