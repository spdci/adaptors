# Workflow template — local API ↔ DCI registry

A ready-to-adapt template for the 3-step pattern described in the main
README's ["Where does `data` come from?"](../../README.md#where-does-data-come-from)
section. This one uses `@openfn/language-http` for Steps 1 and 3, since the
local system here is assumed to be **an existing API** (not a raw
database) — swap those two files for `@openfn/language-postgresql`/
`mysql`/`mssql`/etc. if the local system is actually a database instead.

| Step | File | Adaptor | Credential |
|---|---|---|---|
| 1 | [1-fetch-local-record.js](1-fetch-local-record.js) | `@openfn/language-http` | Your local API's own credentials |
| 2 | [2-map-and-search-dci.js](2-map-and-search-dci.js) | `@openfn/language-dci-common-core` | One of [../configurations/](../configurations/) |
| 3 | [3-write-back-local.js](3-write-back-local.js) | `@openfn/language-http` | Same as Step 1 |

## Building this as a real OpenFn Lightning workflow

Each file above becomes one **step** (job node) in a Lightning workflow,
each with its own adaptor and credential selected from the dropdowns, wired
together with edges:

```
[Step 1: http]  --edge-->  [Step 2: dci-common-core]  --edge-->  [Step 3: http]
```

`state` flows automatically along each edge: Step 2 receives Step 1's final
`state` as its own starting `state` (so `state.data` going into Step 2 is
whatever Step 1 returned), and likewise Step 3 receives Step 2's `state`.
This is why Step 2's code above never fetches or writes to the local
system itself — it only transforms whatever `state.data` it's handed and
hands back a new `state.data` for the next step.

## Testing Step 2 alone, locally

Step 2 is exactly the pattern already covered by this package's own tests
and runnable examples — you don't need Steps 1/3 or a real local API to try
it:

- [test/search-and-map.test.js](../../test/search-and-map.test.js) — the
  same toDCI → searchSync → fromDCI pipeline, asserted against a mocked
  registry.
- The main README's ["Calling `searchSync()` and mapping
  results back"](../../README.md#3-calling-searchsync-and-mapping-results-back)
  section, and `pnpm test:interfaces` (see
  [scripts/test-interfaces.mjs](../../scripts/test-interfaces.mjs)) for
  every other interface.

Testing the *whole* 3-step chain requires the `openfn` CLI with a
multi-step workflow file (or Lightning itself) and real credentials for
whichever local API you swap in for Steps 1/3 — that part is specific to
your actual system, so it isn't included here.
