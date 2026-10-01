// Smoke test for every DCI interface this adaptor supports.
//
// Unlike `pnpm test` (which asserts exact values and is meant for CI), this
// script is meant to be *read* — it walks through each interface, prints
// what's happening at each step, and shows the resulting JSON so you can
// eyeball it. It runs against a mocked registry (undici), so it needs no
// real credentials, network access, or the openfn CLI.
//
// Run from this package's directory:
//   pnpm install   (once)
//   node scripts/test-interfaces.mjs
//
// Run a single interface only:
//   node scripts/test-interfaces.mjs dr
//   node scripts/test-interfaces.mjs core member group crvs dr ibr fr ews

import { enableMockClient } from '@openfn/language-common/util';
import * as Adaptor from '../src/Adaptor.js';

const {
  toDCI,
  fromDCI,
  searchSync,
  subscribe,
  unsubscribe,
  checkTxnStatus,
  getDisabilitySupport,
  getDisabilityDetails,
  checkDisabled,
  submitEnrollmentUpdates,
  checkEnrolled,
  checkEnrollment,
} = Adaptor;

const BASE_URL = 'https://fake.smoke-test.dci.server';
const testServer = enableMockClient(BASE_URL);

const baseConfiguration = {
  baseUrl: BASE_URL,
  sender_id: 'mis.country-x.gov',
  receiver_id: 'registry.country-x.gov',
  authentication: { type: 'bearer', token: 'test-token' },
};

let passed = 0;
let failed = 0;

const section = title => {
  console.log(`\n${'='.repeat(70)}\n${title}\n${'='.repeat(70)}`);
};

const step = (label, value) => {
  console.log(`\n-- ${label} --`);
  console.log(JSON.stringify(value, null, 2));
};

const check = (label, condition) => {
  if (condition) {
    console.log(`  ok — ${label}`);
    passed++;
  } else {
    console.log(`  FAIL — ${label}`);
    failed++;
  }
};

const mockPost = (path, replyBody) => {
  testServer.intercept({ path, method: 'POST' }).reply(200, replyBody);
};

// ---------------------------------------------------------------------
// Core: Person / Member / Group
// ---------------------------------------------------------------------
async function testCore() {
  section('Core — Person, Member, Group (toDCI, search, subscribe, unsubscribe, checkTxnStatus)');

  let state = {
    configuration: {
      ...baseConfiguration,
      schema: 'Person',
      mapping: {
        identifier: { identifier_type: '=NationalID', identifier_value: 'citizen_id' },
        name: { given_name: 'firstName', surname: 'lastName' },
        sex: 'gender',
      },
      codeLists: { sex: { M: 'male', F: 'female' } },
    },
    data: { citizen_id: '847951632', firstName: 'Sudarat', lastName: 'Phumchai', gender: 'F' },
  };

  state = await toDCI()(state);
  step('Person (toDCI)', state.data);
  check('Person mapped', state.data.identifier?.identifier_value === '847951632' && state.data.sex === 'female');

  mockPost('/registry/sync/search', {
    message: { search_response: [{ data: { reg_records: state.data } }] },
  });
  state = await searchSync(() => ({ search_request: [{ search_criteria: { reg_type: 'social', query_type: 'PREDICATE', query: {} } }] }))(state);
  check('searchSync() called', !!state.data.message);

  mockPost('/registry/subscribe', { header: { action: 'on-subscribe' } });
  state = await subscribe(() => ({ subscribe_request: [{ subscribe_criteria: { reg_event_type: 'BIRTH', filter: {}, notify_record_type: 'BIRTH' } }] }))(state);
  check('subscribe() called', !!state.data.header);

  mockPost('/registry/unsubscribe', { header: { action: 'on-unsubscribe' } });
  state = await unsubscribe(() => ({ subscription_codes: ['sub-001'] }))(state);
  check('unsubscribe() called', !!state.data.header);

  mockPost('/registry/txn/status', { header: { action: 'txn-on-status' } });
  state = await checkTxnStatus(() => ({ txnstatus_request: { reference_id: 'r1', txn_type: 'search', attribute_type: 'transaction_id', attribute_value: 'txn-1' } }))(state);
  check('checkTxnStatus() called', !!state.data.header);
}

