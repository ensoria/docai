# valid: conditional response body presence

Expected: valid complete candidate. Conditional response body presence states the exact caller-visible condition and keeps body omission separate from representation nullability.

````markdown
### Response 200

**body_presence**: present when the request sends `Prefer: return=representation`; omitted when the request sends `Prefer: return=minimal`

**media_type**: application/json

**body_nullable**: no

```json
{"id":"usr_01K0COMPLETE","email":"taro@example.com"}
```

| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| id | string | always | no | User ID when the response body is present |
| email | string | always | no | User email when the response body is present |

- Response Headers: none

Clients must branch on `body_presence`: parse JSON only when the body is present, and treat an omitted body as a successful minimal response.
````
