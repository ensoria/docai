> docai-http: 0.10.1 | profile: full | coverage: requires-source | knowledge: requires-input | generated: 2026-07-09 | generation_id: core-full-20260709-001 | projection_id: core-20260709-001 | source: fixtures/core-openapi.yaml (OpenAPI 3.1.1) | source_revision: fixture-revision-core-001 | x-fixture: core-valid-full

## POST /users

Creates a user account that can sign in after email confirmation.

### Behavior

- side_effects: On successful creation, a confirmation email is sent asynchronously
- idempotency: conditionally idempotent when the same `Idempotency-Key` value is reused
- preconditions: none
- authorization: `users:write` scope

### Request

- Path Parameters: none
- Query Parameters: none

#### Headers

| Name | Required | Type | Constraints / Meaning |
|---|---|---|---|
| Idempotency-Key | no | string | Send from the first attempt when the call may be retried, and reuse the same value on retries |

#### Cookie Parameters

none

#### Body

**body_required**: yes

**media_type**: application/json

**body_nullable**: no

```json
{"email":"taro@example.com","name":"Taro Yamada","role":"member","metadata":{"campaign.code|source":"spring"}}
```

| Field | Type | Required | Nullable | Constraints / Meaning |
|---|---|---|---|---|
| $ | object | yes | no | Additional properties forbidden |
| email | string | yes | no | RFC 5322 email address; unique across all tenants |
| name | string | yes | no | 1-100 characters |
| role | string | no | no | `admin` \| `member`. Defaults to `member` when omitted |
| metadata | object | no | no | Additional properties forbidden |
| metadata.campaign\.code\|source | string | no | no | Campaign attribution; field name contains a literal dot and pipe |

### Response 201

**body_presence**: always

**media_type**: application/json

**body_nullable**: no

