# invalid: multiple media-type missing branching

Expected: invalid complete conformance. Multiple response media types omit the caller-visible selection and `Content-Type` branching rule.

````markdown
### Response 200

**body_presence**: always

**media_type**: application/json

**body_nullable**: no

```json
{"report_id":"rpt_01K0COMPLETE","total":1200}
```

| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| report_id | string | always | no | Report ID |
| total | int | always | no | Total in JPY |

**media_type**: application/xml

**body_nullable**: no

```xml
<report><report_id>rpt_01K0COMPLETE</report_id><total>1200</total></report>
```

| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| report_id | string | always | no | `<report_id>` element |
| total | int | always | no | `<total>` element |

- Response Headers: none
````
