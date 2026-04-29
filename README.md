# Inventory App

Aplikasi inventori berbasis React, TypeScript, Vite, Tailwind CSS, shadcn/ui, dan Supabase.

## Menjalankan di Render.com

Gunakan konfigurasi berikut saat membuat service baru di Render.com.

### 1. Pilih tipe service

Pilih:

- **Static Site**

Aplikasi ini adalah frontend Vite, jadi hasil build akan berupa file statis di folder `dist`.

### 2. Build Command

Jika Render memakai **pnpm** atau muncul error `ERR_PNPM_OUTDATED_LOCKFILE`, isi **Build Command** dengan:

pnpm install --no-frozen-lockfile && pnpm run build

Jika Render memakai **npm**, gunakan:

npm install && npm run build

Rekomendasi untuk error yang Anda alami:

pnpm install --no-frozen-lockfile && pnpm run build

### 3. Publish Directory

Isi **Publish Directory** dengan:

dist

### 4. Start Command

Untuk **Static Site**, Render tidak membutuhkan start command.

Jika Render meminta start command karena Anda memilih tipe **Web Service**, gunakan:

pnpm run preview -- --host 0.0.0.0 --port $PORT

Atau jika memakai npm:

npm run preview -- --host 0.0.0.0 --port $PORT

Namun rekomendasi utama untuk project ini adalah memakai **Static Site**, bukan Web Service.

### 5. Environment Variables

Project ini sudah memakai Supabase URL dan publishable key langsung di:

src/integrations/supabase/client.ts

Jadi tidak wajib menambahkan environment variable untuk menjalankan aplikasi saat ini.

### 6. Routing SPA

Project ini sudah memiliki file `vercel.json`, tetapi untuk Render Static Site Anda perlu menambahkan rewrite rule di dashboard Render agar React Router berjalan saat refresh halaman.

Tambahkan rewrite:

Source:

/*

Destination:

/index.html

Action:

Rewrite

## Supabase Storage setup untuk upload foto produk

Jika upload foto produk mengembalikan error `400` pada `/storage/v1/object/item-photos/...`, pastikan bucket `item-photos` sudah ada dan policy storage sudah sesuai.

Jalankan SQL berikut di Supabase SQL Editor:

-- Allow public upload while app has no storage-specific auth policy
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

-- Optional: allow public update
create policy "item_photos_public_update"
on storage.objects
for update
to public
using (bucket_id = 'item-photos')
with check (bucket_id = 'item-photos');

-- Optional: allow public delete
create policy "item_photos_public_delete"
on storage.objects
for delete
to public
using (bucket_id = 'item-photos');

## Ringkasan command

Build Command yang direkomendasikan untuk Render jika muncul error pnpm lockfile:

pnpm install --no-frozen-lockfile && pnpm run build

Publish Directory:

dist

Start Command untuk Static Site:

Tidak perlu

Start Command jika memakai Web Service:

pnpm run preview -- --host 0.0.0.0 --port $PORT