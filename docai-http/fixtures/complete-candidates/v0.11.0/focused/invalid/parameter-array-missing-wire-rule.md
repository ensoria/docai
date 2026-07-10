# invalid: parameter array missing wire rule

Expected: invalid complete candidate. A represented array query parameter omits its exact wire serialization and encoded example.

````markdown
#### Query Parameters

| Name | Type | Required | Constraints / Meaning |
|---|---|---|---|
| ids | string[] | yes | List of user IDs |
| filter | object | no | encoded example `filter[role]=member` |

##### Fields

**parameter**: filter

| Field | Type | Required | Constraints / Meaning |
|---|---|---|---|
| role | string | no | `admin` \| `member` |
````
