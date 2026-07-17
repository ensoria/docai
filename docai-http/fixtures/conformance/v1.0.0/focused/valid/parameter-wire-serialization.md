# valid: parameter wire serialization

Expected: valid complete conformance. Array, object, repeated header, repeated cookie, encoded examples, and empty-value semantics are explicit.

````markdown
#### Query Parameters

| Name | Type | Required | Constraints / Meaning |
|---|---|---|---|
| ids | string[] | yes | style=form, explode=false; encoded example `ids=usr_01K0COMPLETE,usr_01K0SECOND`; empty array is invalid |
| filter | object | no | style=deepObject, explode=true; encoded example `filter[role]=member&filter[active]=true`; omitted filter means no filter; empty object is invalid; `null` is invalid |

##### Fields

**parameter**: filter

| Field | Type | Required | Constraints / Meaning |
|---|---|---|---|
| role | string | no | `admin` \| `member` |
| active | bool | no | `true` includes active users only |

#### Headers

| Name | Required | Type | Constraints / Meaning |
|---|---|---|---|
| X-Trace-Tag | no | string[] | Repeated field lines allowed; not comma-combinable; order significant; example `X-Trace-Tag: import` then `X-Trace-Tag: priority` |

#### Cookie Parameters

| Name | Type | Required | Constraints / Meaning |
|---|---|---|---|
| experiment | string[] | no | Repeated cookie values use separate `Cookie` header pairs; not comma-combinable; order not significant; example `Cookie: experiment=A; experiment=B` |
````
