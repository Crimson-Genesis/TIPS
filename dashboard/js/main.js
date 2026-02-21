// ═══════════════════════════════════════════════════════════════
// TIPS Dashboard — main.js  (v3 — with debug helpers)
// ═══════════════════════════════════════════════════════════════
import { applyChartDefaults, CONFIG } from './config.js';
import { sessionData, loadFromPath, loadFromFiles } from './dataLoader.js';
import { registerPage, initRouter, navigateTo } from './router.js';
import { renderHub } from './pages/hub.js';
import { renderTemporal } from './pages/temporalEvidence.js';
import { renderAnalytics } from './pages/analytics.js';
import { renderPipeline } from './pages/pipelineExecution.js';
import { renderQA } from './pages/qaReview.js';

// ── Register all pages ────────────────────────────────────────
registerPage('hub', renderHub);
registerPage('temporal', renderTemporal);
registerPage('analytics', renderAnalytics);
registerPage('pipeline', renderPipeline);
registerPage('qa', renderQA);

// ── Apply Chart.js dark defaults ─────────────────────────────
applyChartDefaults();

// ── DOM refs ──────────────────────────────────────────────────
const modalOverlay = document.getElementById('modalOverlay');
const modalClose = document.getElementById('modalClose');
const modalCancel = document.getElementById('modalCancel');
const modalConfirm = document.getElementById('modalConfirm');
const progressBar = document.getElementById('progressBar');
const progressText = document.getElementById('progressText');
const progressEl = document.getElementById('modalProgress');
const sessionLabel = document.getElementById('sessionLabel');
const sessionDot = document.querySelector('.session-dot');
const folderPicker = document.getElementById('folderPicker');
const fileListEl = document.getElementById('folderFileList');

document.getElementById('btnLoad').addEventListener('click', () => openModal());

function openModal() { modalOverlay.classList.add('open'); }
function closeModal() { modalOverlay.classList.remove('open'); }

modalClose.addEventListener('click', closeModal);
modalCancel.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) closeModal(); });

// ── Tab switching inside modal ────────────────────────────────
document.querySelectorAll('.load-tab').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.load-tab').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.load-panel').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(`panel-${btn.dataset.mode}`)?.classList.add('active');
    });
});

// ── Build individual file input rows ─────────────────────────
const fileGrid = document.getElementById('fileInputsGrid');
const FILE_KEYS = Object.keys(CONFIG.FILES);
const userFileMap = {}; // key → File

FILE_KEYS.forEach(key => {
    const row = document.createElement('div');
    row.className = 'fi-row';
    row.innerHTML = `<label>${CONFIG.FILES[key]}</label><input type="file" accept=".json" data-key="${key}" />`;
    fileGrid?.appendChild(row);
    row.querySelector('input').addEventListener('change', (e) => {
        if (e.target.files[0]) userFileMap[key] = e.target.files[0];
    });
});

// ── Folder picker: match files by filename ────────────────────
folderPicker?.addEventListener('change', (e) => {
    const files = Array.from(e.target.files);
    if (!fileListEl) return;
    fileListEl.innerHTML = '';
    let matched = 0;
    files.forEach(f => {
        const key = FILE_KEYS.find(k => CONFIG.FILES[k] === f.name);
        const ok = !!key;
        if (ok) { userFileMap[key] = f; matched++; }
        const div = document.createElement('div');
        div.className = `file-item ${ok ? 'ok' : 'unknown'}`;
        div.innerHTML = `<span class="fi-name">${f.name}</span><span class="fi-size">${(f.size / 1024).toFixed(1)} KB · ${ok ? '✓ matched' : 'skipped'}</span>`;
        fileListEl.appendChild(div);
    });
    const summary = document.createElement('div');
    summary.style.cssText = 'margin-top:8px;font-size:12px;color:var(--text-secondary);padding:4px';
    summary.textContent = `${matched} / ${FILE_KEYS.length} expected files matched.`;
    fileListEl.appendChild(summary);
    console.log(`[TIPS] Folder picker: ${matched}/${FILE_KEYS.length} files matched`, userFileMap);
});

