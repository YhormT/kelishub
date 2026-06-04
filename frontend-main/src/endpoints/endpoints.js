// Set VITE_API_URL at build time. Default keeps Railway production API host.
// const BASE_URL = import.meta.env.VITE_API_URL || 'https://yhormpro-production.up.railway.app';
// export default BASE_URL;

// Build-time API origin (Render: set VITE_API_URL on kellishub-web if you override the default).
// Frontend is on kellishub.com; API is api.kellishub.com — do not use the marketing domain for /api/*.
const BASE_URL =
  import.meta.env.VITE_API_URL || 'https://api.kellishub.com';
export default BASE_URL;
