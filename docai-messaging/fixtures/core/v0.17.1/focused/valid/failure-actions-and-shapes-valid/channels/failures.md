> docai-messaging: 0.17.1 | profile: full | perspective: storefront | coverage: requires-source | knowledge: requires-input | source_refs: all

## RECEIVE failures.expanded (expanded-receive)

Processes a message and documents every operation-specific receive failure category.

### Behavior

- side_effects: records successfully handled messages
- idempotency: deduplicate by message identifier
- preconditions: the failure consumer is active
- authorization: consumer credentials permit message processing
- delivery: at-least-once -- acknowledge only after successful processing
- ordering: preserve order per message identifier

### Operation Bindings

none

### Channel

- Parameters: none
- Bindings: none

### Message expanded-receive-message

- Headers: none
- Bindings: none
#### Payload

none

### Reply

none

### Failure Handling

| Failure | Signal | Condition | Action |
|---|---|---|---|
| malformed-payload | inline:malformed-payload | The payload cannot be decoded | Reject the message, preserve its state as unprocessed, and do not re-process it |
| unknown-variant | inline:unknown-variant | The variant discriminator is not recognized | Route the message to the dead-letter channel, preserve its state as unprocessed, and do not re-process it |
| handler-error | common:handler-error | The handler reports a recoverable error | Negatively acknowledge the message, preserve its failed state, and re-process it after recovery |
| legacy-handler-error | common:legacy-error | The legacy handler reports an encoded error | Escalate the message, preserve its unresolved state, and do not re-process it |
| encoded-signal | inline:encoded-signal | The broker returns an encoded failure signal | Escalate the message, preserve its unresolved state, and do not re-process it |

**message_shape**: malformed-payload

- Headers: none
- Bindings: none
#### Payload

none

**message_shape**: unknown-variant

- Headers: none
- Bindings: none
#### Payload

none

**message_shape**: encoded-signal

**unsupported**: replaces failure shape encoded-signal: encoded broker failure at source-a#/failures/encoded-signal

### Related

none

## SEND failures.expanded-deviation (expanded-with-deviation)

Publishes a message with sorted deviations and an operation-specific failure row.

### Behavior

- side_effects: publishes a failure-prone message
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

### Message expanded-with-deviation-message

- Headers: none
- Bindings: none
#### Payload

none

### Reply

none

### Failure Handling

**deviation**: alpha inherited retry rule is replaced by immediate escalation
**deviation**: zeta inherited dead-letter rule is replaced by quarantine routing
| Failure | Signal | Condition | Action |
|---|---|---|---|
| broker-unavailable | broker error | The broker is unavailable | Preserve the unresolved state and retry after the broker recovers |

### Related

none

## SEND failures.none (none)

Publishes a message governed only by common failure conventions.

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

### Message none-message

- Headers: none
- Bindings: none
#### Payload

none

### Reply

none

### Failure Handling

none

### Related

none

## SEND failures.none-deviation (none-with-deviation)

Publishes after suppressing inherited operation-inapplicable failure behavior.

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

### Message none-with-deviation-message

- Headers: none
- Bindings: none
#### Payload

none

### Reply

none

### Failure Handling

**deviation**: inherited poison-message retry rule is suppressed because this operation has no poison-message state
none

### Related

none

## SEND failures.unknown (unknown)

Publishes while operation-specific failure behavior remains unknown.

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

### Message unknown-message

- Headers: none
- Bindings: none
#### Payload

none

### Reply

none

### Failure Handling

unknown
**unknown**: operation-specific recovery behavior requires the producer implementation

### Related

none

## SEND failures.unknown-deviation (unknown-with-deviation)

Publishes with a known deviation while the remaining failure behavior is unknown.

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

### Message unknown-with-deviation-message

- Headers: none
- Bindings: none
#### Payload

none

### Reply

none

### Failure Handling

**deviation**: inherited retry rule is replaced by escalation before unresolved behavior is consulted
unknown
**unknown**: remaining operation-specific recovery behavior requires the producer implementation

### Related

none

## SEND failures.unsupported (unsupported)

Publishes with failure handling represented by an external source.

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

### Message unsupported-message

- Headers: none
- Bindings: none
#### Payload

none

### Reply

none

### Failure Handling

**unsupported**: replaces Failure Handling: encoded operation failure rules at source-a#/failures/unsupported

### Related

none

## SEND failures.unsupported-deviation (unsupported-with-deviation)

Publishes with a deviation and externally represented failure handling.

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

### Message unsupported-with-deviation-message

- Headers: none
- Bindings: none
#### Payload

none

### Reply

none

### Failure Handling

**deviation**: inherited retry rule is replaced by escalation before encoded failure rules are consulted
**unsupported**: replaces Failure Handling: encoded operation failure rules at source-a#/failures/unsupported-deviation

### Related

none

> docai-identity: set_id: b32:r6s2abwqhnffhouzsfivx7uv6u | projection_id: b32:2su6l5snggpayed76bebjwuzuy
