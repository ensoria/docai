> docai-http: 0.11.0 | profile: full | coverage: complete | knowledge: complete | generated: 2026-07-10 | generation_id: non-json-candidate-full-20260710-001 | projection_id: non-json-candidate-20260710-001 | source: fixtures/non-json-candidate-openapi.yaml (OpenAPI 3.1.1) | source_revision: fixture-revision-non-json-candidate-001 | x-fixture: non-json-candidate

## PUT /avatars/{id}/image

Uploads raw PNG bytes for an avatar image.

### Behavior

- side_effects: replaces the avatar image for the user
- idempotency: idempotent when the same bytes and Digest value are retried for the same user
- preconditions: the user exists
- authorization: authenticated user

### Request

#### Path Parameters

| Name | Type | Constraints / Meaning |
|---|---|---|
| id | string | User ID, such as `usr_01K0BIN` |

#### Query Parameters

none

#### Headers

| Name | Required | Type | Constraints / Meaning |
|---|---|---|---|
| Digest | yes | string | `sha-256=<base64>` over the exact body bytes; single field line only; not comma-combinable; order not significant; example `Digest: sha-256=47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=` |

#### Cookie Parameters

none

#### Body

**body_required**: yes

**media_type**: image/png

```http
Content-Type: image/png
Content-Length: 524288
Digest: sha-256=47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=

<binary PNG bytes, maximum 2097152 bytes>
```

The request body is raw binary PNG bytes with no multipart wrapper. Maximum size is 2097152 bytes. Calculate the `Digest` header from the exact body bytes using SHA-256 before upload.

### Response 204

none

- Response Headers: none

### Errors

none

### Related

- Download: GET /avatars/{id}/image

## GET /avatars/{id}/image

Downloads raw PNG bytes for an avatar image.

### Behavior

- side_effects: none
- idempotency: idempotent and safe to retry
- preconditions: the avatar image exists
- authorization: authenticated user

### Request

#### Path Parameters

| Name | Type | Constraints / Meaning |
|---|---|---|
| id | string | User ID, such as `usr_01K0BIN` |

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

**media_type**: image/png

```http
Content-Type: image/png
Content-Disposition: attachment; filename="avatar.png"
Content-Length: 524288
Digest: sha-256=47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=

<binary PNG bytes, maximum 2097152 bytes>
```

Filename is obtained from the `Content-Disposition` header. Maximum size is 2097152 bytes. Verify the `Digest` header against the exact response body bytes using SHA-256 before storing the file.

#### Response Headers

| Name | Type | Presence | Meaning |
|---|---|---|---|
| Content-Disposition | string | always | Attachment filename for the image, such as `avatar.png` |
| Content-Length | int | always | Exact response body size in bytes; maximum is 2097152 |
| Digest | string | always | `sha-256=<base64>` over the exact response body bytes; verify before storing |

### Errors

none

### Related

- Upload: PUT /avatars/{id}/image
