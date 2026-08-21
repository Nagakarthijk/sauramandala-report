-- ─────────────────────────────────────────────────────────────────────
-- Workledger — Supabase schema
-- Run this once in: Supabase Dashboard → SQL Editor → New query
-- ─────────────────────────────────────────────────────────────────────

-- ── Tables ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS profiles (
  id            TEXT PRIMARY KEY,
  user_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  slug          TEXT UNIQUE NOT NULL,
  name          TEXT NOT NULL,
  bio           TEXT,
  photo_url     TEXT,
  upi_id        TEXT,
  upi_qr_url    TEXT,
  current_work  TEXT,
  goal_amount   INTEGER,
  location_text TEXT,
  category      TEXT DEFAULT 'other',
  discoverable  BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT now(),
  last_active_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ledger (
  id         TEXT PRIMARY KEY,
  profile_id TEXT REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  type       TEXT NOT NULL CHECK (type IN ('RECEIVED','SPENT')),
  amount     INTEGER NOT NULL CHECK (amount > 0),
  note       TEXT,
  media_url  TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS updates (
  id         TEXT PRIMARY KEY,
  profile_id TEXT REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  text       TEXT NOT NULL,
  media_url  TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS claims (
  id         TEXT PRIMARY KEY,
  profile_id TEXT REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  amount     INTEGER NOT NULL CHECK (amount > 0),
  name       TEXT,
  anonymous  BOOLEAN DEFAULT false,
  utr        TEXT,
  status     TEXT DEFAULT 'UNVERIFIED' CHECK (status IN ('CONFIRMED','UNVERIFIED','DISPUTED')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS comments (
  id         TEXT PRIMARY KEY,
  profile_id TEXT REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  type       TEXT DEFAULT 'COMMENT' CHECK (type IN ('COMMENT','FLAG')),
  text       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── Row Level Security ────────────────────────────────────────────────

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger   ENABLE ROW LEVEL SECURITY;
ALTER TABLE updates  ENABLE ROW LEVEL SECURITY;
ALTER TABLE claims   ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- profiles: anyone can read; only owner can write
CREATE POLICY "Public view discoverable profiles" ON profiles
  FOR SELECT USING (discoverable = true);
CREATE POLICY "Authenticated can create own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owner can update profile" ON profiles
  FOR UPDATE USING (auth.uid() = user_id);

-- ledger: public read; only profile owner can insert
CREATE POLICY "Public view ledger" ON ledger FOR SELECT USING (true);
CREATE POLICY "Owner can add ledger entries" ON ledger
  FOR INSERT WITH CHECK (
    auth.uid() = (SELECT user_id FROM profiles WHERE id = profile_id)
  );

-- updates: public read; only profile owner can insert
CREATE POLICY "Public view updates" ON updates FOR SELECT USING (true);
CREATE POLICY "Owner can post updates" ON updates
  FOR INSERT WITH CHECK (
    auth.uid() = (SELECT user_id FROM profiles WHERE id = profile_id)
  );

-- claims: public read/insert (anonymous ok); owner can update status
CREATE POLICY "Public view claims" ON claims FOR SELECT USING (true);
CREATE POLICY "Anyone can submit a claim" ON claims FOR INSERT WITH CHECK (true);
CREATE POLICY "Owner can update claim status" ON claims
  FOR UPDATE USING (
    auth.uid() = (SELECT user_id FROM profiles WHERE id = profile_id)
  );

-- comments: public read/insert; owner can delete
CREATE POLICY "Public view comments" ON comments FOR SELECT USING (true);
CREATE POLICY "Anyone can post a comment" ON comments FOR INSERT WITH CHECK (true);
CREATE POLICY "Owner can delete comments" ON comments
  FOR DELETE USING (
    auth.uid() = (SELECT user_id FROM profiles WHERE id = profile_id)
  );

-- ── Storage bucket ────────────────────────────────────────────────────
-- Create this manually in Supabase Dashboard → Storage → New bucket
-- Bucket name: workledger
-- Public bucket: YES (so images are publicly accessible)
-- Then add policy: anyone can SELECT (read), authenticated can INSERT

-- ── Seed data ─────────────────────────────────────────────────────────
-- user_id = null → seed profiles have no owner, nobody can edit them

INSERT INTO profiles (id, user_id, slug, name, bio, upi_id, current_work, goal_amount, location_text, category, created_at, last_active_at)
VALUES
  ('P001', null, 'divya-waste',    'Divya Menon',
   'Running a neighbourhood dry waste sorting drive in HSR Layout. Volunteer for 3 years. Not an NGO — just a person trying to make a block cleaner.',
   'divya.menon@okicici',
   'Setting up a dry waste collection point in Sector 4. Collecting funds for storage bins, signage, and first 3 months of logistics.',
   8000, 'HSR Layout, Bangalore', 'environment', '2026-03-01T10:00:00Z', '2026-04-09T08:30:00Z'),
  ('P002', null, 'arjun-library',  'Arjun Sinha',
   'Village school teacher in Sitamarhi. Building a free lending library for kids who have no books at home. Started with 40 books, now at 310.',
   'arjun.sinha@ybl',
   'Raising funds to buy 200 more books (Grades 3–8) and build a simple wooden shelf unit for the library room.',
   12000, 'Sitamarhi, Bihar', 'education', '2026-01-15T09:00:00Z', '2026-04-08T11:00:00Z'),
  ('P003', null, 'kavitha-writes', 'Kavitha R',
   'Independent journalist covering land rights and tribal displacement in Odisha. No publication backing. Self-funded since 2023.',
   'kavitha.r@paytm',
   'Reporting a 3-part series on forest land disputes in Koraput. Need to cover travel, accommodation, and translation costs.',
   15000, 'Koraput, Odisha', 'journalism', '2025-11-10T14:00:00Z', '2026-04-10T07:00:00Z'),
  ('P004', null, 'preeti-pottery', 'Preeti Kumari',
   'Self-taught clay potter from Molela village. Documenting traditional Rajasthani pottery techniques before they disappear.',
   'preeti.kumari@okaxis',
   'Building a small open workshop for local women to learn pottery. Need a kiln repair and basic tools.',
   6000, 'Molela, Rajasthan', 'craft', '2026-02-20T10:00:00Z', '2026-04-07T16:00:00Z')
ON CONFLICT (id) DO NOTHING;

INSERT INTO ledger (id, profile_id, type, amount, note, created_at) VALUES
  ('L001','P001','RECEIVED',500, 'Support from a neighbour who saw the drive',              '2026-03-05T10:00:00Z'),
  ('L002','P001','SPENT',  1200, 'Bought 4 dry waste bins from local supplier',             '2026-03-10T14:00:00Z'),
  ('L003','P001','RECEIVED',2000,'WhatsApp group collection from RWA members',              '2026-03-18T09:00:00Z'),
  ('L004','P001','SPENT',   800, 'Signage printing and installation — 3 boards',            '2026-03-25T11:00:00Z'),
  ('L005','P001','RECEIVED',1500,'Anonymous support via UPI',                               '2026-04-02T16:00:00Z'),
  ('L006','P001','SPENT',   600, 'First month volunteer coordination lunch',                '2026-04-08T13:00:00Z'),
  ('L007','P002','RECEIVED',1000,'Colleague donated for book purchase',                     '2026-01-20T10:00:00Z'),
  ('L008','P002','SPENT',  2200, 'Bought 80 books from Patna book fair',                   '2026-02-01T14:00:00Z'),
  ('L009','P002','RECEIVED',3500,'Post went semi-viral — 7 supporters contributed',         '2026-02-14T09:00:00Z'),
  ('L010','P002','SPENT',  1800, 'Wooden shelf unit built by local carpenter',              '2026-03-20T15:00:00Z'),
  ('L011','P003','RECEIVED',2000,'Reader support via UPI after first article',              '2025-11-20T10:00:00Z'),
  ('L012','P003','SPENT',  1400, 'Bus + shared jeep travel to Koraput (3 trips)',           '2025-12-05T14:00:00Z'),
  ('L013','P003','RECEIVED',3000,'3 anonymous reader supporters',                           '2025-12-18T09:00:00Z'),
  ('L014','P003','SPENT',  1400, 'Local translator fees + accommodation',                   '2026-01-15T15:00:00Z'),
  ('L015','P004','RECEIVED',1000,'Support from craft collective member',                    '2026-02-25T10:00:00Z'),
  ('L016','P004','SPENT',  1500, 'Kiln repair — local metalworker',                        '2026-03-05T14:00:00Z'),
  ('L017','P004','RECEIVED',1500,'Instagram follower donated after workshop video',         '2026-03-20T09:00:00Z')
ON CONFLICT (id) DO NOTHING;

INSERT INTO updates (id, profile_id, text, created_at) VALUES
  ('U001','P001','First bin installed at the Sector 4 entrance. Already seeing people sort before dumping.','2026-03-12T10:00:00Z'),
  ('U002','P001','RWA meeting happened — they agreed to sponsor one more bin. We now have 5 collection points.','2026-04-01T18:00:00Z'),
  ('U003','P002','Library hit 300 books today. Kids from 3 surrounding villages now visit on weekends.','2026-03-01T12:00:00Z'),
  ('U004','P002','Shelf is up. Carpenter did a beautiful job. Using the remaining funds for a borrow register.','2026-03-22T09:00:00Z'),
  ('U005','P003','Part 1 of the Koraput series is published. Parts 2 and 3 need one more field trip.','2026-02-10T14:00:00Z'),
  ('U006','P004','First workshop session done — 6 women joined. We made small diyas. Kiln worked after repair. Relief.','2026-03-08T16:00:00Z')
ON CONFLICT (id) DO NOTHING;

INSERT INTO claims (id, profile_id, amount, name, anonymous, utr, status, created_at) VALUES
  ('C001','P001',500, 'Rohit K',          false,'TXN204910234','CONFIRMED', '2026-03-05T11:00:00Z'),
  ('C002','P001',2000, null,              true, 'TXN209812345','CONFIRMED', '2026-03-18T10:00:00Z'),
  ('C003','P001',1500, null,              true,  null,         'UNVERIFIED','2026-04-02T17:00:00Z'),
  ('C004','P002',1000,'Meera S',          false,'TXN301923812','CONFIRMED', '2026-01-20T11:00:00Z'),
  ('C005','P002',3500, null,              true, 'TXN309871234','CONFIRMED', '2026-02-14T10:00:00Z'),
  ('C006','P003',2000,'Arun T',           false,'TXN401823451','CONFIRMED', '2025-11-20T11:00:00Z'),
  ('C007','P004',1000,'Craft Collective', false,'TXN501234512','CONFIRMED', '2026-02-25T11:00:00Z')
ON CONFLICT (id) DO NOTHING;

INSERT INTO comments (id, profile_id, type, text, created_at) VALUES
  ('CM001','P001','COMMENT','Divya, this is exactly what HSR needs. Keep going!',                 '2026-03-15T10:00:00Z'),
  ('CM002','P001','COMMENT','Can I volunteer for collection on Sundays?',                         '2026-04-03T14:00:00Z'),
  ('CM003','P002','COMMENT','This made my morning. Real work, real update. Supported.',           '2026-03-02T09:00:00Z'),
  ('CM004','P003','COMMENT','Read Part 1 — powerful reporting. Looking forward to Parts 2 and 3.','2026-02-11T16:00:00Z'),
  ('CM005','P004','COMMENT','I''m from Molela originally. This work matters so much.',            '2026-03-10T12:00:00Z')
ON CONFLICT (id) DO NOTHING;
