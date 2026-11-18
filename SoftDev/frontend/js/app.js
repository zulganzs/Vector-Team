import { fetchSensorData, fetchHistory } from './api.js';
import { 
    state, 
    updateSensorData, 
    updateConnectionStatus, 
    updateHistory, 
    incrementErrors, 
    resetErrors,
    setOffline
} from './state.js';
import { 
    updateConnectionUI, 
    updateLastTimeUI, 
    updateFlameUI, 
    updatePumpUI,
    updateStaleUI,
    updateHistoryUI,
    updateHistoryErrorUI,
    handlePwaInstallUI,
    hidePwaInstallBtn
} from './ui.js';

const INTERVAL = 2000;
let deferredPrompt;

async function poll() {
    try {
        const data = await fetchSensorData();
        resetErrors();
        updateSensorData(data);

        updateLastTimeUI(data.timestamp);

        if (data.esp_connected) {
            updateConnectionStatus(true, "Terhubung");
            updateConnectionUI(true, "Terhubung — data masuk");
            updateFlameUI(data.flame);
            updatePumpUI(data.pump);
        } else {
            // Server reachable, ESP32 silent: grey out the cards instead of
            // presenting the last reading as live.
            const msg = data.timestamp
                ? "ESP32 tidak mengirim data"
                : "ESP32 belum mengirim data";
            updateConnectionStatus(false, msg);
            updateConnectionUI(false, msg);
            updateStaleUI(data.timestamp);
        }
    } catch (err) {
        if (incrementErrors() >= 3) {
            const msg = "Server tidak dapat dihubungi — mencoba lagi";
            updateConnectionStatus(false, msg);
            updateConnectionUI(false, msg);
            updateStaleUI(state.sensorData && state.sensorData.timestamp);
        }
    }

    try {
        const historyData = await fetchHistory();
        updateHistory(historyData);
        updateHistoryUI(historyData);
    } catch (err) {
        updateHistoryErrorUI();
    }
}

function initServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js')
            .then(reg => console.log('SW registered:', reg.scope))
            .catch(err => console.log('SW failed:', err));
    }
}

function initPWA() {
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        handlePwaInstallUI(deferredPrompt);
    });

    const btnInstall = document.getElementById('btn-install');
    if (btnInstall) {
        btnInstall.addEventListener('click', async () => {
            if (deferredPrompt) {
                deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                if (outcome === 'accepted') {
                    console.log('User accepted the install prompt');
                } else {
                    console.log('User dismissed the install prompt');
                }
                deferredPrompt = null;
                handlePwaInstallUI(null);
            }
        });
    }

    window.addEventListener('appinstalled', () => {
        hidePwaInstallBtn();
        deferredPrompt = null;
        console.log('PWA was installed');
    });
}

function updateOfflineUI(isOffline) {
    const badge = document.getElementById('offline-badge');
    if (badge) {
        badge.hidden = !isOffline;
    }
}

function initOfflineDetection() {
    window.addEventListener('online', () => {
        setOffline(false);
        updateOfflineUI(false);
    });
    
    window.addEventListener('offline', () => {
        setOffline(true);
        updateOfflineUI(true);
    });
    
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.addEventListener('message', (event) => {
            if (event.data && event.data.type === 'OFFLINE_STATE') {
                const isOffline = event.data.isOffline;
                setOffline(isOffline);
                updateOfflineUI(isOffline);
            }
        });
    }

    const isOffline = !navigator.onLine;
    setOffline(isOffline);
    updateOfflineUI(isOffline);
}

function init() {
    initServiceWorker();
    initPWA();
    initOfflineDetection();
    
    // Initial poll and start interval
    poll();
    setInterval(poll, INTERVAL);
}

// Start the app when the DOM is ready, or immediately if script is at end of body
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
