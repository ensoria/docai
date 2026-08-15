> docai-messaging: 0.17.1 | profile: full | perspective: storefront | coverage: complete | knowledge: complete | source_refs: all

## SEND failures.deviation (deviation-order)

Publishes with failure deviations in noncanonical order.

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

### Message deviation-order-message

- Headers: none
- Bindings: none
#### Payload

none

### Reply

none

### Failure Handling

**deviation**: zeta inherited failure rule is suppressed
**deviation**: alpha inherited failure rule is suppressed
none

### Related

none

> docai-identity: set_id: b32:r6s2abwqhnffhouzsfivx7uv6u | projection_id: b32:2su6l5snggpayed76bebjwuzuy
