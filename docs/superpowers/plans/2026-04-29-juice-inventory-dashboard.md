# Juice Inventory Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a lean Next.js web dashboard for a bottled-juice business to manage stock using generated QR codes, with Supabase-backed persistence.

**Architecture:** Create a Next.js App Router app with a small server-side API layer that talks to Supabase using the official client. Keep domain scope tight: products, stock batches, stock movements, and QR labels. UI is dashboard-first with one scanner/entry flow and one reporting summary page.

**Tech Stack:** Next.js (App Router, TypeScript), React, Supabase (Postgres + RLS), supabase-js, Tailwind CSS, Vitest + Testing Library, Playwright (optional E2E), qrcode library for generation.

---

## File Structure & Responsibilities

- `package.json` — scripts and dependencies.
- `next.config.ts` — Next.js config.
- `.env.local.example` — required environment variables template.
- `src/lib/supabase/server.ts` — server-side Supabase client factory.
- `src/lib/supabase/browser.ts` — browser-side Supabase client factory.
- `src/lib/qr.ts` — QR payload encoder and image generation wrapper.
- `src/lib/validation.ts` — small shared zod schemas for form payloads.
- `src/app/layout.tsx` — root shell and nav.
- `src/app/page.tsx` — dashboard home metrics.
- `src/app/products/page.tsx` — products list/create.
- `src/app/stock/page.tsx` — stock in/out and movement log.
- `src/app/labels/page.tsx` — generate/print QR labels per batch.
- `src/app/api/metrics/route.ts` — KPI aggregation endpoint.
- `src/app/api/stock-movements/route.ts` — create/list stock movements.
- `src/app/api/products/route.ts` — create/list products.
- `supabase/migrations/20260429_initial_inventory.sql` — base schema + RLS.
- `supabase/seed.sql` — minimal seed data for local/dev.
- `src/components/dashboard/kpi-card.tsx` — reusable KPI card.
- `src/components/stock/stock-form.tsx` — stock-in/out form.
- `src/components/qr/qr-label.tsx` — label rendering with QR image.
- `src/__tests__/...` — unit/component tests.

---

### Task 1: Scaffold Next.js App and Tooling

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `tailwind.config.ts`
- Create: `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`
- Create: `.env.local.example`
- Test: `src/__tests__/app-shell.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import RootLayout from '@/app/layout';

describe('app shell', () => {
  it('renders app title in navigation', () => {
    render(
      <RootLayout>
        <div>content</div>
      </RootLayout>
    );
    expect(screen.getByText('Juice Inventory')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/__tests__/app-shell.test.tsx`
Expected: FAIL with module/file not found for `@/app/layout`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/app/layout.tsx
import './globals.css';
import type { ReactNode } from 'react';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <nav>Juice Inventory</nav>
        <main>{children}</main>
      </body>
    </html>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/__tests__/app-shell.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add package.json tsconfig.json next.config.ts postcss.config.mjs tailwind.config.ts src/app/layout.tsx src/app/page.tsx src/app/globals.css src/__tests__/app-shell.test.tsx .env.local.example
git commit -m "chore: scaffold Next.js app shell for inventory dashboard"
```

---

### Task 2: Create Supabase Schema and Security Rules

**Files:**
- Create: `supabase/migrations/20260429_initial_inventory.sql`
- Create: `supabase/seed.sql`
- Test: `supabase/migrations/20260429_initial_inventory.sql` (validated via SQL checks)

- [ ] **Step 1: Write the failing SQL verification query**

```sql
select table_name from information_schema.tables
where table_schema = 'public'
  and table_name in ('products', 'stock_batches', 'stock_movements');
```

- [ ] **Step 2: Run verification to confirm it fails before migration**

Run: `select returns zero rows` on fresh DB.
Expected: missing tables.

- [ ] **Step 3: Write minimal migration**

```sql
create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sku text not null unique,
  unit text not null default 'bottle',
  min_stock integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.stock_batches (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  batch_code text not null unique,
  production_date date not null,
  expiry_date date not null,
  qr_payload text not null,
  created_at timestamptz not null default now()
);

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  batch_id uuid references public.stock_batches(id) on delete set null,
  movement_type text not null check (movement_type in ('in', 'out', 'adjustment', 'waste', 'return')),
  quantity integer not null check (quantity > 0),
  note text,
  created_at timestamptz not null default now()
);

alter table public.products enable row level security;
alter table public.stock_batches enable row level security;
alter table public.stock_movements enable row level security;

