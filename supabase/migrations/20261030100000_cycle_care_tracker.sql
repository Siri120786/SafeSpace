-- ============================================================================
-- SafeSpace: Cycle Care's personal health tracker
-- Migration: 20261030100000_cycle_care_tracker
--
-- Siri decided (2026-10-25) that Cycle Care gets "My personal health tracker":
-- period start and end dates, optional daily notes (mood, energy, body
-- comfort, sleep, symptoms) and questions to take to appointments. It is
-- saved to the person's account with the rest of Cycle Care.
--
--   cycle_care_data.tracker   one more JSON part, shaped and checked by the
--                             web app like diet, profile and exercise.
--
-- Access is unchanged: ONLY the person themselves (the existing RLS policies
-- on auth.uid() cover the new column). No caregiver, no linked adult, no
-- function reads it. anon: nothing.
-- ============================================================================

alter table public.cycle_care_data
  add column tracker jsonb check (public.valid_cycle_care_part(tracker));

comment on column public.cycle_care_data.tracker is
  'Personal health tracker: period dates, optional daily notes and appointment questions. Only that person can read or change it.';

comment on table public.cycle_care_data is
  'Cycle Care (PCOS / PCOD): label, diet plan, health profile, movement and the personal tracker, one row per person. Only that person can read or change it.';
