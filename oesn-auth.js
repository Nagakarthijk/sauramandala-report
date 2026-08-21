// oesn-auth.js — DRIVE shared authentication + role guard
// Load AFTER supabase-js and drive-config.js on every page.
//
// Usage:
//   const ctx = await OESNAuth.guard('agent');
//   // ctx = { mode, user, role, profile, orgId } or null (redirect triggered)
//   OESNAuth.renderUserBar(ctx, 'user-bar');

const OESNAuth = (() => {
  'use strict';

  const LOGIN_PAGE = 'oesn-login.html';

  const ROLE_HOME = {
    agent             : 'agent.html',
    provider          : 'provider.html',
    programme_officer : 'programme.html',
    admin             : 'admin.html',
  };

  // ── guard(requiredRole?) ──────────────────────────────────────────────────
  async function guard(requiredRole) {
    // Demo mode: no Supabase configured
    if (!window.DRIVE_SB) {
      return { mode: 'demo', role: requiredRole || 'agent', profile: null, user: null, orgId: null };
    }

    const sb = window.DRIVE_SB;

    // Check session
    const { data: { session } } = await sb.auth.getSession();
    if (!session) {
      const next = encodeURIComponent(location.pathname.split('/').pop());
      location.replace(LOGIN_PAGE + (next ? '?next=' + next : ''));
      return null;
    }

    // Load profile
    const { data: profile, error } = await sb
      .from('profiles')
      .select('*, organisations(name,slug)')
      .eq('id', session.user.id)
      .single();

    if (error || !profile) {
      location.replace(LOGIN_PAGE);
      return null;
    }

    const role = profile.role;

    // Admin can access any page
    if (role === 'admin') {
      return { mode: 'supabase', user: session.user, role, profile, orgId: profile.org_id, sb };
    }

    // Wrong role for this page → redirect to their home
    if (requiredRole && role !== requiredRole) {
      location.replace(ROLE_HOME[role] || 'oesn.html');
      return null;
    }

    return { mode: 'supabase', user: session.user, role, profile, orgId: profile.org_id, sb };
  }

  // ── signOut() ─────────────────────────────────────────────────────────────
  async function signOut() {
    if (window.DRIVE_SB) await window.DRIVE_SB.auth.signOut();
    location.replace(LOGIN_PAGE);
  }

  // ── renderUserBar(ctx, containerId) ──────────────────────────────────────
  function renderUserBar(ctx, containerId) {
    const el = document.getElementById(containerId);
    if (!el || !ctx) return;

    if (ctx.mode === 'demo') {
      el.innerHTML = `
        <div class="flex items-center justify-between px-4 py-2 bg-amber-50 border-b border-amber-200 text-xs">
          <span class="text-amber-800 font-medium">Demo mode — data stays on this device only</span>
          <a href="${LOGIN_PAGE}" class="text-amber-700 font-semibold underline">Sign in</a>
        </div>`;
      return;
    }

    const name  = ctx.profile?.name || ctx.user?.email || 'User';
    const org   = ctx.profile?.organisations?.name || '';
    const badge = { agent:'bg-blue-100 text-blue-800', provider:'bg-emerald-100 text-emerald-800',
                    programme_officer:'bg-purple-100 text-purple-800', admin:'bg-red-100 text-red-800' }[ctx.role]
                  || 'bg-stone-100 text-stone-600';

    el.innerHTML = `
      <div class="flex items-center justify-between px-4 py-2 bg-stone-900 text-white text-xs">
        <div class="flex items-center gap-2">
          <span class="font-bold text-amber-400">DRIVE</span>
          <span class="px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${badge}">${ctx.role.replace('_',' ')}</span>
          <span class="text-stone-300 truncate max-w-[140px]">${name}</span>
          ${org ? `<span class="text-stone-500 hidden sm:inline">· ${org}</span>` : ''}
        </div>
        <button onclick="OESNAuth.signOut()" class="text-stone-400 hover:text-white transition-colors">Sign out</button>
      </div>`;
  }

  return { guard, signOut, renderUserBar, ROLE_HOME };
})();
