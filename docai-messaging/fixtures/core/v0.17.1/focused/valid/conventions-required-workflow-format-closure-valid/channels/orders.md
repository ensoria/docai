> docai-messaging: 0.17.1 | profile: full | perspective: storefront | coverage: complete | knowledge: complete | source_refs: all

## SEND orders.commands (create-order)

Documents the selected messaging operation.

### Behavior

- side_effects: dispatches the order command
- idempotency: reuse the order identifier when resending
- preconditions: the order is ready to submit
- authorization: producer credentials permit order publishing
- delivery: at-least-once -- retry ambiguous publishes with the same order identifier
- ordering: preserve order per order identifier

### Operation Bindings

none

### Channel

- Parameters: none
- Bindings: none

### Message create-order

#### Headers

none

#### Bindings

none

#### Payload

none

### Reply

none

### Failure Handling

none

### Related

- workflows/formatted.md provides required operation context.

> docai-identity: set_id: b32:r6s2abwqhnffhouzsfivx7uv6u | projection_id: b32:2su6l5snggpayed76bebjwuzuy