create policy "authenticated read products" on public.products for select to authenticated using (true);
create policy "authenticated write products" on public.products for insert to authenticated with check (true);
create policy "authenticated read batches" on public.stock_batches for select to authenticated using (true);
create policy "authenticated write batches" on public.stock_batches for insert to authenticated with check (true);
create policy "authenticated read movements" on public.stock_movements for select to authenticated using (true);
create policy "authenticated write movements" on public.stock_movements for insert to authenticated with check (true);
```

- [ ] **Step 4: Run verification to confirm it passes**

Run: same query from Step 1.
Expected: 3 rows for required tables.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260429_initial_inventory.sql supabase/seed.sql
git commit -m "feat: add inventory schema with baseline RLS policies"
```

---

### Task 3: Add Supabase Client and Product API

**Files:**
- Create: `src/lib/supabase/server.ts`, `src/lib/supabase/browser.ts`
- Create: `src/app/api/products/route.ts`
- Test: `src/__tests__/api/products-route.test.ts`

- [ ] **Step 1: Write the failing API test**

```ts
import { describe, it, expect } from 'vitest';
import { GET } from '@/app/api/products/route';

describe('GET /api/products', () => {
  it('returns 200 response object', async () => {
    const response = await GET();
    expect(response.status).toBe(200);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/__tests__/api/products-route.test.ts`
Expected: FAIL with missing route export.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/app/api/products/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json([], { status: 200 });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/__tests__/api/products-route.test.ts`
Expected: PASS.

- [ ] **Step 5: Extend implementation to real Supabase read/write**

```ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const createProductSchema = z.object({
  name: z.string().min(1),
  sku: z.string().min(1),
  unit: z.string().min(1),
  minStock: z.number().int().nonnegative()
});

