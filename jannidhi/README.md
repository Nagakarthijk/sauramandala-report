# JanNidhi

*Working name — rename freely.*

An open-source directory where **grassroots political workers** create personal fundraising
pages — a portfolio of their work, expenses with bills, and their **own** UPI QR / bank
details — and share the URL on WhatsApp status, social bios, anywhere.

**The platform never touches money.** There is no payment gateway. A donor scans the
worker's QR with their own UPI app; the money moves directly between two people. JanNidhi
only enables discovery and public record-keeping.

## How it works

1. **Worker** signs in (email OTP or password), creates a page: bio, location, photo,
   their own UPI QR image, UPI ID, the name registered on that UPI ID, optional bank details.
2. Worker optionally **self-attests an ID** (stored in a private bucket; the page then shows
   "ID self-attested" — a statement by the worker, never a platform verification).
3. Worker posts **work updates** (the portfolio) and **expenses with bill photos**.
4. **Donor** pays directly via UPI, then optionally **declares the donation** on the page —
   amount, optional proof screenshot, optional anonymity, and a mandatory
   "I am an Indian citizen / own funds" checkbox (FCRA guardrail).
5. Worker **acknowledges or disputes** each declaration. That two-party handshake is the
   core trust signal.
6. **Organisations** (parties, residents groups, unions) register, workers request to join,
   and the org admin **vouches** for its own people. The org gets a public URL hosting all
   vouched workers. Vouching is the org's statement, not the platform's.

## Transparency score (0–100)

Measures **disclosure practice, not truth**. Computed client-side in `app.js` (`computeScore`):

| Points | Component | Why |
|---|---|---|
| 35 | % of donor declarations resolved (acknowledged/disputed) | Takes two independent parties — hardest to fake alone |
| 25 | % of expenses with a bill attached | Cost of fabrication, habit of proof |
| 20 | Declared inflows ≥ declared expenses (reconciliation) | Spending more than you admit receiving is the classic red flag |
| 10 | Work update within 30/90 days | Live pages over dead ones |
| 10 | Profile completeness (bio, payee name, ID attested, QR/VPA) | Skin in the game |

Components with no data yet score neutral (half), so new pages aren't punished or inflated.

## Liability posture (design, not just disclaimers)

- No payment links are ever generated — the QR is a worker-uploaded *image*, the UPI ID is
  plain text. Payments are legally equivalent to handing over cash.
- No verification claims: badges state facts ("ID self-attested", "Vouched by X") attributed
  to the person/org making them.
- Guardrails baked into flows: donor citizenship/own-funds checkbox (enforced in DB RLS),
  gift-tax + FCRA notice shown to workers *before* the profile form, standing disclaimer on
  every public page, anti-impersonation payee-name check ("if your UPI app shows a different
  name, stop").
- `terms.html` is a plain-language draft — **have a lawyer review it before launch.**

## Stack & setup

Static HTML + Tailwind CDN + [Supabase](https://supabase.com) (free tier). No build step.

1. Create a Supabase project → SQL editor → run `schema.sql`
   (tables, row-level security, `jn-public` / `jn-private` storage buckets).
2. Authentication → Providers → enable **Email** (OTP and password both work out of the box).
3. Copy Project URL + anon key into `config.js`.
4. Host the folder anywhere static (GitHub Pages, Netlify, Cloudflare Pages).

Until `config.js` is filled in, the site runs in **demo mode** with sample data, so every
page can be previewed by just opening `index.html`.

### Files

| File | Purpose |
|---|---|
| `index.html` | Landing + discovery (search workers & orgs) |
| `auth.html` | Email OTP / password sign-in |
| `create.html` | Create/edit worker page, ID attestation, org join requests |
| `profile.html?u=slug` | Public worker page + donor declaration + owner console |
| `org.html?o=slug` | Public org page hosting vouched workers |
| `org-admin.html` | Register org, vouch/revoke workers |
| `terms.html` | Terms & disclaimers (draft) |
| `app.js` | Data layer, transparency score, shared chrome |
| `config.js` | Supabase credentials (placeholders = demo mode) |
| `schema.sql` | Database schema + RLS policies + storage buckets |

## Known limitations / roadmap

- Reports table has no admin UI yet — read it from the Supabase dashboard.
- WhatsApp link previews need server-side rendering (static pages share one meta tag);
  a tiny edge function or prerender step would fix this.
- Custom org hyperlinks are `org.html?o=slug`; pretty paths (`/org/slug`) need host-level
  rewrites (one-line Netlify `_redirects`).
- Donation `donor_contact` is publicly readable at the API level in v1 (the UI hides it) —
  move it to a separate RLS-protected table before serious launch.
- No rate limiting on declarations/reports beyond Supabase defaults.

## License

MIT. Provided as is, no warranty. Instance operators are responsible for their own legal compliance.
