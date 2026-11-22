-- Private bucket for the CV PDF. Run after 001_cv_requests.sql. Safe to re-run.
--
-- public = false and NO policies on storage.objects for this bucket means:
--   * there is no public URL for anything in it, and
--   * the anon/authenticated keys can't read, list or sign files in it.
-- Only the service-role key (held by the Cloudflare Worker) can read the file.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('private-cv', 'private-cv', false, 10485760, array['application/pdf'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Check: this should return one row with public = false.
select id, public, file_size_limit, allowed_mime_types from storage.buckets where id = 'private-cv';
