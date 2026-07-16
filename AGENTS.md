# AGENTS.md — JCB Workshop CRM

## 1. Executive Summary

**JCB Workshop CRM** is a mobile-first customer relationship management system for a JCB/heavy equipment workshop. It tracks machine repair jobs, technician assignments, parts usage, and generates service records/reports. Built as an Expo React Native app with Supabase backend, targeting Android (APK/AAB), iOS, and Web.

**Business domain:** Heavy equipment (JCB backhoe loaders) repair workshop management. Machines are identified by registration numbers; jobs flow through statuses (In Queue → In Progress → Completed/On Hold).

**Current state:** Production-ready MVP. Core CRUD, auth, role-based access, photo upload, CSV export, and billing generation all work. No tests, no CI/CD.

---

## 2. Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Runtime | Expo (React Native) | 54.x |
| UI Framework | React Native | 0.81.5 |
| Language | TypeScript | 5.9.2 (strict) |
| Navigation | React Navigation 7 | native-stack + bottom-tabs |
| Backend/DB | Supabase (PostgreSQL + Auth + Storage) | supabase-js 2.104 |
| Storage | Supabase Storage (machine_photos bucket) | — |
| Image Handling | expo-image-picker, expo-image-manipulator | — |
| File Sharing | expo-file-system, expo-sharing | — |
| Date Picker | @react-native-community/datetimepicker | 8.4.4 |
| Picker | @react-native-picker/picker | 2.11.1 |
| Build | EAS Build (expo) | CLI 5.0+ |

---

## 3. Architecture Overview

```
cutsom_crm/
├── Backend/
│   └── schema.sql              # Supabase schema (tables, RLS, storage, triggers)
├── Frontend/
│   ├── App.tsx                 # Root: SafeAreaProvider → AuthProvider → AppNavigator
│   ├── index.ts               # Entry: URL polyfill + registerRootComponent
│   ├── src/
│   │   ├── components/         # Shared UI (JobSheetCard, QuickStatusModal)
│   │   ├── context/            # AuthContext (session, profile, signOut)
│   │   ├── navigation/         # AppNavigator (auth gate), AdminNavigator (tabs+stack)
│   │   ├── screens/
│   │   │   ├── auth/           # LoginScreen
│   │   │   ├── admin/          # Dashboard, AllJobs, Team, Reports, JobDetail, AddTech
│   │   │   ├── user/           # Dashboard, CreateJob, JobDetail, EditJob
│   │   │   └── shared/         # Settings, EditProfile
│   │   ├── services/           # supabase.ts (client), supabaseAdmin.ts (admin client)
│   │   ├── types/              # TypeScript types (mirrors DB schema)
│   │   └── utils/              # greetingUtils, navigationUtils
│   └── app.json                # Expo config
└── AGENTS.md                   # This file
```

**Pattern:** Role-based navigation split. `AppNavigator` checks `profile.role` → routes to either `AdminNavigator` (tab-based) or user stack (flat screens). No shared navigation between roles except Settings/EditProfile/CreateJobSheet.

---

## 4. Folder Structure (Frontend/src/)

| Directory | Purpose | Files |
|-----------|---------|-------|
| `components/` | Reusable UI components | `JobSheetCard.tsx`, `QuickStatusModal.tsx` |
| `context/` | React Context providers | `AuthContext.tsx` |
| `navigation/` | Navigation config | `AppNavigator.tsx`, `AdminNavigator.tsx` |
| `screens/auth/` | Authentication | `LoginScreen.tsx` |
| `screens/admin/` | Admin-only screens | 6 files (Dashboard, AllJobs, Team, Reports, JobDetail, AddTech) |
| `screens/user/` | Technician screens | 4 files (Dashboard, Create, Detail, Edit) |
| `screens/shared/` | Both roles | `SettingsScreen.tsx`, `EditProfileScreen.tsx` |
| `services/` | Supabase clients + helpers | `supabase.ts`, `supabaseAdmin.ts` |
| `types/` | TypeScript types | `index.ts` |
| `utils/` | Helpers | `greetingUtils.ts`, `navigationUtils.ts` |

