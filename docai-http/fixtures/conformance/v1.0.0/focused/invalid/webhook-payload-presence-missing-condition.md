# invalid: webhook payload presence missing condition

Expected: invalid complete conformance. A conditional webhook payload field omits the exact presence condition.

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
{"event":"document.processed","document_id":"doc_01K0COMPLETE","status":"failed","error":{"code":"OCR_FAILED"}}
```

| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| event | string | always | no | Event name |
| document_id | string | always | no | Document ID |
| status | string | always | no | `indexed` \| `failed` |
| error | object | conditional | yes | Error object |

## Related

- Triggered by: POST /documents
````
