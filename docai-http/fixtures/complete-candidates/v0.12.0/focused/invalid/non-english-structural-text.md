# invalid: non-English structural text

Expected: invalid complete candidate. Structural headings and table column headers must remain English even when prose uses another language.

````markdown
## POST /users

Crea un usuario para el portal.

### Comportamiento

- side_effects: Envia un correo de bienvenida
- idempotency: No es idempotente
- preconditions: none
- authorization: Requiere scope `users:write`

### Solicitud

- Path Parameters: none
- Query Parameters: none
- Headers: none
- Cookie Parameters: none

#### Body

**body_required**: yes

**media_type**: application/json

**body_nullable**: no

```json
{"email":"taro@example.com"}
```

| Campo | Tipo | Required | Nullable | Constraints / Meaning |
|---|---|---|---|---|
| email | string | yes | no | Correo unico del usuario |
````
