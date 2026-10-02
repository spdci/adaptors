# Implementation guide: adopting `dci-common-core` in a country

This guide is for a country team that has an existing system (a database, a
MIS, or an API that isn't DCI-compliant) and wants to exchange data with, or
expose it through, one or more DCI registries. It walks through the work in
order. For API reference see the [README](./README.md).

## The idea in one paragraph

You don't change your local system. You write one **configuration file per DCI
interface** you want to support. Each one holds the registry connection details
plus your **mapping**: which of your fields correspond to which DCI fields.
The adaptor converts your non-DCI data to DCI-compliant data (`toDCI()`),
sends it to or queries the registry, and converts DCI responses back to your
shape (`fromDCI()`). Nothing in the adaptor's code changes per country, only
configuration does.

```
local system  ──►  [ Step 1: fetch ]  ──►  [ Step 2: dci-common-core ]  ──►  DCI registry
(DB or API)        (http / postgresql        toDCI → search/subscribe/…
                    / mysql / mssql …)       fromDCI ◄── response
                                                      │
                                         [ Step 3: write back ]  ──►  local system
```

`dci-common-core` only handles Step 2. Steps 1 and 3 use whichever OpenFn
adaptor matches your local system. See
[examples/workflow-template](./examples/workflow-template/).

## Step 1: Decide which interfaces you need

Not every country implements every interface. Pick only the ones that apply.

| If your country has… | Interface | `schema` value(s) | Config folder |
|---|---|---|---|
| A civil registration / vital events system | CRVS | `CRVSPerson` | `examples/configurations/crvs/` |
| A disability registry | DR | `DisabledPerson`, `DisabilityInfo`, `DisabilitySupport` | `.../dr/` |
| An integrated beneficiary registry | IBR | `IBRPerson`, `Beneficiary` | `.../ibr/` |
| A social registry | Social | `Person`, `Group` | `.../social/` |
| An employment support system | ESS | `Member` | `.../ess/` |
| A farmer registry | FR | `FRPerson` | `.../fr/` |
| An early warning system | EWS | `AlertFeature` | `.../ews/` |
| Only generic person/household data | Core | `Person`, `Member`, `Group` | `.../core/` |

An interface can need more than one configuration. DR has three sync
operations that each return a different data object, so it has three files.
Create one only for the operations you actually call.

## Step 2: Collect the registry connection details

For each registry you connect to, get these from its operator. They go in the
configuration file (or the OpenFn credential), never in job code:

| Field | What it is |
|---|---|
| `baseUrl` | The registry's base URL, including the version path (e.g. `https://…/v1.0.0`) |
| `sender_id` | The ID your system is registered under at the registry |
| `receiver_id` | The registry's ID as registered on your side |
| `authentication` | `bearer` (token), `basic` (username/password), or `apiKey` |
| `sender_uri` | Optional. Your callback URL, only for async (`on-*`) responses |

Also ask the operator which `reg_type` / `reg_record_type` values the registry
expects. The DCI spec defines these as free-form strings, so they are
implementation-specific. They are not part of the configuration file; you
pass them in the request your job builds (see
[Step 7](#step-7-call-the-registry)). The spec's examples look like
`ns:org:RegistryType:Civil` (CRVS), `…:DR`, `…:IBR`, `…:Social`, `…:ESS`,
`…:FR`, but confirm yours with the operator.

## Step 3: Inventory your local data

For each interface, write down where each DCI field lives in your system.
A simple table is enough:

| DCI field | Your system's field | Notes |
|---|---|---|
| `identifier.identifier_value` | `citizen_id` | Identifier type is always `NationalID` |
| `name.given_name` | `first_name` | |
| `name.surname` | `last_name` | |
| `sex` | `gender` | Stored as `M`/`F`, DCI wants `male`/`female` |
| `birth_date` | `dob` | Stored as `DD/MM/YYYY` |

The full list of DCI fields per object is in
[configuration-schema.json](./configuration-schema.json) under `definitions`
(for example `personMapping`, `crvsPersonMapping`, `disabilityInfoMapping`).
You don't have to map everything. Start with identifier, name, sex and birth
date, and add fields as the registry needs them.

## Step 4: Write the configuration

Copy the file for your interface from
[examples/configurations](./examples/configurations/) and edit it.

```json
{
  "baseUrl": "https://registry.example.gov/crvs/v1.0.0",
  "sender_id": "mis.example.gov",
  "receiver_id": "crvs.example.gov",
  "authentication": { "type": "bearer", "token": "…" },
  "schema": "CRVSPerson",
  "mapping": {
    "identifier": { "identifier_type": "=NationalID", "identifier_value": "citizen_id" },
    "name": { "given_name": "first_name", "surname": "last_name" },
    "sex": "gender",
    "birth_date": { "source": "dob", "sourceFormat": "DD/MM/YYYY", "targetFormat": "YYYY-MM-DDTHH:mm:ss" }
  },
  "codeLists": { "sex": { "M": "male", "F": "female" } }
}
```

Rules for `mapping`:

- **Left side** (`identifier`, `name`, `sex`, …) is fixed by the DCI schema.
  Don't rename it.
- **Right side** is yours. A plain string is the name of a field in your record.
- A string starting with `=` is a **constant**: `"=NationalID"` always outputs
  `NationalID`.
- A **date field** can be a plain string if your value is already ISO 8601.
  Use the `{ source, sourceFormat, targetFormat }` object only when it needs
  reformatting. The conversion runs only if `targetFormat` is present.
- Nested DCI objects are nested mappings (`demographic_info` → `name` → …).

Rules for `codeLists`:

- Translates your codes into DCI's vocabulary (`M` → `male`).
- **Its nesting must mirror `mapping`.** If `sex` sits under
  `demographic_info` in the mapping, the list goes under
  `codeLists.demographic_info.sex`, not `codeLists.sex`.

Don't put real tokens in files you commit. Store the finished configuration
as an OpenFn credential.

Validate your file against the schema before using it:

```bash
node --input-type=module -e "
import Ajv from 'ajv'; import fs from 'fs';
const v = new Ajv({strict:false}).compile(JSON.parse(fs.readFileSync('configuration-schema.json')));
console.log(v(JSON.parse(fs.readFileSync(process.argv[1]))) ? 'valid' : v.errors);
" path/to/your-config.json
```

(run from `packages/dci-common-core`).

## Step 5: Test the mapping on its own

Before connecting to anything, check what `toDCI()` produces from a real
record. Put your configuration and one sample record in `tmp/state.json`
(`{ "configuration": {…}, "data": {…} }`) and run:

```js
// tmp/expression.js
toDCI();
fn(state => { console.log(JSON.stringify(state.data, null, 2)); return state; });
```

```bash
openfn tmp/expression.js -ma dci-common-core -s tmp/state.json -o tmp/output.json
```

Compare the output with the example in the DCI spec for your interface. The
usual first-run problems are covered in [Troubleshooting](#troubleshooting).

## Step 6: Build Steps 1 and 3 for your local system

These are ordinary OpenFn jobs using the adaptor for your system:

- **Existing API** → `@openfn/language-http` (`get`, `post`, …)
- **Database** → `@openfn/language-postgresql` / `mysql` / `mssql`

Step 1 must leave one raw record in `state.data`, in your own field names.
Step 3 (optional) writes results back. Templates:
[examples/workflow-template](./examples/workflow-template/).

## Step 7: Call the registry

In Step 2, after `toDCI()`, call the operation for what you need to do.

| You want to… | Operation |
|---|---|
| Look someone up and get the answer immediately | `searchSync()` |
| Look someone up, with the answer delivered to your callback | `search()` |
| Be told about registry events | `subscribe()` / `unsubscribe()` |
| Check on an earlier request | `checkTxnStatus()` |
| DR: disability support / details / yes-no | `getDisabilitySupport()` / `getDisabilityDetails()` / `checkDisabled()` |
| IBR: send enrollment updates / check enrollment | `submitEnrollmentUpdates()` / `checkEnrolled()` |
| ESS: check enrollment status | `checkEnrollment()` |

The adaptor builds the DCI header and envelope for you, and generates
`transaction_id`, `reference_id` and timestamps if you don't supply them. You
supply the message body, including `reg_type`, `reg_record_type` and the query.
A complete example (map → search → map results back) is in the README under
"Calling `searchSync()` and mapping results back".

Things that behave differently from what you might assume:

- **IBR** `submitEnrollmentUpdates()` / `checkEnrolled()` return the raw response
  body, not the usual `{ header, message }` wrapper. This is how the spec
  defines them.
- **ESS** `checkEnrollment()` sends the action `enrollementstatus` (sic). That
  spelling is in the spec.
- **Async operations** (`search`, `subscribe`, …) are acknowledged on the HTTP
  response, but the actual result is pushed to your `sender_uri`. The adaptor
  doesn't receive callbacks. If your registry only supports async, you need a
  separate workflow, triggered by a webhook, to receive them.

## Step 8: Map responses back

A search can return several matches. `fromDCI()` maps exactly one object, so
call it once per record (the README example shows how). It reverses the
**field names** only: DCI codes (`male`) and ISO dates are not converted back
to your `M` / `DD/MM/YYYY`. Convert those in a `fn()` step if your local
system needs the original format.

## Go-live checklist

- [ ] Interfaces chosen; one configuration file per interface
- [ ] `baseUrl`, `sender_id`, `receiver_id`, auth confirmed with the registry operator
- [ ] `reg_type` / `reg_record_type` values confirmed with the operator
- [ ] Configuration validates against `configuration-schema.json`
- [ ] `toDCI()` output reviewed against the spec example for each interface
- [ ] Code lists cover every value your system can produce (unmapped values pass through unchanged, which the registry may reject)
- [ ] Tokens stored as OpenFn credentials, not committed
- [ ] Tried against the registry's sandbox before production
- [ ] Message signing requirement checked with the operator (see below)
- [ ] Error handling decided for registry rejections and for "no match" results

## Known limitations

- **No message signing.** The adaptor doesn't produce the cryptographic
  signature (`MsgSignature`). If your registry requires one, compute it
  yourself and pass it as `options.signature` on the operation. It is attached
  to the envelope as-is.
- **No inbound callbacks.** `on-search`, `notify` etc. are endpoints your side
  implements. They are out of scope for this adaptor.
- **No list fields in mappings.** Multiple identifiers, `Group.member_list`,
  `CapAlert.info`, farm and machinery lists and similar are not mapped. Build
  those arrays in job code.
- **Some DCI data objects are only examples in the spec** (no formal schema).
  Their mappings here were derived from those examples. Check them against
  your registry's actual responses.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| `toDCI() requires configuration.schema and configuration.mapping` | Missing `schema` or `mapping` in the configuration |
| A field is missing from the output | The source field name on the right side doesn't match your record (keys are case-sensitive), or the value is `undefined` |
| Dates come out unchanged | No `targetFormat` in the date mapping; the conversion only runs when it's set |
| Codes (`M`) aren't translated | The `codeLists` nesting doesn't mirror `mapping`, or the key doesn't match |
| `fromDCI()` returns `male`, not `M` | Expected: it reverses field names only (see Step 8) |
| `401` / `403` from the registry | Wrong or expired token, or `sender_id` not registered at that registry |
| Registry rejects the request body | `reg_type` / `reg_record_type` or query shape differs from what that registry expects; check with the operator |
| `undefined` where you expected a search result | Async operation: the result goes to `sender_uri`, not the HTTP response. Use `searchSync()` or a callback workflow |

## Verifying your setup

```bash
cd packages/dci-common-core
pnpm test               # unit tests (mocked registry, no network)
pnpm test:interfaces    # readable smoke test across every interface
```
