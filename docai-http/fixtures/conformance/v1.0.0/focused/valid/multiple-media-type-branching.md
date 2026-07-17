# valid: multiple media-type branching

Expected: valid complete conformance. Multiple concrete media types each carry their own representation, and response prose tells the caller how to branch.

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
<?xml version="1.0" encoding="UTF-8"?>
<report xmlns="https://api.example.test/reports"><report_id>rpt_01K0COMPLETE</report_id><total>1200</total></report>
```

XML uses UTF-8, namespace `https://api.example.test/reports`, child elements in the order `report_id`, then `total`, and no attributes.

| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| report_id | string | always | no | `<report_id>` element |
| total | int | always | no | `<total>` element |

- Response Headers: none

The request `Accept` header selects `application/json` or `application/xml`; branch on the response `Content-Type` before parsing.
````
