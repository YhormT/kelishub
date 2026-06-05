const GMPL_NETWORK = 'MTN';

const isGmplNetwork = (network) => {
  const n = String(network || '').toUpperCase().trim();
  return n === GMPL_NETWORK || n.startsWith('MTN');
};

module.exports = {
  GMPL_NETWORK,
  isGmplNetwork,
};
