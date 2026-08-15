> docai-messaging: 0.17.1 | profile: full | perspective: storefront | coverage: complete | knowledge: requires-input | source_refs: all

## SEND orders.commands (send-order)

Sends an order command while exposing one invalid payload unknown boundary.

### Behavior

- side_effects: dispatches the order command
- idempotency: reuse the order identifier when resending
- preconditions: the order is ready to dispatch
- authorization: producer credentials permit command publishing
- delivery: at-least-once -- retry ambiguous publishes with the same order identifier
- ordering: preserve order per order identifier

### Operation Bindings

none

### Channel

- Parameters: none
- Bindings: none

### Message order-command

- Headers: none
- Bindings: none
#### Payload

**payload_required**: yes
**media_type**: application/json
**payload_nullable**: no
unknown
**unknown**: payload field collection requires the complete order schema at source-a
| Field | Type | Required | Nullable | Constraints / Meaning |
|---|---|---|---|---|
| id | string | yes | no | Stable order identifier |

### Reply

none

### Failure Handling

none

### Related

none

> docai-identity: set_id: b32:r6s2abwqhnffhouzsfivx7uv6u | projection_id: b32:2su6l5snggpayed76bebjwuzuy
