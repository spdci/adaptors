import { expandReferences } from '@openfn/language-common/util';
import {
  dataPath,
  dataValue,
  each,
  field,
  fields,
  fn,
  fnIf,
  map,
  merge,
  sourceValue,
} from '@openfn/language-common';

import * as util from './Utils.js';

/**
 * ================================
 * HTTP Request Functions
 * ================================
 */

/**
 * Make a GET request
 */
export function get(path, options) {
  return request('GET', path, null, options);
}

/**
 * Make a POST request
 */
export function post(path, body, options) {
  return request('POST', path, body, options);
}

/**
 * Make HTTP request
 */
export function request(method, path, body, options = {}) {
  return async state => {
    const [resolvedMethod, resolvedPath, resolvedBody, resolvedOptions] =
      expandReferences(state, method, path, body, options);

    const response = await util.request(
      state.configuration,
      resolvedMethod,
      resolvedPath,
      {
        body: resolvedBody,
        ...resolvedOptions,
      }
    );

    return util.prepareNextState(state, response);
  };
}

/**
 * ================================
 * DCI Core Registry Operations
 * (see registry_core_api_v1.0.0.yaml)
 * ================================
 */

// Fill in reference_id/timestamp on each item of a batch list
// (search_request/subscribe_request) if the caller didn't supply them.
const fillBatchDefaults = list =>
  (list || []).map(item => ({
    reference_id: item.reference_id || util.generateReferenceId(),
    timestamp: item.timestamp || new Date().toISOString(),
    ...item,
  }));

/**
 * Search the registry (async).
 *
 * Posts to /registry/search. The registry replies asynchronously to the
 * sender_uri's /on-search endpoint rather than in the HTTP response body —
 * see registry_core_api_v1.0.0.yaml.
 *
 * @param {object} searchRequest - matches the DCI SearchRequest schema:
 *   { transaction_id?, search_request: [{ reference_id?, timestamp?, search_criteria, locale? }] }
 * @param {object} options - extra request options (headers, etc)
 * @example <caption>Search by demographic criteria</caption>
 * search({
 *   search_request: [
 *     {
 *       search_criteria: {
 *         reg_type: 'crvs',
 *         reg_record_type: 'BIRTH',
 *         query_type: 'PREDICATE',
 *         query: { ... },
 *       },
 *     },
 *   ],
 * });
 */
export function search(searchRequest, options) {
  return async state => {
    const [resolvedRequest, resolvedOptions] = expandReferences(
      state,
      searchRequest,
      options
    );

    const message = {
      transaction_id:
        resolvedRequest.transaction_id || util.generateTransactionId(),
      search_request: fillBatchDefaults(resolvedRequest.search_request),
    };

    const body = util.buildEnvelope(
      state.configuration,
      'search',
      message,
      resolvedOptions
    );

    const response = await util.request(
      state.configuration,
      'POST',
      '/registry/search',
      { body, ...resolvedOptions }
    );

    return util.prepareNextState(state, response);
  };
}

/**
 * Search the registry (sync).
 *
 * Posts to /registry/sync/search and receives the SearchResponse directly
 * in the HTTP response, instead of via an /on-search callback.
 *
 * @param {object} searchRequest - matches the DCI SearchRequest schema, see {@link search}
 * @param {object} options - extra request options (headers, etc)
 * @example <caption>Search synchronously by identifier</caption>
 * searchSync({
 *   search_request: [
 *     {
 *       search_criteria: {
 *         reg_type: 'crvs',
 *         reg_record_type: 'BIRTH',
 *         query_type: 'PREDICATE',
 *         query: { ... },
 *       },
 *     },
 *   ],
 * });
 */
export function searchSync(searchRequest, options) {
  return async state => {
    const [resolvedRequest, resolvedOptions] = expandReferences(
      state,
      searchRequest,
      options
    );

    const message = {
      transaction_id:
        resolvedRequest.transaction_id || util.generateTransactionId(),
      search_request: fillBatchDefaults(resolvedRequest.search_request),
    };

    const body = util.buildEnvelope(
      state.configuration,
      'search',
      message,
      resolvedOptions
    );

    const response = await util.request(
      state.configuration,
      'POST',
      '/registry/sync/search',
      { body, ...resolvedOptions }
    );

    return util.prepareNextState(state, response);
  };
}

