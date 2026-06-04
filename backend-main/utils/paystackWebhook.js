const crypto = require('crypto');

/**
 * Verify Paystack webhook HMAC (requires raw request body buffer).
 */
const verifyPaystackSignature = (rawBody, signatureHeader) => {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret || !signatureHeader) return false;

  const payload = Buffer.isBuffer(rawBody)
    ? rawBody
    : typeof rawBody === 'string'
      ? rawBody
      : null;

  if (!payload || payload.length === 0) return false;

  const hash = crypto.createHmac('sha512', secret).update(payload).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(signatureHeader));
  } catch {
    return false;
  }
};

module.exports = { verifyPaystackSignature };
