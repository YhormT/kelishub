const axios = require('axios');
const crypto = require('crypto');

/** Get More Pay Less Data House — Agent API v1 */
const DEFAULT_GMPL_API_URL = 'https://api.getmorepaylessdatahouse.net/api/v1';

const getGmplConfig = () => {
  const baseUrl = (process.env.GMPL_API_URL || DEFAULT_GMPL_API_URL).replace(/\/$/, '');
  const apiKey = process.env.GMPL_API_KEY;
  return { baseUrl, apiKey };
};

const formatGmplError = (envelope, httpStatus) => {
  const err = envelope?.error;
  if (err?.code && err?.message) return `GMPL ${err.code}: ${err.message}`;
  if (err?.message) return `GMPL: ${err.message}`;
  if (envelope?.message) return `GMPL: ${envelope.message}`;
  return `GMPL HTTP ${httpStatus}`;
};

const gmplRequest = async (method, path, { body, params } = {}) => {
  const { baseUrl, apiKey } = getGmplConfig();
  if (!apiKey) {
    throw new Error('GMPL API is not configured. Set GMPL_API_KEY on the server.');
  }

  const url = `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  const response = await axios({
    method,
    url,
    data: body,
    params,
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    timeout: 120000,
    validateStatus: () => true,
  });

  const envelope = response.data;
  if (response.status >= 400 || envelope?.success === false) {
    throw new Error(formatGmplError(envelope, response.status));
  }

  return envelope?.data !== undefined ? envelope.data : envelope;
};

const getAgentProfile = () => gmplRequest('GET', '/agent/me');

const getWalletBalance = () => gmplRequest('GET', '/agent/wallet/balance');

const listBundles = (network, { search, page, limit } = {}) =>
  gmplRequest('GET', '/agent/bundles', {
    params: {
      network: String(network || 'MTN').toUpperCase(),
      ...(search ? { search } : {}),
      ...(page ? { page } : {}),
      ...(limit ? { limit } : {}),
    },
  });

const placeOrder = ({ bundleId, phoneNumber, idempotencyKey, email }) =>
  gmplRequest('POST', '/agent/orders', {
    body: {
      bundleId,
      phoneNumber,
      idempotencyKey,
      ...(email ? { email } : {}),
    },
  });

const placeBulkOrder = ({ network, idempotencyKey, recipients }) =>
  gmplRequest('POST', '/agent/orders/bulk', {
    body: {
      network: String(network || 'MTN').toUpperCase(),
      idempotencyKey,
      recipients,
    },
  });

const getOrder = (orderId) =>
  gmplRequest('GET', `/agent/orders/${encodeURIComponent(String(orderId))}`);

const listOrders = (params = {}) =>
  gmplRequest('GET', '/agent/orders', { params });

/**
 * Verify GMPL webhook X-Telecom-Signature (HMAC-SHA256, Stripe-style).
 * Header format: t=<unix-ts>,v1=<hex-sig>
 */
const verifyWebhookSignature = (rawBody, signatureHeader, secret) => {
  if (!secret) return true;
  if (!signatureHeader || !rawBody) return false;

  try {
    const parts = String(signatureHeader).split(',');
    let ts = null;
    let sig = null;
    for (const part of parts) {
      const [k, v] = part.trim().split('=');
      if (k === 't') ts = v;
      if (k === 'v1') sig = v;
    }
    if (!ts || !sig) return false;

    const ageSec = Math.abs(Date.now() / 1000 - parseInt(ts, 10));
    if (ageSec > 300) return false;

    const expected = crypto
      .createHmac('sha256', secret)
      .update(`${ts}.${rawBody}`)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(sig, 'hex'),
      Buffer.from(expected, 'hex')
    );
  } catch {
    return false;
  }
};

module.exports = {
  DEFAULT_GMPL_API_URL,
  getGmplConfig,
  getAgentProfile,
  getWalletBalance,
  listBundles,
  placeOrder,
  placeBulkOrder,
  getOrder,
  listOrders,
  verifyWebhookSignature,
};
