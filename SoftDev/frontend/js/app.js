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
    updateSmokeUI, 
    updateFlameUI, 
    updateWaterUI, 
    updatePumpUI, 
    updateHistoryUI,
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

        if (data.esp_connected) {
            updateConnectionStatus(true, "Terhubung");
            updateConnectionUI(true, "Terhubung");
        } else if (data.timestamp) {
            updateConnectionStatus(false, "Tidak Terhubung");
            updateConnectionUI(false, "Tidak Terhubung");
        } else {
            updateConnectionStatus(false, "ESP32 belum kirim data");
            updateConnectionUI(false, "ESP32 belum kirim data");
            return;
        }

        updateLastTimeUI(data.timestamp);
        updateSmokeUI(data.ppm, data.adc);
        updateFlameUI(data.flame);
        updateWaterUI(data.water_pct, data.dist);
        updatePumpUI(data.pump);

    } catch (err) {
        if (incrementErrors() >= 3) {
            updateConnectionStatus(false, "Tidak Terhubung");
            updateConnectionUI(false, "Tidak Terhubung");
        }
    }

    try {
        const historyData = await fetchHistory();
        updateHistory(historyData);
        updateHistoryUI(historyData);
    } catch (err) {
        // Silently handle history fetch errors
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

    document.addEventListener('visibilitychange', async () => {
        if (document.visibilityState === 'visible' && !deferredPrompt) {
            try {
                if ('getInstalledRelatedApps' in navigator) {
                    const apps = await navigator.getInstalledRelatedApps();
                    if (apps.length === 0) {
                        window.location.reload();
                    }
                }
            } catch (e) {
                if (!window.matchMedia('(display-mode: standalone)').matches) {
                    const btnInstall = document.getElementById('btn-install');
                    if (btnInstall && btnInstall.style.display === 'none') {
                        window.location.reload();
                    }
                }
            }
        }
    });
}

function updateOfflineUI(isOffline) {
    const badge = document.getElementById('offline-badge');
    if (badge) {
        badge.style.display = isOffline ? 'inline-block' : 'none';
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
