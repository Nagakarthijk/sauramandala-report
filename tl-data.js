// tl-data.js — Public Work Profile + Trust Ledger · v2.0
// Shared data layer — owner tokens, photo support, localStorage

const TL = (() => {

  const KEYS = {
    profiles: 'tl_profiles',
    ledger:   'tl_ledger',
    updates:  'tl_updates',
    claims:   'tl_claims',
    comments: 'tl_comments',
    seeded:   'tl_seeded_v2'
  };

  // Edit token key per profile — stored separately so it's not in the public profile object
  function ownerKey(slug) { return 'tl_own_' + slug; }
  function isOwner(profile) {
    const stored = localStorage.getItem(ownerKey(profile.slug));
    return stored && stored === profile.editToken;
  }
  function claimOwnership(slug, token) {
    localStorage.setItem(ownerKey(slug), token);
  }

  // ─── Seed Profiles (no one owns these — for demo browsing) ────────
  const SEED_PROFILES = [
    {
      id: 'P001', slug: 'divya-waste', editToken: '__seed__',
      name: 'Divya Menon', photoUrl: null, upiQrUrl: null,
      bio: 'Running a neighbourhood dry waste sorting drive in HSR Layout. Volunteer for 3 years. Not an NGO — just a person trying to make a block cleaner.',
      upiId: 'divya.menon@okicici',
      currentWork: 'Setting up a dry waste collection point in Sector 4. Collecting funds for storage bins, signage, and first 3 months of logistics.',
      goalAmount: 8000, locationText: 'HSR Layout, Bangalore',
      category: 'environment', discoverable: true,
      createdAt: '2026-03-01T10:00:00Z', lastActiveAt: '2026-04-09T08:30:00Z'
    },
    {
      id: 'P002', slug: 'arjun-library', editToken: '__seed__',
      name: 'Arjun Sinha', photoUrl: null, upiQrUrl: null,
      bio: 'Village school teacher in Sitamarhi. Building a free lending library for kids who have no books at home. Started with 40 books, now at 310.',
      upiId: 'arjun.sinha@ybl',
      currentWork: 'Raising funds to buy 200 more books (Grades 3–8) and build a simple wooden shelf unit for the library room.',
      goalAmount: 12000, locationText: 'Sitamarhi, Bihar',
      category: 'education', discoverable: true,
      createdAt: '2026-01-15T09:00:00Z', lastActiveAt: '2026-04-08T11:00:00Z'
    },
    {
      id: 'P003', slug: 'kavitha-writes', editToken: '__seed__',
      name: 'Kavitha R', photoUrl: null, upiQrUrl: null,
      bio: 'Independent journalist covering land rights and tribal displacement in Odisha. No publication backing. Self-funded since 2023.',
      upiId: 'kavitha.r@paytm',
      currentWork: 'Reporting a 3-part series on forest land disputes in Koraput. Need to cover travel, accommodation, and translation costs.',
      goalAmount: 15000, locationText: 'Koraput, Odisha',
      category: 'journalism', discoverable: true,
      createdAt: '2025-11-10T14:00:00Z', lastActiveAt: '2026-04-10T07:00:00Z'
    },
    {
      id: 'P004', slug: 'preeti-pottery', editToken: '__seed__',
      name: 'Preeti Kumari', photoUrl: null, upiQrUrl: null,
      bio: 'Self-taught clay potter from Molela village. Documenting traditional Rajasthani pottery techniques before they disappear.',
      upiId: 'preeti.kumari@okaxis',
      currentWork: 'Building a small open workshop for local women to learn pottery. Need a kiln repair and basic tools.',
      goalAmount: 6000, locationText: 'Molela, Rajasthan',
      category: 'craft', discoverable: true,
      createdAt: '2026-02-20T10:00:00Z', lastActiveAt: '2026-04-07T16:00:00Z'
    }
  ];

  const SEED_LEDGER = [
    { id:'L001', profileId:'P001', type:'RECEIVED', amount:500,  note:'Support from a neighbour who saw the drive', mediaUrl:null, createdAt:'2026-03-05T10:00:00Z' },
    { id:'L002', profileId:'P001', type:'SPENT',    amount:1200, note:'Bought 4 dry waste bins from local supplier', mediaUrl:null, createdAt:'2026-03-10T14:00:00Z' },
    { id:'L003', profileId:'P001', type:'RECEIVED', amount:2000, note:'WhatsApp group collection from RWA members', mediaUrl:null, createdAt:'2026-03-18T09:00:00Z' },
    { id:'L004', profileId:'P001', type:'SPENT',    amount:800,  note:'Signage printing and installation — 3 boards', mediaUrl:null, createdAt:'2026-03-25T11:00:00Z' },
    { id:'L005', profileId:'P001', type:'RECEIVED', amount:1500, note:'Anonymous support via UPI', mediaUrl:null, createdAt:'2026-04-02T16:00:00Z' },
    { id:'L006', profileId:'P001', type:'SPENT',    amount:600,  note:'First month volunteer coordination lunch', mediaUrl:null, createdAt:'2026-04-08T13:00:00Z' },
    { id:'L007', profileId:'P002', type:'RECEIVED', amount:1000, note:'Colleague donated for book purchase', mediaUrl:null, createdAt:'2026-01-20T10:00:00Z' },
    { id:'L008', profileId:'P002', type:'SPENT',    amount:2200, note:'Bought 80 books from Patna book fair', mediaUrl:null, createdAt:'2026-02-01T14:00:00Z' },
    { id:'L009', profileId:'P002', type:'RECEIVED', amount:3500, note:'Post went semi-viral — 7 supporters contributed', mediaUrl:null, createdAt:'2026-02-14T09:00:00Z' },
    { id:'L010', profileId:'P002', type:'SPENT',    amount:1800, note:'Wooden shelf unit built by local carpenter', mediaUrl:null, createdAt:'2026-03-20T15:00:00Z' },
    { id:'L011', profileId:'P003', type:'RECEIVED', amount:2000, note:'Reader support via UPI after first article', mediaUrl:null, createdAt:'2025-11-20T10:00:00Z' },
    { id:'L012', profileId:'P003', type:'SPENT',    amount:1400, note:'Bus + shared jeep travel to Koraput (3 trips)', mediaUrl:null, createdAt:'2025-12-05T14:00:00Z' },
    { id:'L013', profileId:'P003', type:'RECEIVED', amount:3000, note:'3 anonymous reader supporters', mediaUrl:null, createdAt:'2025-12-18T09:00:00Z' },
    { id:'L014', profileId:'P003', type:'SPENT',    amount:1400, note:'Local translator fees + accommodation', mediaUrl:null, createdAt:'2026-01-15T15:00:00Z' },
    { id:'L015', profileId:'P004', type:'RECEIVED', amount:1000, note:'Support from craft collective member', mediaUrl:null, createdAt:'2026-02-25T10:00:00Z' },
    { id:'L016', profileId:'P004', type:'SPENT',    amount:1500, note:'Kiln repair — local metalworker', mediaUrl:null, createdAt:'2026-03-05T14:00:00Z' },
    { id:'L017', profileId:'P004', type:'RECEIVED', amount:1500, note:'Instagram follower donated after workshop video', mediaUrl:null, createdAt:'2026-03-20T09:00:00Z' },
  ];

  const SEED_UPDATES = [
    { id:'U001', profileId:'P001', text:'First bin installed at the Sector 4 entrance. Already seeing people sort before dumping.', mediaUrl:null, createdAt:'2026-03-12T10:00:00Z' },
    { id:'U002', profileId:'P001', text:'RWA meeting happened — they agreed to sponsor one more bin. We now have 5 collection points.', mediaUrl:null, createdAt:'2026-04-01T18:00:00Z' },
    { id:'U003', profileId:'P002', text:'Library hit 300 books today. Kids from 3 surrounding villages now visit on weekends.', mediaUrl:null, createdAt:'2026-03-01T12:00:00Z' },
    { id:'U004', profileId:'P002', text:'Shelf is up. Carpenter did a beautiful job. Using the remaining funds for a borrow register.', mediaUrl:null, createdAt:'2026-03-22T09:00:00Z' },
    { id:'U005', profileId:'P003', text:'Part 1 of the Koraput series is published. Parts 2 and 3 need one more field trip.', mediaUrl:null, createdAt:'2026-02-10T14:00:00Z' },
    { id:'U006', profileId:'P004', text:'First workshop session done — 6 women joined. We made small diyas. Kiln worked after repair. Relief.', mediaUrl:null, createdAt:'2026-03-08T16:00:00Z' },
  ];

  const SEED_CLAIMS = [
    { id:'C001', profileId:'P001', amount:500,  name:'Rohit K',  anonymous:false, utr:'TXN204910234', status:'CONFIRMED',  createdAt:'2026-03-05T11:00:00Z' },
    { id:'C002', profileId:'P001', amount:2000, name:null,       anonymous:true,  utr:'TXN209812345', status:'CONFIRMED',  createdAt:'2026-03-18T10:00:00Z' },
    { id:'C003', profileId:'P001', amount:1500, name:null,       anonymous:true,  utr:null,           status:'UNVERIFIED', createdAt:'2026-04-02T17:00:00Z' },
    { id:'C004', profileId:'P002', amount:1000, name:'Meera S',  anonymous:false, utr:'TXN301923812', status:'CONFIRMED',  createdAt:'2026-01-20T11:00:00Z' },
    { id:'C005', profileId:'P002', amount:3500, name:null,       anonymous:true,  utr:'TXN309871234', status:'CONFIRMED',  createdAt:'2026-02-14T10:00:00Z' },
    { id:'C006', profileId:'P003', amount:2000, name:'Arun T',   anonymous:false, utr:'TXN401823451', status:'CONFIRMED',  createdAt:'2025-11-20T11:00:00Z' },
    { id:'C007', profileId:'P004', amount:1000, name:'Craft Collective', anonymous:false, utr:'TXN501234512', status:'CONFIRMED', createdAt:'2026-02-25T11:00:00Z' },
  ];

  const SEED_COMMENTS = [
    { id:'CM001', profileId:'P001', type:'COMMENT', text:'Divya, this is exactly what HSR needs. Keep going!', createdAt:'2026-03-15T10:00:00Z' },
    { id:'CM002', profileId:'P001', type:'COMMENT', text:'Can I volunteer for collection on Sundays?', createdAt:'2026-04-03T14:00:00Z' },
    { id:'CM003', profileId:'P002', type:'COMMENT', text:'This made my morning. Real work, real update. Supported.', createdAt:'2026-03-02T09:00:00Z' },
    { id:'CM004', profileId:'P003', type:'COMMENT', text:'Read Part 1 — powerful reporting. Looking forward to Parts 2 and 3.', createdAt:'2026-02-11T16:00:00Z' },
    { id:'CM005', profileId:'P004', type:'COMMENT', text:'I\'m from Molela originally. This work matters so much.', createdAt:'2026-03-10T12:00:00Z' },
  ];

  // ─── Init ──────────────────────────────────────────────────────────
  function init() {
    if (!localStorage.getItem(KEYS.seeded)) {
      localStorage.setItem(KEYS.profiles, JSON.stringify(SEED_PROFILES));
      localStorage.setItem(KEYS.ledger,   JSON.stringify(SEED_LEDGER));
      localStorage.setItem(KEYS.updates,  JSON.stringify(SEED_UPDATES));
      localStorage.setItem(KEYS.claims,   JSON.stringify(SEED_CLAIMS));
      localStorage.setItem(KEYS.comments, JSON.stringify(SEED_COMMENTS));
      localStorage.setItem(KEYS.seeded,   'true');
    }
  }

  // ─── Getters ───────────────────────────────────────────────────────
  const getAll  = key => JSON.parse(localStorage.getItem(key) || '[]');
  const saveAll = (key, list) => localStorage.setItem(key, JSON.stringify(list));

  function getProfiles()  { return getAll(KEYS.profiles); }
  function getLedger()    { return getAll(KEYS.ledger);   }
  function getUpdates()   { return getAll(KEYS.updates);  }
  function getClaims()    { return getAll(KEYS.claims);   }
  function getComments()  { return getAll(KEYS.comments); }

  function getProfileBySlug(slug) { return getProfiles().find(p => p.slug === slug) || null; }
  function getProfileById(id)     { return getProfiles().find(p => p.id   === id)   || null; }

  const byProfile = (list, pid) => list.filter(e => e.profileId === pid).sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
  function getLedgerForProfile(pid)   { return byProfile(getLedger(),   pid); }
  function getUpdatesForProfile(pid)  { return byProfile(getUpdates(),  pid); }
  function getClaimsForProfile(pid)   { return byProfile(getClaims(),   pid); }
  function getCommentsForProfile(pid) { return byProfile(getComments(), pid); }

  function getProfileStats(pid) {
    const ledger = getLedgerForProfile(pid);
    const received = ledger.filter(e => e.type === 'RECEIVED').reduce((s,e) => s+e.amount, 0);
    const spent    = ledger.filter(e => e.type === 'SPENT').reduce((s,e) => s+e.amount, 0);
    return { received, spent, balance: received - spent };
  }

  // ─── Writers ───────────────────────────────────────────────────────
  function addProfile(p) {
    const list = getProfiles(); list.push(p); saveAll(KEYS.profiles, list);
    claimOwnership(p.slug, p.editToken); // mark as owned on this browser
  }
  function updateProfile(p) {
    const list = getProfiles();
    const i = list.findIndex(x => x.id === p.id);
    if (i > -1) { list[i] = p; saveAll(KEYS.profiles, list); }
  }
  function addLedgerEntry(e)  { const l = getLedger();   l.push(e);  saveAll(KEYS.ledger,   l); }
  function addUpdate(u)       { const l = getUpdates();  l.push(u);  saveAll(KEYS.updates,  l); }
  function addClaim(c)        { const l = getClaims();   l.push(c);  saveAll(KEYS.claims,   l); }
  function addComment(cm)     { const l = getComments(); l.push(cm); saveAll(KEYS.comments, l); }

  function updateClaimStatus(id, status) {
    const list = getClaims();
    const i = list.findIndex(c => c.id === id);
    if (i > -1) { list[i].status = status; saveAll(KEYS.claims, list); }
  }
  function deleteComment(id) {
    saveAll(KEYS.comments, getComments().filter(c => c.id !== id));
  }
  function touchProfile(id) {
    const list = getProfiles();
    const i = list.findIndex(p => p.id === id);
    if (i > -1) { list[i].lastActiveAt = new Date().toISOString(); saveAll(KEYS.profiles, list); }
  }

  // ─── Helpers ───────────────────────────────────────────────────────
  function generateId(prefix) { return prefix + Date.now().toString(36).toUpperCase().slice(-7); }

  function slugify(name) {
    return name.toLowerCase().replace(/[^a-z0-9\s]/g,'').trim().replace(/\s+/g,'-').slice(0,36)
      + '-' + Math.random().toString(36).slice(2,6);
  }

  function formatINR(n) {
    if (n >= 100000) return '₹' + (n/100000).toFixed(1) + 'L';
    if (n >= 1000)   return '₹' + (n/1000).toFixed(1) + 'k';
    return '₹' + n;
  }
  function formatINRFull(n) { return '₹' + n.toLocaleString('en-IN'); }

  function relativeTime(iso) {
    const diff = Math.floor((Date.now() - new Date(iso)) / 1000);
    if (diff < 60)    return 'just now';
    if (diff < 3600)  return Math.floor(diff/60) + 'm ago';
    if (diff < 86400) return Math.floor(diff/3600) + 'h ago';
    if (diff < 604800) return Math.floor(diff/86400) + 'd ago';
    return new Date(iso).toLocaleDateString('en-IN', { day:'numeric', month:'short' });
  }

  function categoryLabel(cat) {
    return { environment:'Environment', education:'Education', journalism:'Journalism',
             craft:'Craft & Art', health:'Health', community:'Community', other:'Other' }[cat] || cat;
  }

  function categoryColor(cat) {
    return { environment:'bg-emerald-100 text-emerald-700', education:'bg-blue-100 text-blue-700',
             journalism:'bg-violet-100 text-violet-700',    craft:'bg-orange-100 text-orange-700',
             health:'bg-red-100 text-red-700',              community:'bg-teal-100 text-teal-700'
           }[cat] || 'bg-stone-100 text-stone-600';
  }

  function initials(name) { return name.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2); }

  // ─── Image upload helper (FileReader → base64) ─────────────────────
  function readImageFile(file) {
    return new Promise((resolve, reject) => {
      if (!file) return reject('No file');
      if (!file.type.startsWith('image/')) return reject('Not an image');
      if (file.size > 3 * 1024 * 1024) return reject('Image too large (max 3MB)');
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result);
      reader.onerror = () => reject('Read failed');
      reader.readAsDataURL(file);
    });
  }

  // ─── Nav ───────────────────────────────────────────────────────────
  function navHTML(active) {
    return `
      <nav class="bg-white border-b border-stone-100 sticky top-0 z-40 shadow-sm">
        <div class="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <a href="trust-ledger.html" class="flex items-center gap-1.5">
            <span class="font-black text-stone-900 text-lg tracking-tight">workledger</span>
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-0.5"></span>
          </a>
          <div class="flex items-center gap-2">
            <a href="trust-ledger.html"
              class="text-sm font-medium px-3 py-1.5 rounded-lg transition-colors ${active==='explore' ? 'text-stone-900 bg-stone-100' : 'text-stone-500 hover:text-stone-800'}">
              Explore
            </a>
            <a href="tl-create.html"
              class="bg-stone-900 hover:bg-stone-800 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-all">
              + Profile
            </a>
          </div>
        </div>
      </nav>`;
  }

  return {
    init, isOwner, claimOwnership, ownerKey,
    getProfiles, getLedger, getUpdates, getClaims, getComments,
    getProfileBySlug, getProfileById,
    getLedgerForProfile, getUpdatesForProfile, getClaimsForProfile, getCommentsForProfile,
    getProfileStats,
    addProfile, updateProfile, addLedgerEntry, addUpdate, addClaim, addComment,
    updateClaimStatus, deleteComment, touchProfile,
    generateId, slugify,
    formatINR, formatINRFull, relativeTime,
    categoryLabel, categoryColor, initials,
    readImageFile, navHTML
  };
})();