async function testMember() {
  section('Core — Member (nested demographic_info)');

  let state = {
    configuration: {
      ...baseConfiguration,
      schema: 'Member',
      mapping: {
        member_identifier: { identifier_type: '=UIN', identifier_value: 'member_id' },
        demographic_info: { name: { given_name: 'first_name' }, sex: 'gender' },
        marital_status: 'marital_code',
      },
      codeLists: { demographic_info: { sex: { M: 'male', F: 'female' } } },
    },
    data: { member_id: 'MB-021', first_name: 'Kwame', gender: 'M', marital_code: 'married' },
  };

  state = await toDCI()(state);
  step('Member (toDCI)', state.data);
  check('Member mapped', state.data.demographic_info?.sex === 'male');
}

async function testGroup() {
  section('Core — Group (nested group_head_info -> Member)');

  let state = {
    configuration: {
      ...baseConfiguration,
      schema: 'Group',
      mapping: {
        group_identifier: { identifier_type: '=HHID', identifier_value: 'household_id' },
        group_type: 'unit_type',
        group_head_info: { demographic_info: { name: { given_name: 'head_first_name' } } },
      },
    },
    data: { household_id: 'HH-777', unit_type: 'household', head_first_name: 'Ama' },
  };

  state = await toDCI()(state);
  step('Group (toDCI)', state.data);
  check('Group mapped', state.data.group_head_info?.demographic_info?.name?.given_name === 'Ama');
}

// ---------------------------------------------------------------------
// CRVS
// ---------------------------------------------------------------------
async function testCrvs() {
  section('CRVS — CRVSPerson');

  let state = {
    configuration: {
      ...baseConfiguration,
      schema: 'CRVSPerson',
      mapping: {
        identifier: { identifier_type: '=UIN', identifier_value: 'nationalId' },
        name: { surname: 'lastName', given_name: 'firstName' },
        sex: 'gender',
        birth_date: 'dob',
        marital_status: 'maritalCode',
      },
    },
    data: { nationalId: '197382465', lastName: 'Martinez', firstName: 'Elena', gender: 'female', dob: '1980-03-23T10:20:15', maritalCode: 'S' },
  };

  state = await toDCI()(state);
  step('CRVSPerson (toDCI)', state.data);
  check('CRVSPerson mapped', state.data.name?.surname === 'Martinez' && state.data.marital_status === 'S');
}

// ---------------------------------------------------------------------
// DR — three data objects, three operations
// ---------------------------------------------------------------------
async function testDr() {
  section('DR — DisabledPerson / DisabilityInfo / DisabilitySupport');

  let state = {
    configuration: {
      ...baseConfiguration,
      schema: 'DisabledPerson',
      mapping: { disability_details: { impairment_type: 'impType', impairment_level: 'impLevel' } },
    },
    data: { impType: 'Physical', impLevel: 'Severe' },
  };
  state = await toDCI()(state);
  step('DisabledPerson (toDCI)', state.data);
  check('DisabledPerson mapped', state.data.disability_details?.impairment_type === 'Physical');

  mockPost('/registry/sync/get-disability-support', {
    message: { search_response: [{ data: { reg_records: { human_assistance: { type: 'mobility' } } } }] },
  });
  state = await getDisabilitySupport(() => ({
    disabled_criteria: { query_type: 'PREDICATE', query: { predicate_list: [{ attribute_name: 'member.member_identifier', attribute_value: 'M001', operator: 'eq' }] } },
  }))(state);
  step('getDisabilitySupport() response', state.data);
  check('getDisabilitySupport() called', !!state.data.message);

  mockPost('/registry/sync/get-disability-details', {
    message: { search_response: [{ data: { reg_records: { disability_status: 'Approved' } } }] },
  });
  state = await getDisabilityDetails(() => ({
    disabled_criteria: { query_type: 'PREDICATE', query: { predicate_list: [{ attribute_name: 'member.member_identifier', attribute_value: 'M001', operator: 'eq' }] } },
  }))(state);
  check('getDisabilityDetails() called', !!state.data.message);

  mockPost('/registry/sync/disabled', {
    message: { disabled_response: [{ disabled_status: 'yes' }] },
  });
  state = await checkDisabled(() => ({
    disabled_criteria: { query_type: 'PREDICATE', query: { predicate_list: [{ attribute_name: 'member.member_identifier', attribute_value: 'M001', operator: 'eq' }] } },
  }))(state);
  step('checkDisabled() response', state.data);
  check('checkDisabled() called', state.data.message?.disabled_response?.[0]?.disabled_status === 'yes');

  state = {
    configuration: {
      ...baseConfiguration,
      schema: 'DisabilitySupport',
      mapping: { human_assistance: { type: 'assistType', frequency: 'freq' } },
    },
    data: { assistType: 'mobility', freq: 'Daily' },
  };
  state = await toDCI()(state);
  step('DisabilitySupport (toDCI)', state.data);
  check('DisabilitySupport mapped', state.data.human_assistance?.type === 'mobility');
}

