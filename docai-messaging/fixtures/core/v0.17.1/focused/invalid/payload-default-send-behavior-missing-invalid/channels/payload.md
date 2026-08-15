> docai-messaging: 0.17.1 | profile: full | perspective: storefront | coverage: complete | knowledge: complete | source_refs: all

## SEND defaults.missing (missing-default-behavior)

Omits the required SEND construction behavior for a behavioral default.

### Behavior

- side_effects: dispatches the validation message
- idempotency: reuse the message identifier when resending
- preconditions: the validation message is ready to dispatch
- authorization: producer credentials permit validation publishing
- delivery: at-least-once -- retry ambiguous publishes with the same message identifier
- ordering: preserve order per message identifier

### Operation Bindings

none

### Channel

- Parameters: none
- Bindings: none

### Message missing-default-message

- Headers: none
- Bindings: none
#### Payload

**payload_required**: yes
**media_type**: application/json
**payload_nullable**: no
```json
{}
```
| Field | Type | Required | Nullable | Constraints / Meaning |
|---|---|---|---|---|
| mode | string | no | no | `default="safe"`; Preferred mode |

### Reply

none

### Failure Handling

none

### Related

none

> docai-identity: set_id: b32:r6s2abwqhnffhouzsfivx7uv6u | projection_id: b32:2su6l5snggpayed76bebjwuzuy

