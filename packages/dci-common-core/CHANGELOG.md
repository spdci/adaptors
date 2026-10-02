# @openfn/language-dci-common-core

## 1.0.0

Initial release. Covers the DCI Core registry API's three async capabilities
(Search, Event Subscription, Request Status Check) plus synchronous search,
per `registry_core_api_v1.0.0.yaml`. Cryptographic message signing and the
inbound `on-*` callback endpoints are not yet implemented.

Adds `toDCI()`/`fromDCI()` for mapping local data into/out of a Core `Person`,
`Member`, or `Group` object, per `schemas/core/v1/data/{Person,Member,Group}.jsonld`.

Adds support for every DCI extension interface (crvs, dr, ibr, social, ess,
fr, ews) in this same adaptor — a country configures one `configuration`
per interface it uses (its own `schema`/`mapping`/`codeLists`), and the
adaptor converts their non-DCI-compliant local data into DCI-compliant data
for that interface. `search`/`searchSync`/`subscribe`/`unsubscribe`/
`checkTxnStatus` already covered every interface unmodified (reg_type is
caller-supplied, not hardcoded); this adds the extension-specific sync
endpoints — `getDisabilitySupport()`, `getDisabilityDetails()`,
`checkDisabled()` [dr], `submitEnrollmentUpdates()`, `checkEnrolled()` [ibr],
`checkEnrollment()` [ess] — and `toDCI()`/`fromDCI()` support for
`CRVSPerson`, `DisabledPerson`, `DisabilityInfo`, `DisabilitySupport`,
`IBRPerson`, `Beneficiary`, `FRPerson`, and `AlertFeature`. See the README's
"Interfaces" section for the full per-interface reference.
