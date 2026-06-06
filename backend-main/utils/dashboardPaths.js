/** Dashboard path for Paystack top-up callback redirects (matches frontend routes). */
const dashboardPathForRole = (role) => {
  switch (String(role || '').trim().toUpperCase()) {
    case 'ADMIN':
      return '/admin';
    case 'USER':
      return '/user';
    case 'PREMIUM':
      return '/premium';
    case 'SUPER':
      return '/superagent';
    case 'NORMAL':
      return '/normalagent';
    case 'OTHER':
      return '/otherdashboard';
    default:
      return '/user';
  }
};

module.exports = { dashboardPathForRole };
