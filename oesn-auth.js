// oesn-auth.js — OESN shared authentication + role guard
// Load AFTER supabase-js and oesn-data.js on every protected page.
//
// Usage:
//   OESNAuth.guard('agent')     — redirects to login if no session, wrong role → right page
//   OESNAuth.guard('provider')
//   OESNAuth.guard('admin')
//   OESNAuth.guard()            — just checks session, any role ok
//
//   const ctx = await OESNAuth.guard('agent');
//   // ctx = { user, role, profile } or null (redirect already triggered)

const OESNAuth = (() => {
  'use strict';

  const LOGIN_PAGE = 'oesn-login.html';

  const ROLE_HOME = {
    agent    : 'agent.html',
    provider : 'provider.html',
    admin    : 'admin.html',
    programme: 'programme.html',
  };

  // ── Internal: detect role from Supabase tables ────────────────────────
  async function _detectRole(sb, userId) {
    const [adminRes, agentRes, provRes] = await Promise.all([
      sb.from('admins').select('id,name').eq('user_id', userId).maybeSingle(),
      sb.from('agents').select('id,name,geography,operating_model,programme_id').eq('user_id', userId).maybeSingle(),
      sb.from('providers').select('id,org_name,empanelment_status').eq('user_id', userId).maybeSingle(),
    ]);
    if (adminRes.data)  return { role: 'admin',    profile: adminRes.data };
    if (agentRes.data)  return { role: 'agent',    profile: agentRes.data };
    if (provRes.data)   return { role: 'provider', profile: provRes.data };
    return { role: 'unknown', profile: null };
  }

  // ── guard(requiredRole?) ──────────────────────────────────────────────
  // Returns auth context or null (redirect already issued).
  async function guard(requiredRole) {
    // Demo mode: no auth needed
    if (!OESN.isSupabaseMode()) {
      return { mode: 'demo', role: requiredRole || 'agent', profile: null, user: null };
    }

    // Check Supabase session
    const sbUrl = (localStorage.getItem('oesn_sb_url') || '').trim();
    const sbKey = (localStorage.getItem('oesn_sb_key') || '').trim();
    const sb    = supabase.createClient(sbUrl, sbKey);

    const { data: { session } } = await sb.auth.getSession();
    if (!session) {
      const next = encodeURIComponent(location.pathname.split('/').pop() + location.search);
      location.replace(LOGIN_PAGE + (next ? '?next=' + next : ''));
      return null;
    }

    const user = session.user;
    const { role, profile } = await _detectRole(sb, user.id);

    // Admin can access any page
    if (role === 'admin' && requiredRole !== 'admin') {
      // Allow through — admin can view any page
      return { mode: 'supabase', user, role, profile, sb };
    }

    // Wrong role → redirect to their page
    if (requiredRole && role !== requiredRole) {
      const home = ROLE_HOME[role] || 'oesn.html';
      location.replace(home);
      return null;
    }

    return { mode: 'supabase', user, role, profile, sb };
  }

  // ── signOut() ─────────────────────────────────────────────────────────
  async function signOut() {
    await OESN.signOut();
    location.replace(LOGIN_PAGE);
  }

  // ── renderUserBar(ctx, containerId) ──────────────────────────────────
  // Injects a slim top bar showing user + role + logout.
  function renderUserBar(ctx, containerId) {
    const el = document.getElementById(containerId);
    if (!el || !ctx) return;

    const name  = ctx.profile?.name || ctx.profile?.org_name || ctx.user?.email || 'User';
    const badge = {
      agent    : 'bg-blue-100 text-blue-800',
      provider : 'bg-emerald-100 text-emerald-800',
      admin    : 'bg-red-100 text-red-800',
      demo     : 'bg-amber-100 text-amber-800',
    }[ctx.role] || 'bg-stone-100 text-stone-600';

    el.innerHTML = `
      <div class="flex items-center justify-between px-4 py-2 bg-stone-900 text-white text-xs">
        <div class="flex items-center gap-2">
          <span class="font-bold text-amber-400">OESN</span>
          <span class="px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${badge}">${ctx.role}</span>
          <span class="text-stone-400 truncate max-w-[160px]">${name}</span>
        </div>
        <button onclick="OESNAuth.signOut()"
          class="text-stone-400 hover:text-white transition-colors text-xs">Sign out</button>
      </div>`;
  }

  return { guard, signOut, renderUserBar, ROLE_HOME };
})();
