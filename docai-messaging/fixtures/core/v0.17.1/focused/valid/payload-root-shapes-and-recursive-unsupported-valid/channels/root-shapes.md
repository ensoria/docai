> docai-messaging: 0.17.1 | profile: full | perspective: storefront | coverage: requires-source | knowledge: complete | source_refs: all

## SEND roots.a.recursive (recursive-payload)

Sends a recursive payload while preserving the unsupported schema boundary.

### Behavior

- side_effects: dispatches the recursive payload
- idempotency: reuse the payload identifier when resending
- preconditions: the recursive payload is ready to dispatch
- authorization: producer credentials permit recursive payload publishing
- delivery: at-least-once -- retry ambiguous publishes with the same payload identifier
- ordering: preserve order per payload identifier

### Operation Bindings

none

### Channel

- Parameters: none
- Bindings: none

### Message recursive-payload-message

- Headers: none
- Bindings: none
#### Payload

**payload_required**: yes
**unsupported**: replaces payload representation recursive-payload-message 16:application/json: recursive schema at source.json#/recursivePayload

### Reply

none

### Failure Handling

none

### Related

none

## SEND roots.b.array (root-array)

Sends an array whose decoded root and item containers are explicit.

### Behavior

- side_effects: dispatches the root array
- idempotency: reuse the array identifier when resending
- preconditions: the array is ready to dispatch
- authorization: producer credentials permit root array publishing
- delivery: at-least-once -- retry ambiguous publishes with the same array identifier
- ordering: preserve item order within the array

### Operation Bindings

none

### Channel

- Parameters: none
- Bindings: none

### Message root-array-message

- Headers: none
- Bindings: none
#### Payload

**payload_required**: yes
**media_type**: application/json
**payload_nullable**: no
```json
[{"id":"item_01HXYZ"}]
```
| Field | Type | Required | Nullable | Constraints / Meaning |
|---|---|---|---|---|
| $ | object[] | yes | no | Ordered item records |
| $[] | object | yes | no | Additional properties are forbidden |
| $[].id | string | yes | no | Stable item identifier |

### Reply

none

### Failure Handling

none

### Related

none

## SEND roots.c.map (root-map)

Sends a dynamic-key map whose values use one homogeneous object shape.

### Behavior

- side_effects: dispatches the root map
- idempotency: reuse the map revision when resending
- preconditions: the map is ready to dispatch
- authorization: producer credentials permit root map publishing
- delivery: at-least-once -- retry ambiguous publishes with the same map revision
- ordering: no cross-key ordering guarantee

### Operation Bindings

none

### Channel

- Parameters: none
- Bindings: none

### Message root-map-message

- Headers: none
- Bindings: none
#### Payload

**payload_required**: yes
**media_type**: application/json
**payload_nullable**: no
```json
{"usd":{"amount":12},"jpy":{"amount":1800}}
```
| Field | Type | Required | Nullable | Constraints / Meaning |
|---|---|---|---|---|
| $ | map<string, object> | yes | no | Currency-keyed amount records |
| $.{key} | object | yes | no | Additional properties are forbidden |
| $.{key}.amount | int | yes | no | Amount for each currency key |

### Reply

none

### Failure Handling

none

### Related

none

## SEND roots.d.object (root-object)

Sends a constrained root object whose additional-value type is explicit.

### Behavior

- side_effects: dispatches the root object
- idempotency: reuse the object identifier when resending
- preconditions: the object is ready to dispatch
- authorization: producer credentials permit root object publishing
- delivery: at-least-once -- retry ambiguous publishes with the same object identifier
- ordering: preserve order per object identifier

### Operation Bindings

none

### Channel

- Parameters: none
- Bindings: none

### Message root-object-message

- Headers: none
- Bindings: none
#### Payload

**payload_required**: yes
**media_type**: application/json
**payload_nullable**: no
```json
{"id":"obj_01HXYZ","rank":7}
```
| Field | Type | Required | Nullable | Constraints / Meaning |
|---|---|---|---|---|
| $ | object | yes | no | Additional properties are allowed with int values |
| {key} | int | yes | no | Integer value for each additional property |
| id | string | yes | no | Stable object identifier |

### Reply

none

### Failure Handling

none

### Related

none

## SEND roots.e.scalar (root-scalar)

Sends a scalar identifier as the complete decoded payload.

### Behavior

- side_effects: dispatches the scalar identifier
- idempotency: reuse the scalar identifier when resending
- preconditions: the identifier is ready to dispatch
- authorization: producer credentials permit scalar publishing
- delivery: at-least-once -- retry ambiguous publishes with the same identifier
- ordering: preserve order per scalar identifier

### Operation Bindings

none

### Channel

- Parameters: none
- Bindings: none

### Message root-scalar-message

- Headers: none
- Bindings: none
#### Payload

**payload_required**: yes
**media_type**: application/json
**payload_nullable**: no
```json
"ord_01HXYZ"
```
| Field | Type | Required | Nullable | Constraints / Meaning |
|---|---|---|---|---|
| $ | string | yes | no | Stable order identifier |

### Reply

none

### Failure Handling

none

### Related

none

> docai-identity: set_id: b32:r6s2abwqhnffhouzsfivx7uv6u | projection_id: b32:2su6l5snggpayed76bebjwuzuy
