-- Demo data for Iapher development
-- Inserts 3 sessions with responses across all sections

-- Sessions (phone_hash is a bcrypt hash of demo numbers)
insert into sessions (id, phone_hash, lang, entry_mode, district, is_partial, completed_at) values
  ('11111111-1111-1111-1111-111111111111', '$2a$12$demo1hashAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', 'en', 'self', 'East Khasi Hills', false, now() - interval '1 day'),
  ('22222222-2222-2222-2222-222222222222', '$2a$12$demo2hashBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB', 'kh', 'self', 'West Garo Hills', false, now() - interval '2 days'),
  ('33333333-3333-3333-3333-333333333333', '$2a$12$demo3hashCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC', 'ga', 'assisted', 'East Garo Hills', false, now() - interval '3 days')
on conflict do nothing;

-- Responses for session 1 (English, East Khasi Hills)
insert into responses (session_id, question_id, section, response_type, choice_index, scale_value, text_content) values
  ('11111111-1111-1111-1111-111111111111', 'q_age', 'demographics', 'pick', 1, null, null),
  ('11111111-1111-1111-1111-111111111111', 'q_gender', 'demographics', 'pick', 0, null, null),
  ('11111111-1111-1111-1111-111111111111', 'q_district', 'demographics', 'pick', 0, null, null),
  ('11111111-1111-1111-1111-111111111111', 'q_setting', 'demographics', 'pick', 1, null, null),
  ('11111111-1111-1111-1111-111111111111', 'q_occupation', 'demographics', 'pick', 2, null, null),
  ('11111111-1111-1111-1111-111111111111', 'q_life', 'wellbeing', 'scale', null, 4, null),
  ('11111111-1111-1111-1111-111111111111', 'q_job', 'work', 'scale', null, 3, null),
  ('11111111-1111-1111-1111-111111111111', 'q_social', 'relationships', 'scale', null, 3, null),
  ('11111111-1111-1111-1111-111111111111', 'q_phys', 'health', 'scale', null, 4, null),
  ('11111111-1111-1111-1111-111111111111', 'q_clim', 'climate', 'pick', 2, null, null),
  ('11111111-1111-1111-1111-111111111111', 'q_final_voice', 'closing', 'voice_text', null, null, 'I hope this platform helps young people like me feel heard.')
on conflict do nothing;

-- Responses for session 2 (Khasi, West Garo Hills)
insert into responses (session_id, question_id, section, response_type, choice_index, scale_value, text_content) values
  ('22222222-2222-2222-2222-222222222222', 'q_age', 'demographics', 'pick', 2, null, null),
  ('22222222-2222-2222-2222-222222222222', 'q_gender', 'demographics', 'pick', 1, null, null),
  ('22222222-2222-2222-2222-222222222222', 'q_district', 'demographics', 'pick', 8, null, null),
  ('22222222-2222-2222-2222-222222222222', 'q_setting', 'demographics', 'pick', 0, null, null),
  ('22222222-2222-2222-2222-222222222222', 'q_occupation', 'demographics', 'pick', 1, null, null),
  ('22222222-2222-2222-2222-222222222222', 'q_life', 'wellbeing', 'scale', null, 2, null),
  ('22222222-2222-2222-2222-222222222222', 'q_job', 'work', 'scale', null, 4, null),
  ('22222222-2222-2222-2222-222222222222', 'q_migr', 'work', 'pick', 1, null, null),
  ('22222222-2222-2222-2222-222222222222', 'q_social', 'relationships', 'scale', null, 2, null),
  ('22222222-2222-2222-2222-222222222222', 'q_phys', 'health', 'scale', null, 3, null),
  ('22222222-2222-2222-2222-222222222222', 'q_clim', 'climate', 'pick', 0, null, null),
  ('22222222-2222-2222-2222-222222222222', 'q_final_voice', 'closing', 'voice_text', null, null, 'Ka jingim da sngap pham ba don la phi u ia ka jingmut jong ngi.')
on conflict do nothing;

-- Responses for session 3 (Garo, East Garo Hills)
insert into responses (session_id, question_id, section, response_type, choice_index, scale_value, text_content) values
  ('33333333-3333-3333-3333-333333333333', 'q_age', 'demographics', 'pick', 0, null, null),
  ('33333333-3333-3333-3333-333333333333', 'q_gender', 'demographics', 'pick', 0, null, null),
  ('33333333-3333-3333-3333-333333333333', 'q_district', 'demographics', 'pick', 7, null, null),
  ('33333333-3333-3333-3333-333333333333', 'q_setting', 'demographics', 'pick', 2, null, null),
  ('33333333-3333-3333-3333-333333333333', 'q_occupation', 'demographics', 'pick', 3, null, null),
  ('33333333-3333-3333-3333-333333333333', 'q_life', 'wellbeing', 'scale', null, 3, null),
  ('33333333-3333-3333-3333-333333333333', 'q_job', 'work', 'scale', null, 2, null),
  ('33333333-3333-3333-3333-333333333333', 'q_social', 'relationships', 'scale', null, 4, null),
  ('33333333-3333-3333-3333-333333333333', 'q_phys', 'health', 'scale', null, 3, null),
  ('33333333-3333-3333-3333-333333333333', 'q_clim', 'climate', 'pick', 1, null, null),
  ('33333333-3333-3333-3333-333333333333', 'q_final_voice', 'closing', 'voice_text', null, null, 'Ningo chinga aro mitde.')
on conflict do nothing;
