# invalid: field_defaults unknown value

Expected: invalid complete candidate. `field_defaults` cannot use `unknown` as a default value; compact tables with unknown cells must retain the affected column and marker.

````markdown
**field_defaults**: Presence=unknown | Nullable=no

| Field | Type | Meaning |
|---|---|---|
| $ | object | Additional properties forbidden |
| id | string | User ID |
````
