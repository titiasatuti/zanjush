# Welcome to your Dyad app

## Supabase Storage setup for product photo uploads

If product photo upload returns `400` on `/storage/v1/object/item-photos/...`, configure Storage policies for the `item-photos` bucket.

Run these SQL statements in Supabase SQL Editor:

```sql
-- Allow public (anon) upload while app has no auth
create policy "item_photos_public_insert"
on storage.objects
for insert
to public
with check (bucket_id = 'item-photos');

-- Allow public read of uploaded files
create policy "item_photos_public_select"
on storage.objects
for select
to public
using (bucket_id = 'item-photos');

-- Optional: allow public update (if needed later)
create policy "item_photos_public_update"
on storage.objects
for update
to public
using (bucket_id = 'item-photos')
with check (bucket_id = 'item-photos');

-- Optional: allow public delete (if needed later)
create policy "item_photos_public_delete"
on storage.objects
for delete
to public
using (bucket_id = 'item-photos');
```

Also ensure bucket `item-photos` exists.