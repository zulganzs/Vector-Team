const LEAFLET_CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
const LEAFLET_JS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";

let leafletReady;
let mapInstance;
let markerInstance;

function setText(el, text) {
    if (el.textContent !== text) el.textContent = text;
}

/**
 * Loads Leaflet on demand. It is only needed once the device reports a
 * position, so it must not block the first paint of the page.
 */
function loadLeaflet() {
    if (leafletReady) return leafletReady;
    leafletReady = new Promise((resolve, reject) => {
        const css = document.createElement("link");
        css.rel = "stylesheet";
        css.href = LEAFLET_CSS;
        document.head.appendChild(css);

        const script = document.createElement("script");
        script.src = LEAFLET_JS;
        script.onload = () => resolve(window.L);
        script.onerror = () => {
            leafletReady = null;
            reject(new Error("Leaflet failed to load"));
        };
        document.head.appendChild(script);
    });
    return leafletReady;
}

/**
 * Shows the device position. Called only with real coordinates from the
 * backend; with none, the page keeps its "location not available" state.
 * @param {number} lat
 * @param {number} lng
 */
export async function showLocation(lat, lng) {
    document.getElementById("dev-coord").textContent =
        lat.toFixed(6) + ", " + lng.toFixed(6);

    const frameEl = document.getElementById("map-frame");
    const emptyEl = document.getElementById("map-empty");

    try {
        const L = await loadLeaflet();
        frameEl.hidden = false;
        emptyEl.hidden = true;

        if (!mapInstance) {
            mapInstance = L.map("map").setView([lat, lng], 15);
            L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
                attribution:
                    '&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>',
            }).addTo(mapInstance);
            markerInstance = L.marker([lat, lng]).addTo(mapInstance);
        } else {
            markerInstance.setLatLng([lat, lng]);
            mapInstance.panTo([lat, lng]);
        }
    } catch (err) {
        emptyEl.hidden = false;
        emptyEl.querySelector("strong").textContent = "Peta gagal dimuat";
        emptyEl.querySelector("span").textContent =
            "Koordinat tetap ditampilkan di panel samping. Periksa koneksi internet lalu muat ulang halaman.";
    }
}

/**
 * Updates the device info panel.
 * @param {boolean} status - True for online, false for offline.
 * @param {number|string} lastSeen - Timestamp.
 */
export function updateDeviceInfo(status, lastSeen) {
    const statusEl = document.getElementById("dev-status");
    setText(statusEl, status ? "Online" : "Offline");
    document.getElementById("dev-band").dataset.state = status ? "safe" : "stale";

    setText(
        document.getElementById("dev-lastseen"),
        lastSeen ? new Date(lastSeen).toLocaleTimeString("id-ID") : "belum pernah"
    );
}

/**
 * Updates the connection dot and text in the top bar.
 * @param {boolean} connected - True for connected, false for not connected.
 */
export function updateConnectionDot(connected) {
    document.getElementById("dot").className = "conn-dot " + (connected ? "on" : "off");
    setText(
        document.getElementById("conn-text"),
        connected ? "ESP32 terhubung ke server" : "ESP32 tidak terhubung"
    );
}

/**
 * Renders the status history table.
 * @param {Array} history - Array of {time, connected} entries.
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
                    <td class="${h.connected ? "state-on" : "state-off"}">${
                        h.connected ? "Online" : "Offline"
                    }</td>
                </tr>`
        )
        .join("");
}
