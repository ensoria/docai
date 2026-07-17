# invalid: structural identifier spelling

Expected: invalid complete conformance. Method, path, response status, and media type use non-canonical structural spelling.

````markdown
## get reports/{id}?download=true

Downloads a report.

### Response 60X

**body_presence**: always

**media_type**: Application/JSON; charset=UTF-8

**body_nullable**: no

```json
{"id":"rpt_01K0COMPLETE"}
```

| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| id | string | always | no | Report ID |
````
