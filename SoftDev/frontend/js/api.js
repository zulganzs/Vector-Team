const API_BASE_URL = "https://testing-production-3853.up.railway.app";

/**
 * Fetches the latest sensor data from the backend.
 * @returns {Promise<Object>} The sensor data object.
 */
export async function fetchSensorData() {
    const response = await fetch(`${API_BASE_URL}/api/data`);
    if (!response.ok) {
        throw response;
    }
    return await response.json();
}

/**
 * Fetches the historical sensor data from the backend.
 * @returns {Promise<Array>} Array of historical sensor data objects.
 */
export async function fetchHistory() {
    const response = await fetch(`${API_BASE_URL}/api/history`);
    if (!response.ok) {
        throw response;
    }
    return await response.json();
}

/**
 * Fetches the ESP connection status from the backend.
 * @returns {Promise<Object>} The connection status object.
 */
export async function fetchStatus() {
    const response = await fetch(`${API_BASE_URL}/api/status`);
    if (!response.ok) {
        throw response;
    }
    return await response.json();
}

/**
 * Fetches the health status of the backend.
 * @returns {Promise<Object>} The health status object.
 */
export async function fetchHealth() {
    const response = await fetch(`${API_BASE_URL}/api/health`);
    if (!response.ok) {
        throw response;
    }
    return await response.json();
}