// ---------------------------------------------------------------------
// IBR — two data objects, two operations (unwrapped responses)
// ---------------------------------------------------------------------
async function testIbr() {
  section('IBR — IBRPerson / Beneficiary (note: unwrapped responses)');

  let state = {
    configuration: {
      ...baseConfiguration,
      schema: 'IBRPerson',
      mapping: {
        identifier: { identifier_type: '=UIN', identifier_value: 'nid' },
        name: { given_name: 'fname', surname: 'lname' },
        enrolment_status: 'enrolStatus',
      },
    },
    data: { nid: '847951632', fname: 'Sudarat', lname: 'Phumchai', enrolStatus: '3' },
  };
  state = await toDCI()(state);
  step('IBRPerson (toDCI)', state.data);
  check('IBRPerson mapped', state.data.identifier?.identifier_value === '847951632');

  mockPost('/registry/sync/enrollment/updates', {
    transaction_id: 'txn-2',
    enrolled_response: [{ reference_id: 'ref-1', status: 'succ' }],
  });
  state = await submitEnrollmentUpdates(() => ({
    enrolled_updates: { receipt_type: 'enrolled', beneficiaries: [{ identifier: { identifier_type: 'UIN', identifier_value: 'B001' } }] },
  }))(state);
  step('submitEnrollmentUpdates() response (unwrapped)', state.data);
  check('response is unwrapped (no header/message)', state.data.header === undefined && state.data.enrolled_response !== undefined);

  mockPost('/registry/sync/enrolled', {
    transaction_id: 'txn-3',
    enrolled_response: [{ reference_id: 'ref-1', enrolled_status: 'yes' }],
  });
  state = await checkEnrolled(() => ({
    enrolled_criteria: { query_type: 'PREDICATE', response_entity: 'Beneficiary', query: { predicate_list: [{ attribute_name: 'member.member_identifier', attribute_value: 'M001', operator: 'eq' }] } },
  }))(state);
  step('checkEnrolled() response (unwrapped)', state.data);
  check('response is unwrapped (no header/message)', state.data.header === undefined && state.data.enrolled_response !== undefined);

  state = {
    configuration: {
      ...baseConfiguration,
      schema: 'Beneficiary',
      mapping: { assistance_unit: 'unit', member: { member_identifier: 'memberId' } },
    },
    data: { unit: '1', memberId: 'HS0205202401' },
  };
  state = await toDCI()(state);
  step('Beneficiary (toDCI)', state.data);
  check('Beneficiary mapped', state.data.member?.member_identifier === 'HS0205202401');
}

// ---------------------------------------------------------------------
// Social — reuses Core Person/Group directly
// ---------------------------------------------------------------------
async function testSocial() {
  section('Social — reuses Core Person/Group directly (no interface-specific schema)');
  console.log('See "Core — Person, Member, Group" above; Social uses the shared Core objects as-is.');
}