---

## 5. Application Flow

### Auth Flow
1. User opens app → `LoginScreen` renders
2. User enters username → Supabase RPC `get_user_email_by_username` resolves email
3. User enters password → `supabase.auth.signInWithPassword({ email, password })`
4. `AuthContext` receives auth state change → fetches profile from `profiles` table
5. `AppNavigator` re-renders: `profile.role === 'admin'` → `AdminNavigator`, else → user stack

### Job Lifecycle
1. **Create** (admin or user): `CreateJobSheetScreen` → inserts to `job_sheets` with status `'In Queue'`
2. **Assign**: Admin assigns technician via picker; user auto-assigns to self
3. **Update Status**: `QuickStatusModal` or detail screen → updates `status`, `completed_at`, `tat_hours`
4. **Complete**: TAT calculated as `(completed_at - entry_date_time)` in hours
5. **Log**: Every status change inserts to `job_updates` table (activity log)

### Photo Flow
1. User picks image (camera/gallery) → compressed to 800px, 50% quality JPEG
2. Uploaded to Supabase Storage `machine_photos` bucket as `jobs/{timestamp}_{index}.jpg`
3. Public URL stored in `job_sheets.photos[]` array

---

## 6. Component Hierarchy

```
App
└── SafeAreaProvider
    └── AuthProvider (Context)
        └── AppNavigator
            ├── [!session] → LoginScreen
            ├── [admin] → AdminNavigator
            │   ├── AdminTabs (BottomTabNavigator)
            │   │   ├── AdminDashboardScreen (→ JobSheetCard, QuickStatusModal)
            │   │   ├── AllJobsScreen (→ JobSheetCard, QuickStatusModal)
            │   │   ├── TeamScreen
            │   │   └── ReportsScreen
            │   ├── JobDetailAdminScreen
            │   ├── AddTechnicianScreen
            │   ├── CreateJobSheetScreen
            │   ├── SettingsScreen → EditProfileScreen
            │   └── (shared screens)
            └── [user] → UserDashboardScreen
                ├── JobSheetDetailScreen → EditJobSheetScreen
                ├── CreateJobSheetScreen
                ├── SettingsScreen → EditProfileScreen
                └── QuickStatusModal
```

---

## 7. State Management

**No global state library.** All state is local + React Context.

| Mechanism | Location | Purpose |
|-----------|----------|---------|
| `AuthContext` | `src/context/AuthContext.tsx` | Session, profile, loading, signOut, fetchProfile, updateProfile |
| Local `useState` | Every screen | All UI state (loading, form fields, filters, modals) |
| `useFocusEffect` | Dashboard/Detail screens | Refetch data when screen gains focus |

**Data fetching pattern:** Direct Supabase queries in screen components. No abstraction layer, no caching, no optimistic updates (except status in `handleStatusUpdate` which patches local state immediately).

---

## 8. API Layer

