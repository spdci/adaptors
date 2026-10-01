// Step 2 of 3 — map the local record into DCI shape and search the registry.
//
// Adaptor:    @openfn/language-dci-common-core
// Credential: one of ../configurations/*.json for the interface you're
//             using (e.g. ../configurations/core/person.json), filled in
//             with your real registry baseUrl/sender_id/receiver_id/token.
//
// state.data coming in is Step 1's output — the raw local record. This
// step never talks to your local API; that's Steps 1 and 3.

// 1. local record -> DCI object (Person here; swap for your interface's
//    schema — see the main README's "Interfaces" table)
toDCI();

// 2. build the search query from the mapped object
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

// 3. call the registry
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

// state.data is now an array of matches, already mapped back to your
// local system's own field names — ready for Step 3.
