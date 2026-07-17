# invalid: any used for missing type

Expected: invalid complete conformance. `any` is not a substitute for missing type knowledge; missing type facts use `Type=unknown` and a required `**unknown**:` marker.

````markdown
### Response 200

**body_presence**: always

**media_type**: application/json

**body_nullable**: no

```json
{"payload":{"source":"not documented"}}
```

| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| payload | any | always | no | Type is not documented in the authoritative source |
````
