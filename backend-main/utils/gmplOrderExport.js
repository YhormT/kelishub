const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const os = require('os');
const gmplService = require('../services/gmplService');

const networkToGmplProvider = (network) => {
  const n = String(network || '')
    .toUpperCase()
    .trim();
  if (n.includes('MTN')) return 'mtn';
  if (n.includes('TELECEL') || n.includes('VODAFONE')) return 'telecel';
  if (n.includes('AIRTEL') || n.includes('TIGO')) return 'airteltigo';
  throw new Error(`Unsupported network for GMPL: ${network}`);
};

const buildSupplierExcelBuffer = (rows) => {
  const wsData = [['Phone Number', 'Data Size']];
  for (const row of rows) {
    let phone = row.phone || '';
    if (phone.startsWith('233')) phone = '0' + phone.substring(3);
    const dataSize = (row.bundle || '').replace(/[^0-9.]/g, '');
    wsData.push([phone, dataSize]);
  }
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  XLSX.utils.book_append_sheet(wb, ws, 'Orders');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
};

const submitRowsToGmpl = async (rows, network) => {
  if (!process.env.GMPL_API_KEY) {
    throw new Error('GMPL API is not configured. Set GMPL_API_KEY on the server.');
  }
  const buffer = buildSupplierExcelBuffer(rows);
  const tmpPath = path.join(os.tmpdir(), `gmpl-admin-${Date.now()}.xlsx`);
  fs.writeFileSync(tmpPath, buffer);
  try {
    return await gmplService.submitAgentOrderFile(
      tmpPath,
      networkToGmplProvider(network)
    );
  } finally {
    try {
      fs.unlinkSync(tmpPath);
    } catch (_) {
      /* ignore */
    }
  }
};

module.exports = {
  networkToGmplProvider,
  buildSupplierExcelBuffer,
  submitRowsToGmpl,
};
