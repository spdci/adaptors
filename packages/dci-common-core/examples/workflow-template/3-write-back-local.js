// Step 3 of 3 (optional) — write the registry's response back into your
// local system, e.g. to mark a record as verified/synced.
//
// Adaptor:    @openfn/language-http
// Credential: the same local-API credential as Step 1.
//
// state.data coming in is Step 2's output — an array of records, already
// mapped back to your local system's own field names.

each(
  state => state.data,
  state =>
    post(`/citizens/${state.data.citizen_id}/dci-sync`, {
      synced: true,
      matched_at: new Date().toISOString(),
    })
);
