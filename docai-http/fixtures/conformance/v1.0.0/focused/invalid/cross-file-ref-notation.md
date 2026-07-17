# invalid: cross-file reference notation

Expected: invalid complete conformance. Cross-file schema reference notation such as `$ref` is used instead of inline DocAI HTTP fields or compact `**same_as**:`.

````markdown
### Response 200

**body_presence**: always

**media_type**: application/json

**body_nullable**: no

```json
{"$ref":"#/components/schemas/User"}
```

| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| $ref | string | always | no | Reference to `#/components/schemas/User` |
````
