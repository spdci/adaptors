// Step 1 of 3 — fetch the record to sync from your existing local API.
//
// Adaptor:    @openfn/language-http
// Credential: your local API's own credentials (baseUrl + auth) — NOT a
//             dci-common-core configuration; this step never touches DCI.
//
// Swap the path/query below for your actual API's endpoint. Whatever this
// step returns becomes state.data going into Step 2.

get('/citizens/847951632');

// state.data is now the raw local record, in your API's own field names,
// e.g.:
// { citizen_id: '847951632', firstName: 'Sudarat', lastName: 'Phumchai',
//   gender: 'F', dob: '21/09/1995' }
