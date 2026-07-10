# valid: bodyless and unknown body states

Expected: valid complete candidate. Body-less requests and responses use explicit `none`, while unknown response body presence keeps the required body markers and unknown marker.

````markdown
## DELETE /sessions/{id}

### Request

- Path Parameters:

| Name | Type | Required | Constraints / Meaning |
|---|---|---|---|
| id | string | yes | Session ID |

- Query Parameters: none
- Headers: none
- Cookie Parameters: none
- Body: none

### Response 204

none

### Response 202

**body_presence**: unknown

**media_type**: application/json

**body_nullable**: no

```json
{"operation_id":"op_01K0COMPLETE"}
```

| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| operation_id | string | always | no | Async deletion operation ID |

#### Response Headers

- Response Headers: none

**unknown**: response body presence for accepted async deletion is not documented; requires service-owner response contract for DELETE /sessions/{id}
````
