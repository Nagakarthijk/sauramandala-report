// oesn-ai.js — DRIVE SmartNote: voice → transcript → AI extraction → form fill
// Requires: oesn-auth.js loaded (for demo-mode check), no other deps.

const DriveAI = (() => {
  'use strict';

  // Points to our Netlify Edge Function proxy. In demo/local mode calls are mocked.
  const AI_ENDPOINT = '/ai-extract';

  let _recognition = null;
  let _isListening = false;
  let _onTranscript = null; // callback(text)

  // ── Speech recognition ────────────────────────────────────────────────────

  function speechSupported() {
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  function startListening(onResult, onEnd) {
    if (!speechSupported()) { alert('Voice input not supported on this browser. Try Chrome on Android.'); return; }
    if (_isListening) { stopListening(); return; }

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    _recognition = new SR();
    _recognition.continuous = true;
    _recognition.interimResults = true;
    _recognition.lang = 'en-IN';

    let finalText = '';

    _recognition.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText += t + ' ';
        else interim = t;
      }
      onResult(finalText + interim, finalText);
    };

    _recognition.onend = () => {
      _isListening = false;
      if (onEnd) onEnd(finalText.trim());
    };

    _recognition.onerror = (e) => {
      console.warn('[DriveAI] Speech error:', e.error);
      _isListening = false;
      if (onEnd) onEnd(finalText.trim());
    };

    _recognition.start();
    _isListening = true;
  }

  function stopListening() {
    if (_recognition) { _recognition.stop(); _recognition = null; }
    _isListening = false;
  }

  function isListening() { return _isListening; }

  // ── AI extraction ─────────────────────────────────────────────────────────

  async function extract(transcript, mode) {
    if (!transcript.trim()) return null;

    // Demo fallback: return mock data so it works without an API key
    if (!window.DRIVE_SB) {
      return _mockExtract(transcript, mode);
    }

    try {
      const resp = await fetch(AI_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript, mode }),
      });
      const data = await resp.json();
      if (data.error) throw new Error(data.error);
      return data.fields;
    } catch (err) {
      console.warn('[DriveAI] Extraction failed, using mock:', err.message);
      return _mockExtract(transcript, mode);
    }
  }

  function _mockExtract(transcript, mode) {
    // Very basic keyword extraction for demo/offline mode
    if (mode === 'entrepreneur') {
      const phoneMatch = transcript.match(/\b[6-9]\d{9}\b/);
      return {
        phone: phoneMatch ? phoneMatch[0] : '',
        observation: transcript.length > 20 ? transcript.trim() : '',
      };
    }
    return { summary: transcript.trim() };
  }

  // ── SmartNote modal ───────────────────────────────────────────────────────
  // Opens a bottom sheet with mic + text area + Extract button.
  // mode: 'entrepreneur' | 'observation' | 'general'
  // onFill(fields): called with extracted fields object when user taps "Fill fields"

  function openSmartNote(opts = {}) {
    const { mode = 'general', onFill, placeholder = 'Speak or type your notes here…', title = 'Smart Note' } = opts;

    // Remove existing if any
    const existing = document.getElementById('smart-note-modal');
    if (existing) existing.remove();

    const el = document.createElement('div');
    el.id = 'smart-note-modal';
    el.innerHTML = `
      <div id="sn-overlay" style="position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:200;" onclick="DriveAI.closeSmartNote()"></div>
      <div id="sn-sheet" style="position:fixed;bottom:0;left:0;right:0;z-index:201;background:#fff;border-radius:20px 20px 0 0;max-height:85vh;overflow-y:auto;padding:0 0 env(safe-area-inset-bottom);">
        <div style="width:48px;height:6px;background:#d6d3d1;border-radius:9px;margin:12px auto 0;"></div>
        <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 20px;border-bottom:1px solid #f5f5f4;">
          <div>
            <div style="font-size:15px;font-weight:700;color:#1c1917;">${title}</div>
            <div style="font-size:11px;color:#a8a29e;margin-top:2px;">Speak or type — AI will extract the structured fields</div>
          </div>
          <button onclick="DriveAI.closeSmartNote()" style="color:#a8a29e;background:none;border:none;cursor:pointer;padding:4px;">
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
          </button>
        </div>
        <div style="padding:16px 20px;display:flex;flex-direction:column;gap:12px;">
          <textarea id="sn-text" rows="6" placeholder="${placeholder}"
            style="width:100%;box-sizing:border-box;background:#f5f5f4;border:none;border-radius:12px;padding:12px;font-size:14px;font-family:inherit;resize:none;outline:none;line-height:1.5;color:#1c1917;"></textarea>
          <div id="sn-status" style="font-size:12px;color:#a8a29e;min-height:16px;"></div>
          <div style="display:flex;gap:8px;">
            ${speechSupported() ? `
            <button id="sn-mic-btn" onclick="DriveAI._toggleMic()"
              style="display:flex;align-items:center;gap:6px;background:#f5f5f4;border:none;border-radius:12px;padding:10px 16px;font-size:13px;font-weight:600;color:#57534e;cursor:pointer;flex-shrink:0;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 1a4 4 0 014 4v7a4 4 0 01-8 0V5a4 4 0 014-4z" stroke="currentColor" stroke-width="1.8"/><path d="M19 11a7 7 0 01-14 0M12 19v4M8 23h8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
              <span id="sn-mic-label">Hold to speak</span>
            </button>` : ''}
            <button onclick="DriveAI._runExtract('${mode}', window._snFillCb)"
              style="flex:1;background:#f59e0b;border:none;border-radius:12px;padding:10px 16px;font-size:13px;font-weight:700;color:#1c1917;cursor:pointer;">
              ✨ Extract &amp; Fill Fields
            </button>
          </div>
          <div id="sn-preview" style="display:none;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:12px;font-size:12px;color:#166534;"></div>
        </div>
      </div>`;
    document.body.appendChild(el);
    window._snFillCb = onFill;
    setTimeout(() => document.getElementById('sn-text')?.focus(), 100);
  }

  function closeSmartNote() {
    stopListening();
    const el = document.getElementById('smart-note-modal');
    if (el) el.remove();
    window._snFillCb = null;
  }

  async function _toggleMic() {
    const btn = document.getElementById('sn-mic-btn');
    const label = document.getElementById('sn-mic-label');
    const status = document.getElementById('sn-status');
    const ta = document.getElementById('sn-text');

    if (isListening()) {
      stopListening();
      if (btn) btn.style.background = '#f5f5f4';
      if (label) label.textContent = 'Hold to speak';
      if (status) status.textContent = '';
      return;
    }

    if (btn) btn.style.background = '#fef3c7';
    if (label) label.textContent = 'Listening…';
    if (status) status.textContent = '🎙 Speak now — tap mic again to stop';

    let baseText = (ta?.value || '').trimEnd();
    if (baseText) baseText += ' ';

    startListening(
      (live) => { if (ta) ta.value = baseText + live; },
      (final) => {
        if (ta) ta.value = (baseText + final).trim();
        if (btn) btn.style.background = '#f5f5f4';
        if (label) label.textContent = 'Hold to speak';
        if (status) status.textContent = final ? '✓ Done — review then tap Extract' : '';
      }
    );
  }

  async function _runExtract(mode, cb) {
    const ta = document.getElementById('sn-text');
    const status = document.getElementById('sn-status');
    const preview = document.getElementById('sn-preview');
    const text = ta?.value?.trim();

    if (!text) { if (status) status.textContent = 'Add some text first.'; return; }
    if (status) status.textContent = '✨ Extracting…';

    const fields = await extract(text, mode);
    if (!fields) { if (status) status.textContent = 'Could not extract — check your connection.'; return; }

    // Show preview
    if (preview) {
      preview.style.display = 'block';
      const lines = Object.entries(fields)
        .filter(([, v]) => v && (typeof v === 'string' ? v.trim() : true))
        .map(([k, v]) => `<b>${k.replace(/_/g, ' ')}:</b> ${Array.isArray(v) ? v.join(', ') : v}`)
        .join('<br>');
      preview.innerHTML = lines || 'Nothing extracted — try adding more detail.';
    }

    if (status) status.textContent = '✓ Review above then confirm';

    // Replace Extract button with Confirm
    const extractBtn = preview?.previousElementSibling?.querySelector('button:last-child');
    if (extractBtn) {
      extractBtn.textContent = '✓ Confirm & Fill';
      extractBtn.style.background = '#22c55e';
      extractBtn.style.color = '#fff';
      extractBtn.onclick = () => {
        if (cb) cb(fields, text);
        closeSmartNote();
      };
    }
  }

  return {
    openSmartNote,
    closeSmartNote,
    speechSupported,
    extract,
    isListening,
    _toggleMic,
    _runExtract,
  };
})();
