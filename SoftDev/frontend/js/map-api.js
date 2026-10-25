// When the map page is served locally (run.bat on localhost:3000), talk to the
// local backend instead of the deployed Railway API. Deployed builds (Vercel)
// keep using the production URL.
const API_BASE_URL = ["localhost", "127.0.0.1"].includes(location.hostname)
    ? location.origin
    : "https://testing-production-3853.up.railway.app";

/**
 * Fetches the latest device data from the backend.
 * @returns {Promise<Object>} The device data object.
 */
export async function fetchDeviceData() {
    const response = await fetch(`${API_BASE_URL}/api/data`);
    if (!response.ok) {
        throw response;
    }
    return await response.json();
}