```json
{"id":"usr_01J0CORE","email":"taro@example.com","name":"Taro Yamada","role":"member","created_at":"2026-07-09T03:00:00Z"}
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
| Location | string | always | URL of the created user, such as `/users/usr_01J0CORE` |
| ETag | string | always | Use as `If-Match` when updating the user |

**unsupported**: localized: response also includes dynamic `X-Audit-*` audit-correlation headers that clients must log but whose generated names cannot be enumerated at fixtures/core-openapi.yaml#/paths/~1users/post/responses/201/headers

### Errors

| Status | code | Shape | Condition | Caller action |
|---|---|---|---|---|
| 409 | email_taken | common:standard-error | Email address already exists | Use another email address. Do not retry unchanged input |
| 422 | validation_failed | inline:validation-error | Input value is invalid for this endpoint | Show field-level errors in the form. Do not retry unchanged input |

422 validation_failed inline:validation-error:

**error_shape**: validation-error

**body_presence**: always

**media_type**: application/json

**body_nullable**: no

```json
{"error":{"code":"validation_failed","message":"input is invalid","field_errors":[{"field":"role","code":"invalid_enum","message":"role must be admin or member"}]}}
```

| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| $ | object | always | no | Additional properties forbidden |
| error | object | always | no | Error envelope; additional properties forbidden |
| error.code | string | always | no | Always `validation_failed` |
| error.message | string | always | no | Developer-facing summary; do not display directly to users |
| error.field_errors | object[] | always | no | Field-level validation failures; array items reject additional properties |
| error.field_errors[].field | string | always | no | Request field targeted by the error |
| error.field_errors[].code | string | always | no | Machine-readable validation code |
| error.field_errors[].message | string | always | no | Safe to display next to the target field |

- Response Headers: none

### Related

- Fetch after creation: GET /users/{id}
- Update after creation: PATCH /users/{id}

## GET /users/{id}

Fetches a user account by ID.

### Behavior

- side_effects: none
- idempotency: idempotent and safe to retry
- preconditions: the user exists
- authorization: `users:read` scope

### Request

#### Path Parameters

| Name | Type | Constraints / Meaning |
|---|---|---|
| id | string | User ID returned by POST /users, such as `usr_01J0CORE` |

#### Query Parameters

| Name | Type | Required | Constraints / Meaning |
|---|---|---|---|
| include | string | no | `summary` \| `profile`. Defaults to `summary`; `profile` includes the `profile` object |

#### Headers

| Name | Required | Type | Constraints / Meaning |
|---|---|---|---|
| If-None-Match | no | string | Send a previously returned ETag to allow a 304 response |

#### Cookie Parameters

none

#### Body

none

### Response 200

**body_presence**: unknown

**media_type**: application/json

**body_nullable**: no

```json
{"id":"usr_01J0CORE","email":"taro@example.com","name":"Taro Yamada","profile":{"timezone":"Asia/Tokyo"}}
```

| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| $ | object | always | no | Additional properties forbidden |
| id | string | always | no | Opaque user ID |
| email | string | always | no | User email address |
| name | string | always | no | User display name |
| profile | object | Present when `include=profile` | no | Additional properties forbidden |
| profile.timezone | string | always | no | IANA time zone name |

#### Response Headers

| Name | Type | Presence | Meaning |
|---|---|---|---|
| ETag | string | always | Use as `If-None-Match` for reads or `If-Match` for updates |
| X-Request-ID | string | unknown | Log with support requests |

**unknown**: response body presence and X-Request-ID presence are not documented; requires service-owner response contract for GET /users/{id}

### Response 304

none

#### Response Headers

| Name | Type | Presence | Meaning |
|---|---|---|---|
| ETag | string | always | Current validator for the unchanged representation |

### Errors

none

### Related

- Update: PATCH /users/{id}

## PATCH /users/{id}

Updates editable user profile fields.

### Behavior

- side_effects: updates the user resource and records an audit event on success
- idempotency: not idempotent unless the same request body and `If-Match` value are reused against the same representation
- preconditions: fetch the user first and send the returned ETag in `If-Match`
- authorization: `users:write` scope

### Request

#### Path Parameters

| Name | Type | Constraints / Meaning |
|---|---|---|
| id | string | User ID returned by POST /users, such as `usr_01J0CORE` |

#### Query Parameters

none

#### Headers

| Name | Required | Type | Constraints / Meaning |
|---|---|---|---|
| If-Match | yes | string | ETag returned by GET /users/{id}; required for optimistic concurrency |

#### Cookie Parameters

none

#### Body

**body_required**: yes

**media_type**: application/json

**body_nullable**: no

```json
{"name":"Taro Yamada Jr.","role":"member"}
```

| Field | Type | Required | Nullable | Constraints / Meaning |
|---|---|---|---|---|
| $ | object | yes | no | Additional properties forbidden |
| name | string | no | no | 1-100 characters; updatable |
| role | string | no | no | `admin` \| `member`; updatable |
| email | string | no | no | Not updatable; omit this field. Sending it returns 422 |

### Response 200

**body_presence**: always

**media_type**: application/json

**body_nullable**: no

```json
{"id":"usr_01J0CORE","email":"taro@example.com","name":"Taro Yamada Jr.","role":"member","updated_at":"2026-07-09T03:05:00Z"}
```

| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| $ | object | always | no | Additional properties forbidden |
| id | string | always | no | Opaque user ID |
| email | string | always | no | User email address |
| name | string | always | no | User display name |
| role | string | always | no | `admin` or `member` |
| updated_at | string | always | no | RFC 3339 update timestamp |

#### Response Headers

| Name | Type | Presence | Meaning |
|---|---|---|---|
| ETag | string | always | New validator for the updated representation |

### Errors

| Status | code | Shape | Condition | Caller action |
|---|---|---|---|---|
| 412 | etag_mismatch | inline:etag-error | `If-Match` does not match the current user representation | No change is applied. Fetch the user again, merge changes, and retry with the new ETag |
| 422 | validation_failed | common:validation-error | Request validation failed | Show field-level errors when present. Do not retry unchanged input |

412 etag_mismatch inline:etag-error:

**error_shape**: etag-error

**body_presence**: always

**media_type**: application/json

**body_nullable**: no

```json
{"error":{"code":"etag_mismatch","message":"resource was modified"}}
```

| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| $ | object | always | no | Additional properties forbidden |
| error | object | always | no | Error envelope; additional properties forbidden |
| error.code | string | always | no | Always `etag_mismatch` |
| error.message | string | always | no | Developer-facing message; do not display directly to users |

- Response Headers: none

### Related

- Fetch before update: GET /users/{id}

## GET /users/{id}/manager-tree

Fetches the user's management hierarchy.

### Behavior

- side_effects: none
- idempotency: idempotent and safe to retry
- preconditions: the user exists
- authorization: `users:read` scope

### Request

#### Path Parameters

| Name | Type | Constraints / Meaning |
|---|---|---|
| id | string | User ID returned by POST /users, such as `usr_01J0CORE` |

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

**unsupported**: replaces response representation 200 application/json: directly recursive manager tree schema at fixtures/core-openapi.yaml#/components/schemas/UserNode

- Response Headers: none

### Errors

none

### Related

none
