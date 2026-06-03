/** Normalize role from API / localStorage for route guards */
export const normalizeRole = (role) => (role || '').trim().toUpperCase();

export const getStoredAuth = () => {
  const token = localStorage.getItem('token');
  const role = normalizeRole(localStorage.getItem('role'));
  const userId = localStorage.getItem('userId');
  return { token, role, userId };
};

export const persistAuth = (user, token) => {
  localStorage.setItem('token', token);
  localStorage.setItem('role', normalizeRole(user.role));
  localStorage.setItem('name', user.name);
  localStorage.setItem('email', user.email);
  localStorage.setItem('userId', String(user.id));
  localStorage.setItem('isLoggedIn', 'true');
  localStorage.setItem('isSuspended', user.isSuspended ? 'true' : 'false');
};

export const dashboardPathForRole = (role) => {
  switch (normalizeRole(role)) {
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
      return '/login';
  }
};
