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

export function updateSmokeUI(ppm, adc) {
    const vPpm = document.getElementById("v-ppm");
    const vAdc = document.getElementById("v-adc");
    const sc = document.getElementById("c-smoke");
    const sb = document.getElementById("b-smoke");

    if (vPpm) vPpm.innerText = ppm.toFixed(1);
    if (vAdc) vAdc.innerText = adc;

    if (sc && sb) {
        if (ppm < 650) {
            sc.className = "card safe";
            sb.className = "badge badge-safe";
            sb.innerText = "Normal";
        } else if (ppm < 4000) {
            sc.className = "card warn";
            sb.className = "badge badge-warn";
            sb.innerText = "Peringatan";
        } else {
            sc.className = "card danger";
            sb.className = "badge badge-danger";
            sb.innerText = "BAHAYA!";
        }
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

export function updateWaterUI(waterPct, dist) {
    const vWater = document.getElementById("v-water");
    const vDist = document.getElementById("v-dist");
    const wc = document.getElementById("c-water");
    const wb = document.getElementById("b-water");

    if (vDist) vDist.innerText = dist.toFixed(1);

    let statusText = "Full";
    if (waterPct < 30) {
        statusText = "Low";
        if (wc) wc.className = "card danger";
        if (wb) {
            wb.className = "badge badge-danger";
            wb.innerText = "Kritis";
        }
    } else if (waterPct <= 80) {
        statusText = "Not Full";
        if (wc) wc.className = "card warn";
        if (wb) {
            wb.className = "badge badge-warn";
            wb.innerText = "Normal";
        }
    } else {
        statusText = "Full";
        if (wc) wc.className = "card safe";
        if (wb) {
            wb.className = "badge badge-safe";
            wb.innerText = "Aman";
        }
    }

    if (vWater) vWater.innerText = statusText;
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
                let waterStatus = "Full";
                if (r.water_pct < 30) waterStatus = "Low";
                else if (r.water_pct <= 80) waterStatus = "Not Full";
                
                return `<tr><td>${new Date(r.timestamp).toLocaleTimeString("id-ID")}</td><td>${r.ppm.toFixed(0)}</td><td>${r.flame === 0 ? "Low" : "High!!!!!"}</td><td>${waterStatus}</td><td>${r.pump ? "💧" : "—"}</td></tr>`;
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
