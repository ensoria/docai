# valid: single prose language with English structure

Expected: valid complete conformance. Prose uses one non-English document language while structural text stays in English.

````markdown
## POST /users

Crea un usuario para el portal.

### Behavior

- side_effects: Envia un correo de bienvenida cuando `send_invite=true`
- idempotency: No es idempotente; no reintentar sin una clave de idempotencia
- preconditions: El correo no existe en el tenant
- authorization: Requiere scope `users:write`

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

| Field | Type | Required | Nullable | Constraints / Meaning |
|---|---|---|---|---|
| email | string | yes | no | Correo unico del usuario |
| name | string | yes | no | Nombre visible |

### Response 201

**body_presence**: always

**media_type**: application/json

**body_nullable**: no

```json
{"id":"usr_01K0COMPLETE","email":"taro@example.com","name":"Taro Yamada"}
```

| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| id | string | always | no | Identificador del usuario |
| email | string | always | no | Correo del usuario |
| name | string | always | no | Nombre visible |

- Response Headers: none

### Errors

none

### Related

none
````
