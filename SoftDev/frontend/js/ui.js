export function updateConnectionUI(ok, msg) {
    const dot = document.getElementById("dot");
    const connText = document.getElementById("conn-text");
    
    if (dot) {
        dot.className = "conn-dot " + (ok ? "on" : "off");
    }
    
    if (connText) {
        connText.innerText = msg || (ok ? "Terhubung — Data Masuk" : "Terputus");
    }
}

export function updateLastTimeUI(timestamp) {
    const el = document.getElementById("last-time");
    if (el && timestamp) {
        el.innerText = new Date(timestamp).toLocaleTimeString("id-ID");
    }
}

export function updateFlameUI(flame) {
    const vFlame = document.getElementById("v-flame");
    const fc = document.getElementById("c-flame");
    const fb = document.getElementById("b-flame");

    if (vFlame && fc && fb) {
        if (flame === 0) {
            vFlame.innerText = "Aman";
            fc.className = "card safe";
            fb.className = "badge badge-safe";
            fb.innerText = "Tidak Ada Api";
        } else {
            vFlame.innerText = "🔥";
            fc.className = "card danger";
            fb.className = "badge badge-danger";
            fb.innerText = "KEBAKARAN";
        }
    }
}

export function updatePumpUI(pump) {
    const vPump = document.getElementById("v-pump");
    const pc = document.getElementById("c-pump");
    const pb = document.getElementById("b-pump");

    if (vPump && pc && pb) {
        if (pump === 1) {
            vPump.innerText = "💧 ON";
            pc.className = "card warn";
            pb.className = "badge badge-warn";
            pb.innerText = "Menyemprot";
        } else {
            vPump.innerText = "OFF";
            pc.className = "card safe";
            pb.className = "badge badge-safe";
            pb.innerText = "Standby";
        }
    }
}

export function updateHistoryUI(history) {
    const histEl = document.getElementById("hist");
    if (!histEl || !history || !history.length) return;

    histEl.innerHTML = history
        .slice(-10)
        .reverse()
        .map(
            (r) => {
                return `<tr><td>${new Date(r.timestamp).toLocaleTimeString("id-ID")}</td><td>${r.flame === 0 ? "Low" : "High!!!!!"}</td><td>${r.pump ? "💧" : "—"}</td></tr>`;
            }
        )
        .join("");
}

export function handlePwaInstallUI(deferredPrompt) {
    const btnInstall = document.getElementById('btn-install');
    if (!btnInstall) return;

    if (deferredPrompt) {
        btnInstall.style.display = 'inline-block';
    } else {
        btnInstall.style.display = 'none';
    }
}

export function hidePwaInstallBtn() {
    const btnInstall = document.getElementById('btn-install');
    if (btnInstall) {
        btnInstall.style.display = 'none';
    }
}
