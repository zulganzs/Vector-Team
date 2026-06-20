export const DEFAULT_LAT = -6.2088;
export const DEFAULT_LNG = 106.8456;

let mapInstance;
let markerInstance;

/**
 * Initializes the Leaflet map and marker.
 */
export function initMap() {
    mapInstance = L.map("map").setView([DEFAULT_LAT, DEFAULT_LNG], 15);
    
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>',
    }).addTo(mapInstance);

    markerInstance = L.marker([DEFAULT_LAT, DEFAULT_LNG]).addTo(mapInstance);
    markerInstance.bindPopup("<b>ESP32-01</b><br>Lokasi Perangkat").openPopup();

    document.getElementById("dev-coord").innerText =
        DEFAULT_LAT.toFixed(6) + ", " + DEFAULT_LNG.toFixed(6);
}

/**
 * Updates the device info panel.
 * @param {boolean} status - True for online, false for offline.
 * @param {number|string} lastSeen - Timestamp.
 */
export function updateDeviceInfo(status, lastSeen) {
    const statusEl = document.getElementById("dev-status");
    statusEl.innerText = status ? "Online" : "Offline";
    statusEl.className = "info-value " + (status ? "online" : "offline");

    document.getElementById("dev-lastseen").innerText = lastSeen
        ? new Date(lastSeen).toLocaleTimeString("id-ID")
        : "—";
}

/**
 * Updates the connection dot and text in the top bar.
 * @param {boolean} connected - True for connected, false for not connected.
 */
export function updateConnectionDot(connected) {
    document.getElementById("dot").className = "conn-dot " + (connected ? "on" : "off");
    document.getElementById("conn-text").innerText = connected ? "Terhubung" : "Tidak Terhubung";
}

/**
 * Renders the history table.
 * @param {Array} history - Array of history objects.
 */
export function renderHistoryTable(history) {
    const histEl = document.getElementById("hist");
    
    histEl.innerHTML = history
        .slice()
        .reverse()
        .map(
            (h) =>
                `<tr>
                    <td>${h.time}</td>
                    <td>${h.lat.toFixed(6)}</td>
                    <td>${h.lng.toFixed(6)}</td>
                    <td><span class="badge ${h.connected ? "badge-safe" : "badge-danger"}">${
                        h.connected ? "Online" : "Offline"
                    }</span></td>
                </tr>`
        )
        .join("");
}
