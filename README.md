# Zanjus Inventory

Aplikasi inventory dan produksi minuman berbasis React + TypeScript + Vite + Supabase.

Project ini sudah memakai model **made-by-order**:

- Produk tidak disimpan sebagai stok batch produk.
- Stok produk dihitung **otomatis** dari stok bahan baku (virtual stock).
- Saat pesanan produk diproses, bahan baku dipotong otomatis pakai strategi **FEFO** (First Expired, First Out).

## Tech Stack

- Frontend: React, TypeScript, Vite, Tailwind CSS, shadcn/ui
- Backend as a Service: Supabase (Auth, Postgres, Storage)
- Routing: React Router
- Icons: Lucide

## Konsep Utama

### 1) Virtual stock produk

Stok produk diturunkan dari resep produk (`product_ingredients`) dan stok bahan baku.

Formula:

product_stock = min(
floor(stock_ingredient_1 / qty_per_unit_1),
floor(stock_ingredient_2 / qty_per_unit_2),
...
)

Artinya bottleneck bahan baku menentukan berapa banyak produk yang siap dibuat.

### 2) FEFO untuk pemakaian bahan baku

Ketika pesanan produk diproses:

1. Sistem cek kebutuhan bahan baku dari resep.
2. Sistem pilih batch bahan baku dengan expired terdekat dulu.
3. `remaining_quantity` batch dikurangi per alokasi.
4. `stock_movements` dicatat dengan `batch_id` yang terpakai.

Dengan ini risiko bahan expired bisa ditekan.

### 3) Expiry bahan baku berbasis batch

Di halaman list bahan baku, status expired dan tanggal expired ditarik dari batch aktif (`remaining_quantity > 0`), bukan hanya dari field master item.

## Entitas Data yang Dipakai

- `items`
	- Menyimpan master item (`type = product | ingredient`), nama, sku, unit, min stock, photo, status aktif.
- `products`
	- Menyimpan metadata produk (harga, kategori, dll).
	- `production_date` dan `expiry_date` untuk produk diset `null` pada model made-by-order.
- `product_ingredients`
	- Resep: relasi produk ke bahan baku + `qty_per_unit`.
- `stock_batches`
	- Batch bahan baku: kode batch, tanggal pembelian/produksi, expired, `remaining_quantity`.
- `stock_movements`
	- Riwayat movement in/out + `batch_id` (saat movement terkait batch).
- `activity_logs`
	- Audit aktivitas user (create/update/delete/stock movement/blocked).

## Fitur Utama

### Produk

- Buat produk baru (mode made-by-order).
- Atur resep produk (komposisi bahan baku per 1 produk).
- Lihat virtual stock (siap dibuat).
- Proses pesanan produk:
	- qty pesanan -> otomatis potong bahan baku -> FEFO.

### Bahan Baku

- Buat bahan baku + stok awal batch.
- Tambah/kurangi stok bahan baku manual.
- Riwayat batch bahan baku + QR label batch.
- Hapus batch jika qty tersisa 0.

### Dashboard

- KPI stok produk virtual dan stok bahan baku.
- Restock alert berdasarkan minimum stock.
- Ringkasan movement harian.
- Produk paling banyak keluar.

### Scan QR

- Scan batch bahan baku untuk tambah/kurangi stok batch.
- Produk tidak diproses dari scan pada model made-by-order.
	- Pesanan produk diproses dari halaman detail produk agar resep dan FEFO berjalan benar.

### Histori

- Histori movement stok.
- Histori aktivitas sistem.

## Flow Operasional Rekomendasi

1. Buat bahan baku + batch awal di menu bahan baku.
2. Buat produk.
3. Atur komposisi produk (resep).
4. Pantau virtual stock produk di katalog/dashboard.
5. Saat ada order, buka detail produk -> tab Pesanan -> proses qty.
6. Sistem memotong bahan baku otomatis dengan FEFO.
7. Pantau histori movement dan dashboard.

## Struktur Halaman Penting

- `/` atau `/dashboard` -> Dashboard operasional
- `/products` -> menu produk
- `/products/catalogue` -> katalog produk (virtual stock)
- `/products/catalogue/new` -> tambah produk
- `/products/catalogue/:id` -> detail produk (data, pesanan, komposisi)
- `/products/ingredients` -> daftar bahan baku
- `/products/ingredients/new` -> tambah bahan baku
- `/products/ingredients/:id` -> detail bahan baku (data, stok & batch)
- `/scan` -> scan QR batch
- `/stock` -> histori stok

## Menjalankan Project (Local)

### Prasyarat

- Node.js 18+
- npm

### Install

```bash
npm install
```

### Development

```bash
npm run dev
```

### Build Production

```bash
npm run build
```

### Preview Build

```bash
npm run preview
```

## Konfigurasi Supabase

Client Supabase ada di:

- `src/integrations/supabase/client.ts`

Project saat ini menggunakan URL dan publishable key langsung di file tersebut.

Jika ingin lebih aman untuk deployment jangka panjang, pindahkan ke environment variable.

## Upload Foto

Bucket storage yang dipakai:

- `item-photos`

Pastikan policy storage untuk read/write sesuai kebutuhan aplikasi.

## Deploy Render (Static Site)

- Service type: Static Site
- Build command: `npm install && npm run build`
- Publish directory: `dist`

SPA rewrite sudah didukung melalui konfigurasi project.

## Catatan Implementasi

- Movement out bahan baku dari pesanan produk sudah batch-aware dan FEFO.
- Perubahan `remaining_quantity` batch memakai optimistic check agar aman dari race condition sederhana.
- Jika batch berubah saat proses, user diminta ulangi aksi.

## Roadmap Saran

- Pindahkan alur FEFO ke Supabase RPC/transaction agar atomic 100% di server.
- Tambahkan test otomatis untuk:
	- virtual stock calculation
	- FEFO allocation
	- rollback saat konflik batch
- Tambahkan role-based access (admin/operator).