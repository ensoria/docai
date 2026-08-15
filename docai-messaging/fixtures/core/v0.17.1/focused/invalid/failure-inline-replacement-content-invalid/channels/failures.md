> docai-messaging: 0.17.1 | profile: full | perspective: storefront | coverage: requires-source | knowledge: complete | source_refs: all

## SEND failures.replacement (inline-replacement-content)

Publishes with prohibited normal content after a replacement failure shape.

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

### Message inline-replacement-content-message

- Headers: none
- Bindings: none
#### Payload

none

### Reply

none

### Failure Handling

| Failure | Signal | Condition | Action |
|---|---|---|---|
| encoded | inline:encoded-signal | The broker returns an encoded error | Escalate the message and preserve its unresolved state without retrying it |

**message_shape**: encoded-signal

**unsupported**: replaces failure shape encoded-signal: encoded broker failure at source-a#/failures/encoded-signal

#### Payload

none

### Related

none

> docai-identity: set_id: b32:r6s2abwqhnffhouzsfivx7uv6u | projection_id: b32:2su6l5snggpayed76bebjwuzuy
