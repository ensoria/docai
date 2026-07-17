# valid: endpoint section order and path parameters

Expected: valid complete conformance. Endpoint sections appear in fixed order, path parameter rows exactly match path template variables, and later empty request sections retain their headings after the first non-empty subsection.

````markdown
## GET /users/{id}/devices/{device_id}

Gets a registered device for one user.

**call_shape**: authenticated read; returns one device; 404 means either the user or device was not found.

### Behavior

- side_effects: none
- idempotency: safe and idempotent
- preconditions: User and device exist
- authorization: `devices:read` scope

### Request

#### Path Parameters

| Name | Type | Constraints / Meaning |
|---|---|---|
| id | string | User ID returned by POST /users |
| device_id | string | Device ID returned by POST /users/{id}/devices |

#### Query Parameters

none

#### Headers

| Name | Required | Type | Constraints / Meaning |
|---|---|---|---|
| If-None-Match | no | string | Optional ETag validator; single field line only; example `If-None-Match: "dev_01K0COMPLETE"` |

#### Cookie Parameters

none

#### Body

none

### Response 200

**body_presence**: always

**media_type**: application/json

**body_nullable**: no

```json
{"id":"dev_01K0COMPLETE","user_id":"usr_01K0COMPLETE","platform":"ios"}
```

| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| id | string | always | no | Device ID |
| user_id | string | always | no | Owning user ID |
| platform | string | always | no | `ios` \| `android` |

#### Response Headers

| Name | Type | Presence | Meaning |
|---|---|---|---|
| ETag | string | always | Use as `If-None-Match` on later reads |

### Errors

none

### Related

- User: GET /users/{id}
````
