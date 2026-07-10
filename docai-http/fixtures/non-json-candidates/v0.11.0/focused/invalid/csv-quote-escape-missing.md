# invalid: CSV quote escape missing

Expected: invalid non-JSON candidate. CSV responses must state quote and escape behavior.

````markdown
### Response 200

**body_presence**: always

**media_type**: text/csv;charset=UTF-8

**body_nullable**: no

```csv
report_id,title,total
rpt_01K0CSV,"Q2, statement",1200
```

The CSV is UTF-8. The delimiter is comma(`,`). The record separator on the wire is CRLF. The first record is a header row. The column order is exactly `report_id`, `title`, `total`.

| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| report_id | string | always | no | First column; report ID |
| title | string | always | no | Second column |
| total | int | always | no | Third column; report total in JPY |

#### Response Headers

| Name | Type | Presence | Meaning |
|---|---|---|---|
| Content-Disposition | string | always | Attachment filename for the CSV export, such as `reports.csv` |
````