### Supabase Client (`src/services/supabase.ts`)
- Created with `EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- Storage adapter: AsyncStorage (native) → MemoryStorage fallback → localStorage (web)
- Exports: `supabase`, `getPhotoUrl()`, `uploadPhotoFromUri()`

### Supabase Admin Client (`src/services/supabaseAdmin.ts`)
- Created with `EXPO_PUBLIC_SUPABASE_SERVICE_KEY` (bypasses RLS)
- Used only in `AddTechnicianScreen` for `auth.admin.createUser()`

### RPC Functions Used
| RPC | Purpose | Called From |
|-----|---------|------------|
| `get_user_email_by_username` | Username → email lookup | LoginScreen |

### Views Used
| View | Purpose | Called From |
|------|---------|------------|
| `job_updates_with_profile` | Joins job_updates with profiles for display name | JobDetailAdminScreen, JobSheetDetailScreen |

### Tables Queried
| Table | Operations |
|-------|-----------|
| `profiles` | SELECT, INSERT, UPDATE |
| `job_sheets` | SELECT, INSERT, UPDATE, DELETE |
| `job_updates` | SELECT, INSERT |

---

## 9. Build & Deployment

| Aspect | Details |
|--------|---------|
| Build Tool | EAS Build (Expo Application Services) |
| Android (dev) | APK via `eas build --profile development` |
| Android (prod) | AAB via `eas build --profile production` (auto-increment version) |
| iOS | Configured but no iOS build profiles defined |
| Web | `expo start --web` (Metro bundler) |
| Deep Linking | Prefixes: `https://jcb-workshop-crm.vercel.app`, `jcbcrm://` |
| Android Package | `com.siddiqiaakil.jcbworkshopcrm` |
| Expo Owner | `siddiqi_aakil` |
| EAS Project ID | `02419726-f74f-4f6b-baf5-f8782ff84e68` |

**Required Environment Variables:**
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_SUPABASE_SERVICE_KEY` (admin client — security risk if exposed to client)

---

## 10. Coding Standards

### TypeScript
- Strict mode enabled (`tsconfig.json`)
- Types mirror DB schema exactly (`src/types/index.ts`)
- Nullable columns typed as `string | null` (not optional)
- Manual types (no generated Supabase types)

### Style
- `StyleSheet.create()` for all styles
- Color palette: `#1a1a2e` (dark navy), `#FFD700`/`#ffcc00` (gold), `#f5f5f5` (light gray bg)
- Dark mode: NOT supported (hardcoded colors)
- Emoji used as icons (no icon library)

### Conventions
- Screens are functional components with hooks
- Export pattern: `export const ScreenName = () => {}` (named exports, arrow functions)
- Platform checks: `Platform.OS === 'web'` for web-specific behavior (window.confirm, date inputs)
- No CSS-in-JS library, no Tailwind, pure React Native StyleSheet

---

## 11. Strengths

1. **Clean architecture** — Role-based navigation split is well-implemented
2. **Type safety** — Types closely mirror DB schema; strict TS enabled
3. **RLS enforcement** — Supabase Row Level Security properly configured with admin/user policies
4. **Offline resilience** — MemoryStorage fallback for AsyncStorage failures
5. **Image optimization** — Client-side compression before upload
6. **Activity logging** — Every status change creates an audit trail in `job_updates`
7. **Cross-platform** — Works on Android, iOS, and Web with platform-specific code paths
8. **CSV export** — Three export types (Job Summary, Parts, Team Performance) with proper BOM encoding
9. **Quick status updates** — Modal allows fast status changes from list views

---

## 12. Weaknesses

1. **No backend code** — Only `schema.sql`; no Edge Functions, no server-side logic
2. **Admin key on client** — `EXPO_PUBLIC_SUPABASE_SERVICE_KEY` in frontend code is a security risk
3. **No tests** — Zero unit, integration, or E2E tests
4. **No CI/CD** — No GitHub Actions, no automated builds
5. **No error boundary** — App crashes on unhandled errors
6. **Duplicate code** — `getStatusColors()` duplicated in 5+ files; `STANDARD_MODELS` duplicated in Create/Edit
7. **No caching** — Every screen refetches data on focus; no local cache or SWR pattern
8. **No pagination for team/dashboard** — Only AllJobsScreen has pagination
9. **Web alerts** — Uses `window.alert()` for confirmations on web (inconsistent UX)
10. **No form validation library** — Manual validation scattered across screens

---

## 13. Technical Debt

