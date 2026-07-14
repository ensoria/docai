# invalid: duplicate media-type representation

Expected: invalid complete candidate. The same concrete media type must not appear twice inside one response; same-media alternatives use variants or `unsupported`.

````markdown
### Response 200

**body_presence**: always

**media_type**: application/json

**body_nullable**: no

```json
{"kind":"summary","total":1200}
```

| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| kind | string | always | no | Always `summary` |
| total | int | always | no | Total in JPY |

**media_type**: application/json

**body_nullable**: no

```json
{"kind":"detail","items":[]}
```

| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| kind | string | always | no | Always `detail` |
| items | object[] | always | no | Detail rows |

- Response Headers: none
````
