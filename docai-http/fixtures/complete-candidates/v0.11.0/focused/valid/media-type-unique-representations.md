# valid: unique media-type representations

Expected: valid complete candidate. Each concrete media type appears at most once inside the containing response.

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

**media_type**: text/csv;charset=UTF-8

**body_nullable**: no

```csv
report_id,total
rpt_01K0COMPLETE,1200
```

CSV uses comma delimiter, CRLF record separators, a header row, and column order `report_id,total`.

- Response Headers: none
````
