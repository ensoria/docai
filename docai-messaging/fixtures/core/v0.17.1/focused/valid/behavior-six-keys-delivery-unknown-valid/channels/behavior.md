> docai-messaging: 0.17.1 | profile: full | perspective: storefront | coverage: complete | knowledge: requires-input | source_refs: all

## SEND behavior.commands (at-least-once)

Requests a retryable command publish.

### Behavior

- side_effects: dispatches the command for downstream processing
- idempotency: reuse the command identifier when resending
- preconditions: the command target exists
- authorization: producer credentials permit publishing commands
- delivery: at-least-once -- acknowledge after broker persistence and retry an ambiguous publish with the same identifier
- ordering: preserve publish order for one command target

### Operation Bindings

none

### Channel

- Parameters: none
- Bindings: none

### Message at-least-once

#### Headers

none

#### Bindings

none

#### Payload

none

### Reply

none

### Failure Handling

none

### Related

none

## SEND behavior.commands (at-most-once)

Requests a command publish without retrying an ambiguous result.

### Behavior

- side_effects: dispatches the command when the single publish succeeds
- idempotency: none
- preconditions: the command target exists
- authorization: producer credentials permit publishing commands
- delivery: at-most-once
- ordering: none

### Operation Bindings

none

### Channel

- Parameters: none
- Bindings: none

### Message at-most-once

#### Headers

none

#### Bindings

none

#### Payload

none

### Reply

none

### Failure Handling

none

### Related

none

## SEND behavior.commands (exactly-once)

Requests a transactionally scoped command publish.

### Behavior

- side_effects: commits the command and its processing result atomically
- idempotency: reuse the transaction identifier for the same logical command
- preconditions: the producer transaction is active
- authorization: producer credentials permit transactional publishing
- delivery: exactly-once -- holds only for the command publish and processing result committed in the same broker transaction
- ordering: preserve transaction order within one partition

### Operation Bindings

none

### Channel

- Parameters: none
- Bindings: none

### Message exactly-once

#### Headers

none

#### Bindings

none

#### Payload

none

### Reply

none

### Failure Handling

none

### Related

none

## SEND behavior.commands (unknown-facts)

Requests a command whose complete behavior inputs are unavailable.

### Behavior

- side_effects: unknown
- idempotency: none
- preconditions: unknown
- authorization: none
- delivery: unknown
- ordering: none
**unknown**: side_effects requires the handler specification
**unknown**: preconditions requires the command lifecycle specification
**unknown**: delivery requires the broker acknowledgement policy

### Operation Bindings

none

### Channel

- Parameters: none
- Bindings: none

### Message unknown-facts

#### Headers

none

#### Bindings

none

#### Payload

none

### Reply

none

### Failure Handling

none

### Related

none

> docai-identity: set_id: b32:r6s2abwqhnffhouzsfivx7uv6u | projection_id: b32:2su6l5snggpayed76bebjwuzuy
