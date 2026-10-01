import { composeNextState } from '@openfn/language-common';
import {
  request as commonRequest,
  makeBasicAuthHeader,
} from '@openfn/language-common/util';
import nodepath from 'node:path';
import crypto from 'node:crypto';

export const prepareNextState = (state, response) => {
  const { body, ...responseWithoutBody } = response;

  if (!state.references) {
    state.references = [];
  }

  return {
    ...composeNextState(state, response.body),
    response: responseWithoutBody,
  };
};

// Build the auth header(s) for the configured authentication strategy.
// DCI registries typically front the Core API with bearer tokens, but
// basic/apiKey are supported too since sandboxes vary.
const buildAuthHeaders = configuration => {
  const { authentication = {} } = configuration;

  if (authentication.type === 'bearer' && authentication.token) {
    return { Authorization: `Bearer ${authentication.token}` };
  }

  if (authentication.type === 'apiKey' && authentication.token) {
    return { 'x-api-key': authentication.token };
  }

  if (
    authentication.type === 'basic' &&
    authentication.username &&
    authentication.password
  ) {
    return makeBasicAuthHeader(
      authentication.username,
      authentication.password
    );
  }

  return {};
};

// This helper function will call out to the backend service
// and add authorisation headers
// Refer to the common request function for options and details
export const request = (configuration = {}, method, path, options) => {
  const { baseUrl } = configuration;
  const headers = buildAuthHeaders(configuration);

  const opts = {
    // Force the response to be parsed as JSON
    parseAs: 'json',

    // Set the baseUrl from the config object
    baseUrl,

    ...options,

    // You can add extra headers here if you want to
    headers: {
      'content-type': 'application/json',
      ...headers,
      ...options?.headers,
    },
  };

  const safePath = nodepath.join(path);

  // Make the actual request
  return commonRequest(method, safePath, opts);
};

// Build a DCI MsgHeader_V1.0.0 object.
// Real cryptographic message signing (MsgSignature, ed25519) is NOT
// implemented here — see README "Signing" section. Callers may pass a
// pre-computed `signature` through `overrides.signature` if they have one.
export const buildHeader = (configuration, action, overrides = {}) => {
  const { sender_id, receiver_id, sender_uri } = configuration;

  return {
    version: '1.0.0',
    message_id: overrides.message_id || crypto.randomUUID(),
    message_ts: overrides.message_ts || new Date().toISOString(),
    action,
    sender_id,
    receiver_id,
    ...(sender_uri ? { sender_uri } : {}),
    total_count:
      overrides.total_count === undefined ? 1 : overrides.total_count,
  };
};

// Wrap a DCI request/response body into the standard
// { signature, header, message } envelope.
export const buildEnvelope = (configuration, action, message, overrides = {}) => {
  const envelope = {
    header: buildHeader(configuration, action, overrides),
    message,
  };

  if (overrides.signature) {
    envelope.signature = overrides.signature;
  }

  return envelope;
};

// Generate a DCI transaction_id if the caller didn't supply one.
export const generateTransactionId = () => crypto.randomUUID();

// Generate a DCI reference_id if the caller didn't supply one.
export const generateReferenceId = () => crypto.randomUUID();
