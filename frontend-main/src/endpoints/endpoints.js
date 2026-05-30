// Set VITE_API_URL at build time. Default keeps Railway production API host.
const BASE_URL = import.meta.env.VITE_API_URL || 'https://yhormpro-production.up.railway.app';
export default BASE_URL;
