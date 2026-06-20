export const mapState = {
    deviceStatus: false, // true = online, false = offline
    lastSeen: null, // timestamp
    history: [], // array of history objects
    isOffline: false, // true = disconnected from backend, false = connected
};

/**
 * Updates the device status.
 * @param {boolean} status - True for online, false for offline.
 */
export function updateDeviceStatus(status) {
    mapState.deviceStatus = status;
}

/**
 * Updates the last seen timestamp.
 * @param {number|string} timestamp - The last seen timestamp.
 */
export function updateLastSeen(timestamp) {
    mapState.lastSeen = timestamp;
}

/**
 * Adds a new history entry. Keeps only the last 10 entries.
 * @param {Object} entry - The history entry object.
 */
export function addHistoryEntry(entry) {
    const exists = mapState.history.some((h) => h.time === entry.time);
    if (!exists) {
        mapState.history.push(entry);
        if (mapState.history.length > 10) {
            mapState.history.shift();
        }
        return true;
    }
    return false;
}

/**
 * Sets the offline state when the backend is unreachable.
 */
export function setOffline() {
    mapState.isOffline = true;
    mapState.deviceStatus = false;
}

/**
 * Clears the offline state.
 */
export function clearOffline() {
    mapState.isOffline = false;
}
