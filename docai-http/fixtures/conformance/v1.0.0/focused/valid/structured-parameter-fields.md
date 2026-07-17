# valid: structured parameter fields

Expected: valid complete conformance. A represented object query parameter has exact serialization, an encoded example, and complete structured-parameter fields.

````markdown
#### Query Parameters

| Name | Type | Required | Constraints / Meaning |
|---|---|---|---|
| filter | object | no | style=form, explode=true; encoded example `filter[name]=Taro&filter[role]=member`; additional properties forbidden |

##### Fields

**parameter**: filter

| Field | Type | Required | Constraints / Meaning |
|---|---|---|---|
| name | string | no | Filter by display name |
| role | string | no | `admin` \| `member` |
````