/**
 * Subscribe to a registry life event.
 *
 * Posts to /registry/subscribe.
 *
 * @param {object} subscribeRequest - matches the DCI SubscribeRequest schema:
 *   { transaction_id?, subscribe_request: [{ reference_id?, timestamp?, subscribe_criteria, locale? }] }
 * @param {object} options - extra request options (headers, etc)
 * @example <caption>Subscribe to birth registration events</caption>
 * subscribe({
 *   subscribe_request: [
 *     {
 *       subscribe_criteria: {
 *         reg_type: 'crvs',
 *         reg_event_type: 'BIRTH',
 *         frequency: 'REAL_TIME',
 *         filter_type: 'PREDICATE',
 *         filter: { ... },
 *         notify_record_type: 'BIRTH',
 *       },
 *     },
 *   ],
 * });
 */
export function subscribe(subscribeRequest, options) {
  return async state => {
    const [resolvedRequest, resolvedOptions] = expandReferences(
      state,
      subscribeRequest,
      options
    );

    const message = {
      transaction_id:
        resolvedRequest.transaction_id || util.generateTransactionId(),
      subscribe_request: fillBatchDefaults(resolvedRequest.subscribe_request),
    };

    const body = util.buildEnvelope(
      state.configuration,
      'subscribe',
      message,
      resolvedOptions
    );

    const response = await util.request(
      state.configuration,
      'POST',
      '/registry/subscribe',
      { body, ...resolvedOptions }
    );

    return util.prepareNextState(state, response);
  };
}

/**
 * Unsubscribe from existing registry subscription(s).
 *
 * Posts to /registry/unsubscribe.
 *
 * @param {object} unsubscribeRequest - matches the DCI UnSubscribeRequest schema:
 *   { transaction_id?, timestamp?, subscription_codes }
 * @param {object} options - extra request options (headers, etc)
 * @example <caption>Unsubscribe by subscription code</caption>
 * unsubscribe({ subscription_codes: ['sub-001'] });
 */
export function unsubscribe(unsubscribeRequest, options) {
  return async state => {
    const [resolvedRequest, resolvedOptions] = expandReferences(
      state,
      unsubscribeRequest,
      options
    );

    const message = {
      transaction_id:
        resolvedRequest.transaction_id || util.generateTransactionId(),
      timestamp: resolvedRequest.timestamp || new Date().toISOString(),
      subscription_codes: resolvedRequest.subscription_codes,
    };

    const body = util.buildEnvelope(
      state.configuration,
      'unsubscribe',
      message,
      resolvedOptions
    );

    const response = await util.request(
      state.configuration,
      'POST',
      '/registry/unsubscribe',
      { body, ...resolvedOptions }
    );

    return util.prepareNextState(state, response);
  };
}

/**
 * Check the status of a previously submitted search/subscribe/unsubscribe
 * request (async).
 *
 * Posts to /registry/txn/status.
 *
 * @param {object} txnStatusRequest - matches the DCI TxnStatusRequest schema:
 *   { transaction_id?, txnstatus_request: { reference_id, txn_type, attribute_type, attribute_value, locale? } }
 * @param {object} options - extra request options (headers, etc)
 * @example <caption>Check the status of a search request by transaction_id</caption>
 * checkTxnStatus({
 *   transaction_id: 'txn-001',
 *   txnstatus_request: {
 *     reference_id: 'ref-001',
 *     txn_type: 'search',
 *     attribute_type: 'transaction_id',
 *     attribute_value: 'txn-001',
 *   },
 * });
 */
export function checkTxnStatus(txnStatusRequest, options) {
  return async state => {
    const [resolvedRequest, resolvedOptions] = expandReferences(
      state,
      txnStatusRequest,
      options
    );

    const message = {
      transaction_id:
        resolvedRequest.transaction_id || util.generateTransactionId(),
      txnstatus_request: resolvedRequest.txnstatus_request,
    };

    const body = util.buildEnvelope(
      state.configuration,
      'txn-status',
      message,
      resolvedOptions
    );

    const response = await util.request(
      state.configuration,
      'POST',
      '/registry/txn/status',
      { body, ...resolvedOptions }
    );

    return util.prepareNextState(state, response);
  };
}

/**
 * ================================
 * Interface-Specific Operations
 *
 * Extra sync endpoints unique to the dr/ibr/ess extensions — every other
 * DCI interface (crvs, social, fr, and the generic Core interface itself)
 * is fully covered by search/searchSync/subscribe/unsubscribe/checkTxnStatus
 * above, since reg_type/reg_record_type are caller-supplied strings, not
 * hardcoded per interface. ews has no endpoints beyond subscribe/unsubscribe
 * (also already covered) — see registry_core_api_v1.0.0.yaml vs.
 * {dr,ibr,ess}_api_v1.0.0.yaml (reference only).
 * ================================
 */

