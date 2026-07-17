# valid: enum documentation

Expected: valid complete conformance. Standardized full-set enums reference the standard with edition/source guidance; API-specific subsets enumerate every allowed value.

````markdown
#### Body

**body_required**: yes

**media_type**: application/json

**body_nullable**: no

```json
{"currency":"JPY","role":"member","country":"JP"}
```

| Field | Type | Required | Nullable | Constraints / Meaning |
|---|---|---|---|---|
| currency | string | yes | no | Any ISO 4217 currency code from the current ISO 4217 maintenance agency list; clients must not hard-code a closed set and should defer final validation to the server |
| country | string | yes | no | Any ISO 3166-1 alpha-2 country code from the 2026-07-10 source snapshot; clients must not hard-code a closed set |
| role | string | yes | no | `admin` \| `member`; closed API-specific subset |
````
