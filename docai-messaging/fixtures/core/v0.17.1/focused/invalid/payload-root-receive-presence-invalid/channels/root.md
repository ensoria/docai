> docai-messaging: 0.17.1 | profile: full | perspective: storefront | coverage: complete | knowledge: complete | source_refs: all

## RECEIVE roots.scalar (root-payload)

Receives a scalar root payload with an invalid root Presence value.

### Behavior

- side_effects: records the received root payload
- idempotency: deduplicate by payload identifier
- preconditions: the payload consumer is running
- authorization: consumer credentials permit payload reads
- delivery: at-least-once -- acknowledge after durable processing
- ordering: preserve order per payload identifier

### Operation Bindings

none

### Channel

- Parameters: none
- Bindings: none

### Message root-message

- Headers: none
- Bindings: none
#### Payload

**payload_presence**: always
**media_type**: application/json
**payload_nullable**: no
```json
"root_01HXYZ"
```
| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| $ | string | optional | no | Stable root identifier |

### Reply

none

### Failure Handling

none

### Related

none

> docai-identity: set_id: b32:r6s2abwqhnffhouzsfivx7uv6u | projection_id: b32:2su6l5snggpayed76bebjwuzuy