/**
 * Check disability support/status for a member (DR interface).
 *
 * Posts to /registry/sync/get-disability-support. Response is the standard
 * wrapped envelope; state.data.message.search_response[].data.reg_records
 * is shaped as DisabilitySupport (see configuration-schema.json
 * `disabilitySupportMapping`).
 *
 * @param {object} request - { transaction_id?, disabled_criteria: { query_type, query } }
 * @param {object} options - extra request options (headers, etc)
 * @example <caption>Check disability support by member identifier</caption>
 * getDisabilitySupport({
 *   disabled_criteria: {
 *     query_type: 'PREDICATE',
 *     query: { predicate_list: [{ attribute_name: 'member.member_identifier', attribute_value: 'M001', operator: 'eq' }] },
 *   },
 * });
 */
export function getDisabilitySupport(request, options) {
  return async state => {
    const [resolvedRequest, resolvedOptions] = expandReferences(
      state,
      request,
      options
    );

    const message = {
      transaction_id:
        resolvedRequest.transaction_id || util.generateTransactionId(),
      disabled_criteria: resolvedRequest.disabled_criteria,
    };

    const body = util.buildEnvelope(
      state.configuration,
      'search',
      message,
      resolvedOptions
    );

    const response = await util.request(
      state.configuration,
      'POST',
      '/registry/sync/get-disability-support',
      { body, ...resolvedOptions }
    );

    return util.prepareNextState(state, response);
  };
}

/**
 * Fetch detailed disability info for a member (DR interface).
 *
 * Posts to /registry/sync/get-disability-details. Same request shape as
 * {@link getDisabilitySupport} (the spec reuses GetDisabilitySupportRequest
 * for both endpoints). Response is the standard wrapped envelope;
 * state.data.message.search_response[].data.reg_records is shaped as
 * DisabilityInfo (see configuration-schema.json `disabilityInfoMapping`).
 *
 * @param {object} request - { transaction_id?, disabled_criteria: { query_type, query } }
 * @param {object} options - extra request options (headers, etc)
 * @example <caption>Fetch disability details by member identifier</caption>
 * getDisabilityDetails({
 *   disabled_criteria: {
 *     query_type: 'PREDICATE',
 *     query: { predicate_list: [{ attribute_name: 'member.member_identifier', attribute_value: 'M001', operator: 'eq' }] },
 *   },
 * });
 */
export function getDisabilityDetails(request, options) {
  return async state => {
    const [resolvedRequest, resolvedOptions] = expandReferences(
      state,
      request,
      options
    );

    const message = {
      transaction_id:
        resolvedRequest.transaction_id || util.generateTransactionId(),
      disabled_criteria: resolvedRequest.disabled_criteria,
    };

    const body = util.buildEnvelope(
      state.configuration,
      'search',
      message,
      resolvedOptions
    );

    const response = await util.request(
      state.configuration,
      'POST',
      '/registry/sync/get-disability-details',
      { body, ...resolvedOptions }
    );

    return util.prepareNextState(state, response);
  };
}

/**
 * Check whether a member is registered as disabled (DR interface).
 *
 * Posts to /registry/sync/disabled. Response is the standard wrapped
 * envelope; state.data.message.disabled_response[] has a simple
 * `disabled_status: 'yes' | 'no'` per entry (not a full record).
 *
 * @param {object} request - { transaction_id?, disabled_criteria: { query_type, query } }
 * @param {object} options - extra request options (headers, etc)
 * @example <caption>Check disabled status by member identifier</caption>
 * checkDisabled({
 *   disabled_criteria: {
 *     query_type: 'PREDICATE',
 *     query: { predicate_list: [{ attribute_name: 'member.member_identifier', attribute_value: 'M001', operator: 'eq' }] },
 *   },
 * });
 */
export function checkDisabled(request, options) {
  return async state => {
    const [resolvedRequest, resolvedOptions] = expandReferences(
      state,
      request,
      options
    );

    const message = {
      transaction_id:
        resolvedRequest.transaction_id || util.generateTransactionId(),
      disabled_criteria: resolvedRequest.disabled_criteria,
    };

    const body = util.buildEnvelope(
      state.configuration,
      'search',
      message,
      resolvedOptions
    );

    const response = await util.request(
      state.configuration,
      'POST',
      '/registry/sync/disabled',
      { body, ...resolvedOptions }
    );

    return util.prepareNextState(state, response);
  };
}

