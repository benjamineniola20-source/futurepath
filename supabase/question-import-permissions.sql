-- Allow trusted administrators to bulk-import question records.
-- The application still verifies the admin role before showing the import form.
create policy "questions admin insert"
on public.questions
for insert
to authenticated
with check (
  (select private.is_admin())
  and created_by = (select auth.uid())
);
