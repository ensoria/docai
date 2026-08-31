> docai-messaging: 0.17.1 | profile: full | perspective: storefront | coverage: complete | knowledge: complete | source_refs: all

## SEND sentences.alpha (publish-alpha)

Publishes an alpha event when producers complete alpha processing.

### Behavior

- side_effects: dispatches the selected alpha event
- idempotency: reuse the event identifier when resending
- preconditions: the alpha event is ready to publish
- authorization: producer credentials permit publishing
- delivery: at-least-once -- retry an ambiguous publish with the same event identifier
- ordering: preserve order per event identifier

### Operation Bindings

none

### Channel

- Parameters: none
- Bindings: none

### Message alpha-created

Use this message when the `kind` header is `alpha-created`.

#### Headers

| Name | Type | Required | Nullable | Constraints / Meaning |
|---|---|---|---|---|
| kind | string | yes | no | Value is `alpha-created` |

#### Bindings

none
#### Payload

none

### Message alpha-updated

Use this message when the `state` header is `ready?`.

#### Headers

| Name | Type | Required | Nullable | Constraints / Meaning |
|---|---|---|---|---|
| state | string | yes | no | Value is `ready?` |

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

## SEND sentences.beta (publish-beta)

ベータ処理が完了したイベントを送信します。購読者への状態更新に使用します。

### Behavior

- side_effects: dispatches the selected beta event
- idempotency: reuse the event identifier when resending
- preconditions: the beta event is ready to publish
- authorization: producer credentials permit publishing
- delivery: at-least-once -- retry an ambiguous publish with the same event identifier
- ordering: preserve order per event identifier

### Operation Bindings

none

### Channel

- Parameters: none
- Bindings: none

### Message beta-created

Use this message when the `kind` header is `beta-created`.

#### Headers

| Name | Type | Required | Nullable | Constraints / Meaning |
|---|---|---|---|---|
| kind | string | yes | no | Value is `beta-created` |

#### Bindings

none
#### Payload

none

### Message beta-updated

Use this message when the `source` header is https://example.test.

#### Headers

| Name | Type | Required | Nullable | Constraints / Meaning |
|---|---|---|---|---|
| source | string | yes | no | Value is `https://example.test` |

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
