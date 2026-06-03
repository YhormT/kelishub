const axios = require('axios');
const fs = require('fs');
const path = require('path');

const getGmplConfig = () => {
  const baseUrl = (process.env.GMPL_API_URL || 'https://api.gmpl.com').replace(/\/$/, '');
  const apiKey = process.env.GMPL_API_KEY;
  return { baseUrl, apiKey };
};

/**
 * Submit an agent order file to GMPL for fulfillment.
 * @see POST /api/orders/agents/new
 */
const submitAgentOrderFile = async (filePath, networkProvider) => {
  const { baseUrl, apiKey } = getGmplConfig();

  if (!apiKey) {
    throw new Error('GMPL API is not configured. Set GMPL_API_KEY on the server.');
  }

  const network = String(networkProvider || '').trim().toLowerCase();
  if (!network) {
    throw new Error('network_provider is required (e.g. mtn, telecel, airteltigo)');
  }

  const url = `${baseUrl}/api/orders/agents/new`;
  const fileBuffer = fs.readFileSync(filePath);
  const filename = path.basename(filePath) || 'order.xlsx';

  const boundary = `----kellishub${Date.now()}`;
  const parts = [];

  const appendField = (name, value) => {
    parts.push(
      `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="${name}"\r\n\r\n` +
        `${value}\r\n`
    );
  };

  const appendFile = (name, buffer, fname) => {
    parts.push(
      `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="${name}"; filename="${fname}"\r\n` +
        `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n\r\n`
    );
    parts.push(buffer);
    parts.push('\r\n');
  };

  appendFile('orderFile', fileBuffer, filename);
  appendField('network_provider', network);
  parts.push(`--${boundary}--\r\n`);

  const body = Buffer.concat(
    parts.map((p) => (Buffer.isBuffer(p) ? p : Buffer.from(p, 'utf8')))
  );

  const response = await axios.post(url, body, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'x-clerk-api-key': apiKey,
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': body.length,
    },
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
    timeout: 120000,
    validateStatus: (status) => status < 500,
  });

  if (response.status >= 400) {
    const msg =
      response.data?.message ||
      response.data?.error ||
      JSON.stringify(response.data) ||
      `GMPL returned HTTP ${response.status}`;
    throw new Error(`GMPL order failed: ${msg}`);
  }

  return response.data;
};

module.exports = {
  submitAgentOrderFile,
  getGmplConfig,
};
