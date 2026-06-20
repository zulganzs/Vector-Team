const API_BASE_URL = "https://testing-production-3853.up.railway.app";

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