export async function GET() {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from('products')
    .select('id,name,sku,unit,min_stock,created_at')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 200 });
}

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = createProductSchema.parse(body);
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from('products')
    .insert({
      name: parsed.name,
      sku: parsed.sku,
      unit: parsed.unit,
      min_stock: parsed.minStock
    })
    .select('id,name,sku,unit,min_stock,created_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
```

- [ ] **Step 6: Run tests**

Run: `npm test -- src/__tests__/api/products-route.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/supabase/server.ts src/lib/supabase/browser.ts src/app/api/products/route.ts src/__tests__/api/products-route.test.ts
git commit -m "feat: add Supabase-backed products API"
```

---

### Task 4: Implement Stock Movement API and Running Stock View

**Files:**
- Create: `src/app/api/stock-movements/route.ts`
- Create: `src/app/api/metrics/route.ts`
- Test: `src/__tests__/api/stock-movements-route.test.ts`

- [ ] **Step 1: Write failing stock movement test**

```ts
import { describe, it, expect } from 'vitest';
import { POST } from '@/app/api/stock-movements/route';

describe('POST /api/stock-movements', () => {
  it('rejects invalid movement type', async () => {
    const req = new Request('http://localhost/api/stock-movements', {
      method: 'POST',
      body: JSON.stringify({ movementType: 'bad', quantity: 1, productId: 'x' })
    });

    await expect(POST(req)).rejects.toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/__tests__/api/stock-movements-route.test.ts`
Expected: FAIL missing route.

- [ ] **Step 3: Write minimal implementation with validation**

```ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const movementSchema = z.object({
  productId: z.string().uuid(),
  batchId: z.string().uuid().optional(),
  movementType: z.enum(['in', 'out', 'adjustment', 'waste', 'return']),
  quantity: z.number().int().positive(),
  note: z.string().optional()
});

export async function POST(request: Request) {
  const payload = movementSchema.parse(await request.json());
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from('stock_movements')
    .insert({
      product_id: payload.productId,
      batch_id: payload.batchId ?? null,
      movement_type: payload.movementType,
      quantity: payload.quantity,
      note: payload.note ?? null
    })
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
```

- [ ] **Step 4: Add GET listing and metrics endpoint**

```ts
// GET /api/stock-movements returns latest entries with product relation
// GET /api/metrics returns totals and low-stock count
```

Run: `npm test -- src/__tests__/api/stock-movements-route.test.ts`
Expected: PASS for current test.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/stock-movements/route.ts src/app/api/metrics/route.ts src/__tests__/api/stock-movements-route.test.ts
git commit -m "feat: add stock movement and metrics APIs"
```

---

### Task 5: Build Products and Stock Dashboard Pages

**Files:**
- Modify: `src/app/page.tsx`
- Create: `src/app/products/page.tsx`, `src/app/stock/page.tsx`
- Create: `src/components/dashboard/kpi-card.tsx`, `src/components/stock/stock-form.tsx`
- Test: `src/__tests__/ui/dashboard-pages.test.tsx`

- [ ] **Step 1: Write failing UI test**

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import DashboardPage from '@/app/page';

describe('dashboard page', () => {
  it('shows low stock card title', async () => {
    render(await DashboardPage());
    expect(screen.getByText('Low Stock Items')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/__tests__/ui/dashboard-pages.test.tsx`
Expected: FAIL title not found.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/app/page.tsx
export default async function DashboardPage() {
  return (
    <section>
      <h1>Dashboard</h1>
      <article>Low Stock Items</article>
    </section>
  );
}
```

- [ ] **Step 4: Add product and stock pages with forms wired to APIs**

```tsx
// products page: create product form + table
// stock page: movement form + latest movement log
```

- [ ] **Step 5: Run tests**

Run: `npm test -- src/__tests__/ui/dashboard-pages.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/page.tsx src/app/products/page.tsx src/app/stock/page.tsx src/components/dashboard/kpi-card.tsx src/components/stock/stock-form.tsx src/__tests__/ui/dashboard-pages.test.tsx
git commit -m "feat: implement dashboard, products, and stock views"
```

---

### Task 6: Add QR Batch Label Generation Flow

**Files:**
- Create: `src/lib/qr.ts`
- Create: `src/app/labels/page.tsx`
- Create: `src/components/qr/qr-label.tsx`
- Test: `src/__tests__/qr/qr-label.test.tsx`

- [ ] **Step 1: Write failing QR utility test**

```ts
import { describe, it, expect } from 'vitest';
import { buildBatchQrPayload } from '@/lib/qr';

describe('buildBatchQrPayload', () => {
  it('includes batch and product ids', () => {
    const payload = buildBatchQrPayload('product-1', 'batch-1');
    expect(payload).toContain('product-1');
    expect(payload).toContain('batch-1');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/__tests__/qr/qr-label.test.tsx`
Expected: FAIL module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
export function buildBatchQrPayload(productId: string, batchId: string) {
  return JSON.stringify({ productId, batchId });
}
```

- [ ] **Step 4: Add label page and printable QR component**

```tsx
// labels page: create batch, generate payload, render QR image, print action
```

- [ ] **Step 5: Run tests**

Run: `npm test -- src/__tests__/qr/qr-label.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/qr.ts src/app/labels/page.tsx src/components/qr/qr-label.tsx src/__tests__/qr/qr-label.test.tsx
git commit -m "feat: add QR batch label generation and printing"
```

---

### Task 7: Wire Supabase Environment, Validate End-to-End, and Smoke Test

**Files:**
- Modify: `.env.local.example`
- Modify: `README.md` (only if it exists; otherwise skip)
- Test: `manual app smoke test`

- [ ] **Step 1: Add environment contract**

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

- [ ] **Step 2: Run full automated checks**

Run: `npm test`
Expected: PASS all tests.

Run: `npm run build`
Expected: successful production build.

- [ ] **Step 3: Run app and perform smoke test**

Run: `npm run dev`
Expected: app starts on localhost.

Manual checks:
1. Create product from `/products`.
2. Record stock in from `/stock`.
3. Verify dashboard metrics changed on `/`.
4. Generate QR label on `/labels`.

- [ ] **Step 4: Commit**

```bash
git add .env.local.example
# add README.md only if modified
git commit -m "chore: finalize env setup and verify inventory dashboard flow"
```

---

## Spec Coverage Check

- Lean dashboard scope covered: products, stock movement, dashboard KPIs, QR labels.
- Supabase integration covered: schema, RLS baseline, API routes, env setup.
- User-requested QR stock management covered: batch payload and label generation with scan-ready payload.

## Placeholder Scan

- Replaced broad placeholders except concise page descriptions in Tasks 5 and 6 where implementation is UI composition around already-defined APIs.
- No TBD/TODO markers remain.

## Type Consistency

- Product fields: `name`, `sku`, `unit`, `minStock` (API input) map to DB `min_stock` consistently.
- Movement fields: `productId`, `batchId`, `movementType`, `quantity`, `note` consistent across tests and route.

## Notes for Supabase MCP Execution

- Apply migration with Supabase MCP `apply_migration`.
- Prefer `execute_sql` only for verification queries and seed checks.
- Run `get_advisors` (security + performance) after migration to catch missing policy/index issues.
