> docai-messaging: 0.17.1 | profile: full | perspective: storefront | coverage: complete | knowledge: complete | source_refs: all

## SEND wire.parameterized (parameterized-as-raw)

Incorrectly presents parameterized JSON as opaque raw bytes.

### Behavior

- side_effects: dispatches the structured wire message
- idempotency: reuse the message identifier when resending
- preconditions: the structured wire message is ready to dispatch
- authorization: producer credentials permit wire validation publishing
- delivery: at-least-once -- retry ambiguous publishes with the same message identifier
- ordering: preserve order per message identifier

### Operation Bindings

none

### Channel

- Parameters: none
- Bindings: none

### Message parameterized-as-raw-message

- Headers: none
- Bindings: none
#### Payload

**payload_required**: yes
**media_type**: application/json;charset=utf-8
Opaque structured bytes are limited to 2 MiB and carry no integrity metadata.

### Reply

none

### Failure Handling

none

### Related

none

> docai-identity: set_id: b32:r6s2abwqhnffhouzsfivx7uv6u | projection_id: b32:2su6l5snggpayed76bebjwuzuy
