# invalid: body marker ordering wrong

Expected: invalid complete conformance. Body markers are emitted in the wrong order across request, response, error-shape, and webhook payload units.

````markdown
#### Body

**media_type**: application/json

**body_required**: yes

**body_nullable**: no

```json
{"email":"taro@example.com"}
```

| Field | Type | Required | Nullable | Constraints / Meaning |
|---|---|---|---|---|
| email | string | yes | no | User email |

### Response 201

**media_type**: application/json

**body_presence**: always

**body_nullable**: no

```json
{"id":"usr_01K0COMPLETE"}
```

| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| id | string | always | no | User ID |

409 email_taken inline:email-conflict:

**error_shape**: email-conflict

**media_type**: application/json

**body_presence**: always

**body_nullable**: no

## Payload

**media_type**: application/json

**body_required**: yes

**body_nullable**: no
````
