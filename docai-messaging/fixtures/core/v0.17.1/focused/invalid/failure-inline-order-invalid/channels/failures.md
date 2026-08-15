> docai-messaging: 0.17.1 | profile: full | perspective: storefront | coverage: complete | knowledge: complete | source_refs: all

## SEND failures.order (inline-order)

Publishes with inline failure shapes outside their first-use order.

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

### Message inline-order-message

- Headers: none
- Bindings: none
#### Payload

none

### Reply

none

### Failure Handling

| Failure | Signal | Condition | Action |
|---|---|---|---|
| alpha | inline:alpha-shape | The first failure occurs | Preserve the unresolved state and escalate without retrying the message |
| zeta | inline:zeta-shape | The second failure occurs | Preserve the unresolved state and escalate without retrying the message |

**message_shape**: zeta-shape

- Headers: none
- Bindings: none
#### Payload

none

**message_shape**: alpha-shape

- Headers: none
- Bindings: none
#### Payload

none

### Related

none

> docai-identity: set_id: b32:r6s2abwqhnffhouzsfivx7uv6u | projection_id: b32:2su6l5snggpayed76bebjwuzuy
