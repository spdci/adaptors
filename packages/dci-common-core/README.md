# language-dci-common-core <img src='./assets/square.png' width="30" height="30"/>

An OpenFn **_adaptor_** for building integration jobs against the
[DCI (Digital Convergence Initiative) Core interoperability API](https://standards.spdci.org/standards) —
the generalized `/registry/*` API that every DCI registry extension (CRVS,
Social Registry, Disability Registry, IBR, ESS, FR, EWS, ...) is built on top
of.

One important structural fact drives this adaptor's design: every DCI
extension (CRVS, Disability Registry, IBR, Social Registry, ESS, Farmer
Registry) shares the **exact same `/registry/*` envelope** as Core —
`reg_type` is a free string the *caller* supplies, never hardcoded per
extension. So this single adaptor covers every interface, not just Core:

1. **Search** — `search()` (async, `/registry/search`) and `searchSync()`
   (sync, `/registry/sync/search`)
2. **Event subscription** — `subscribe()` (`/registry/subscribe`) and
   `unsubscribe()` (`/registry/unsubscribe`)
3. **Request status check** — `checkTxnStatus()` (`/registry/txn/status`)

— plus a handful of extra operations for the few endpoints that genuinely
differ per extension (DR, IBR, ESS — see
[Interfaces](#interfaces-crvs-dr-ibr-social-ess-fr-ews) below).

It also provides a generic **object mapper** — `toDCI()` / `fromDCI()` —
for converting local data into/out of any DCI data object (`Person`,
`Member`, `Group`, and interface-specific objects like `CRVSPerson`,
`DisabilitySupport`, `IBRPerson`, `FRPerson`, ..., per `configuration.schema`),
driven by `configuration.mapping` and an optional `configuration.codeLists`
for controlled-vocabulary lookups. This is how you convert non-DCI-compliant
local data into DCI-compliant data: **one `configuration` per interface**,
with your own field mapping against that interface's DCI object — see
[Interfaces](#interfaces-crvs-dr-ibr-social-ess-fr-ews) for which `schema`
value and operations to use per interface, and
[Onboarding a country / local system](#onboarding-a-country--local-system)
for a full walkthrough and a runnable example. Nested objects
(e.g. `Member.demographic_info`, `Group.group_head_info`) can nest another
schema's mapping. List fields (e.g. multiple identifiers, `Group.member_list`,
`CapAlert.info`) aren't supported — map those manually in job code.

Every HTTP operation builds the standard DCI envelope (`{ signature, header,
message }`) for you: the `header` (`message_id`, `message_ts`, `action`,
`sender_id`, `receiver_id`, `total_count`, ...) is generated from your
`configuration` plus sane defaults, per `MsgHeader_V1.0.0`. You only need to
supply the `message` payload described by each operation's DCI request
schema (`SearchRequest`, `SubscribeRequest`, `UnSubscribeRequest`,
`TxnStatusRequest`).

**Implementing this for a country?** Start with the
[Implementation guide](./IMPLEMENTATION_GUIDE.md) — a step-by-step walkthrough
from choosing interfaces to go-live checklist.

## Where does `data` come from?

This adaptor implements **only the DCI registry side**. It does not connect
to a country's database or existing API at all — that's intentional, and
matches how every OpenFn adaptor works: one adaptor per external system,
chained together in a workflow. A real integration is typically three
steps:

```
Step 1: postgresql / mysql / http / odoo / dhis2 / ... adaptor
        -> queries the country's actual local system (a database, or an
           existing API — whichever adaptor matches it)
        -> state.data = raw local record, in the country's own field names

Step 2: dci-common-core (this adaptor)
        -> toDCI()                          maps state.data into the DCI shape
        -> search() / subscribe() / etc.    talks to the DCI registry over HTTP
        -> fromDCI()                        maps the response back

Step 3 (optional): postgresql / mysql / http / ... adaptor again
        -> writes the result back into the local system
```

Whether the local system is a raw database or an existing API changes which
adaptor goes in Step 1/3 — not anything about this adaptor. `get`/`post`/
`request` here exist only for calling the DCI registry itself (or a
registry extension endpoint not yet wrapped by a named operation) — not for
a country's local system.

**[examples/workflow-template/](./examples/workflow-template/)** has a
ready-to-adapt 3-step template for exactly this — using `@openfn/language-http`
for Steps 1/3 (an existing local API); swap those two files for a database
adaptor (`postgresql`/`mysql`/`mssql`) if the local system is a database
instead.

## Not yet implemented

- **Signing**: real cryptographic message signing (`MsgSignature`, ed25519)
  is out of scope for this version. If you have a pre-computed signature,
  pass it via the `options.signature` argument and it will be attached to
  the envelope; otherwise the `signature` field is omitted.
- **Callback endpoints**: `on-search`, `on-subscribe`, `notify`, and
  `on-unsubscribe` are inbound endpoints implemented by the receiving
  SPMIS/webhook, not outbound calls a job makes — they're not covered here.

## Interfaces (crvs, dr, ibr, social, ess, fr, ews)

For each interface: which `configuration.schema` value(s) to map against
with `toDCI()`/`fromDCI()`, and which operations are relevant. `search`,
`searchSync`, `subscribe`, `unsubscribe`, `checkTxnStatus` work identically
for every interface (see above) — only the extra column below is
interface-specific code.

| Interface | `schema` value(s) | Extra operations | Notes |
|---|---|---|---|
| **Core** (generic) | `Person`, `Member`, `Group` | — | The base objects; also shared by Social and ESS below. |
| **CRVS** | `CRVSPerson` | — | Modeled on `extensions/dci/Person.yaml` (the schema crvs's own `SearchResponse` actually references — `extensions/crvs/Person.yaml` is unused in the spec). |
| **DR** (Disability Registry) | `DisabledPerson`, `DisabilityInfo`, `DisabilitySupport` | `getDisabilitySupport()`, `getDisabilityDetails()`, `checkDisabled()` | Three distinct data objects for three distinct sync endpoints. |
| **IBR** (Inclusive/Beneficiary Registry) | `IBRPerson`, `Beneficiary` (`Member`/`Group` also apply) | `submitEnrollmentUpdates()`, `checkEnrolled()` | These two operations return the **raw response body**, not the usual `{ signature, header, message }` envelope — a real inconsistency in the spec, not a simplification made here. |
| **Social** (Social Registry) | `Person`, `Group` | — | Uses the shared Core objects directly — no extra schema needed. |
| **ESS** (Employment Support System) | `Member` | `checkEnrollment()` | Its request uses the literal (typo'd) action `"enrollementstatus"`, per the spec. Its own `/registry/sync/txn/status` is a YAML indentation bug in the spec (nests under `check-enrollment` instead of being a sibling path) — use the generic async `checkTxnStatus()` instead. |
| **FR** (Farmer Registry) | `FRPerson` | — | Deeply nested (person + household + farm + livestock + equipment); the mapping covers personal/family details only — farm/machinery lists aren't supported, map those manually. Note `famer_personal_details` is the DCI spec's own (typo'd) field name, not a typo introduced here. |
| **EWS** (Early Warning System) | `AlertFeature` | — | No search/status endpoints exist in the spec for ews at all — only `subscribe()`/`unsubscribe()`/`notify` apply, all already covered. `AlertFeature` is a CAP 1.2 alert embedded in a GeoJSON Feature — the one interface with fully-specified (not example-only) schemas. |

A country using, say, only the DR interface sets `configuration.schema` to
whichever DR object they need (e.g. `DisabilitySupport`) and calls
`getDisabilitySupport()` — they never touch `CRVSPerson`, `FRPerson`, or any
other interface's shape. Each interface's exact `mapping` shape is
documented as a JSON-Schema `definition` in
[configuration-schema.json](./configuration-schema.json) (e.g.
`crvsPersonMapping`, `disabilitySupportMapping`, `ibrPersonMapping`,
`frPersonMapping`, `alertFeatureMapping`) — inspect it, or your OpenFn
credential editor's autocomplete, for the full field list per interface.

Several extension data objects in the DCI spec itself are example-only (no
formal `properties:` schema) or contain malformed example JSON (noted where
relevant above) — the mapping shapes here were hand-derived from those
examples and verified against `toDCI()`/`fromDCI()` directly (see
`test/interface-mapping.test.js`), not generated mechanically from a schema.

**[examples/configurations/](./examples/configurations/)** has a ready-to-copy,
schema-validated `configuration` file for all 7 interfaces (core, crvs, dr,
ibr, social, ess, fr, ews) — 14 files total, one per interface/schema
combination (DR has three, one per sync endpoint's data object; Social has
two). Pick only the ones for the interfaces you actually implement.

For the generic escape hatch, `get`/`post`/`request` are available if you
need to call an endpoint (including an extension's endpoints, e.g.
`/crvs/...`) that isn't wrapped by a named operation yet.

## Onboarding a country / local system

Nothing in this adaptor's code changes between countries or systems — only
`configuration` does. There are two groups of settings to fill in:

1. **Connection & identity** — which registry you're talking to, and who
   you are to it: `baseUrl`, `sender_id`, `receiver_id`, `sender_uri`,
   `authentication`. Get these from whoever operates the registry (DCI
   sandbox/production onboarding).
2. **Field mapping** — how *your* system's field names line up with the DCI
   vocabulary: `schema` (`Person` | `Member` | `Group`), `mapping`, and
   optionally `codeLists` for value translation (e.g. your `M`/`F` → DCI's
   `male`/`female`). See `configuration-schema.json` for the exact shape
   per `schema` value, or the `Person`/`Member`/`Group` examples in
   [test/mapping.test.js](./test/mapping.test.js).

### 1. Write your configuration

Every `mapping` leaf is either:

- a **source field name** from your local record (`"firstName"`), or
- a **constant**, written with a leading `=` (`"=NationalID"`), or
- a **date object** `{ source, sourceFormat, targetFormat }` for fields that
  need reformatting into DCI's ISO 8601 style.

```json
{
  "baseUrl": "https://sandbox.spdci.org/socialregistry/v1.0.0",
  "sender_id": "mis.country-x.gov",
  "receiver_id": "socialregistry.country-x.gov",
  "authentication": { "type": "bearer", "token": "REPLACE_ME" },

  "schema": "Person",
  "mapping": {
    "identifier": {
      "identifier_type": "=NationalID",
      "identifier_value": "citizen_id"
    },
    "name": { "given_name": "firstName", "surname": "lastName" },
    "sex": "gender",
    "birth_date": {
      "source": "dob",
      "sourceFormat": "DD/MM/YYYY",
      "targetFormat": "YYYY-MM-DDTHH:mm:ss"
    },
    "phone_number": "mobile"
  },
  "codeLists": {
    "sex": { "M": "male", "F": "female" }
  }
}
```

The left-hand keys (`identifier`, `name`, `sex`, ...) are fixed by the DCI
schema — don't rename those. The right-hand values are yours to change to
match whatever your database/MIS/spreadsheet actually calls those fields.

### 2. Runnable examples

Set up once:

```bash
npm install -g @openfn/cli
export OPENFN_ADAPTORS_REPO=/path/to/adaptors   # this monorepo's root
cd packages/dci-common-core
pnpm install
pnpm build
```

Each example below is a `tmp/state-*.json` + `tmp/expression-*.js` pair
(already checked into `tmp/`, which is gitignored — edit them directly to
try your own fields), run from the **repo root** with:

```bash
openfn tmp/expression-<name>.js -ma dci-common-core -s tmp/state-<name>.json -o tmp/output-<name>.json
```

All three outputs below were produced by actually running that command
against this adaptor, not hand-typed.

#### Person — `tmp/state.json` + `tmp/expression.js`

`data` is one raw record from your local system, in *your* field names;
`configuration.mapping` translates it into a DCI `Person`
(`schemas/core/v1/data/Person.jsonld`):

```json
{
  "configuration": {
    "baseUrl": "https://sandbox.spdci.org/socialregistry/v1.0.0",
    "sender_id": "mis.country-x.gov",
    "receiver_id": "socialregistry.country-x.gov",
    "authentication": { "type": "bearer", "token": "REPLACE_ME" },
    "schema": "Person",
    "mapping": {
      "identifier": {
        "identifier_type": "=NationalID",
        "identifier_value": "citizen_id"
      },
      "name": { "given_name": "firstName", "surname": "lastName" },
      "sex": "gender",
      "birth_date": {
        "source": "dob",
        "sourceFormat": "DD/MM/YYYY",
        "targetFormat": "YYYY-MM-DDTHH:mm:ss"
      },
      "phone_number": "mobile"
    },
    "codeLists": {
      "sex": { "M": "male", "F": "female" }
    }
  },
  "data": {
    "citizen_id": "847951632",
    "firstName": "Sudarat",
    "lastName": "Phumchai",
    "gender": "F",
    "dob": "21/09/1995",
    "mobile": "+66811112222"
  }
}
```

Map the local record into a DCI `Person`, then use it to search the
registry for an existing match before enrolling:

```js
toDCI();
// state.data is now a DCI Person object

fn(state => {
  const person = state.data;
  return {
    ...state,
    query: {
      search_request: [
        {
          search_criteria: {
            reg_type: 'social',
            reg_record_type: 'PERSON',
            query_type: 'PREDICATE',
            query: {
              predicate_list: [
                {
                  attribute_name: 'identifier.identifier_value',
                  attribute_value: person.identifier.identifier_value,
                  operator: 'eq',
                },
              ],
            },
          },
        },
      ],
    },
  };
});

// Uncomment to actually call a live registry (needs a real baseUrl/token
// in tmp/state.json first):
// searchSync(state => state.query);

// Once a result comes back in state.data (a DCI Person from reg_records),
// map it back to your local field names, e.g. to update your own MIS:
// fromDCI();
```

```bash
openfn tmp/expression.js -ma dci-common-core -o tmp/output.json -s tmp/state.json
```

`toDCI()` produces this `state.data`:

```json
{
  "identifier": { "identifier_type": "NationalID", "identifier_value": "847951632" },
  "name": { "given_name": "Sudarat", "surname": "Phumchai" },
  "sex": "female",
  "birth_date": "1995-09-21T00:00:00",
  "phone_number": "+66811112222"
}
```

And `fromDCI()` applied to that same object round-trips it back to:

```json
{
  "citizen_id": "847951632",
  "firstName": "Sudarat",
  "lastName": "Phumchai",
  "gender": "female",
  "dob": "1995-09-21T00:00:00",
  "mobile": "+66811112222"
}
```

Note `gender`/`dob` come back as `female`/ISO-formatted rather than the
original `F`/`21/09/1995` — `fromDCI()` reverses the *field mapping*, not
the code-list/date transforms, so if your downstream system needs the
original local codes/format back, convert those two fields yourself after
calling `fromDCI()`.

#### Member — `tmp/state-member.json` + `tmp/expression-member.js`

A household member with demographic + socio-economic attributes, mapped to
`schemas/core/v1/data/Member.jsonld`. `demographic_info` nests a `Person`
mapping (same shape as the example above), so its `codeLists` entries nest
one level too — `codeLists.demographic_info.sex`, not `codeLists.sex`:

```json
{
  "configuration": {
    "baseUrl": "https://sandbox.spdci.org/socialregistry/v1.0.0",
    "sender_id": "mis.country-x.gov",
    "receiver_id": "socialregistry.country-x.gov",
    "authentication": { "type": "bearer", "token": "REPLACE_ME" },
    "schema": "Member",
    "mapping": {
      "member_identifier": {
        "identifier_type": "=UIN",
        "identifier_value": "member_id"
      },
      "demographic_info": {
        "name": { "given_name": "first_name", "surname": "last_name" },
        "sex": "gender"
      },
      "marital_status": "marital_code",
      "employment_status": "employment_code",
      "occupation": "job_title",
      "income_level": "income_band"
    },
    "codeLists": {
      "demographic_info": { "sex": { "M": "male", "F": "female" } },
      "marital_status": { "S": "single", "M": "married" },
      "employment_status": { "E": "employed", "U": "unemployed" }
    }
  },
  "data": {
    "member_id": "MB-021",
    "first_name": "Kwame",
    "last_name": "Mensah",
    "gender": "M",
    "marital_code": "M",
    "employment_code": "E",
    "job_title": "farmer",
    "income_band": "low"
  }
}
```

```js
toDCI();
// state.data is now a DCI Member object (with a nested demographic_info Person)

fn(state => {
  console.log('DCI Member:');
  console.log(JSON.stringify(state.data, null, 2));
  return state;
});
```

```bash
openfn tmp/expression-member.js -ma dci-common-core -s tmp/state-member.json -o tmp/output-member.json
```

`toDCI()` produces:

```json
{
  "member_identifier": { "identifier_type": "UIN", "identifier_value": "MB-021" },
  "demographic_info": {
    "name": { "given_name": "Kwame", "surname": "Mensah" },
    "sex": "male"
  },
  "marital_status": "married",
  "employment_status": "employed",
  "occupation": "farmer",
  "income_level": "low"
}
```

#### Group — `tmp/state-group.json` + `tmp/expression-group.js`

A household, mapped to `schemas/core/v1/data/Group.jsonld`.
`group_head_info` nests a `Member` mapping (which itself nests a `Person`
mapping via `demographic_info`), so `codeLists` nests two levels deep here —
`codeLists.group_head_info.demographic_info.sex`:

```json
{
  "configuration": {
    "baseUrl": "https://sandbox.spdci.org/socialregistry/v1.0.0",
    "sender_id": "mis.country-x.gov",
    "receiver_id": "socialregistry.country-x.gov",
    "authentication": { "type": "bearer", "token": "REPLACE_ME" },
    "schema": "Group",
    "mapping": {
      "group_identifier": {
        "identifier_type": "=HHID",
        "identifier_value": "household_id"
      },
      "group_type": "unit_type",
      "address": {
        "locality": "village",
        "region_code": "region",
        "country_code": "country"
      },
      "group_size": "num_members",
      "group_head_info": {
        "member_identifier": { "identifier_value": "head_id" },
        "demographic_info": {
          "name": {
            "given_name": "head_first_name",
            "surname": "head_last_name"
          },
          "sex": "head_gender"
        }
      }
    },
    "codeLists": {
      "group_head_info": {
        "demographic_info": { "sex": { "M": "male", "F": "female" } }
      }
    }
  },
  "data": {
    "household_id": "HH-777",
    "unit_type": "household",
    "village": "Riverside",
    "region": "Central",
    "country": "GH",
    "num_members": "5",
    "head_id": "HH-777-01",
    "head_first_name": "Ama",
    "head_last_name": "Boateng",
    "head_gender": "F"
  }
}
```

```js
toDCI();
// state.data is now a DCI Group object (with a nested group_head_info Member)

fn(state => {
  console.log('DCI Group:');
  console.log(JSON.stringify(state.data, null, 2));
  return state;
});
```

```bash
openfn tmp/expression-group.js -ma dci-common-core -s tmp/state-group.json -o tmp/output-group.json
```

`toDCI()` produces:

```json
{
  "group_identifier": { "identifier_type": "HHID", "identifier_value": "HH-777" },
  "group_type": "household",
  "address": {
    "locality": "Riverside",
    "region_code": "Central",
    "country_code": "GH"
  },
  "group_size": "5",
  "group_head_info": {
    "member_identifier": { "identifier_value": "HH-777-01" },
    "demographic_info": {
      "name": { "given_name": "Ama", "surname": "Boateng" },
      "sex": "female"
    }
  }
}
```

### 3. Calling `searchSync()` and mapping results back

The three examples above only build the mapped object and (for Person) the
search query — they don't call a live registry, since `tmp/state*.json`
only has placeholder credentials. Here's the full round trip: map a local
record → search the registry → map every match back to local field names.

This exact pipeline is covered by
[test/search-and-map.test.js](./test/search-and-map.test.js) (mocked HTTP,
no live network), so the shapes below are asserted by CI, not just narrated.

```js
// 1. local record -> DCI Person
toDCI();

// 2. build the search query from the mapped Person
fn(state => {
  const person = state.data;
  return {
    ...state,
    query: {
      search_request: [
        {
          search_criteria: {
            reg_type: 'social',
            reg_record_type: 'PERSON',
            query_type: 'PREDICATE',
            query: {
              predicate_list: [
                {
                  attribute_name: 'identifier.identifier_value',
                  attribute_value: person.identifier.identifier_value,
                  operator: 'eq',
                },
              ],
            },
          },
        },
      ],
    },
  };
});

// 3. call the registry — state.data becomes the raw response envelope:
// { header, message: { search_response: [ { data: { reg_records: <DCI Person> }, ... } ] } }
searchSync(state => state.query);

// 4. unwrap each match and map it back to local field names
fn(async state => {
  const results = state.data.message?.search_response || [];

  const localRecords = await Promise.all(
    results.map(result =>
      fromDCI()({
        configuration: state.configuration,
        data: result.data.reg_records,
      }).then(s => s.data)
    )
  );

  return { ...state, data: localRecords };
});
```

Given a registry that replies with two matching `Person` records, step 4
leaves `state.data` as:

```json
[
  {
    "citizen_id": "847951632",
    "firstName": "Sudarat",
    "lastName": "Phumchai",
    "gender": "female",
    "dob": "1995-09-21T00:00:00",
    "mobile": "+66811112222"
  },
  {
    "citizen_id": "111222333",
    "firstName": "Somchai",
    "lastName": "Boonmee",
    "gender": "male"
  }
]
```

— ready to hand to whichever adaptor talks to your local database/MIS. If
the registry finds no matches, `search_response` is empty and `state.data`
ends up `[]`.

Note step 4 calls `fromDCI()` once per matched record rather than on
`state.data` as a whole, since `fromDCI()` maps exactly one object at a
time (same as `toDCI()`) and a search can return several.

### 4. Interface-specific operations — DR example

The same map-then-call pattern applies to the interface-specific operations
in the [Interfaces](#interfaces-crvs-dr-ibr-social-ess-fr-ews) table — only
the `schema`/`mapping` and which operation you call change. This example
uses `DisabledPerson` + `getDisabilitySupport()` (DR); verified directly
against `src/Adaptor.js`:

```js
// configuration.schema = "DisabledPerson"
// configuration.mapping = {
//   disability_details: { impairment_type: 'impType', impairment_level: 'impLevel' },
// }
toDCI();
// state.data -> { disability_details: { impairment_type: 'Physical', impairment_level: 'Severe' } }

getDisabilitySupport(state => ({
  disabled_criteria: {
    query_type: 'PREDICATE',
    query: {
      predicate_list: [
        { attribute_name: 'member.member_identifier', attribute_value: 'M001', operator: 'eq' },
      ],
    },
  },
}));
// state.data -> the standard wrapped envelope:
// { header, message: { search_response: [ { data: { reg_records: <DisabilitySupport> }, ... } ] } }
```

Swap `getDisabilitySupport` for `getDisabilityDetails`/`checkDisabled` (also
DR), or for IBR/ESS use `checkEnrolled`/`submitEnrollmentUpdates`/
`checkEnrollment` with `IBRPerson`/`Beneficiary`/`Member` — same shape,
different `schema` and operation per the table above.

### 5. Smoke-testing every interface at once

[scripts/test-interfaces.mjs](./scripts/test-interfaces.mjs) exercises all
ten interface/schema combinations above in one run — mapping, then the
relevant operation, against a mocked registry (no real credentials or
network needed):

```bash
pnpm install   # once
pnpm test:interfaces
```

Or just one interface at a time, e.g. `pnpm test:interfaces dr`. Unlike
`pnpm test` (which asserts exact values for CI), this script prints each
step's JSON as it goes — meant to be read, not just passed/failed, when
you want to eyeball what a given interface actually produces.

## Documentation

View the
[docs site](https://docs.openfn.org/adaptors/packages/dci-common-core-docs)
for full technical documentation.

### Configuration

View the
[configuration-schema](https://docs.openfn.org/adaptors/packages/dci-common-core-configuration-schema/)
for required and optional `configuration` properties.

The configuration schema uses
[JSON Schema draft-07](https://json-schema.org/draft-07/json-schema-release-notes).
Run `pnpm validate:schemas` from the adaptors repo root after editing it.

## Development

Clone the [adaptors monorepo](https://github.com/OpenFn/adaptors). Follow the
"Getting Started" guide inside to get set up.

Run tests using `pnpm run test` or `pnpm run test:watch`

Build the project using `pnpm build`.

To build _only_ the docs run `pnpm build docs`.
