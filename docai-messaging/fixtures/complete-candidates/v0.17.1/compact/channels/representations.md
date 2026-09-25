> docai-messaging: 0.17.1 | profile: compact | perspective: storefront | coverage: complete | knowledge: complete | source_refs: complete-representations

## SEND representations.csv (r-csv-operation)

Sends one lifecycle record through the publication-scoped CSV wire adapter.

### Behavior

- side_effects: none
- idempotency: none
- preconditions: none
- authorization: none
- delivery: none
- ordering: none

### Operation Bindings

none

### Channel

- Parameters: none
- Bindings: none

### Message csv-message

#### Headers

none

#### Bindings

none

#### Payload

**payload_required**: yes

**media_type**: text/csv;charset=utf-8

**payload_nullable**: no

```csv
event_id,status
evt_03,created
```

| Field | Type | Required | Nullable | Constraints / Meaning |
|---|---|---|---|---|
| event_id | string | yes | no | Synthetic event identifier |
| status | string | yes | no | Lifecycle status |

### Reply

none

### Failure Handling

none

### Related

none

## SEND representations.raw (r-raw-operation)

Sends an authoritatively opaque receipt payload.

### Behavior

- side_effects: none
- idempotency: none
- preconditions: none
- authorization: none
- delivery: none
- ordering: none

### Operation Bindings

none

### Channel

- Parameters: none
- Bindings: none

### Message raw-message

#### Headers

none

#### Bindings

none

#### Payload

**payload_required**: yes

**media_type**: application/octet-stream

Opaque receipt bytes are limited to 2 MiB and carry a SHA-256 integrity digest.

### Reply

none

### Failure Handling

none

### Related

none

## SEND representations.tagged (r-tagged-operation)

Sends a lifecycle event selected by its complete discriminator mapping.

### Behavior

- side_effects: none
- idempotency: none
- preconditions: none
- authorization: none
- delivery: none
- ordering: none

### Operation Bindings

none

### Channel

- Parameters: none
- Bindings: none

### Message tagged-message

#### Headers

none

#### Bindings

none

#### Payload

**payload_required**: yes

**media_type**: application/json

**payload_nullable**: no

**variant**: kind = "created"

```json
{"kind":"created","id":"evt_01"}
```

| Field | Type | Required | Nullable | Constraints / Meaning |
|---|---|---|---|---|
| kind | string | yes | no | `const="created"`; Variant discriminator |
| id | string | yes | no | Synthetic event identifier |

**variant**: kind = "rejected"

```json
{"kind":"rejected","reason":"invalid"}
```

| Field | Type | Required | Nullable | Constraints / Meaning |
|---|---|---|---|---|
| kind | string | yes | no | `const="rejected"`; Variant discriminator |
| reason | string | yes | no | Rejection reason |

### Reply

none

### Failure Handling

none

### Related

none

## RECEIVE representations.untagged (r-untagged-operation)

Receives a lifecycle event selected without a discriminator field.

### Behavior

- side_effects: none
- idempotency: none
- preconditions: none
- authorization: none
- delivery: none
- ordering: none

### Operation Bindings

none

### Channel

- Parameters: none
- Bindings: none

### Message untagged-message

#### Headers

none

#### Bindings

none

#### Payload

**payload_presence**: always

**media_type**: application/json

**payload_nullable**: no

The receiver identifies the applicable lifecycle shape from the complete decoded value.

**variant**: archived

```json
{"reason":"expired"}
```

| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| reason | string | always | no | Archival reason |

**variant**: restored

```json
{"id":"evt_02"}
```

| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| id | string | always | no | Synthetic event identifier |

### Reply

none

### Failure Handling

none

### Related

none

> docai-identity: set_id: b32:wd5halve5xnlznddsehqy3lmzi | projection_id: b32:bnzbddlon6mxaiywtzumct7w6y
