// tl-data.js — Public Work Profile + Trust Ledger
// Shared data layer · v1.0 · localStorage-backed demo

const TL = (() => {
  const KEYS = {
    profiles:  'tl_profiles',
    ledger:    'tl_ledger',
    updates:   'tl_updates',
    claims:    'tl_claims',
    comments:  'tl_comments',
    seeded:    'tl_seeded_v1'
  };

  // ─── Seed Profiles ───────────────────────────────────────────────
  const SEED_PROFILES = [
    {
      id: 'P001', slug: 'divya-waste',
      name: 'Divya Menon', photoUrl: null,
      bio: 'Running a neighbourhood dry waste sorting drive in HSR Layout. Volunteer for 3 years. Not an NGO — just a person trying to make a block cleaner.',
      upiId: 'divya.menon@okicici',
      currentWork: 'Setting up a dry waste collection point in Sector 4. Collecting funds for storage bins, signage, and first 3 months of logistics.',
      goalAmount: 8000,
      locationText: 'HSR Layout, Bangalore', locationPrecision: 'area',
      category: 'environment',
      discoverable: true,
      createdAt: '2026-03-01T10:00:00Z', lastActiveAt: '2026-04-09T08:30:00Z'
    },
    {
      id: 'P002', slug: 'arjun-library',
      name: 'Arjun Sinha', photoUrl: null,
      bio: 'Village school teacher in Sitamarhi. Building a free lending library for kids who have no books at home. Started with 40 books, now at 310.',
      upiId: 'arjun.sinha@ybl',
      currentWork: 'Raising funds to buy 200 more books (Grades 3–8) and build a simple wooden shelf unit for the library room.',
      goalAmount: 12000,
      locationText: 'Sitamarhi, Bihar', locationPrecision: 'area',
      category: 'education',
      discoverable: true,
      createdAt: '2026-01-15T09:00:00Z', lastActiveAt: '2026-04-08T11:00:00Z'
    },
    {
      id: 'P003', slug: 'kavitha-writes',
      name: 'Kavitha R', photoUrl: null,
      bio: 'Independent journalist covering land rights and tribal displacement in Odisha. No publication backing. Self-funded since 2023.',
      upiId: 'kavitha.r@paytm',
      currentWork: 'Reporting a 3-part series on forest land disputes in Koraput. Need to cover travel, accommodation, and translation costs.',
      goalAmount: 15000,
      locationText: 'Koraput, Odisha', locationPrecision: 'area',
      category: 'journalism',
      discoverable: true,
      createdAt: '2025-11-10T14:00:00Z', lastActiveAt: '2026-04-10T07:00:00Z'
    },
    {
      id: 'P004', slug: 'preeti-pottery',
      name: 'Preeti Kumari', photoUrl: null,
      bio: 'Self-taught clay potter from Molela village. Documenting traditional Rajasthani pottery techniques before they disappear. Making and teaching.',
      upiId: 'preeti.kumari@okaxis',
      currentWork: 'Building a small open workshop for local women to learn pottery. Need a kiln repair and basic tools.',
      goalAmount: 6000,
      locationText: 'Molela, Rajasthan', locationPrecision: 'area',
      category: 'craft',
      discoverable: true,
      createdAt: '2026-02-20T10:00:00Z', lastActiveAt: '2026-04-07T16:00:00Z'
    }
  ];

  // ─── Seed Ledger ─────────────────────────────────────────────────
  const SEED_LEDGER = [
    // Divya
    { id:'L001', profileId:'P001', type:'RECEIVED', amount:500,  note:'Support from a neighbour who saw the drive', createdAt:'2026-03-05T10:00:00Z' },
    { id:'L002', profileId:'P001', type:'SPENT',    amount:1200, note:'Bought 4 dry waste bins from local supplier', mediaUrls:[], createdAt:'2026-03-10T14:00:00Z' },
    { id:'L003', profileId:'P001', type:'RECEIVED', amount:2000, note:'WhatsApp group collection from RWA members', createdAt:'2026-03-18T09:00:00Z' },
    { id:'L004', profileId:'P001', type:'SPENT',    amount:800,  note:'Signage printing and installation — 3 boards', createdAt:'2026-03-25T11:00:00Z' },
    { id:'L005', profileId:'P001', type:'RECEIVED', amount:1500, note:'Anonymous support via UPI', createdAt:'2026-04-02T16:00:00Z' },
    { id:'L006', profileId:'P001', type:'SPENT',    amount:600,  note:'First month volunteer coordination lunch', createdAt:'2026-04-08T13:00:00Z' },
    // Arjun
    { id:'L007', profileId:'P002', type:'RECEIVED', amount:1000, note:'Colleague donated for book purchase', createdAt:'2026-01-20T10:00:00Z' },
    { id:'L008', profileId:'P002', type:'SPENT',    amount:2200, note:'Bought 80 books from Patna book fair — receipts available', createdAt:'2026-02-01T14:00:00Z' },
    { id:'L009', profileId:'P002', type:'RECEIVED', amount:3500, note:'Twitter/X post went semi-viral — 7 supporters', createdAt:'2026-02-14T09:00:00Z' },
    { id:'L010', profileId:'P002', type:'RECEIVED', amount:500,  note:'Student\'s parent gave directly', createdAt:'2026-03-10T11:00:00Z' },
    { id:'L011', profileId:'P002', type:'SPENT',    amount:1800, note:'Wooden shelf unit built by local carpenter', createdAt:'2026-03-20T15:00:00Z' },
    // Kavitha
    { id:'L012', profileId:'P003', type:'RECEIVED', amount:2000, note:'Reader support via UPI after first article', createdAt:'2025-11-20T10:00:00Z' },
    { id:'L013', profileId:'P003', type:'SPENT',    amount:1400, note:'Bus + shared jeep travel to Koraput (3 trips)', createdAt:'2025-12-05T14:00:00Z' },
    { id:'L014', profileId:'P003', type:'RECEIVED', amount:3000, note:'3 anonymous reader supporters in December', createdAt:'2025-12-18T09:00:00Z' },
    { id:'L015', profileId:'P003', type:'SPENT',    amount:800,  note:'Local translator fees for 2 interviews', createdAt:'2026-01-10T11:00:00Z' },
    { id:'L016', profileId:'P003', type:'SPENT',    amount:600,  note:'Accommodation — 4 nights at local guest house', createdAt:'2026-01-15T15:00:00Z' },
    // Preeti
    { id:'L017', profileId:'P004', type:'RECEIVED', amount:1000, note:'Support from craft collective member', createdAt:'2026-02-25T10:00:00Z' },
    { id:'L018', profileId:'P004', type:'SPENT',    amount:1500, note:'Kiln repair — local metalworker', createdAt:'2026-03-05T14:00:00Z' },
    { id:'L019', profileId:'P004', type:'RECEIVED', amount:1500, note:'Instagram follower donated after workshop video', createdAt:'2026-03-20T09:00:00Z' },
  ];

  // ─── Seed Updates ─────────────────────────────────────────────────
  const SEED_UPDATES = [
    { id:'U001', profileId:'P001', text:'First bin installed at the Sector 4 entrance. Already seeing people sort before dumping. Small win.', createdAt:'2026-03-12T10:00:00Z' },
    { id:'U002', profileId:'P001', text:'RWA meeting happened — they agreed to sponsor one more bin. We now have 5 collection points. Posting photos tomorrow.', createdAt:'2026-04-01T18:00:00Z' },
    { id:'U003', profileId:'P002', text:'Library hit 300 books today. Kids from 3 surrounding villages now visit on weekends. Never expected this.', createdAt:'2026-03-01T12:00:00Z' },
    { id:'U004', profileId:'P002', text:'Shelf is up. Carpenter did a beautiful job. Using the remaining funds for a register so kids can borrow books home.', createdAt:'2026-03-22T09:00:00Z' },
    { id:'U005', profileId:'P003', text:'Part 1 of the Koraput series is published. Will share the link here. Parts 2 and 3 need one more field trip.', createdAt:'2026-02-10T14:00:00Z' },
    { id:'U006', profileId:'P004', text:'First workshop session done — 6 women from the neighbourhood joined. We made small diyas. Kiln worked after repair. Relief.', createdAt:'2026-03-08T16:00:00Z' },
  ];

  // ─── Seed Claims ──────────────────────────────────────────────────
  const SEED_CLAIMS = [
    { id:'C001', profileId:'P001', amount:500,  name:'Rohit K', anonymous:false, utr:'TXN204910234', status:'CONFIRMED', createdAt:'2026-03-05T11:00:00Z' },
    { id:'C002', profileId:'P001', amount:2000, name:null,       anonymous:true,  utr:'TXN209812345', status:'CONFIRMED', createdAt:'2026-03-18T10:00:00Z' },
    { id:'C003', profileId:'P001', amount:1500, name:null,       anonymous:true,  utr:null,           status:'UNVERIFIED', createdAt:'2026-04-02T17:00:00Z' },
    { id:'C004', profileId:'P002', amount:1000, name:'Meera S',  anonymous:false, utr:'TXN301923812', status:'CONFIRMED', createdAt:'2026-01-20T11:00:00Z' },
    { id:'C005', profileId:'P002', amount:3500, name:null,       anonymous:true,  utr:'TXN309871234', status:'CONFIRMED', createdAt:'2026-02-14T10:00:00Z' },
    { id:'C006', profileId:'P003', amount:2000, name:'Arun T',   anonymous:false, utr:'TXN401823451', status:'CONFIRMED', createdAt:'2025-11-20T11:00:00Z' },
    { id:'C007', profileId:'P004', amount:1000, name:'Craft Collective', anonymous:false, utr:'TXN501234512', status:'CONFIRMED', createdAt:'2026-02-25T11:00:00Z' },
  ];

  // ─── Seed Comments ────────────────────────────────────────────────
  const SEED_COMMENTS = [
    { id:'CM001', profileId:'P001', type:'COMMENT', text:'Divya, this is exactly what HSR needs. Keep going!', createdAt:'2026-03-15T10:00:00Z' },
    { id:'CM002', profileId:'P001', type:'COMMENT', text:'Can I volunteer for collection on Sundays?', createdAt:'2026-04-03T14:00:00Z' },
    { id:'CM003', profileId:'P002', type:'COMMENT', text:'This made my morning. Real work, real update. Supported.', createdAt:'2026-03-02T09:00:00Z' },
    { id:'CM004', profileId:'P003', type:'COMMENT', text:'Read Part 1 — powerful reporting. Looking forward to Parts 2 and 3.', createdAt:'2026-02-11T16:00:00Z' },
    { id:'CM005', profileId:'P004', type:'COMMENT', text:'I\'m from Molela originally. This work matters so much. Thank you.', createdAt:'2026-03-10T12:00:00Z' },
  ];

  // ─── Core Functions ───────────────────────────────────────────────
  function init() {
    if (!localStorage.getItem(KEYS.seeded)) {
      localStorage.setItem(KEYS.profiles,  JSON.stringify(SEED_PROFILES));
      localStorage.setItem(KEYS.ledger,    JSON.stringify(SEED_LEDGER));
      localStorage.setItem(KEYS.updates,   JSON.stringify(SEED_UPDATES));
      localStorage.setItem(KEYS.claims,    JSON.stringify(SEED_CLAIMS));
      localStorage.setItem(KEYS.comments,  JSON.stringify(SEED_COMMENTS));
      localStorage.setItem(KEYS.seeded,    'true');
    }
  }

  function getProfiles()               { return JSON.parse(localStorage.getItem(KEYS.profiles)  || '[]'); }
  function getLedger()                 { return JSON.parse(localStorage.getItem(KEYS.ledger)    || '[]'); }
  function getUpdates()                { return JSON.parse(localStorage.getItem(KEYS.updates)   || '[]'); }
  function getClaims()                 { return JSON.parse(localStorage.getItem(KEYS.claims)    || '[]'); }
  function getComments()               { return JSON.parse(localStorage.getItem(KEYS.comments)  || '[]'); }

  function getProfileBySlug(slug)      { return getProfiles().find(p => p.slug === slug) || null; }
  function getProfileById(id)          { return getProfiles().find(p => p.id === id) || null; }

  function getLedgerForProfile(pid)    { return getLedger().filter(e => e.profileId === pid).sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)); }
  function getUpdatesForProfile(pid)   { return getUpdates().filter(e => e.profileId === pid).sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)); }
  function getClaimsForProfile(pid)    { return getClaims().filter(e => e.profileId === pid).sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)); }
  function getCommentsForProfile(pid)  { return getComments().filter(e => e.profileId === pid).sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)); }

  function getProfileStats(pid) {
    const ledger = getLedgerForProfile(pid);
    const received = ledger.filter(e => e.type === 'RECEIVED').reduce((s,e) => s + e.amount, 0);
    const spent    = ledger.filter(e => e.type === 'SPENT').reduce((s,e) => s + e.amount, 0);
    return { received, spent, balance: received - spent };
  }

  function addProfile(p)  { const list = getProfiles();  list.push(p);  localStorage.setItem(KEYS.profiles,  JSON.stringify(list)); }
  function addLedger(e)   { const list = getLedger();    list.push(e);  localStorage.setItem(KEYS.ledger,    JSON.stringify(list)); }
  function addUpdate(u)   { const list = getUpdates();   list.push(u);  localStorage.setItem(KEYS.updates,   JSON.stringify(list)); }
  function addClaim(c)    { const list = getClaims();    list.push(c);  localStorage.setItem(KEYS.claims,    JSON.stringify(list)); }
  function addComment(cm) { const list = getComments();  list.push(cm); localStorage.setItem(KEYS.comments,  JSON.stringify(list)); }

  function updateClaimStatus(id, status) {
    const list = getClaims();
    const i = list.findIndex(c => c.id === id);
    if (i > -1) { list[i].status = status; localStorage.setItem(KEYS.claims, JSON.stringify(list)); }
  }

  function generateId(prefix) { return prefix + Date.now().toString(36).toUpperCase().slice(-6); }

  function slugify(name) {
    return name.toLowerCase().replace(/[^a-z0-9\s]/g,'').trim().replace(/\s+/g,'-').slice(0, 40)
      + '-' + Math.random().toString(36).slice(2,6);
  }

  function formatINR(n) { return '₹' + n.toLocaleString('en-IN'); }

  function relativeTime(iso) {
    const diff = Math.floor((Date.now() - new Date(iso)) / 1000);
    if (diff < 60)   return 'just now';
    if (diff < 3600) return Math.floor(diff/60) + 'm ago';
    if (diff < 86400) return Math.floor(diff/3600) + 'h ago';
    if (diff < 604800) return Math.floor(diff/86400) + 'd ago';
    return new Date(iso).toLocaleDateString('en-IN', { day:'numeric', month:'short' });
  }

  function categoryLabel(cat) {
    const m = { environment:'Environment', education:'Education', journalism:'Journalism',
                craft:'Craft & Art', health:'Health', community:'Community', other:'Other' };
    return m[cat] || cat;
  }

  function categoryColor(cat) {
    const m = { environment:'bg-green-100 text-green-700', education:'bg-blue-100 text-blue-700',
                journalism:'bg-purple-100 text-purple-700', craft:'bg-orange-100 text-orange-700',
                health:'bg-red-100 text-red-700', community:'bg-teal-100 text-teal-700' };
    return m[cat] || 'bg-stone-100 text-stone-600';
  }

  function initials(name) {
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2);
  }

  // Shared nav for all TL pages
  function navHTML(activePage) {
    return `
      <nav class="bg-white border-b border-stone-200 sticky top-0 z-40">
        <div class="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <a href="trust-ledger.html" class="flex items-center gap-2">
            <span class="font-black text-stone-900 text-lg tracking-tight">workledger</span>
            <span class="text-[10px] font-semibold text-stone-400 uppercase tracking-widest hidden sm:block">public trust</span>
          </a>
          <div class="flex items-center gap-3">
            <a href="trust-ledger.html" class="text-sm font-medium ${activePage==='explore' ? 'text-stone-900' : 'text-stone-400 hover:text-stone-700'} transition-colors">Explore</a>
            <a href="tl-create.html" class="bg-stone-900 hover:bg-stone-800 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-all">
              + Your Profile
            </a>
          </div>
        </div>
      </nav>`;
  }

  return {
    init, getProfiles, getLedger, getUpdates, getClaims, getComments,
    getProfileBySlug, getProfileById,
    getLedgerForProfile, getUpdatesForProfile, getClaimsForProfile, getCommentsForProfile,
    getProfileStats,
    addProfile, addLedger, addUpdate, addClaim, addComment, updateClaimStatus,
    generateId, slugify, formatINR, relativeTime, categoryLabel, categoryColor, initials,
    navHTML
  };
})();
