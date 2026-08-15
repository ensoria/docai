> docai-messaging: 0.17.1 | profile: full | perspective: storefront | coverage: requires-source | knowledge: complete | source_refs: all

## SEND constraints.commands (exact-constraints)

Sends values whose exact constraints, defaults, and format roles remain observable.

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

### Message exact-message

- Headers: none
- Bindings: none
#### Payload

**payload_required**: yes
**media_type**: application/json
**payload_nullable**: no
```json
{"amount":1e0,"codes":[9007199254740992,9007199254740993],"currency":"USD","sequence":7,"timestamp":"2024-01-02T03:04:05Z"}
```
| Field | Type | Required | Nullable | Constraints / Meaning |
|---|---|---|---|---|
| amount | number | yes | no | `const=1.0`; `enum=[1e0,2]`; `minimum=0`; `maximum=2`; `multipleOf=0.1`; Exact decimal amount |
| codes | int[] | yes | no | `minItems=2`; `maxItems=2`; `uniqueItems=true`; Exact distinct identifiers |
| codes[] | int | yes | no | Exact identifier |
| currency | string | yes | no | Currency code whose open custom format is not normalized |
| mode | string | no | no | `default="safe"`; The application uses the default as the effective value when constructing an omitted field. |
| note | string | no | no | `default_annotation="draft"`; Descriptive source annotation only; it does not control construction. |
| sequence | int | yes | no | `format="int32"`; Signed 32-bit sequence number |
| timestamp | string | yes | no | `format_annotation="date-time"`; Descriptive date-time representation intent |

**unsupported**: localized: custom format currency-code omitted from currency at source.json#/payload/properties/currency/format

### Reply

none

### Failure Handling

none

### Related

none

## RECEIVE constraints.events (receive-default)

Receives an optional value with an application-effective default.

### Behavior

- side_effects: consumes the validation message
- idempotency: duplicate messages have no additional effect
- preconditions: the consumer is ready to receive validation messages
- authorization: consumer credentials permit validation consumption
- delivery: at-least-once -- tolerate duplicate deliveries
- ordering: preserve order per message identifier

### Operation Bindings

none

### Channel

- Parameters: none
- Bindings: none

### Message receive-default-message

- Headers: none
- Bindings: none
#### Payload

**payload_presence**: always
**media_type**: application/json
**payload_nullable**: no
```json
{}
```
| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| mode | string | optional | no | `default="safe"`; The implemented application treats the absent field as having that effective value while Presence remains optional. |

### Reply

none

### Failure Handling

none

### Related

none

> docai-identity: set_id: b32:r6s2abwqhnffhouzsfivx7uv6u | projection_id: b32:2su6l5snggpayed76bebjwuzuy
