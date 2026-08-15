> docai-messaging: 0.17.1 | profile: full | perspective: storefront | coverage: complete | knowledge: complete | source_refs: all

## SEND constraints.unique (duplicate-exact-values)

Contains mathematically equal array values despite uniqueItems.

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

### Message duplicate-message

- Headers: none
- Bindings: none
#### Payload

**payload_required**: yes
**media_type**: application/json
**payload_nullable**: no
```json
{"codes":[9007199254740992,9007199254740992.0]}
```
| Field | Type | Required | Nullable | Constraints / Meaning |
|---|---|---|---|---|
| codes | number[] | yes | no | `uniqueItems=true`; Exact distinct identifiers |
| codes[] | number | yes | no | Exact identifier |

### Reply

none

### Failure Handling

none

### Related

none

> docai-identity: set_id: b32:r6s2abwqhnffhouzsfivx7uv6u | projection_id: b32:2su6l5snggpayed76bebjwuzuy

