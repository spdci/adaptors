import { expect } from 'chai';
import { enableMockClient } from '@openfn/language-common/util';

import {
  search,
  searchSync,
  subscribe,
  unsubscribe,
  checkTxnStatus,
} from '../src/Adaptor.js';

const testServer = enableMockClient('https://fake.dci.server');

const state = {
  configuration: {
    baseUrl: 'https://fake.dci.server',
    sender_id: 'spp.example.org',
    receiver_id: 'civilregistry.example.org',
  },
};

// Intercepts a POST to `path`, capturing the parsed JSON body sent by the
// adaptor so it can be asserted on after the request completes.
const interceptCapturingBody = (path, replyBody) => {
  let capturedBody;

  testServer
    .intercept({
      path,
      method: 'POST',
      body: raw => {
        capturedBody = JSON.parse(raw);
        return true;
      },
    })
    .reply(200, replyBody);

  return () => capturedBody;
};

describe('search', () => {
  it('posts a SearchRequest envelope to /registry/search', async () => {
    const getBody = interceptCapturingBody('/registry/search', {
      transaction_id: 'txn-1',
    });

    const finalState = await search({
      search_request: [
        {
          search_criteria: {
            reg_type: 'crvs',
            reg_record_type: 'BIRTH',
            query_type: 'PREDICATE',
            query: {},
          },
        },
      ],
    })(state);

    const body = getBody();
    expect(body.header.action).to.eql('search');
    expect(body.header.sender_id).to.eql('spp.example.org');
    expect(body.header.receiver_id).to.eql('civilregistry.example.org');
    expect(body.message.transaction_id).to.be.a('string');
    expect(body.message.search_request).to.have.length(1);
    expect(body.message.search_request[0].reference_id).to.be.a('string');
    expect(body.message.search_request[0].search_criteria).to.eql({
      reg_type: 'crvs',
      reg_record_type: 'BIRTH',
      query_type: 'PREDICATE',
      query: {},
    });

    expect(finalState.data).to.eql({ transaction_id: 'txn-1' });
  });

  it('keeps a caller-supplied transaction_id and reference_id', async () => {
    const getBody = interceptCapturingBody('/registry/search', {});

    await search({
      transaction_id: 'my-txn',
      search_request: [
        {
          reference_id: 'my-ref',
          search_criteria: { query_type: 'PREDICATE', query: {} },
        },
      ],
    })(state);

    const body = getBody();
    expect(body.message.transaction_id).to.eql('my-txn');
    expect(body.message.search_request[0].reference_id).to.eql('my-ref');
  });
});

describe('searchSync', () => {
  it('posts a SearchRequest envelope to /registry/sync/search', async () => {
    const getBody = interceptCapturingBody('/registry/sync/search', {
      reg_records: [],
    });

    const finalState = await searchSync({
      search_request: [
        {
          search_criteria: { query_type: 'PREDICATE', query: {} },
        },
      ],
    })(state);

    const body = getBody();
    expect(body.header.action).to.eql('search');
    expect(body.message.search_request).to.have.length(1);

    expect(finalState.data).to.eql({ reg_records: [] });
  });
});

describe('subscribe', () => {
  it('posts a SubscribeRequest envelope to /registry/subscribe', async () => {
    const getBody = interceptCapturingBody('/registry/subscribe', {
      subscription_code: 'sub-001',
    });

    const finalState = await subscribe({
      subscribe_request: [
        {
          subscribe_criteria: {
            reg_type: 'crvs',
            reg_event_type: 'BIRTH',
            frequency: 'REAL_TIME',
            filter_type: 'PREDICATE',
            filter: {},
            notify_record_type: 'BIRTH',
          },
        },
      ],
    })(state);

    const body = getBody();
    expect(body.header.action).to.eql('subscribe');
    expect(body.message.subscribe_request).to.have.length(1);
    expect(body.message.subscribe_request[0].reference_id).to.be.a('string');
    expect(body.message.subscribe_request[0].timestamp).to.be.a('string');

    expect(finalState.data).to.eql({ subscription_code: 'sub-001' });
  });
});

describe('unsubscribe', () => {
  it('posts an UnSubscribeRequest envelope to /registry/unsubscribe', async () => {
    const getBody = interceptCapturingBody('/registry/unsubscribe', {
      status: 'succ',
    });

    const finalState = await unsubscribe({
      subscription_codes: ['sub-001', 'sub-002'],
    })(state);

    const body = getBody();
    expect(body.header.action).to.eql('unsubscribe');
    expect(body.message.subscription_codes).to.eql(['sub-001', 'sub-002']);
    expect(body.message.transaction_id).to.be.a('string');
    expect(body.message.timestamp).to.be.a('string');

    expect(finalState.data).to.eql({ status: 'succ' });
  });
});

describe('checkTxnStatus', () => {
  it('posts a TxnStatusRequest envelope to /registry/txn/status', async () => {
    const getBody = interceptCapturingBody('/registry/txn/status', {
      txnstatus_response: { status: 'succ' },
    });

    const finalState = await checkTxnStatus({
      transaction_id: 'txn-1',
      txnstatus_request: {
        reference_id: 'ref-1',
        txn_type: 'search',
        attribute_type: 'transaction_id',
        attribute_value: 'txn-1',
      },
    })(state);

    const body = getBody();
    expect(body.header.action).to.eql('txn-status');
    expect(body.message.transaction_id).to.eql('txn-1');
    expect(body.message.txnstatus_request).to.eql({
      reference_id: 'ref-1',
      txn_type: 'search',
      attribute_type: 'transaction_id',
      attribute_value: 'txn-1',
    });

    expect(finalState.data).to.eql({
      txnstatus_response: { status: 'succ' },
    });
  });
});
