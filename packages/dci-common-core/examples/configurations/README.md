# Example configurations, one per interface

Each file here is a complete, valid `configuration` for exactly **one**
DCI interface/schema combination — validated against
[../../configuration-schema.json](../../configuration-schema.json). A
country picks only the files for the interfaces it actually implements and
ignores the rest; there is no single "do everything" configuration.

Every one of the 7 DCI interfaces — plus generic Core — has its own file(s)
below. Countries implementing only one or two interfaces (the common case —
few implement all seven) only ever need to open their own folder.

| File | Interface | `schema` |
|---|---|---|
| [core/person.json](core/person.json) | Core | `Person` |
| [core/member.json](core/member.json) | Core | `Member` |
| [core/group.json](core/group.json) | Core | `Group` |
| [crvs/person.json](crvs/person.json) | CRVS | `CRVSPerson` |
| [dr/disabled-person.json](dr/disabled-person.json) | DR | `DisabledPerson` |
| [dr/disability-info.json](dr/disability-info.json) | DR | `DisabilityInfo` |
| [dr/disability-support.json](dr/disability-support.json) | DR | `DisabilitySupport` |
| [ibr/person.json](ibr/person.json) | IBR | `IBRPerson` |
| [ibr/beneficiary.json](ibr/beneficiary.json) | IBR | `Beneficiary` |
| [social/person.json](social/person.json) | Social | `Person` |
| [social/group.json](social/group.json) | Social | `Group` |
| [ess/member.json](ess/member.json) | ESS | `Member` |
| [fr/person.json](fr/person.json) | FR | `FRPerson` |
| [ews/alert-feature.json](ews/alert-feature.json) | EWS | `AlertFeature` |

Social's and ESS's files use the same underlying `Person`/`Group`/`Member`
`schema` values as Core — because those interfaces reuse the Core data
objects directly, per the DCI spec (see the main README's
[Interfaces](../../README.md#interfaces-crvs-dr-ibr-social-ess-fr-ews)
table) — but each still gets its **own file**, with its own registry
connection details and its own `mapping` filled in for that interface's
actual data. They are not aliases of `core/*.json` — edit them
independently.

**A single interface can need more than one file.** DR, for example, has
three — `DisabledPerson`, `DisabilityInfo`, `DisabilitySupport` — because
its three sync operations (`checkDisabled`, `getDisabilityDetails`,
`getDisabilitySupport`) each return a differently-shaped record. If a
country only calls one of those three operations, it only needs that one
file. In practice each of these becomes its own OpenFn credential:
same `baseUrl`/`sender_id`/`receiver_id`/`authentication` (same registry
connection), different `schema`/`mapping` (different DCI object).

## Using one

1. Copy the file for your interface.
2. Fill in your real `baseUrl`, `sender_id`, `receiver_id`, and
   `authentication.token` (these three placeholder values — `REPLACE_ME`,
   `country-x.gov`, the `sandbox.spdci.org` URLs — are not real).
3. Change every `mapping` value (the right-hand side of each pair) to match
   your local system's actual field names. Don't rename the left-hand keys
   — those are fixed by the DCI schema.
4. Save it as your OpenFn credential/configuration for that interface, or
   drop it into a `tmp/state-*.json`'s `configuration` key to test locally
   (see the main README's "Runnable examples" section).

These are `configuration` objects only (no `data`) — see the main
[README](../../README.md) for the full walkthrough, including how `data`
(your actual local record) fits alongside `configuration` in a job's state,
and where that `data` comes from in a real workflow (it doesn't come from
this adaptor — see "Where does `data` come from?" in the main README).
