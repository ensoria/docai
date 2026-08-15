> docai-messaging: 0.17.1 | profile: full | perspective: storefront | coverage: complete | knowledge: requires-input | source_refs: all

## SEND orders.commands (send-order)

Constructs an order command with an unmarked unknown header.

### Behavior

- side_effects: unknown
- idempotency: reuse the order identifier when retrying
- preconditions: the messaging client is running
- authorization: client credentials permit the operation
- delivery: at-least-once -- acknowledge after durable processing
- ordering: preserve order per order identifier
**unknown**: side_effects requires the authoritative order handler at source-a

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
```json
{"id":"ord_01HXYZ"}
```
| Field | Type | Required | Nullable | Constraints / Meaning |
|---|---|---|---|---|
| id | string | yes | no | Stable order identifier |
| supplemental | unknown | unknown | unknown | Supplemental field contract requires the order schema |

### Reply

none

### Failure Handling

none

### Related

none

> docai-identity: set_id: b32:r6s2abwqhnffhouzsfivx7uv6u | projection_id: b32:2su6l5snggpayed76bebjwuzuy
