// drive-config.js — DRIVE Supabase connection
// ─────────────────────────────────────────────────────────────────────────────
// Step 1: Go to https://supabase.com → your project → Project Settings → API
// Step 2: Copy "Project URL" and "anon public" key and paste below
// Step 3: Save the file
// ─────────────────────────────────────────────────────────────────────────────

const DRIVE_CONFIG = {
  supabaseUrl : 'https://zitxdtycwxphsebgggnc.supabase.co/rest/v1/',   // ← paste here
  supabaseKey : 'sb_publishable_2chBi0sBFJeuCLvAg4vTQQ_Z8aEnu42',                    // ← paste here
};

// Leave this alone — it connects to Supabase using the values above
if (DRIVE_CONFIG.supabaseUrl !== 'https://YOUR-PROJECT-REF.supabase.co') {
  window.DRIVE_SB = supabase.createClient(DRIVE_CONFIG.supabaseUrl, DRIVE_CONFIG.supabaseKey);
}
