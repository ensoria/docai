# valid: body marker ordering across units

Expected: valid complete candidate. Request bodies, responses, inline error shapes, common error shapes, and webhook payloads use their required marker order.

````markdown
#### Body

**body_required**: yes

**media_type**: application/json

**body_nullable**: no

```json
{"email":"taro@example.com"}
```

| Field | Type | Required | Nullable | Constraints / Meaning |
|---|---|---|---|---|
| email | string | yes | no | User email |

### Response 201

**body_presence**: always

**media_type**: application/json

**body_nullable**: no

```json
{"id":"usr_01K0COMPLETE"}
```

| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| id | string | always | no | User ID |

- Response Headers: none

### Errors

| Status | code | Shape | Condition | Caller action |
|---|---|---|---|---|
| 409 | email_taken | inline:email-conflict | Email already exists | Use another email. Do not retry |

409 email_taken inline:email-conflict:

**error_shape**: email-conflict

**body_presence**: always

**media_type**: application/json

**body_nullable**: no

```json
{"error":{"code":"email_taken"}}
```

| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| error | object | always | no | Error envelope; additional properties forbidden |
| error.code | string | always | no | Always `email_taken` |

- Response Headers: none

---

# API Conventions

## Errors

| Status | code | Shape | Condition | Caller action |
|---|---|---|---|---|
| 401 | token_expired | auth-error | Access token expired | Refresh once, then retry once |

**error_shape**: auth-error

**body_presence**: always

**media_type**: application/json

**body_nullable**: no

```json
{"error":{"code":"token_expired"}}
```

| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| error | object | always | no | Error envelope; additional properties forbidden |
| error.code | string | always | no | Always `token_expired` |

- Response Headers: none

---

## Payload

**body_required**: yes

**media_type**: application/json

**body_nullable**: no

```json
{"event":"user.created","user_id":"usr_01K0COMPLETE"}
```

| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| event | string | always | no | Event name |
| user_id | string | always | no | User ID |
````