| Debt | Location | Impact |
|------|----------|--------|
| `supabaseAdmin` client in frontend | `supabaseAdmin.ts` | Security: service key exposed to client |
| `console.log` statements throughout | `AuthContext.tsx`, screens | Performance, information leak |
| `any` types | `AdminDashboardScreen:56`, `AllJobsScreen:29`, `ReportsScreen:38-39`, `TeamScreen` | Type safety erosion |
| Duplicated status color logic | 5+ files | Maintenance burden |
| Duplicated form code (Create/Edit JobSheet) | `CreateJobSheetScreen.tsx`, `EditJobSheetScreen.tsx` | ~600 lines duplicated |
| Inline styles mixed with StyleSheet | Multiple screens | Inconsistent styling |
| `isMounted` pattern in every fetch | Every screen with data | Boilerplate; could use AbortController |
| No Supabase generated types | `src/types/index.ts` | Manual type maintenance |
| `ts_errors.txt` binary file in repo | Root of Frontend | Unknown contents, shouldn't be committed |

---

## 14. Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Service key on client | **CRITICAL** | Move admin operations to Supabase Edge Functions |
| No input sanitization | HIGH | SQL injection mitigated by Supabase parameterized queries; XSS risk on web |
| No rate limiting | MEDIUM | Supabase handles basic rate limiting |
| Photo storage costs | MEDIUM | Images compressed, but no cleanup of deleted job photos |
| Single admin role | MEDIUM | No granular permissions (e.g., can't restrict team management) |
| No data backup strategy | HIGH | Supabase has built-in backups but no verified process |

---

## 15. Suggested Improvements (Do Not Implement)

1. **Move `supabaseAdmin` to Edge Functions** — Never expose service role key to client
2. **Extract shared components** — `StatusBadge`, `FormField`, `DateInput` to reduce duplication
3. **Add React Query / TanStack Query** — Caching, deduplication, optimistic updates
4. **Generate Supabase types** — `supabase gen types typescript` for auto-generated types
5. **Add error boundary** — Catch render errors gracefully
6. **Add tests** — At minimum: auth flow, job creation, status transitions
7. **Implement CI/CD** — GitHub Actions → EAS Build → TestFlight/Play Console
8. **Add dark mode** — Use theme context or NativeWind
9. **Extract constants** — Status colors, models, colors into a constants file
10. **Add offline support** — SQLite or WatermelonDB for offline job viewing
11. **Add notifications** — Push notifications for status changes and new assignments
12. **Add search debounce** — Search input fires on every keystroke currently

---

## 16. Questions

1. **Is `EXPO_PUBLIC_SUPABASE_SERVICE_KEY` intentional on the client?** This is a critical security issue. Admin user creation should happen server-side.
2. **Is `job_updates_with_profile` a database view or table?** Schema only defines `job_updates` table, but code queries the view name.
3. **What is `is_active` field on profiles?** Used in code (`TeamScreen`, `AddTechnicianScreen`) but not in `schema.sql`.
4. **Is `serial_number` a DB column?** Used in types and screens but not in `schema.sql`.
5. **What is `service_location`?** Used in types and screens but not in `schema.sql`.
6. **What is `priority`?** Used in types and screens but not in `schema.sql`.
7. **Why is `ts_errors.txt` a binary file in the repo?** Should be text or removed.
8. **Is the Vercel deployment (`jcb-workshop-crm.vercel.app`) active?** Referenced in linking config.

---

## Verified Findings

- ✅ Expo 54 + React Native 0.81.5 + TypeScript 5.9.2 (strict)
- ✅ Supabase backend with RLS, auth, storage
- ✅ Role-based navigation (admin vs user)
- ✅ Job lifecycle: In Queue → In Progress → Completed/On Hold
- ✅ Photo upload with compression
- ✅ CSV export (3 types)
- ✅ Billing/service record generation
- ✅ Activity logging on status changes
- ✅ EAS Build configured for Android (APK + AAB)
- ✅ Deep linking configured
- ✅ Web platform support with platform-specific code paths
- ❌ No tests found
- ❌ No CI/CD configuration
- ❌ `schema.sql` missing columns used in code (`is_active`, `serial_number`, `service_location`, `priority`)
- ❌ `job_updates_with_profile` view not defined in schema
