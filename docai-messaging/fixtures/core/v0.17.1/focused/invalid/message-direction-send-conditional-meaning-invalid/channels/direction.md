> docai-messaging: 0.17.1 | profile: full | perspective: storefront | coverage: complete | knowledge: complete | source_refs: all

## SEND orders.commands (send-order)

Constructs an order command without the required condition text.

### Behavior

- side_effects: records the messaging action
- idempotency: reuse the order identifier when retrying
- preconditions: the messaging client is running
- authorization: client credentials permit the operation
- delivery: at-least-once -- acknowledge after durable processing
- ordering: preserve order per order identifier

### Operation Bindings

none

### Channel

- Parameters: none
- Bindings: none

### Message order-command

#### Headers

| Name | Type | Required | Nullable | Constraints / Meaning |
|---|---|---|---|---|
| x-tenant | string | conditional | no | none |

#### Bindings

none

#### Payload

none

### Reply

none

### Failure Handling

none

### Related

none

> docai-identity: set_id: b32:r6s2abwqhnffhouzsfivx7uv6u | projection_id: b32:2su6l5snggpayed76bebjwuzuy
