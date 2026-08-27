> docai-messaging: 0.17.1 | profile: full | perspective: storefront | coverage: complete | knowledge: requires-input | source_refs: all

## SEND examples.commands (illustrative-example)

Publishes an illustrative quantity without claiming it is a credible business value.

### Behavior

- side_effects: publishes the illustrative message
- idempotency: reuse the message identifier when resending
- preconditions: the illustrative message is ready to publish
- authorization: producer credentials permit publishing
- delivery: at-least-once -- retry ambiguous publishes with the same message identifier
- ordering: preserve order per message identifier

### Operation Bindings

none

### Channel

- Parameters: none
- Bindings: none

### Message illustrative-message

- Headers: none
- Bindings: none
#### Payload

**payload_required**: yes
**media_type**: application/json
**payload_nullable**: no
```json
{"quantity":11}
```
| Field | Type | Required | Nullable | Constraints / Meaning |
|---|---|---|---|---|
| quantity | int | yes | no | `minimum=1`; `maximum=10`; Illustrative quantity chosen without assuming a credible business value |
**unknown**: valid example values require representative business quantity samples at source.json#/examples/quantity

### Reply

none

### Failure Handling

none

### Related

none

> docai-identity: set_id: b32:jdyfy5qp5a7u77co3qfryiw7ky | projection_id: b32:2su6l5snggpayed76bebjwuzuy
