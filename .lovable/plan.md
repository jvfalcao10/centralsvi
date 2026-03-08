
## End-to-End Audit Results

### What's working ✅
- **Database**: All 8 tables exist with RLS enabled. Seed data is present: 8 clients, 10 leads (across all 6 pipeline stages), 13 deliveries, 13 invoices, 12 expenses, 5 interactions
- **Auth flow**: Login page is correct, `AuthContext` properly uses `onAuthStateChange` + `getSession`, ProtectedRoute redirects unauthenticated users
- **Supabase client** (`src/lib/supabase.ts`): Now uses hardcoded URL+key — no more "supabaseKey is required" error
- **Theme**: Dark mode default via `localStorage`, CSS variables correctly configured
- **Dashboard**: Fetches real clients/deliveries/invoices for KPIs and alerts
- **Pipeline**: Fetches all 10 leads, drag-and-drop updates `stage` in DB
- **Clients**: Fetches clients ordered by MRR, opens modal with deliveries/invoices/interactions per client
- **Deliveries**: Joins `clients(name, company)` — this works since FK constraint exists. Checkbox toggles status in DB
- **Financial**: Fetches invoices joined with `clients(name)` and expenses. Actions (mark paid, add expense) update DB

### Issues Found & Fixes Needed

**Issue 1 — RLS policies block unauthenticated seed data viewing**
The RLS `USING (auth.uid() IS NOT NULL)` means data only loads when a user is logged in. This is correct behavior — but no sign-up flow exists! There's no way to create an account. Users need a way to register.

**Issue 2 — No sign-up / registration page**
The login page only has email+password login and "forgot password". There's zero way to create an account. Without an account, users can't log in and see any data. We need a signup form (or at minimum, a note to the user that they need to create a demo account via the backend).

**Issue 3 — Profile trigger missing**
The `handle_new_user()` function exists in the DB to auto-create profiles, but the trigger is listed as missing (`db-triggers` shows empty). This means new users won't get a profile row, causing `AuthContext.fetchProfile` to return nothing, so the sidebar shows "SV" initials and "user" role instead of the real name. The trigger on `auth.users` needs to be recreated.

**Issue 4 — `Plus` icon imported but never used in Pipeline**
Minor: `Plus` is imported from lucide-react in Pipeline.tsx but not used — harmless but creates a lint warning.

**Issue 5 — `info` CSS color variable used but not defined**
`SOURCE_COLORS` in Pipeline uses `text-info` and `bg-info/20` — but looking at `index.css`, there's no `--info` CSS variable defined. Only `--primary`, `--success`, `--warning`, `--danger` etc. This makes "pago" source badges render with no color.

**Issue 6 — `success`, `warning`, `danger` CSS variables missing**
`tailwind.config.ts` likely maps `success`, `warning`, `danger`, `info` to CSS variables but `index.css` only defines standard shadcn variables. Need to verify these are mapped correctly.

### Plan

1. **Add `info`, `success`, `warning`, `danger` to `index.css`** CSS variables (both light and dark), so badges render with correct colors
2. **Add the missing DB trigger** for `handle_new_user` via migration so profiles are auto-created on signup
3. **Add a signup tab to the Login page** — toggle between "Login" and "Criar conta" so users can register, OR add a separate sign-up link
4. **Fix the unused `Plus` import** in Pipeline.tsx (minor cleanup)

The signup addition is the most critical — without it, the app is completely locked out to new visitors with no way in.
