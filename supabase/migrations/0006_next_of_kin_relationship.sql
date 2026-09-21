-- Singapore applicants were asked for two emergency contacts *and* two next of
-- kin — the same family, entered twice. The form now asks once, under the name
-- each market uses: "emergency contact" in Malaysia, "next of kin" in Singapore.
--
-- Next of kin therefore gains the relationship that emergency contacts already
-- carried. Existing rows keep both sets; the relationship is nullable so the
-- pre-migration next of kin rows (which never had one) still read back fine.
-- Which set a row carries is enforced by the API (src/lib/validate.ts) — a
-- Malaysian row fills emergency_contact_*, a Singaporean row next_of_kin_*.

alter table applications
  add column if not exists next_of_kin_1_relationship text,
  add column if not exists next_of_kin_2_relationship text;