// ---------------------------------------------------------------------
// ESS
// ---------------------------------------------------------------------
async function testEss() {
  section('ESS — Member + checkEnrollment()');

  let state = {
    configuration: {
      ...baseConfiguration,
      schema: 'Member',
      mapping: { member_identifier: { identifier_type: '=UIN', identifier_value: 'member_id' } },
    },
    data: { member_id: 'MB-021' },
  };
  state = await toDCI()(state);
  step('Member (toDCI, ESS context)', state.data);

  mockPost('/registry/sync/check-enrollment', {
    header: { action: 'txn-on-status' },
    message: { enrolled_response: [{ enrolled_status: 'Active' }] },
  });
  state = await checkEnrollment(() => ({
    enrolled_criteria: { query_type: 'PREDICATE', response_entity: 'Member', query: { predicate_list: [{ attribute_name: 'member.member_identifier', attribute_value: 'MB-021', operator: 'eq' }] } },
  }))(state);
  step('checkEnrollment() response', state.data);
  check('checkEnrollment() called', state.data.message?.enrolled_response?.[0]?.enrolled_status === 'Active');
}

// ---------------------------------------------------------------------
// FR
// ---------------------------------------------------------------------
async function testFr() {
  section('FR — FRPerson (nested famer_personal_details / family_details)');

  let state = {
    configuration: {
      ...baseConfiguration,
      schema: 'FRPerson',
      mapping: {
        famer_personal_details: {
          demographic_info: { name: { first_name: 'fname', last_name: 'lname' }, gender: 'sexCode' },
        },
        family_details: { group_type: 'famType', poverty_score: 'povScore' },
      },
    },
    data: { fname: 'John', lname: 'Doe', sexCode: 'Male', famType: 'family', povScore: '45.2' },
  };

  state = await toDCI()(state);
  step('FRPerson (toDCI)', state.data);
  check(
    'FRPerson mapped',
    state.data.famer_personal_details?.demographic_info?.name?.first_name === 'John' &&
      state.data.family_details?.group_type === 'family'
  );
}

// ---------------------------------------------------------------------
// EWS
// ---------------------------------------------------------------------
async function testEws() {
  section('EWS — AlertFeature (CAP 1.2 alert)');

  let state = {
    configuration: {
      ...baseConfiguration,
      schema: 'AlertFeature',
      mapping: {
        id: 'alertId',
        properties: {
          capAlert: {
            identifier: 'capId',
            sender: 'senderOrg',
            status: 'statusCode',
            info: { event: 'eventType', severity: 'severityCode', headline: 'headlineText' },
          },
        },
      },
    },
    data: {
      alertId: 'ALERT-2026-00001',
      capId: 'ALERT-2026-00001',
      senderOrg: 'ews.gov.lb',
      statusCode: 'Actual',
      eventType: 'Flash Flood',
      severityCode: 'Severe',
      headlineText: 'Flash Flood Warning',
    },
  };

  state = await toDCI()(state);
  step('AlertFeature (toDCI)', state.data);
  check('AlertFeature mapped', state.data.properties?.capAlert?.info?.headline === 'Flash Flood Warning');

  state = await fromDCI()(state);
  step('AlertFeature (fromDCI, round trip)', state.data);
  check('AlertFeature round-tripped', state.data.headlineText === 'Flash Flood Warning');
}

// ---------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------
const interfaces = {
  core: testCore,
  member: testMember,
  group: testGroup,
  crvs: testCrvs,
  dr: testDr,
  ibr: testIbr,
  social: testSocial,
  ess: testEss,
  fr: testFr,
  ews: testEws,
};

const requested = process.argv.slice(2);
const toRun = requested.length ? requested : Object.keys(interfaces);

for (const name of toRun) {
  const fn = interfaces[name];
  if (!fn) {
    console.error(`Unknown interface "${name}". Available: ${Object.keys(interfaces).join(', ')}`);
    process.exitCode = 1;
    continue;
  }
  await fn();
}

console.log(`\n${'='.repeat(70)}`);
console.log(`${passed} check(s) passed, ${failed} failed.`);
console.log('='.repeat(70));

if (failed > 0) process.exitCode = 1;
