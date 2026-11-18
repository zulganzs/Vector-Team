// Only touch the DOM when the value changed, so screen readers announce real
// state changes instead of every 2-second poll.
function setText(el, text) {
    if (el.textContent !== text) el.textContent = text;
}

// A reading is a container with data-state (safe | warn | danger | stale);
// the stylesheet decides what each state looks like.
function setCard(prefix, { state, value, sub, badge }) {
    const card = document.getElementById(`c-${prefix}`);
    const val = document.getElementById(`v-${prefix}`);
    const subEl = document.getElementById(`s-${prefix}`);
    const badgeEl = document.getElementById(`b-${prefix}`);
    if (!card || !val || !subEl || !badgeEl) return;

    card.dataset.state = state;
    setText(val, value);
    setText(subEl, sub);
    setText(badgeEl, badge);
}

const TITLE = document.title;

function formatTime(timestamp) {
    return new Date(timestamp).toLocaleTimeString("id-ID");
}

export function updateConnectionUI(ok, msg) {
    const dot = document.getElementById("dot");
    const connText = document.getElementById("conn-text");

    if (dot) {
        dot.className = "conn-dot " + (ok ? "on" : "off");
    }
    if (connText) {
        setText(connText, msg || (ok ? "Terhubung — data masuk" : "Terputus"));
    }
}

export function updateLastTimeUI(timestamp) {
    const el = document.getElementById("last-time");
    if (!el) return;
    if (timestamp) {
        el.textContent = "Data terakhir " + formatTime(timestamp);
        el.hidden = false;
    } else {
        el.hidden = true;
    }
}

export function updateFlameUI(flame) {
    if (flame === 0) {
        setCard("flame", {
            state: "safe",
            value: "Aman",
            sub: "Flame sensor",
            badge: "Tidak ada api terdeteksi",
        });
        document.title = TITLE;
    } else {
        setCard("flame", {
            state: "danger",
            value: "Ada api",
            sub: "Flame sensor",
            badge: "Sensor mendeteksi api",
        });
        // Visible in a background tab too.
        document.title = "KEBAKARAN — " + TITLE;
    }
}

export function updatePumpUI(pump) {
    if (pump === 1) {
        setCard("pump", {
            state: "warn",
            value: "Aktif",
            sub: "Relay",
            badge: "Menyemprot",
        });
    } else {
        setCard("pump", {
            state: "safe",
            value: "Mati",
            sub: "Relay",
            badge: "Standby",
        });
    }
}

/**
 * The ESP32 is not sending. Never show its last reading as if it were live:
 * a stale "Aman" on a fire monitor is worse than no answer.
 * @param {string|undefined} timestamp - Time of the last reading, if any.
 */
export function updateStaleUI(timestamp) {
    const since = timestamp
        ? `Data terakhir ${formatTime(timestamp)}`
        : "Belum ada data masuk";
    document.title = TITLE;
    setCard("flame", {
        state: "stale",
        value: "Tidak ada data",
        sub: since,
        badge: "Sensor tidak terhubung",
    });
    setCard("pump", {
        state: "stale",
        value: "—",
        sub: since,
        badge: "Status tidak diketahui",
    });
}

function setHistoryNote(message) {
    const histEl = document.getElementById("hist");
    if (!histEl) return;
    histEl.innerHTML = '<tr><td colspan="3" class="cell-note"></td></tr>';
    histEl.querySelector("td").textContent = message;
}

export function updateHistoryUI(history) {
    const histEl = document.getElementById("hist");
    if (!histEl) return;

    if (!history || !history.length) {
        setHistoryNote(
            "Belum ada data. Riwayat muncul setelah ESP32 mengirim pembacaan pertama."
        );
        return;
    }

    histEl.innerHTML = history
        .slice(-10)
        .reverse()
        .map((r) => {
            const fire = r.flame !== 0;
            const flameCell = fire
                ? '<td class="cell-alert">Api</td>'
                : "<td>Aman</td>";
            return `<tr><td>${formatTime(r.timestamp)}</td>${flameCell}<td>${r.pump ? "Aktif" : "Standby"}</td></tr>`;
        })
        .join("");
}

/**
 * Called when the history request fails. Keeps rows already on screen;
 * only fills the empty table with an explanation.
 */
export function updateHistoryErrorUI() {
    const histEl = document.getElementById("hist");
    if (!histEl) return;
    const hasRows = histEl.querySelector("td:not(.cell-note)");
    if (!hasRows) {
        setHistoryNote("Riwayat gagal dimuat. Mencoba lagi otomatis setiap 2 detik.");
    }
}

export function handlePwaInstallUI(deferredPrompt) {
    const btnInstall = document.getElementById("btn-install");
    if (btnInstall) btnInstall.hidden = !deferredPrompt;
}

export function hidePwaInstallBtn() {
    const btnInstall = document.getElementById("btn-install");
    if (btnInstall) btnInstall.hidden = true;
}
