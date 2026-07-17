# invalid: field_defaults retained column

Expected: invalid complete conformance. A table that declares a `field_defaults` column must omit that defaulted column from the compact table.

````markdown
**field_defaults**: Presence=always | Nullable=no

| Field | Type | Presence | Meaning |
|---|---|---|---|
| $ | object | always | Additional properties forbidden |
| id | string | always | User ID |
````
