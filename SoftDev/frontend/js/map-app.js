import { fetchDeviceData } from "./map-api.js";
import {
    mapState,
    updateDeviceStatus,
    updateLastSeen,
    addHistoryEntry,
    setOffline,
    clearOffline
} from "./map-state.js";
import {
    initMap,
    updateDeviceInfo,
    updateConnectionDot,
    renderHistoryTable,
    DEFAULT_LAT,
    DEFAULT_LNG
} from "./map-ui.js";

const POLLING_INTERVAL = 5000;
let errors = 0;

/**
 * Main application polling loop.
 */
async function poll() {
    try {
        const data = await fetchDeviceData();
        errors = 0;
        clearOffline();
        
        const connected = data.esp_connected;
        
        updateDeviceStatus(connected);
        updateLastSeen(data.timestamp);
        
        updateConnectionDot(connected);
        updateDeviceInfo(connected, data.timestamp);
        
        if (data.timestamp) {
            const time = new Date(data.timestamp).toLocaleTimeString("id-ID");
            const entry = {
                time: time,
                lat: DEFAULT_LAT,
                lng: DEFAULT_LNG,
                connected: connected,
            };
            
            const added = addHistoryEntry(entry);
            if (added) {
                renderHistoryTable(mapState.history);
            }
        }
    } catch (error) {
        errors++;
        if (errors >= 3) {
            setOffline();
            updateConnectionDot(false);
            updateDeviceInfo(false, mapState.lastSeen);
        }
    }
}

/**
 * Initialize the application on DOM Content Loaded.
 */
document.addEventListener("DOMContentLoaded", () => {
    initMap();
    
    // Initial fetch and start polling
    poll();
    setInterval(poll, POLLING_INTERVAL);
    
    // Handle offline/online browser events
    window.addEventListener("offline", () => {
        setOffline();
        updateConnectionDot(false);
        updateDeviceInfo(false, mapState.lastSeen);
    });
    
    window.addEventListener("online", () => {
        // Force immediate poll when coming back online
        errors = 0;
        poll();
    });
});
