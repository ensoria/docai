> docai-messaging: 0.17.1 | profile: full | perspective: storefront | coverage: complete | knowledge: complete | source_refs: all

## SEND bindings.commands (publish-order)

Publishes an order with malformed failure-signal binding columns.

### Behavior

- side_effects: none
- idempotency: none
- preconditions: none
- authorization: none
- delivery: none
- ordering: none

### Operation Bindings

none

### Channel

- Parameters: none
- Bindings: none

### Message publish-order

- Headers: none
- Bindings: none
#### Payload

none

### Reply

none

### Failure Handling

| Failure | Signal | Condition | Action |
|---|---|---|---|
| publish error | inline:publish-error | The broker rejects the publish | Preserve the failed state, report the error, and stop processing |

**message_shape**: publish-error

- Headers: none
#### Bindings

| Protocol | Name | Value / Rule |
|---|---|---|
| kafka | key | UTF-8 bytes of the failed order identifier |

#### Payload

none

### Related

none

> docai-identity: set_id: b32:r6s2abwqhnffhouzsfivx7uv6u | projection_id: b32:2su6l5snggpayed76bebjwuzuy
