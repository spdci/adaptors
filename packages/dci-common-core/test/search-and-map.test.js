import { expect } from 'chai';
import { enableMockClient } from '@openfn/language-common/util';

import { toDCI, fromDCI, searchSync } from '../src/Adaptor.js';

// Integration-style test for the documented "map -> search -> map results
// back" pipeline (see README "Calling searchSync() and mapping results
// back"). Still no live network — the registry is mocked with undici, same
// as the rest of this package's tests.
const testServer = enableMockClient('https://fake.search-and-map.dci.server');

const configuration = {
  baseUrl: 'https://fake.search-and-map.dci.server',
  sender_id: 'mis.country-x.gov',
  receiver_id: 'socialregistry.country-x.gov',
  authentication: { type: 'bearer', token: 'test-token' },
  schema: 'Person',
  mapping: {
    identifier: {
      identifier_type: '=NationalID',
      identifier_value: 'citizen_id',
    },
    name: { given_name: 'firstName', surname: 'lastName' },
    sex: 'gender',
    birth_date: {
      source: 'dob',
      sourceFormat: 'DD/MM/YYYY',
      targetFormat: 'YYYY-MM-DDTHH:mm:ss',
    },
    phone_number: 'mobile',
  },
  codeLists: { sex: { M: 'male', F: 'female' } },
};

// Build the search query from a mapped DCI Person, matching by identifier.
const buildSearchQuery = person => ({
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
});

// Unwrap a SearchResponse's search_response[].data.reg_records entries and
// map each back to local field names with fromDCI().
const mapSearchResultsToLocal = async state => {
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
};

describe('search + map integration', () => {
  it('maps a local record to DCI, searches the registry, and maps matches back to local shape', async () => {
    testServer
      .intercept({ path: '/registry/sync/search', method: 'POST' })
      .reply(200, {
        header: { action: 'on-search' },
        message: {
          transaction_id: 'txn-abc',
          correlation_id: 'corr-abc',
          search_response: [
            {
              reference_id: 'ref-1',
              timestamp: '2026-08-24T00:00:00Z',
              status: 'succ',
              data: {
                reg_type: 'social',
                reg_record_type: 'PERSON',
                reg_records: {
                  identifier: {
                    identifier_type: 'NationalID',
                    identifier_value: '847951632',
                  },
                  name: { given_name: 'Sudarat', surname: 'Phumchai' },
                  sex: 'female',
                  birth_date: '1995-09-21T00:00:00',
                  phone_number: '+66811112222',
                },
              },
            },
            {
              reference_id: 'ref-2',
              timestamp: '2026-08-24T00:00:00Z',
              status: 'succ',
              data: {
                reg_type: 'social',
                reg_record_type: 'PERSON',
                reg_records: {
                  identifier: {
                    identifier_type: 'NationalID',
                    identifier_value: '111222333',
                  },
                  name: { given_name: 'Somchai', surname: 'Boonmee' },
                  sex: 'male',
                },
              },
            },
          ],
        },
      });

    let state = {
      configuration,
      data: {
        citizen_id: '847951632',
        firstName: 'Sudarat',
        lastName: 'Phumchai',
        gender: 'F',
        dob: '21/09/1995',
        mobile: '+66811112222',
      },
    };

    state = await toDCI()(state);
    state = await searchSync(s => buildSearchQuery(s.data))(state);
    state = await mapSearchResultsToLocal(state);

    expect(state.data).to.eql([
      {
        citizen_id: '847951632',
        firstName: 'Sudarat',
        lastName: 'Phumchai',
        gender: 'female',
        dob: '1995-09-21T00:00:00',
        mobile: '+66811112222',
      },
      {
        citizen_id: '111222333',
        firstName: 'Somchai',
        lastName: 'Boonmee',
        gender: 'male',
      },
    ]);
  });

  it('returns an empty array when the registry finds no matches', async () => {
    testServer
      .intercept({ path: '/registry/sync/search', method: 'POST' })
      .reply(200, {
        header: { action: 'on-search' },
        message: {
          transaction_id: 'txn-def',
          correlation_id: 'corr-def',
          search_response: [],
        },
      });

    let state = {
      configuration,
      data: {
        citizen_id: 'does-not-exist',
        firstName: 'Nobody',
        lastName: 'Here',
        gender: 'F',
        dob: '01/01/2000',
      },
    };

    state = await toDCI()(state);
    state = await searchSync(s => buildSearchQuery(s.data))(state);
    state = await mapSearchResultsToLocal(state);

    expect(state.data).to.eql([]);
  });
});
