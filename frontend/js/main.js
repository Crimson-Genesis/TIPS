// ═══════════════════════════════════════════════════════════════
// TIPS Unified Frontend — main.js
// Entry point: registers pages, wires modal, auto-loads
// ═══════════════════════════════════════════════════════════════
import { applyChartDefaults, CONFIG } from './config.js';
import { sessionData, loadFromPath, loadFromFiles, loadFromAPI, exportSessionJSON } from './dataLoader.js';
import { registerPage, initRouter, navigateTo } from './router.js';
import { renderHub } from './pages/hub.js';
import { renderTemporal } from './pages/temporalEvidence.js';
import { renderAnalytics } from './pages/analytics.js';
import { renderPipeline } from './pages/pipelineExecution.js';
import { renderQA } from './pages/qaReview.js';
import { renderControl } from './pages/control.js';

// ── Register pages ─────────────────────────────────────────────
registerPage('hub', renderHub);
registerPage('temporal', renderTemporal);
registerPage('analytics', renderAnalytics);
registerPage('pipeline', renderPipeline);
registerPage('qa', renderQA);
registerPage('control', renderControl);

// ── Apply Chart.js dark theme ─────────────────────────────────
applyChartDefaults();

// ── Init router ───────────────────────────────────────────────
initRouter();

// ── Session chip helpers ──────────────────────────────────────
function setSessionUI(label, active = false) {
    const dot = document.getElementById('sessionDot');
    const lbl = document.getElementById('sessionLabel');
    if (dot) dot.classList.toggle('active', active);
    if (lbl) lbl.textContent = label;
}

function refreshCurrentPage() {
    const hash = window.location.hash.replace('#', '') || 'hub';
    navigateTo(hash);
}

function onLoadSuccess() {
    const id = sessionData.timeline?.dataset_id || sessionData.timeline?.session_id || 'Session loaded';
    setSessionUI(id, true);
    refreshCurrentPage();
}

// ── Modal wiring ───────────────────────────────────────────────
const overlay = document.getElementById('modalOverlay');
const closeBtn = document.getElementById('modalClose');
const cancelBtn = document.getElementById('modalCancel');
const confirmBtn = document.getElementById('modalConfirm');
const progressWrap = document.getElementById('modalProgress');
const progressBar = document.getElementById('progressBar');
const progressText = document.getElementById('progressText');

function openModal() { overlay.classList.add('open'); }
function closeModal() { overlay.classList.remove('open'); }

document.getElementById('btnLoad')?.addEventListener('click', openModal);
document.getElementById('btnLoadMobile')?.addEventListener('click', openModal);
closeBtn?.addEventListener('click', closeModal);
cancelBtn?.addEventListener('click', closeModal);
overlay?.addEventListener('click', e => { if (e.target === overlay) closeModal(); });

// Load-tab switching
document.querySelectorAll('.load-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.load-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.load-panel').forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(`panel-${tab.dataset.mode}`)?.classList.add('active');
    });
});

// ── File Inputs grid (individual files tab) ───────────────────
const fileMap = CONFIG.FILES;
const grid = document.getElementById('fileInputsGrid');
if (grid) {
    Object.entries(fileMap).forEach(([key, fname]) => {
        const row = document.createElement('div');
        row.className = 'fi-row';
        row.innerHTML = `<label>${fname}</label>
            <input type="file" accept=".json" data-key="${key}" />`;
        grid.appendChild(row);
    });
}

// ── Folder picker ─────────────────────────────────────────────
const folderPicker = document.getElementById('folderPicker');
const folderFileList = document.getElementById('folderFileList');
let folderFiles = {};

if (folderPicker) {
    folderPicker.addEventListener('change', () => {
        folderFiles = {};
        folderFileList.innerHTML = '';
        const files = Array.from(folderPicker.files);

        // Match files by name
        const reverseMap = {};
        Object.entries(fileMap).forEach(([key, fname]) => { reverseMap[fname.toLowerCase()] = key; });

        files.forEach(file => {
            const key = reverseMap[file.name.toLowerCase()];
            if (key) folderFiles[key] = file;

            const item = document.createElement('div');
            item.className = `file-item ${key ? 'ok' : 'unknown'}`;
            item.innerHTML = `<span class="fi-name">${file.name}</span>
                <span class="fi-size">${(file.size / 1024).toFixed(1)} KB</span>`;
            folderFileList.appendChild(item);
        });
    });
}

// ── API Load button ───────────────────────────────────────────
document.getElementById('btnApiLoad')?.addEventListener('click', async () => {
    progressWrap.classList.add('visible');
    progressText.textContent = 'Connecting to server API…';
    progressBar.style.width = '20%';
    try {
        await loadFromAPI(CONFIG.API_BASE);
        progressBar.style.width = '100%';
        progressText.textContent = 'Loaded from API ✓';
        setTimeout(() => {
            progressWrap.classList.remove('visible');
            progressBar.style.width = '0';
            closeModal();
            onLoadSuccess();
        }, 600);
    } catch (e) {
        progressText.textContent = `API error: ${e.message}`;
        progressBar.style.width = '0';
        setTimeout(() => progressWrap.classList.remove('visible'), 2000);
    }
});

// ── Confirm button ────────────────────────────────────────────
confirmBtn?.addEventListener('click', async () => {
    const activeTab = document.querySelector('.load-tab.active')?.dataset.mode;

    // Gather files based on active tab
    let filesByKey = {};
    if (activeTab === 'folder') {
        filesByKey = folderFiles;
    } else if (activeTab === 'files') {
        document.querySelectorAll('#fileInputsGrid input[type="file"]').forEach(input => {
            if (input.files.length) filesByKey[input.dataset.key] = input.files[0];
        });
    } else if (activeTab === 'api') {
        // Handled by btnApiLoad
        document.getElementById('btnApiLoad')?.click();
        return;
    }

    if (!Object.keys(filesByKey).length) {
        progressText.textContent = '⚠ No files selected.';
        progressWrap.classList.add('visible');
        setTimeout(() => progressWrap.classList.remove('visible'), 2000);
        return;
    }

    progressWrap.classList.add('visible');
    progressBar.style.width = '0';
    progressText.textContent = 'Loading…';

    try {
        await loadFromFiles(filesByKey, (done, total) => {
            progressBar.style.width = `${Math.round((done / total) * 100)}%`;
            progressText.textContent = `Loading files… ${done}/${total}`;
        });
        progressBar.style.width = '100%';
        progressText.textContent = 'Session loaded ✓';
        setTimeout(() => {
            progressWrap.classList.remove('visible');
            progressBar.style.width = '0';
            closeModal();
            onLoadSuccess();
        }, 500);
    } catch (e) {
        progressText.textContent = `Error: ${e.message}`;
        setTimeout(() => progressWrap.classList.remove('visible'), 3000);
    }
});

// ── Auto-try from static path or API ─────────────────────────
(async () => {
    // 1. Try server API first (when served via server.py)
    try {
        await loadFromAPI(CONFIG.API_BASE);
        if (sessionData.loaded && sessionData.timeline) {
            onLoadSuccess();
            return;
        }
    } catch { /* not running via API — normal */ }

    // 2. Try relative static path (opened via file://)
    try {
        await loadFromPath(CONFIG.OUTPUT_DIR, fileMap, () => { });
        if (sessionData.timeline) {
            onLoadSuccess();
        }
    } catch { /* no data found */ }
})();

// ── Expose debug / export helpers ────────────────────────────
window._tips = {
    sessionData,
    navigateTo,
    export: (subset) => exportSessionJSON(subset),
};
