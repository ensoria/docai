# invalid: XML node table missing

Expected: invalid non-JSON candidate. XML responses must map elements and attributes to a node table.

````markdown
### Response 200

**body_presence**: always

**media_type**: application/xml;charset=UTF-8

**body_nullable**: no

```xml
<?xml version="1.0" encoding="UTF-8"?>
<report xmlns="https://api.example.com/reports" xmlns:audit="https://api.example.com/audit" id="rpt_01K0XML" status="final">
  <title>Q2 statement</title>
  <total currency="JPY">1200</total>
  <audit:updated_at>2026-07-10T00:00:00Z</audit:updated_at>
</report>
```

The XML is UTF-8. The XML declaration encoding is UTF-8. The default namespace URI is `https://api.example.com/reports`. The audit namespace URI is `https://api.example.com/audit`. Consumers match namespace URIs, not lexical prefixes. Element order is fixed: `title`, `total`, `audit:updated_at`. Attributes are unordered. No mixed content is used.
````
