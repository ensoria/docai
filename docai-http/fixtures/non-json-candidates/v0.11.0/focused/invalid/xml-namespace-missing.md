# invalid: XML namespace missing

Expected: invalid non-JSON candidate. XML responses must state namespace URIs and namespace matching rules.

````markdown
### Response 200

**body_presence**: always

**media_type**: application/xml;charset=UTF-8

**body_nullable**: no

```xml
<?xml version="1.0" encoding="UTF-8"?>
<report id="rpt_01K0XML" status="final">
  <title>Q2 statement</title>
  <total currency="JPY">1200</total>
  <updated_at>2026-07-10T00:00:00Z</updated_at>
</report>
```

The XML is UTF-8. The XML declaration encoding is UTF-8. Element order is fixed: `title`, `total`, `audit:updated_at`. Attributes are unordered. No mixed content is used.

| Node | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| /report | object | always | no | Root element |
| /report/@id | string | always | no | Attribute; report ID |
| /report/@status | enum(final, draft) | always | no | Attribute; report status |
| /report/title | string | always | no | First child element |
| /report/total | int | always | no | Second child element |
| /report/total/@currency | enum(JPY, USD) | always | no | Attribute; currency code for total |
| /report/audit:updated_at | datetime | always | no | Third child element |
````
