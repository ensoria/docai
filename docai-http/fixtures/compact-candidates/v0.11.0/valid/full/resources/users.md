> docai-http: 0.11.0 | profile: full | coverage: complete | knowledge: complete | generated: 2026-07-09 | generation_id: compact-candidate-full-20260709-001 | projection_id: compact-candidate-20260709-001 | source: fixtures/compact-candidate-openapi.yaml (OpenAPI 3.1.1) | source_revision: fixture-revision-compact-candidate-001 | x-fixture: compact-candidate

## POST /users

Creates a user record.

### Behavior

- side_effects: creates a user record
- idempotency: not idempotent
- preconditions: email is unique
- authorization: authenticated user with `users:write`

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
{"email":"taro@example.com","name":"Taro Yamada","role":"member"}
```

| Field | Type | Required | Nullable | Constraints / Meaning |
|---|---|---|---|---|
| $ | object | yes | no | Additional properties forbidden |
| email | string | yes | no | RFC 5322 email address; unique across all tenants |
| name | string | yes | no | 1-100 characters |
| role | string | no | no | `admin` \| `member`. Defaults to `member` when omitted |

### Response 201

**body_presence**: always

**media_type**: application/json

**body_nullable**: no

```json
{"id":"usr_01K0COMPACT","email":"taro@example.com","name":"Taro Yamada","role":"member","created_at":"2026-07-09T03:00:00Z"}
```

| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| $ | object | always | no | Additional properties forbidden |
| id | string | always | no | Opaque user ID; use in later API calls |
| email | string | always | no | User email address |
| name | string | always | no | User display name |
| role | string | always | no | `admin` or `member` |
| created_at | string | always | no | RFC 3339 creation timestamp |

#### Response Headers

| Name | Type | Presence | Meaning |
|---|---|---|---|
| Location | string | always | URL of the created user, such as `/users/usr_01K0COMPACT` |

### Errors

none

### Related

none