/**
 * Submit enrolled/updated beneficiary details to the registry (IBR interface).
 *
 * Posts to /registry/sync/enrollment/updates with header action 'notify'
 * (SP-System -> Registry direction, per the spec). Unlike every other
 * operation in this adaptor, the response is NOT the standard
 * { signature, header, message } envelope — it's the EnrollmentUpdatesResponse
 * body directly: state.data = { transaction_id, correlation_id, enrolled_response: [...] }.
 *
 * @param {object} request - { transaction_id?, enrolled_updates: { receipt_type, beneficiaries } }
 * @param {object} options - extra request options (headers, etc)
 * @example <caption>Submit newly enrolled beneficiaries</caption>
 * submitEnrollmentUpdates({
 *   enrolled_updates: { receipt_type: 'enrolled', beneficiaries: [{ identifier: { identifier_type: 'UIN', identifier_value: 'B001' } }] },
 * });
 */
export function submitEnrollmentUpdates(request, options) {
  return async state => {
    const [resolvedRequest, resolvedOptions] = expandReferences(
      state,
      request,
      options
    );

    const message = {
      transaction_id:
        resolvedRequest.transaction_id || util.generateTransactionId(),
      enrolled_updates: resolvedRequest.enrolled_updates,
    };

    const body = util.buildEnvelope(
      state.configuration,
      'notify',
      message,
      resolvedOptions
    );

    const response = await util.request(
      state.configuration,
      'POST',
      '/registry/sync/enrollment/updates',
      { body, ...resolvedOptions }
    );

    return util.prepareNextState(state, response);
  };
}

/**
 * Check which programmes a person is enrolled in (IBR interface).
 *
 * Posts to /registry/sync/enrolled. Like {@link submitEnrollmentUpdates},
 * the response is NOT the standard envelope — it's the EnrolledResponse
 * body directly: state.data = { transaction_id, correlation_id, enrolled_response: [...] },
 * each entry carrying `enrolled_status: 'yes' | 'no'`.
 *
 * @param {object} request - { transaction_id?, enrolled_criteria: { query_type, response_entity, query } }
 * @param {object} options - extra request options (headers, etc)
 * @example <caption>Check enrollment by identifier</caption>
 * checkEnrolled({
 *   enrolled_criteria: {
 *     query_type: 'PREDICATE',
 *     response_entity: 'Beneficiary',
 *     query: { predicate_list: [{ attribute_name: 'member.member_identifier', attribute_value: 'M001', operator: 'eq' }] },
 *   },
 * });
 */
export function checkEnrolled(request, options) {
  return async state => {
    const [resolvedRequest, resolvedOptions] = expandReferences(
      state,
      request,
      options
    );

    const message = {
      transaction_id:
        resolvedRequest.transaction_id || util.generateTransactionId(),
      enrolled_criteria: resolvedRequest.enrolled_criteria,
    };

    const body = util.buildEnvelope(
      state.configuration,
      'search',
      message,
      resolvedOptions
    );

    const response = await util.request(
      state.configuration,
      'POST',
      '/registry/sync/enrolled',
      { body, ...resolvedOptions }
    );

    return util.prepareNextState(state, response);
  };
}

/**
 * Check enrollment status for a member (ESS interface).
 *
 * Posts to /registry/sync/check-enrollment with header action
 * 'enrollementstatus' (this literal spelling, typo included, is what the
 * spec defines). Response is the standard wrapped envelope;
 * state.data.message.enrolled_response[] carries a richer status enum than
 * IBR's (Active/Deceased/Suspended/Inactive/Reinstated/'Awaiting Renewal').
 *
 * @param {object} request - { transaction_id?, enrolled_criteria: { query_type, response_entity, query } }
 * @param {object} options - extra request options (headers, etc)
 * @example <caption>Check enrollment status by identifier</caption>
 * checkEnrollment({
 *   enrolled_criteria: {
 *     query_type: 'PREDICATE',
 *     response_entity: 'Member',
 *     query: { predicate_list: [{ attribute_name: 'member.member_identifier', attribute_value: 'M001', operator: 'eq' }] },
 *   },
 * });
 */
export function checkEnrollment(request, options) {
  return async state => {
    const [resolvedRequest, resolvedOptions] = expandReferences(
      state,
      request,
      options
    );

    const message = {
      transaction_id:
        resolvedRequest.transaction_id || util.generateTransactionId(),
      enrolled_criteria: resolvedRequest.enrolled_criteria,
    };

    const body = util.buildEnvelope(
      state.configuration,
      'enrollementstatus',
      message,
      resolvedOptions
    );

    const response = await util.request(
      state.configuration,
      'POST',
      '/registry/sync/check-enrollment',
      { body, ...resolvedOptions }
    );

    return util.prepareNextState(state, response);
  };
}