// ── Shared post-load state update ────────────────────────────
function onLoadSuccess() {
    console.log('[TIPS] sessionData after load:', JSON.stringify({
        timeline: !!sessionData.timeline,
        qa_pairs: !!sessionData.qa_pairs,
        checkpoints: sessionData.checkpoints?.length,
        final_verdict: !!sessionData.final_verdict,
        behavior_metrics: !!sessionData.behavior_metrics,
        speaking_segments: sessionData.speaking_segments?.length,
        relevance_scores: sessionData.relevance_scores?.length,
        errors: sessionData.errors,
    }, null, 2));

    const id = sessionData.timeline?.dataset_id || '?';
    const errs = Object.keys(sessionData.errors).length;
    sessionLabel.textContent = errs > 0
        ? `Session: dataset_${id} (${errs} error(s))`
        : `Session: dataset_${id}`;
    sessionDot.classList.add('active');

    // Re-render the currently visible page with fresh data
    const currentPage = window.location.hash.replace('#', '') || 'hub';
    console.log('[TIPS] Navigating to:', currentPage);
    navigateTo(currentPage);
}

// ── Confirm button ────────────────────────────────────────────
modalConfirm.addEventListener('click', async () => {
    const activeTab = document.querySelector('.load-tab.active')?.dataset.mode;
    progressEl.classList.add('visible');
    progressBar.style.width = '0';
    progressText.textContent = 'Starting…';

    const onProgress = (done, total) => {
        const pct = Math.round((done / total) * 100);
        progressBar.style.width = pct + '%';
        progressText.textContent = `Loaded ${done} / ${total} files…`;
    };

    try {
        if (activeTab === 'path') {
            const pathInput = document.getElementById('pathInput');
            const path = pathInput.value.trim() || CONFIG.OUTPUT_DIR;
            progressText.textContent = `Fetching from ${path}…`;
            console.log('[TIPS] Loading from path:', path);
            await loadFromPath(path, CONFIG.FILES, onProgress);
        } else {
            const keysCovered = Object.keys(userFileMap);
            if (!keysCovered.length) {
                progressText.textContent = '⚠ No files selected. Click the folder icon first, then select files.';
                return;
            }
            console.log('[TIPS] Loading from files:', keysCovered);
            await loadFromFiles(userFileMap, onProgress);
        }

        const errs = Object.keys(sessionData.errors);
        const loaded = FILE_KEYS.filter(k => !sessionData.errors[k]);
        progressBar.style.width = '100%';

        if (errs.length) {
            progressText.textContent = `⚠ ${loaded.length}/${FILE_KEYS.length} files loaded. Failed: ${errs.join(', ')}`;
        } else {
            progressText.textContent = `✓ All ${loaded.length} files loaded successfully!`;
        }

        setTimeout(() => {
            closeModal();
            progressEl.classList.remove('visible');
            onLoadSuccess();
        }, 1400);

    } catch (err) {
        progressText.textContent = `✗ Error: ${err.message}`;
        console.error('[TIPS] Load error:', err);
    }
});

// ── Keyboard close ────────────────────────────────────────────
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

// ── Global debug helper (type tipsDebug() in browser console) ─
window.tipsDebug = function () {
    const summary = {
        loaded: sessionData.loaded,
        timeline: !!sessionData.timeline,
        qa_pairs: !!sessionData.qa_pairs,
        checkpoints_count: sessionData.checkpoints?.length ?? 0,
        final_verdict: sessionData.final_verdict?.verdict ?? null,
        behavior_metrics: !!sessionData.behavior_metrics,
        behavior_segments: sessionData.behavior_metrics?.segments?.length ?? 0,
        speaking_segments: sessionData.speaking_segments?.length ?? 0,
        relevance_scores: sessionData.relevance_scores?.length ?? 0,
        interviewer: !!sessionData.interviewer,
        errors: sessionData.errors,
    };
    console.table(summary);
    console.log('Full sessionData:', sessionData);
    return summary;
};
console.log('[TIPS] Debug helper ready. Type tipsDebug() in console to see load status.');

// ── Boot ──────────────────────────────────────────────────────
initRouter();

// Auto-try from default path — only mark loaded if timeline actually came through
(async () => {
    try {
        await loadFromPath(CONFIG.OUTPUT_DIR, CONFIG.FILES, () => { });
        if (sessionData.timeline) {
            console.log('[TIPS] Auto-load from path succeeded!');
            onLoadSuccess();
        } else {
            console.info('[TIPS] Auto-load: output files not reachable (normal when served from dashboard/ subfolder).',
                '\n→ Click "Load Session" → Folder Picker → select d:\\AIProject\\TIPS\\backend\\backend\\output\\');
        }
    } catch (e) {
        console.info('[TIPS] Auto-load skipped:', e.message);
    }
})();
