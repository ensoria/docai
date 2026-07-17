# valid: non-JSON representation classes

Expected: valid complete conformance. Complete-surface non-JSON focused coverage includes form-urlencoded, raw binary upload and download, CSV, XML, and SSE representation shapes beyond multipart.

````markdown
#### Body

**body_required**: yes

**media_type**: application/x-www-form-urlencoded;charset=UTF-8

**body_nullable**: no

```http
Content-Type: application/x-www-form-urlencoded; charset=UTF-8

q=quarterly+statement&tag=finance&tag=quarterly
```

Encode the form body as UTF-8 before percent-encoding. Encode spaces as `+`. Repeated `tag` values are sent by repeating the field once per value.

| Field | Type | Required | Nullable | Constraints / Meaning |
|---|---|---|---|---|
| q | string | yes | no | Form field `q`; empty string rejected |
| tag | string[] | no | no | Repeat `tag` once per value; omit the field when the list is empty |

#### Body

**body_required**: yes

**media_type**: image/png

```http
Content-Type: image/png
Content-Length: 524288
Digest: sha-256=47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=

<binary PNG bytes, maximum 2097152 bytes>
```

The request body is raw binary PNG bytes with no multipart wrapper. Maximum size is 2097152 bytes. Calculate the `Digest` header from the exact body bytes using SHA-256 before upload.

### Response 200

**body_presence**: always

**media_type**: image/png

```http
Content-Type: image/png
Content-Disposition: attachment; filename="avatar.png"
Content-Length: 524288
Digest: sha-256=47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=

<binary PNG bytes, maximum 2097152 bytes>
```

Filename is obtained from the `Content-Disposition` header. Maximum size is 2097152 bytes. Verify the `Digest` header against the exact response body bytes using SHA-256 before storing the file.

#### Response Headers

| Name | Type | Presence | Meaning |
|---|---|---|---|
| Content-Disposition | string | always | Attachment filename for the image, such as `avatar.png` |
| Content-Length | int | always | Exact response body size in bytes; maximum is 2097152 |
| Digest | string | always | `sha-256=<base64>` over the exact response body bytes; verify before storing |

### Response 200

**body_presence**: always

**media_type**: text/csv;charset=UTF-8

**body_nullable**: no

```csv
report_id,title,total
rpt_01K0CSV,"Q2, statement",1200
```

The CSV is UTF-8. The delimiter is comma(`,`). The record separator on the wire is CRLF. The first record is a header row. The column order is exactly `report_id`, `title`, `total`. Fields containing comma, quote, CR, or LF are quoted with double quotes; a double quote inside a field is escaped as two double quotes.

| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| report_id | string | always | no | First column; report ID |
| title | string | always | no | Second column; quoted when required by CSV rules |
| total | int | always | no | Third column; report total in JPY |

### Response 200

**body_presence**: always

**media_type**: application/xml;charset=UTF-8

**body_nullable**: no

```xml
<?xml version="1.0" encoding="UTF-8"?>
<report xmlns="https://api.example.test/reports" id="rpt_01K0XML" status="final"><title>Q2 statement</title><total currency="JPY">1200</total></report>
```

The XML is UTF-8. The XML declaration encoding is UTF-8. The namespace URI is `https://api.example.test/reports`. Consumers match namespace URIs, not lexical prefixes. Element order is fixed: `title`, then `total`. Attributes are unordered.

| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| /report | object | always | no | Root element in the namespace `https://api.example.test/reports` |
| /report/@id | string | always | no | Attribute; report ID |
| /report/@status | enum(final, draft) | always | no | Attribute; report status |
| /report/title | string | always | no | First child element |
| /report/total | int | always | no | Second child element |
| /report/total/@currency | enum(JPY, USD) | always | no | Attribute; currency code for total |

### Response 200

**body_presence**: always

**media_type**: text/event-stream;charset=UTF-8

```sse
retry: 5000

id: evt_01K0SSE001
event: report.progress
data: {"report_id":"rpt_01K0SSE","state":"processing","percent":40}

id: evt_01K0SSE002
event: stream.end
data: {"reason":"complete"}
```

The stream is UTF-8. Each SSE frame is terminated by a blank line. Each event frame uses exactly one `id:` line, exactly one `event:` line, and one `data:` line. The `data:` line contains one compact JSON object. Event names are exactly `report.progress` and `stream.end`. The `retry:` field is 5000 milliseconds and may appear before the first event. Clients reconnect after transport errors using the `Last-Event-ID` request header. The `stream.end` event is terminal; after receiving it, clients must not reconnect for this stream.

- Response Headers: none
````
