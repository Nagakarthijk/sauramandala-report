-- ═══════════════════════════════════════════════════════════════
-- Support batches of files, not just one link at a time
-- ═══════════════════════════════════════════════════════════════
-- Real field visits and asset references come in batches — a phone
-- dump of photos, a shared Drive folder, several reference images for
-- one character. The app now lets these be added in bulk; this
-- migration adjusts the schema to match.

-- field_visit_media gains a 'folder' media type: one row whose
-- file_reference is a folder link (Drive, etc.) standing in for a
-- whole batch of files, instead of forcing every file to be enumerated.
alter table field_visit_media drop constraint if exists field_visit_media_media_type_check;
alter table field_visit_media add constraint field_visit_media_media_type_check
  check (media_type in ('photo', 'video', 'document', 'audio', 'folder', 'other'));

-- illustration_assets: a character/scene/object usually has more than
-- one reference image (concept sketches, different angles). Replaces
-- the single artwork_file_reference with an array.
alter table illustration_assets add column if not exists artwork_file_references text[] default '{}';

update illustration_assets
  set artwork_file_references = array[artwork_file_reference]
  where artwork_file_reference is not null and artwork_file_reference <> '';

alter table illustration_assets drop column if exists artwork_file_reference;
