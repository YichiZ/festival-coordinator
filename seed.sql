-- Seed data for Festival Coordinator
-- Clears existing data and inserts fresh records

-- Clean slate (order matters for foreign keys)
truncate artists, festivals, calls, members, groups cascade;

-- ============================================================
-- Groups
-- ============================================================
insert into groups (id, name, description) values
  ('aaaaaaaa-0001-4000-a000-000000000001', 'Bay Area Bassheads',   'SF crew that lives for bass music and desert festivals'),
  ('aaaaaaaa-0001-4000-a000-000000000002', 'East Coast Explorers', 'NYC-to-Boston friends branching out into new festivals'),
  ('aaaaaaaa-0001-4000-a000-000000000003', 'Solo Starters',       'New members not yet in a group');

-- ============================================================
-- Members
-- ============================================================
insert into members (id, group_id, name, city, phone, status) values
  -- Bay Area Bassheads
  ('bbbbbbbb-0001-4000-b000-000000000001', 'aaaaaaaa-0001-4000-a000-000000000001', 'Yichi',      'San Francisco, CA', '+14156403871', 'active'),
  ('bbbbbbbb-0001-4000-b000-000000000002', 'aaaaaaaa-0001-4000-a000-000000000001', 'Alex',       'San Francisco, CA', '+14155550101', 'active'),
  ('bbbbbbbb-0001-4000-b000-000000000003', 'aaaaaaaa-0001-4000-a000-000000000001', 'Maria',      'Oakland, CA',       '+15105550102', 'active'),
  ('bbbbbbbb-0001-4000-b000-000000000004', 'aaaaaaaa-0001-4000-a000-000000000001', 'Jordan',     'San Jose, CA',      '+14085550103', 'pending'),

  -- East Coast Explorers
  ('bbbbbbbb-0001-4000-b000-000000000005', 'aaaaaaaa-0001-4000-a000-000000000002', 'Jack',       'New York, NY',      '+12125550201', 'active'),
  ('bbbbbbbb-0001-4000-b000-000000000006', 'aaaaaaaa-0001-4000-a000-000000000002', 'Jacqueline', 'Brooklyn, NY',      '+17185550202', 'active'),
  ('bbbbbbbb-0001-4000-b000-000000000007', 'aaaaaaaa-0001-4000-a000-000000000002', 'Steve',      'Boston, MA',        '+16175550203', 'active'),
  ('bbbbbbbb-0001-4000-b000-000000000008', 'aaaaaaaa-0001-4000-a000-000000000002', 'Priya',      'Philadelphia, PA',  '+12155550204', 'inactive'),

  -- Solo Starters (no group assignment yet)
  ('bbbbbbbb-0001-4000-b000-000000000009', 'aaaaaaaa-0001-4000-a000-000000000003', 'Sam',        'Austin, TX',        '+15125550301', 'pending');

-- ============================================================
-- Festivals
-- ============================================================
insert into festivals (id, group_id, name, location, dates_start, dates_end, ticket_price, on_sale_date, status) values
  -- Bay Area Bassheads festivals
  ('cccccccc-0001-4000-c000-000000000001', 'aaaaaaaa-0001-4000-a000-000000000001', 'Coachella 2026',        'Indio, CA',        '2026-04-10', '2026-04-12', 599,  '2026-01-10', 'committed'),
  ('cccccccc-0001-4000-c000-000000000002', 'aaaaaaaa-0001-4000-a000-000000000001', 'Outside Lands 2026',    'San Francisco, CA','2026-08-07', '2026-08-09', 475,  '2026-03-15', 'considering'),
  ('cccccccc-0001-4000-c000-000000000003', 'aaaaaaaa-0001-4000-a000-000000000001', 'Burning Man 2026',      'Black Rock City, NV','2026-08-30','2026-09-07', 575, '2026-02-25', 'considering'),

  -- East Coast Explorers festivals
  ('cccccccc-0001-4000-c000-000000000004', 'aaaaaaaa-0001-4000-a000-000000000002', 'Governors Ball 2026',   'New York, NY',     '2026-06-05', '2026-06-07', 355,  '2026-01-20', 'committed'),
  ('cccccccc-0001-4000-c000-000000000005', 'aaaaaaaa-0001-4000-a000-000000000002', 'Bonnaroo 2026',         'Manchester, TN',   '2026-06-11', '2026-06-14', 400,  '2026-01-08', 'considering'),
  ('cccccccc-0001-4000-c000-000000000006', 'aaaaaaaa-0001-4000-a000-000000000002', 'EDC Las Vegas 2026',    'Las Vegas, NV',    '2026-05-15', '2026-05-17', 500,  '2025-12-15', 'passed');

