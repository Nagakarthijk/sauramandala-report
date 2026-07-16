// dip-network.js — Doorstep Incubation Protocol · Shared Data & Functions
// v0.1.0 | Sauramandala Foundation | #noruralentrepreneurleftbehind

const DIP = (() => {
  const KEYS = {
    entrepreneurs: 'dip_entrepreneurs',
    matches: 'dip_matches',
    agentName: 'dip_agent_name',
    seeded: 'dip_seeded_v1',
    geminiApiKey: 'dip_gemini_api_key'
  };

  function getApiKey() {
    let key = localStorage.getItem(KEYS.geminiApiKey);
    if (!key) {
      key = window.prompt(
        'AI Match needs a free Gemini API key (get one at aistudio.google.com/apikey).\n' +
        'It is stored only in this browser — never sent anywhere but Google\'s API.'
      );
      if (key) localStorage.setItem(KEYS.geminiApiKey, key.trim());
    }
    return key;
  }

  function setApiKey(key) {
    if (key) localStorage.setItem(KEYS.geminiApiKey, key.trim());
    else localStorage.removeItem(KEYS.geminiApiKey);
  }

  // ─── Vendor Network (Platform / API / In-Person / Government / Financial) ───
  const SEED_VENDORS = [
    {
      id: 'V001', name: 'Meesho', type: 'platform',
      sectors: ['textiles', 'food', 'handicrafts', 'any'],
      description: 'Social commerce platform connecting rural sellers to 100M+ buyers across India. Zero commission. Sellers can list in 10 minutes.',
      connect: 'meesho.com/supplier — free registration',
      tags: ['e-commerce', 'marketplace', 'zero-cost', 'rural-sellers'],
      impact: '800k+ rural sellers onboarded'
    },
    {
      id: 'V002', name: 'Dukaan', type: 'platform',
      sectors: ['any'],
      description: 'Build a free online store in 30 seconds. WhatsApp-native ordering. No technical skills needed. Works on any phone.',
      connect: 'mydukaan.io — free store creation',
      tags: ['online-store', 'digital', 'whatsapp', 'zero-cost', 'quick-setup']
    },
    {
      id: 'V003', name: 'WhatsApp Business', type: 'api',
      sectors: ['any'],
      description: 'Automated customer communication, product catalogue sharing, and order tracking via WhatsApp. Used by millions of small businesses.',
      connect: 'business.whatsapp.com — free app download',
      tags: ['communication', 'catalogue', 'customer-service', 'free']
    },
    {
      id: 'V004', name: 'Razorpay', type: 'api',
      sectors: ['any'],
      description: 'Accept UPI, card, and wallet payments digitally. Low fees (2%), trusted by 8M+ businesses. Easy onboarding.',
      connect: 'razorpay.com/payment-gateway',
      tags: ['payments', 'upi', 'digital-money', 'collections']
    },
    {
      id: 'V005', name: 'Shiprocket', type: 'api',
      sectors: ['food', 'textiles', 'handicrafts', 'any'],
      description: 'Logistics aggregator shipping from tier-3 towns to anywhere in India. Doorstep pickup. Compare rates across 17 couriers.',
      connect: 'shiprocket.in — seller registration',
      tags: ['logistics', 'shipping', 'delivery', 'rural', 'cod-available']
    },
    {
      id: 'V006', name: 'FSSAI Registration Consultant', type: 'in-person',
      sectors: ['food', 'beverages'],
      description: 'Certified consultants who visit food businesses, handle FSSAI registration end-to-end, and advise on labelling and hygiene compliance.',
      connect: 'Through SMF Field Agent referral — no upfront fee',
      tags: ['food-license', 'compliance', 'fssai', 'regulation', 'food-safety']
    },
    {
      id: 'V007', name: 'KVIC (Khadi & Village Industries Commission)', type: 'government',
      sectors: ['textiles', 'handicrafts', 'food'],
      description: 'Government grants, subsidies up to ₹25 lakhs, and premium market linkages for cottage industries. Khadi mark certification available.',
      connect: 'kvic.gov.in / Local KVIC district office',
      tags: ['grant', 'subsidy', 'khadi', 'government', 'textile', 'certification']
    },
    {
      id: 'V008', name: 'NABARD SHG Credit Linkage', type: 'financial',
      sectors: ['any'],
      description: 'Micro-loans via Self-Help Groups. ₹10,000 to ₹5 lakhs at low interest. No collateral for first loan cycle. Women-led groups prioritised.',
      connect: 'Local NABARD regional office or through existing SHG network',
      tags: ['microfinance', 'credit', 'loan', 'shg', 'no-collateral', 'women']
    },
    {
      id: 'V009', name: 'Startup India (DPIIT Recognition)', type: 'government',
      sectors: ['any'],
      description: 'DPIIT recognition unlocks 3-year tax exemption, fast-track patent filing at 80% discount, and access to government tenders.',
      connect: 'startupindia.gov.in — free online application',
      tags: ['startup', 'tax-benefit', 'government', 'recognition', 'patent']
    },
    {
      id: 'V010', name: 'India Post Business Parcel', type: 'in-person',
      sectors: ['any'],
      description: 'Last-mile delivery via 155,000 post offices. Cash-on-delivery available in remote areas. Most affordable option for rural entrepreneurs.',
      connect: 'Local post office — walk in with products',
      tags: ['logistics', 'cod', 'rural', 'last-mile', 'affordable', 'post-office']
    },
    {
      id: 'V011', name: 'GoCoop', type: 'platform',
      sectors: ['textiles', 'handicrafts'],
      description: 'Cooperative marketplace for weavers and artisans. Direct access to premium buyers, exporters, and international customers. Fair pricing.',
      connect: 'gocoop.com/seller — free registration for cooperatives',
      tags: ['weavers', 'artisans', 'cooperative', 'export', 'premium-buyers', 'fair-trade']
    },
    {
      id: 'V012', name: 'eSamudaay (ONDC Network)', type: 'platform',
      sectors: ['any'],
      description: 'Hyperlocal commerce on Open Network for Digital Commerce (ONDC). Beckn-compatible. Connects rural sellers to urban buyers without intermediaries.',
      connect: 'esamudaay.com — seller onboarding',
      tags: ['ondc', 'hyperlocal', 'digital-commerce', 'open-network', 'beckn']
    },
    {
      id: 'V013', name: 'Craftsvilla / Jaypore', type: 'platform',
      sectors: ['textiles', 'handicrafts', 'jewellery'],
      description: 'Premium curated marketplace for ethnic and handmade products. Reaches urban, NRI, and international buyers willing to pay premium prices.',
      connect: 'craftsvilla.com → Sell With Us / jaypore.com → Partner',
      tags: ['ethnic', 'handmade', 'premium', 'export', 'marketplace', 'artisan']
    },
    {
      id: 'V014', name: 'Local Packaging & Design Partner', type: 'in-person',
      sectors: ['food', 'textiles', 'beverages', 'handicrafts'],
      description: 'Design studios and print shops that create brand identity, product labels, and eco-friendly packaging for small rural businesses.',
      connect: 'Through SMF Field Agent referral — Shillong / Guwahati network',
      tags: ['branding', 'packaging', 'design', 'label', 'identity', 'print']
    },
    {
      id: 'V015', name: 'Digital Sakhi / CSC Kiosk', type: 'in-person',
      sectors: ['any'],
      description: 'Rural digital literacy and connectivity support via Common Service Centres. Helps first-time internet users go online, open digital accounts, access schemes.',
      connect: 'Nearest CSC (Common Service Centre) — locator at csc.gov.in',
      tags: ['digital-literacy', 'internet', 'csc', 'government', 'first-time', 'connectivity']
    }
  ];

  // ─── Seed Entrepreneurs ───
  const SEED_ENTREPRENEURS = [
    {
      id: 'E001',
      name: 'Kong Ailinda Sayoo',
      age: 45,
      gender: 'Female',
      location: 'East Khasi Hills, Meghalaya',
      sector: 'textiles',
      business: 'Eri Silk Jainsem Weaving',
      story: 'A master weaver with 20+ years of experience creating traditional Eri Silk Jainsems. Her work is highly regarded locally but she has no way to reach buyers outside her village. Sells at low local prices despite the national demand for Eri silk.',
      problems: ['No market access beyond local area', 'Cannot price competitively without buyer connection', 'No digital presence or online sales channel'],
      needs: ['e-commerce', 'branding', 'pricing-strategy', 'buyer-access'],
      resources: { phone: true, bankAccount: true, internet: 'limited' },
      capturedBy: 'PSREF Field Team',
      capturedAt: '2024-03-15',
      status: 'matched'
    },
    {
      id: 'E002',
      name: 'Pecindha K Sangma',
      age: 38,
      gender: 'Male',
      location: 'South Garo Hills, Meghalaya',
      sector: 'beverages',
      business: 'Traditional Rice Wine (Chubitchi)',
      story: 'A winemaker using ancient Garo family recipes passed down three generations. Has a loyal local customer base but sells informally. Wants to obtain a formal licence to supply restaurants in Tura and Guwahati, and eventually export.',
      problems: ['No production licence', 'Cannot sell formally or ship online', 'Limited production capacity', 'No formal branding'],
      needs: ['food-license', 'compliance', 'capacity-building', 'distribution', 'branding'],
      resources: { phone: true, bankAccount: false, internet: 'none' },
      capturedBy: 'PSREF Field Team',
      capturedAt: '2024-02-10',
      status: 'in-incubation'
    },
    {
      id: 'E003',
      name: 'Joseph Marbaniang',
      age: 52,
      gender: 'Male',
      location: 'West Khasi Hills, Meghalaya',
      sector: 'agriculture',
      business: 'Organic Ginger & Turmeric Farming',
      story: 'Grows certified organic ginger and turmeric on 3 acres but sells at distress prices to local middlemen. No cold storage access causes 30% post-harvest loss. Knows his product is premium quality but has no way to prove it to buyers.',
      problems: ['Post-harvest loss of ~30% due to no cold storage', 'Middlemen take 60% margin', 'No direct buyer connections', 'No certification documentation'],
      needs: ['cold-chain', 'buyer-connections', 'packaging', 'logistics', 'certification'],
      resources: { phone: true, bankAccount: true, internet: 'limited' },
      capturedBy: 'SMF Agent Kiran',
      capturedAt: '2026-01-20',
      status: 'pending-match'
    },
    {
      id: 'E004',
      name: 'Meena Syngkli',
      age: 29,
      gender: 'Female',
      location: 'Ri Bhoi District, Meghalaya',
      sector: 'food',
      business: 'Wild Forest Fruit Jams & Pickles',
      story: 'Makes artisanal jams and pickles from wild local fruits — sohiong (black plum), sohphie (wild citrus), and tynring (wild pear). Has received repeat orders from cafes in Shillong but cannot scale without FSSAI compliance and proper packaging.',
      problems: ['No FSSAI food licence', 'Homemade packaging not acceptable to retail buyers', 'Cannot fulfil bulk orders', 'No working capital for raw materials at scale'],
      needs: ['food-license', 'packaging', 'logistics', 'working-capital'],
      resources: { phone: true, bankAccount: true, internet: 'good' },
      capturedBy: 'SMF Agent Priya',
      capturedAt: '2026-03-05',
      status: 'pending-match'
    },
    {
      id: 'E005',
      name: 'Preety Nongrum',
      age: 31,
      gender: 'Female',
      location: 'East Jaintia Hills, Meghalaya',
      sector: 'handicrafts',
      business: 'Traditional Bone & Bamboo Jewellery',
      story: 'An innovation fellow from the CMYC programme who won a state-level award for her unique jewellery combining bone, bamboo, and glass. Sells at local markets far below the price her work deserves. Has an Instagram but no structured online sales.',
      problems: ['Selling at 30% below market value', 'No organised online sales channel', 'No brand identity or story', 'No knowledge of premium buyer networks'],
      needs: ['e-commerce', 'branding', 'premium-positioning', 'buyer-access', 'pricing'],
      resources: { phone: true, bankAccount: true, internet: 'good' },
      capturedBy: 'CMYC Innovation Programme',
      capturedAt: '2024-11-10',
      status: 'matched'
    }
  ];

  // ─── Core Functions ───

  function init() {
    if (!localStorage.getItem(KEYS.seeded)) {
      localStorage.setItem(KEYS.entrepreneurs, JSON.stringify(SEED_ENTREPRENEURS));
      localStorage.setItem(KEYS.seeded, 'true');
    }
  }

  function getEntrepreneurs() {
    return JSON.parse(localStorage.getItem(KEYS.entrepreneurs) || '[]');
  }

  function addEntrepreneur(e) {
    const list = getEntrepreneurs();
    list.push(e);
    localStorage.setItem(KEYS.entrepreneurs, JSON.stringify(list));
    return e;
  }

  function updateEntrepreneurStatus(id, status) {
    const list = getEntrepreneurs();
    const idx = list.findIndex(e => e.id === id);
    if (idx > -1) {
      list[idx].status = status;
      localStorage.setItem(KEYS.entrepreneurs, JSON.stringify(list));
    }
  }

  function getVendors() { return SEED_VENDORS; }

  function getMatches() {
    return JSON.parse(localStorage.getItem(KEYS.matches) || '[]');
  }

  function addMatch(m) {
    const list = getMatches();
    list.push(m);
    localStorage.setItem(KEYS.matches, JSON.stringify(list));
    return m;
  }

  function getAgentName() {
    return localStorage.getItem(KEYS.agentName) || '';
  }

  function setAgentName(name) {
    localStorage.setItem(KEYS.agentName, name);
  }

  function getStats() {
    const entrepreneurs = getEntrepreneurs();
    const matches = getMatches();
    return {
      totalEntrepreneurs: entrepreneurs.length,
      pendingMatch: entrepreneurs.filter(e => e.status === 'pending-match').length,
      inIncubation: entrepreneurs.filter(e => e.status === 'in-incubation').length,
      matched: entrepreneurs.filter(e => e.status === 'matched').length,
      graduated: entrepreneurs.filter(e => e.status === 'graduated').length,
      totalVendors: SEED_VENDORS.length,
      totalMatches: matches.length
    };
  }

  function generateId(prefix) {
    return prefix + Date.now().toString(36).toUpperCase().slice(-6);
  }

  function sectorLabel(sector) {
    const m = {
      textiles: 'Textiles & Weaving', food: 'Food Processing',
      beverages: 'Beverages', agriculture: 'Agriculture',
      handicrafts: 'Handicrafts', services: 'Services',
      livestock: 'Livestock', education: 'Education', any: 'Any Sector'
    };
    return m[sector] || sector;
  }

  function statusBadge(status) {
    const m = {
      'pending-match': { label: 'Pending Match', color: 'bg-amber-100 text-amber-800 border-amber-200' },
      'matched': { label: 'Matched', color: 'bg-blue-100 text-blue-800 border-blue-200' },
      'in-incubation': { label: 'In Incubation', color: 'bg-purple-100 text-purple-800 border-purple-200' },
      'graduated': { label: 'Graduated ✓', color: 'bg-green-100 text-green-800 border-green-200' },
      'stalled': { label: 'Stalled', color: 'bg-red-100 text-red-800 border-red-200' }
    };
    return m[status] || { label: status, color: 'bg-slate-100 text-slate-600 border-slate-200' };
  }

  function vendorTypeBadge(type) {
    const m = {
      'platform': { label: 'Platform', color: 'bg-blue-100 text-blue-700' },
      'api': { label: 'API', color: 'bg-purple-100 text-purple-700' },
      'in-person': { label: 'In-Person', color: 'bg-green-100 text-green-700' },
      'government': { label: 'Government', color: 'bg-orange-100 text-orange-700' },
      'financial': { label: 'Financial', color: 'bg-teal-100 text-teal-700' }
    };
    return m[type] || { label: type, color: 'bg-slate-100 text-slate-600' };
  }

  async function callGemini(prompt) {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error('A Gemini API key is required to use AI Match.');
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    const payload = { contents: [{ role: 'user', parts: [{ text: prompt }] }] };
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err?.error?.message || `API Error: ${response.statusText}`);
    }
    const result = await response.json();
    const text = result?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('No response from AI');
    return text;
  }

  function navHTML(activePage) {
    const pages = [
      { href: 'doorstep-incubation.html', label: 'Protocol', key: 'protocol' },
      { href: 'field-agent.html', label: 'Field Agent', key: 'agent' },
      { href: 'entrepreneur-directory.html', label: 'Entrepreneurs', key: 'directory' },
      { href: 'ai-match.html', label: 'AI Match', key: 'match' }
    ];
    return `
      <nav class="bg-slate-900 text-white sticky top-0 z-40 shadow-lg">
        <div class="container mx-auto px-4 py-3 flex items-center justify-between">
          <a href="doorstep-incubation.html" class="flex items-center gap-2 shrink-0">
            <span class="bg-amber-500 text-slate-900 font-black px-2 py-0.5 rounded text-sm">DIP</span>
            <span class="font-semibold text-sm hidden sm:block text-slate-200">Doorstep Incubation</span>
          </a>
          <div class="flex items-center gap-1 sm:gap-3">
            ${pages.map(p => `
              <a href="${p.href}" class="text-xs sm:text-sm font-medium px-2 py-1.5 rounded-lg transition-colors ${activePage === p.key ? 'bg-amber-500 text-slate-900' : 'text-slate-300 hover:text-white hover:bg-slate-700'}">
                ${p.label}
              </a>`).join('')}
          </div>
        </div>
      </nav>`;
  }

  return {
    SEED_VENDORS, SEED_ENTREPRENEURS,
    init, getEntrepreneurs, addEntrepreneur, updateEntrepreneurStatus,
    getVendors, getMatches, addMatch,
    getAgentName, setAgentName,
    getApiKey, setApiKey,
    getStats, generateId,
    sectorLabel, statusBadge, vendorTypeBadge,
    callGemini, navHTML
  };
})();
