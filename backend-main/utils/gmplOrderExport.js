const crypto = require('crypto');
const XLSX = require('xlsx');
const gmplService = require('../services/gmplService');

const normalizeGhPhone = (phone) => {
  let p = String(phone || '').replace(/\D/g, '');
  if (p.startsWith('233') && p.length === 12) p = '0' + p.slice(3);
  return p;
};

const networkToGmplApiNetwork = (network) => {
  const n = String(network || '').toUpperCase().trim();
  if (n.includes('MTN')) return 'MTN';
  if (n.includes('TELECEL') || n.includes('VODAFONE')) return 'TELECEL';
  throw new Error(`Unsupported network for GMPL: ${network}`);
};

/** @deprecated use networkToGmplApiNetwork — kept for imports */
const networkToGmplProvider = (network) =>
  networkToGmplApiNetwork(network).toLowerCase();

const parseDataSizeGb = (bundle) => {
  const s = String(bundle || '').trim();
  const gbMatch = s.match(/(\d+(?:\.\d+)?)\s*gb/i);
  if (gbMatch) return parseFloat(gbMatch[1]);
  const numMatch = s.replace(/[^0-9.]/g, '');
  const n = parseFloat(numMatch);
  return Number.isFinite(n) && n > 0 ? n : null;
};

const buildSupplierExcelBuffer = (rows) => {
  const wsData = [['Phone Number', 'Data Size']];
  for (const row of rows) {
    let phone = row.phone || '';
    if (phone.startsWith('233')) phone = '0' + phone.substring(3);
    const dataSize = parseDataSizeGb(row.bundle) ?? (row.bundle || '').replace(/[^0-9.]/g, '');
    wsData.push([phone, dataSize]);
  }
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  XLSX.utils.book_append_sheet(wb, ws, 'Orders');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
};

const rowsToRecipients = (rows) => {
  const recipients = [];
  const errors = [];

  for (const row of rows) {
    const phoneNumber = normalizeGhPhone(row.phone);
    const dataSizeGb = parseDataSizeGb(row.bundle);

    if (!phoneNumber || phoneNumber.length < 9) {
      errors.push(`Invalid phone: ${row.phone || 'empty'}`);
      continue;
    }
    if (!dataSizeGb) {
      errors.push(`Could not parse data size (GB) for ${phoneNumber}: "${row.bundle || ''}"`);
      continue;
    }

    recipients.push({ phoneNumber, dataSizeGb });
  }

  if (errors.length) {
    throw new Error(errors.slice(0, 3).join('; ') + (errors.length > 3 ? '…' : ''));
  }
  if (!recipients.length) {
    throw new Error('No valid recipients to submit to GMPL');
  }

  return recipients;
};

/**
 * Submit batch rows to GMPL via POST /agent/orders/bulk (JSON, not Excel upload).
 */
const submitRowsToGmpl = async (rows, network, { idempotencyKey, batchId } = {}) => {
  if (!process.env.GMPL_API_KEY) {
    throw new Error('GMPL API is not configured. Set GMPL_API_KEY on the server.');
  }

  const recipients = rowsToRecipients(rows);
  const key =
    idempotencyKey ||
    (batchId != null ? `kellishub-batch-${batchId}` : null) ||
    crypto.randomUUID();

  const result = await gmplService.placeBulkOrder({
    network: networkToGmplApiNetwork(network),
    idempotencyKey: key,
    recipients,
  });

  try {
    console.log('[GMPL] bulk response shape:', JSON.stringify(result).slice(0, 800));
  } catch (_) {
    /* logging is best-effort */
  }

  return result;
};

const parseExcelFileToRows = (filePath) => {
  const wb = XLSX.readFile(filePath);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  return data.map((row) => {
    const phone =
      row['Phone Number'] ||
      row['Phone'] ||
      row.phoneNumber ||
      row.phone ||
      row.Phone ||
      '';
    const bundle =
      row['Data Size'] ||
      row['Data size'] ||
      row.dataSize ||
      row.bundle ||
      row.Bundle ||
      '';
    return { phone: String(phone), bundle: String(bundle) };
  });
};

module.exports = {
  normalizeGhPhone,
  networkToGmplProvider,
  networkToGmplApiNetwork,
  parseDataSizeGb,
  buildSupplierExcelBuffer,
  rowsToRecipients,
  submitRowsToGmpl,
  parseExcelFileToRows,
};
