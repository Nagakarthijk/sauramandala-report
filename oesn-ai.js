// oesn-ai.js — DRIVE SmartNote: voice → transcript → AI extraction → form fill
// Requires: oesn-auth.js loaded (for demo-mode check), no other deps.

const DriveAI = (() => {
  'use strict';

  const AI_ENDPOINT = '/ai-extract';

  let _recognition = null;
  let _isListening = false;

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

    // Always try the real API first. Only fall back to mock if it fails.
    try {
      const resp = await fetch(AI_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript, mode }),
      });
      const data = await resp.json();
      if (data.error) throw new Error(data.error);
      if (!data.fields) throw new Error('No fields returned from AI');
      return data.fields;
    } catch (err) {
      console.warn('[DriveAI] API call failed:', err.message);
      // Only use mock if this is clearly a demo/local environment with no API configured
      const isDemoMode = !navigator.onLine ||
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1';
      if (isDemoMode) return _mockExtract(transcript, mode);
      throw err; // re-throw so _runExtract can show the error
    }
  }

  function _mockExtract(transcript, mode) {
    if (mode === 'entrepreneur') {
      const phoneMatch = transcript.match(/\b[6-9]\d{9}\b/);
      const words = transcript.split(/\s+/);
      return {
        phone: phoneMatch ? phoneMatch[0] : '',
        name: words.slice(0, 2).join(' '),
        observation: transcript.length > 20 ? transcript.trim() : '',
      };
    }
    return { summary: transcript.trim() };
  }

  // ── SmartNote modal ───────────────────────────────────────────────────────

  function openSmartNote(opts = {}) {
    const {
      mode = 'general',
      onFill,
      placeholder = 'Speak or type your notes here…',
      title = 'Smart Note',
    } = opts;

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
            <button id="sn-extract-btn"
              style="flex:1;background:#f59e0b;border:none;border-radius:12px;padding:10px 16px;font-size:13px;font-weight:700;color:#1c1917;cursor:pointer;">
              ✨ Extract &amp; Fill Fields
            </button>
          </div>
          <div id="sn-preview" style="display:none;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:12px;font-size:12px;color:#166534;"></div>
          <button id="sn-confirm-btn" style="display:none;width:100%;background:#22c55e;border:none;border-radius:12px;padding:12px 16px;font-size:14px;font-weight:700;color:#fff;cursor:pointer;">
            ✓ Confirm &amp; Fill Fields
          </button>
        </div>
      </div>`;
    document.body.appendChild(el);

    // Wire extract button — capture onFill in closure (no global _snFillCb needed)
    document.getElementById('sn-extract-btn').addEventListener('click', () => {
      _runExtract(mode, onFill);
    });

    setTimeout(() => document.getElementById('sn-text')?.focus(), 100);
  }

  function closeSmartNote() {
    stopListening();
    const el = document.getElementById('smart-note-modal');
    if (el) el.remove();
  }

  async function _toggleMic() {
    const btn    = document.getElementById('sn-mic-btn');
    const label  = document.getElementById('sn-mic-label');
    const status = document.getElementById('sn-status');
    const ta     = document.getElementById('sn-text');

    if (isListening()) {
      stopListening();
      if (btn)   btn.style.background = '#f5f5f4';
      if (label) label.textContent    = 'Hold to speak';
      if (status) status.textContent  = '';
      return;
    }

    if (btn)   btn.style.background = '#fef3c7';
    if (label) label.textContent    = 'Listening…';
    if (status) status.textContent  = '🎙 Speak now — tap mic again to stop';

    let baseText = (ta?.value || '').trimEnd();
    if (baseText) baseText += ' ';

    startListening(
      (live) => { if (ta) ta.value = baseText + live; },
      (final) => {
        if (ta)    ta.value          = (baseText + final).trim();
        if (btn)   btn.style.background = '#f5f5f4';
        if (label) label.textContent = 'Hold to speak';
        if (status) status.textContent = final ? '✓ Done — tap Extract to fill fields' : '';
      }
    );
  }

  async function _runExtract(mode, onFill) {
    const ta         = document.getElementById('sn-text');
    const status     = document.getElementById('sn-status');
    const preview    = document.getElementById('sn-preview');
    const extractBtn = document.getElementById('sn-extract-btn');
    const confirmBtn = document.getElementById('sn-confirm-btn');
    const text       = ta?.value?.trim();

    if (!text) {
      if (status) status.textContent = 'Add some text first.';
      return;
    }

    // Loading state
    if (extractBtn) { extractBtn.disabled = true; extractBtn.textContent = '✨ Extracting…'; }
    if (status)     status.textContent    = '';
    if (preview)    preview.style.display = 'none';
    if (confirmBtn) confirmBtn.style.display = 'none';

    let fields;
    try {
      fields = await extract(text, mode);
    } catch (err) {
      if (status) status.textContent = `⚠ AI error: ${err.message}`;
      if (extractBtn) { extractBtn.disabled = false; extractBtn.textContent = '✨ Extract & Fill Fields'; }
      return;
    }

    if (!fields) {
      if (status) status.textContent = 'Nothing extracted — try adding more detail.';
      if (extractBtn) { extractBtn.disabled = false; extractBtn.textContent = '✨ Extract & Fill Fields'; }
      return;
    }

    // Restore extract button
    if (extractBtn) { extractBtn.disabled = false; extractBtn.textContent = '✨ Extract & Fill Fields'; }

    // Show preview
    if (preview) {
      const lines = Object.entries(fields)
        .filter(([, v]) => v && (typeof v === 'string' ? v.trim() : true))
        .map(([k, v]) => `<b>${k.replace(/_/g, ' ')}:</b> ${Array.isArray(v) ? v.join(', ') : v}`)
        .join('<br>');
      preview.innerHTML = lines || 'Nothing extracted — try adding more detail to your note.';
      preview.style.display = 'block';
    }

    if (status) status.textContent = '✓ Looks right? Confirm to fill the form.';

    // Show dedicated confirm button — no fragile DOM traversal
    if (confirmBtn) {
      confirmBtn.style.display = 'block';
      // Remove any previous listener by replacing the node
      const fresh = confirmBtn.cloneNode(true);
      confirmBtn.parentNode.replaceChild(fresh, confirmBtn);
      fresh.addEventListener('click', () => {
        if (onFill) onFill(fields, text);
        closeSmartNote();
      });
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
