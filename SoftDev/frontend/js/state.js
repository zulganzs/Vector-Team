export const state = {
    sensorData: null,
    connectionStatus: {
        ok: false,
        msg: "Memulai koneksi...",
    },
    isOffline: false,
    history: [],
    errors: 0
};

export function updateSensorData(data) {
    state.sensorData = data;
}

export function updateConnectionStatus(ok, msg) {
    state.connectionStatus.ok = ok;
    state.connectionStatus.msg = msg;
}

export function updateHistory(historyData) {
    state.history = historyData;
}

export function setOffline(isOffline) {
    state.isOffline = isOffline;
}

export function incrementErrors() {
    state.errors++;
    return state.errors;
}

export function resetErrors() {
    state.errors = 0;
}
