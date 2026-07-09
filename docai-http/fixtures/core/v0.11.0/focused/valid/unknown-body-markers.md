# valid: unknown body markers

Expected: valid `body_required`, `body_presence`, `body_nullable`, table-cell `unknown`, and marker placement.

````markdown
#### Body

**body_required**: unknown

**media_type**: application/json

**body_nullable**: unknown

```json
{"email":"taro@example.com","display_name":"Taro"}
```

| Field | Type | Required | Nullable | Constraints / Meaning |
|---|---|---|---|---|
| email | string | unknown | no | Requiredness is absent from the authoritative request schema |
| display_name | unknown | no | unknown | Display name type and nullability are absent from the authoritative request schema |

**unknown**: request body requiredness, `email` requiredness, and `display_name` type/nullability are not documented; requires service-owner request schema for POST /users

### Response 200

**body_presence**: unknown

**media_type**: application/json

**body_nullable**: unknown

```json
{"id":"usr_01J0CORE"}
```

| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| id | string | always | no | User ID |

- Response Headers: none

**unknown**: response body presence and nullability are not documented; requires service-owner response contract for GET /users/{id}
````