-- ============================================================
-- Artists
-- ============================================================
insert into artists (id, festival_id, name, priority) values
  -- Coachella
  ('dddddddd-0001-4000-d000-000000000001', 'cccccccc-0001-4000-c000-000000000001', 'Kendrick Lamar',    'must_see'),
  ('dddddddd-0001-4000-d000-000000000002', 'cccccccc-0001-4000-c000-000000000001', 'Charli XCX',        'must_see'),
  ('dddddddd-0001-4000-d000-000000000003', 'cccccccc-0001-4000-c000-000000000001', 'Fred Again..',      'want_to_see'),
  ('dddddddd-0001-4000-d000-000000000004', 'cccccccc-0001-4000-c000-000000000001', 'Peggy Gou',         'nice_to_have'),

  -- Outside Lands
  ('dddddddd-0001-4000-d000-000000000005', 'cccccccc-0001-4000-c000-000000000002', 'Tyler, the Creator','must_see'),
  ('dddddddd-0001-4000-d000-000000000006', 'cccccccc-0001-4000-c000-000000000002', 'Disclosure',        'want_to_see'),

  -- Governors Ball
  ('dddddddd-0001-4000-d000-000000000007', 'cccccccc-0001-4000-c000-000000000004', 'SZA',               'must_see'),
  ('dddddddd-0001-4000-d000-000000000008', 'cccccccc-0001-4000-c000-000000000004', 'Dominic Fike',      'want_to_see'),
  ('dddddddd-0001-4000-d000-000000000009', 'cccccccc-0001-4000-c000-000000000004', 'Raye',              'must_see'),

  -- Bonnaroo
  ('dddddddd-0001-4000-d000-000000000010', 'cccccccc-0001-4000-c000-000000000005', 'Tame Impala',       'must_see'),
  ('dddddddd-0001-4000-d000-000000000011', 'cccccccc-0001-4000-c000-000000000005', 'Japanese Breakfast', 'want_to_see');

-- ============================================================
-- Calls (past conversation history)
-- ============================================================
insert into calls (id, group_id, started_at, ended_at, summary, from_number) values
  ('eeeeeeee-0001-4000-e000-000000000001', 'aaaaaaaa-0001-4000-a000-000000000001',
    '2026-02-01 18:30:00+00', '2026-02-01 18:45:00+00',
    '- Group decided on "Bay Area Bassheads" as the crew name\n- Yichi, Alex, and Maria confirmed for Coachella 2026\n- Jordan might join but hasn''t committed yet (pending)\n- Discussed Outside Lands as a second option\n- Next step: check Burning Man ticket lottery dates',
    '+14156403871'),
  ('eeeeeeee-0001-4000-e000-000000000002', 'aaaaaaaa-0001-4000-a000-000000000002',
    '2026-02-03 20:00:00+00', '2026-02-03 20:20:00+00',
    '- East Coast Explorers locked in for Governors Ball\n- Jack and Jacqueline buying tickets this week\n- Steve interested in Bonnaroo as a road trip\n- Priya dropped out (marked inactive)\n- Passed on EDC — too far and expensive',
    '+12125550201');