/**
 * ================================
 * DCI Object Mapping (toDCI / fromDCI)
 * ================================
 *
 * Generic mapping engine, driven entirely by `configuration.mapping`
 * (and optionally `configuration.codeLists`). Works the same way for
 * any of the supported `configuration.schema` values (Person, Member,
 * Group) — see configuration-schema.json for the expected mapping shape
 * per schema, based on schemas/core/v1/data/{Person,Member,Group}.jsonld.
 *
 * Limitation: only single values/nested objects are supported. DCI list
 * fields (e.g. Person.identifier, Member.related_person, Group.member_list)
 * are not mapped — map those manually in job code if needed.
 */

/**
 * Get a nested value from a source object using a dot-path.
 * A path prefixed with '=' is treated as a constant value instead.
 */
const getValue = (obj, path) => {
  if (!path) {
    return undefined;
  }

  if (path.startsWith('=')) {
    return path.substring(1);
  }

  return path.split('.').reduce((value, key) => value?.[key], obj);
};

/**
 * Transform a local date into DCI ISO format.
 *
 * Example: 21/09/1995 (with sourceFormat DD/MM/YYYY) becomes
 * 1995-09-21T00:00:00
 */
const transformDate = (value, config) => {
  if (!value) {
    return undefined;
  }

  if (config.sourceFormat === 'DD/MM/YYYY') {
    const [day, month, year] = value.split('/');
    return `${year}-${month}-${day}T00:00:00`;
  }

  return new Date(value).toISOString().replace('.000', '');
};

/**
 * Transform a local code value using a codeLists lookup.
 */
const transformCode = (value, mapping) => {
  if (!value || !mapping) {
    return value;
  }

  return mapping[value] || value;
};

/**
 * Recursively build a DCI object from a mapping configuration.
 */
const buildDCIObject = (mapping, source, codeLists = {}) => {
  const result = {};

  Object.entries(mapping).forEach(([key, rule]) => {
    // nested object
    if (typeof rule === 'object' && rule !== null && !rule.source) {
      result[key] = buildDCIObject(rule, source, codeLists[key] || {});
      return;
    }

    let value;

    // object rule (date-style: { source, sourceFormat, targetFormat })
    if (typeof rule === 'object' && rule.source) {
      value = getValue(source, rule.source);

      if (rule.targetFormat) {
        value = transformDate(value, rule);
      }
    } else {
      value = getValue(source, rule);
    }

    if (codeLists[key]) {
      value = transformCode(value, codeLists[key]);
    }

    if (value !== undefined) {
      result[key] = value;
    }
  });

  return result;
};

/**
 * Convert local data into a DCI object (Person, Member, or Group, per
 * configuration.schema) using configuration.mapping/codeLists.
 *
 * @example <caption>Map local data into a DCI Person</caption>
 * toDCI();
 */
export function toDCI() {
  return async state => {
    const { schema, mapping, codeLists } = state.configuration;

    if (!schema || !mapping) {
      throw new Error(
        'toDCI() requires configuration.schema and configuration.mapping to be set'
      );
    }

    const dciObject = buildDCIObject(mapping, state.data, codeLists);

    return {
      ...state,
      data: dciObject,
    };
  };
}

/**
 * Convert a DCI object (Person, Member, or Group) in state.data back into
 * local field names, using the same configuration.mapping used by toDCI().
 *
 * @example <caption>Map a DCI Person back into local field names</caption>
 * fromDCI();
 */
export function fromDCI() {
  return async state => {
    const { schema, mapping } = state.configuration;

    if (!schema || !mapping) {
      throw new Error(
        'fromDCI() requires configuration.schema and configuration.mapping to be set'
      );
    }

    const source = {};

    const reverseMap = (currentMapping, currentData) => {
      Object.entries(currentMapping).forEach(([dciField, rule]) => {
        const isNested =
          typeof rule === 'object' && rule !== null && !rule.source;

        if (isNested) {
          reverseMap(rule, currentData?.[dciField] || {});
          return;
        }

        const sourcePath =
          typeof rule === 'object' && rule.source ? rule.source : rule;

        if (
          currentData?.[dciField] !== undefined &&
          !sourcePath.startsWith('=')
        ) {
          source[sourcePath] = currentData[dciField];
        }
      });
    };

    reverseMap(mapping, state.data);

    return {
      ...state,
      data: source,
    };
  };
}

/**
 * Export OpenFn utilities
 */
export {
  dataPath,
  dataValue,
  each,
  field,
  fields,
  fn,
  fnIf,
  map,
  merge,
  sourceValue,
  util,
};
