# valid: webhook payload presence

Expected: valid complete candidate. Webhook payload `body_required` is documented separately from per-field `Presence`.

````markdown
# document.events

Sent when document processing changes state.

## Headers

| Name | Required | Type | Constraints / Meaning |
|---|---|---|---|
| X-Webhook-Event | yes | string | Single field line only; not comma-combinable; order not significant; example `X-Webhook-Event: document.processed` |

## Payload

**body_required**: yes

**media_type**: application/json

**body_nullable**: no

```json
{"event":"document.processed","document_id":"doc_01K0COMPLETE","status":"indexed","error":null}
```

| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| event | string | always | no | Event name |
| document_id | string | always | no | Document ID |
| status | string | always | no | `indexed` \| `failed` |
| error | object | conditional | yes | Present with a non-null object only when status is `failed`; present as `null` when status is `indexed`; omitted only for legacy deliveries before 2026-07-10 |

Additional properties forbidden.

## Related

- Triggered by: POST /documents
````
