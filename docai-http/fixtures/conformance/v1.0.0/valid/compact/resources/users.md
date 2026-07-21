> docai-http: 1.0.0 | profile: compact | coverage: complete | knowledge: complete | generated: 2026-07-21 | generation_id: conformance-compact-20260721-rc4-001 | projection_id: conformance-20260721-rc4-001 | source: fixtures/conformance/v1.0.0/source/complete-input-set.yaml (authoritative input set) | source_revision: fixture-input-set-rc3-001 | x-retrieval-unit: resource-file | x-fixture: stable-conformance

## POST /users

Creates a user record.

### Behavior

- side_effects: creates a user record
- idempotency: safe to retry only with the same `Idempotency-Key` and semantically identical request; without a key, do not retry after an ambiguous outcome
- preconditions: email is unique
- authorization: authenticated caller with `users:write`

### Request

- Path Parameters: none
- Query Parameters: none
- Headers: none
- Cookie Parameters: none

#### Body

**body_required**: yes

**media_type**: application/json

**body_nullable**: no

```json
{"email":"taro@example.com","name":"Taro Yamada"}
```

**field_defaults**: Nullable=no

| Field | Type | Required | Constraints / Meaning |
|---|---|---|---|
| $ | object | yes | Additional properties forbidden |
| email | string | yes | RFC 5322 email address; unique across all tenants |
| name | string | yes | 1-100 characters |
| role | string | no | `admin` \| `member`. Defaults to `member` when omitted |

### Response 201

**body_presence**: always

**media_type**: application/json

**body_nullable**: no

```json
{"id":"usr_01K0COMPLETE","email":"taro@example.com","name":"Taro Yamada","role":"member","created_at":"2026-07-10T03:00:00Z"}
```

**field_defaults**: Presence=always | Nullable=no

| Field | Type | Meaning |
|---|---|---|
| $ | object | Additional properties forbidden |
| id | string | Opaque user ID; use in later API calls |
| email | string | User email address |
| name | string | User display name |
| role | string | `admin` or `member` |
| created_at | string | RFC 3339 creation timestamp |

#### Response Headers

**field_defaults**: Presence=always

| Name | Type | Meaning |
|---|---|---|
| Location | string | URL of the created user, such as `/users/usr_01K0COMPLETE` |

### Errors

| Status | code | Shape | Condition | Caller action |
|---|---|---|---|---|
| 409 | email_taken | inline:email-taken | Email address already exists | Use another email address. Do not retry unchanged input |
| 409 | idempotency_conflict | common:standard-error | The `Idempotency-Key` was already used with a different request | Use the original request or a new key for a new logical operation; do not retry the changed request with the same key |
| 422 | validation_failed | common:validation-error | Request validation failed | Correct the input, then retry as a new logical operation with a new `Idempotency-Key`; do not retry unchanged input |

409 email_taken inline:email-taken:

**error_shape**: email-taken

**body_presence**: always

**media_type**: application/json

**body_nullable**: no

```json
{"error":{"code":"email_taken","message":"email already exists"}}
```

**field_defaults**: Presence=always | Nullable=no

| Field | Type | Meaning |
|---|---|---|
| $ | object | Additional properties forbidden |
| error | object | Error envelope; additional properties forbidden |
| error.code | string | Always `email_taken` |
| error.message | string | Developer-facing message; do not display directly to users |

- Response Headers: none

### Related

- Fetch after creation: GET /users/{id}

## GET /users/{id}

Gets one user by ID.

### Behavior

- side_effects: none
- idempotency: idempotent and safe to retry
- preconditions: the user exists
- authorization: authenticated caller with `users:read`

### Request

#### Path Parameters

| Name | Type | Constraints / Meaning |
|---|---|---|
| id | string | User ID returned by POST /users, such as `usr_01K0COMPLETE` |

#### Query Parameters

none

#### Headers

none

#### Cookie Parameters

none

#### Body

none

### Response 200

**body_presence**: always

**same_as**: POST /users Response 201 application/json

- Response Headers: none

### Errors

none

### Related

- Create: POST /users
