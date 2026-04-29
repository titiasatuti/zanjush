# Inventory App

Aplikasi inventori berbasis React, TypeScript, Vite, Tailwind CSS, shadcn/ui, dan Supabase.

## Menjalankan di Render.com

Gunakan konfigurasi berikut saat membuat service baru di Render.com.

### 1. Pilih tipe service

Pilih:

- **Static Site**

Aplikasi ini adalah frontend Vite, jadi hasil build akan berupa file statis di folder `dist`.

### 2. Build Command

Gunakan:

npm install && npm run build

### 3. Publish Directory

Isi **Publish Directory** dengan:

dist

### 4. Start Command

Untuk **Static Site**, Render tidak membutuhkan start command.

Jika Render meminta start command karena Anda memilih tipe **Web Service**, gunakan:

npm run preview -- --host 0.0.0.0 --port $PORT

Namun rekomendasi utama untuk project ini adalah memakai **Static Site**, bukan Web Service.

### 5. Kenapa error `ERR_PNPM_OUTDATED_LOCKFILE` bisa terjadi?

Error ini terjadi karena Render mendeteksi file `pnpm-lock.yaml`, lalu otomatis mencoba install dependency memakai pnpm dengan mode frozen lockfile.

Jika isi `pnpm-lock.yaml` tidak sama dengan `package.json`, Render akan gagal dengan pesan:

ERR_PNPM_OUTDATED_LOCKFILE

Solusi yang dipakai project ini adalah:

- Menghapus `pnpm-lock.yaml`
- Menggunakan npm untuk deploy
- Build command menjadi:

npm install && npm run build

Jika repository GitHub masih menampilkan error yang sama, pastikan perubahan terbaru sudah masuk ke branch yang dipakai Render, yaitu branch `main`.

### 6. Environment Variables

Project ini sudah memakai Supabase URL dan publishable key langsung di:

src/integrations/supabase/client.ts

Jadi tidak wajib menambahkan environment variable untuk menjalankan aplikasi saat ini.

### 7. Routing SPA

Project ini sudah memiliki file `render.yaml` untuk rewrite React Router.

Jika Anda mengatur rewrite manual di dashboard Render, tambahkan:

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

## Ringkasan konfigurasi Render

Service Type:

Static Site

Build Command:

npm install && npm run build

Publish Directory:

dist

Start Command:

Tidak perlu untuk Static Site