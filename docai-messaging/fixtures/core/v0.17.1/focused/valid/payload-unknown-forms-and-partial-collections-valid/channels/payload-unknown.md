> docai-messaging: 0.17.1 | profile: full | perspective: storefront | coverage: complete | knowledge: requires-input | source_refs: all

## SEND orders.a.partial-fields (partial-fields)

Sends an order while retaining every established payload field name.

### Behavior

- side_effects: dispatches the partial order command
- idempotency: reuse the order identifier when resending
- preconditions: the order is ready to dispatch
- authorization: producer credentials permit command publishing
- delivery: at-least-once -- retry ambiguous publishes with the same order identifier
- ordering: preserve order per order identifier

### Operation Bindings

none

### Channel

- Parameters: none
- Bindings: none

### Message partial-fields-message

- Headers: none
- Bindings: none
#### Payload

**payload_required**: yes
**media_type**: application/json
**payload_nullable**: no
| Field | Type | Required | Nullable | Constraints / Meaning |
|---|---|---|---|---|
| id | string | yes | no | Stable order identifier |
**unknown**: additional unnamed field requires the complete order schema at source-a

### Reply

none

### Failure Handling

none

### Related

none

## SEND orders.b.{tenant}.partial-members (partial-members)

Sends an order while retaining every established channel parameter and header name.

### Behavior

- side_effects: dispatches the tenant order command
- idempotency: reuse the order identifier when resending
- preconditions: the tenant order is ready to dispatch
- authorization: producer credentials permit tenant command publishing
- delivery: at-least-once -- retry ambiguous publishes with the same order identifier
- ordering: preserve order per tenant and order identifier

### Operation Bindings

none

### Channel

#### Parameters

| Name | Type | Constraints / Meaning |
|---|---|---|
| tenant | string | Tenant routing value |
**unknown**: additional unnamed parameter requires the complete channel declaration at source-a

#### Bindings

none

### Message partial-members-message

#### Headers

| Name | Type | Required | Nullable | Constraints / Meaning |
|---|---|---|---|---|
| x-order-id | string | yes | no | Stable order identifier |
**unknown**: additional unnamed header requires the complete message header declaration at source-a

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

## SEND orders.c.unknown-fields (unknown-fields)

Sends an order with established wire identity but no established field names.

### Behavior

- side_effects: dispatches the field-unknown order command
- idempotency: reuse the order identifier when resending
- preconditions: the order is ready to dispatch
- authorization: producer credentials permit command publishing
- delivery: at-least-once -- retry ambiguous publishes with the same order identifier
- ordering: preserve order per order identifier

### Operation Bindings

none

### Channel

- Parameters: none
- Bindings: none

### Message unknown-fields-message

#### Headers

unknown
**unknown**: message header collection requires the complete envelope declaration at source-a

#### Bindings

none

#### Payload

**payload_required**: yes
**media_type**: application/json
**payload_nullable**: unknown
**unknown**: payload nullability requires the complete order schema at source-a
unknown
**unknown**: payload field collection requires the complete order schema at source-a

### Reply

none

### Failure Handling

none

### Related

none

## SEND orders.d.unknown-representations (unknown-representations)

Sends an established non-empty payload whose wire identity is not established.

### Behavior

- side_effects: dispatches the representation-unknown order command
- idempotency: reuse the order identifier when resending
- preconditions: the order is ready to dispatch
- authorization: producer credentials permit command publishing
- delivery: at-least-once -- retry ambiguous publishes with the same order identifier
- ordering: preserve order per order identifier

### Operation Bindings

none

### Channel

- Parameters: none
- Bindings: none

### Message unknown-representations-message

- Headers: none
- Bindings: none
#### Payload

**payload_required**: unknown
**unknown**: payload requiredness requires the complete order schema at source-a
unknown
**unknown**: payload representation set requires the wire contract at source-a

### Reply

none

### Failure Handling

none

### Related

none

## SEND orders.e.{tenant}.unknown-parameters (unknown-parameters)

Sends an order while preserving that the channel parameter collection is not established.

### Behavior

- side_effects: dispatches the parameter-unknown order command
- idempotency: reuse the order identifier when resending
- preconditions: the order is ready to dispatch
- authorization: producer credentials permit command publishing
- delivery: at-least-once -- retry ambiguous publishes with the same order identifier
- ordering: preserve order per order identifier

### Operation Bindings

none

### Channel

#### Parameters

unknown
**unknown**: channel parameter collection requires the complete channel declaration at source-a

#### Bindings

none

### Message unknown-parameters-message

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

> docai-identity: set_id: b32:r6s2abwqhnffhouzsfivx7uv6u | projection_id: b32:2su6l5snggpayed76bebjwuzuy
