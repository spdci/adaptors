import { expect } from 'chai';
import { enableMockClient } from '@openfn/language-common/util';

import {
  getDisabilitySupport,
  getDisabilityDetails,
  checkDisabled,
  submitEnrollmentUpdates,
  checkEnrolled,
  checkEnrollment,
} from '../src/Adaptor.js';

// Own fake origin — enableMockClient shares one mock queue per origin across
// every test file in the same mocha run, so reusing 'https://fake.dci.server'
// (used by Adaptor.test.js) causes cross-file interceptor collisions.
const testServer = enableMockClient('https://fake.interface-ops.dci.server');

const state = {
  configuration: {
    baseUrl: 'https://fake.interface-ops.dci.server',
    sender_id: 'spp.example.org',
    receiver_id: 'registry.example.org',
  },
};

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

describe('getDisabilitySupport [dr]', () => {
  it('posts a GetDisabilitySupportRequest envelope to /registry/sync/get-disability-support', async () => {
    const getBody = interceptCapturingBody(
      '/registry/sync/get-disability-support',
      { header: { action: 'on-search' }, message: { transaction_id: 'txn-1' } }
    );

    const finalState = await getDisabilitySupport({
      disabled_criteria: {
        query_type: 'PREDICATE',
        query: {
          predicate_list: [
            {
              attribute_name: 'member.member_identifier',
              attribute_value: 'M001',
              operator: 'eq',
            },
          ],
        },
      },
    })(state);

    const body = getBody();
    expect(body.header.action).to.eql('search');
    expect(body.message.transaction_id).to.be.a('string');
    expect(body.message.disabled_criteria.query_type).to.eql('PREDICATE');
    expect(finalState.data).to.eql({
      header: { action: 'on-search' },
      message: { transaction_id: 'txn-1' },
    });
  });
});

describe('getDisabilityDetails [dr]', () => {
  it('posts to /registry/sync/get-disability-details', async () => {
    const getBody = interceptCapturingBody(
      '/registry/sync/get-disability-details',
      { reg_records: { disability_status: 'Approved' } }
    );

    const finalState = await getDisabilityDetails({
      disabled_criteria: {
        query_type: 'PREDICATE',
        query: {
          predicate_list: [
            {
              attribute_name: 'member.member_identifier',
              attribute_value: 'M001',
              operator: 'eq',
            },
          ],
        },
      },
    })(state);

    const body = getBody();
    expect(body.header.action).to.eql('search');
    expect(body.message.disabled_criteria).to.be.an('object');
    expect(finalState.data).to.eql({ reg_records: { disability_status: 'Approved' } });
  });
});

describe('checkDisabled [dr]', () => {
  it('posts to /registry/sync/disabled', async () => {
    const getBody = interceptCapturingBody('/registry/sync/disabled', {
      message: { disabled_response: [{ disabled_status: 'yes' }] },
    });

    await checkDisabled({
      disabled_criteria: {
        query_type: 'PREDICATE',
        query: {
          predicate_list: [
            {
              attribute_name: 'member.member_identifier',
              attribute_value: 'M001',
              operator: 'eq',
            },
          ],
        },
      },
    })(state);

    const body = getBody();
    expect(body.header.action).to.eql('search');
    expect(body.message.disabled_criteria.query_type).to.eql('PREDICATE');
  });
});

describe('submitEnrollmentUpdates [ibr]', () => {
  it('posts to /registry/sync/enrollment/updates with action=notify and returns the unwrapped response', async () => {
    const getBody = interceptCapturingBody('/registry/sync/enrollment/updates', {
      transaction_id: 'txn-2',
      correlation_id: 'corr-2',
      enrolled_response: [{ reference_id: 'ref-1', status: 'succ' }],
    });

    const finalState = await submitEnrollmentUpdates({
      enrolled_updates: {
        receipt_type: 'enrolled',
        beneficiaries: [
          { identifier: { identifier_type: 'UIN', identifier_value: 'B001' } },
        ],
      },
    })(state);

    const body = getBody();
    expect(body.header.action).to.eql('notify');
    expect(body.message.enrolled_updates.receipt_type).to.eql('enrolled');

    // unwrapped response — no signature/header/message envelope
    expect(finalState.data).to.eql({
      transaction_id: 'txn-2',
      correlation_id: 'corr-2',
      enrolled_response: [{ reference_id: 'ref-1', status: 'succ' }],
    });
  });
});

describe('checkEnrolled [ibr]', () => {
  it('posts to /registry/sync/enrolled and returns the unwrapped response', async () => {
    const getBody = interceptCapturingBody('/registry/sync/enrolled', {
      transaction_id: 'txn-3',
      correlation_id: 'corr-3',
      enrolled_response: [{ reference_id: 'ref-1', enrolled_status: 'yes' }],
    });

    const finalState = await checkEnrolled({
      enrolled_criteria: {
        query_type: 'PREDICATE',
        response_entity: 'Beneficiary',
        query: {
          predicate_list: [
            {
              attribute_name: 'member.member_identifier',
              attribute_value: 'M001',
              operator: 'eq',
            },
          ],
        },
      },
    })(state);

    const body = getBody();
    expect(body.header.action).to.eql('search');
    expect(body.message.enrolled_criteria.response_entity).to.eql('Beneficiary');

    expect(finalState.data).to.eql({
      transaction_id: 'txn-3',
      correlation_id: 'corr-3',
      enrolled_response: [{ reference_id: 'ref-1', enrolled_status: 'yes' }],
    });
  });
});

describe('checkEnrollment [ess]', () => {
  it('posts to /registry/sync/check-enrollment with action=enrollementstatus', async () => {
    const getBody = interceptCapturingBody('/registry/sync/check-enrollment', {
      header: { action: 'txn-on-status' },
      message: { enrolled_response: [{ enrolled_status: 'Active' }] },
    });

    const finalState = await checkEnrollment({
      enrolled_criteria: {
        query_type: 'PREDICATE',
        response_entity: 'Member',
        query: {
          predicate_list: [
            {
              attribute_name: 'member.member_identifier',
              attribute_value: 'M001',
              operator: 'eq',
            },
          ],
        },
      },
    })(state);

    const body = getBody();
    expect(body.header.action).to.eql('enrollementstatus');
    expect(body.message.enrolled_criteria.response_entity).to.eql('Member');

    expect(finalState.data).to.eql({
      header: { action: 'txn-on-status' },
      message: { enrolled_response: [{ enrolled_status: 'Active' }] },
    });
  });
});
