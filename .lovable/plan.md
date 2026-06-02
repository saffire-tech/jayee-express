
## Goal
Let users contribute named map locations so future searches can jump straight to coordinates that real Ghanaians have pinned, with autocomplete suggestions as they type.

## 1. Database

New table `community_locations`:
- `id` uuid pk
- `name` text (the user-provided place name, e.g. "Mama Lizzy Shop, Adenta")
- `name_lower` text (generated, lower-cased, for fast ILIKE / trigram search)
- `latitude` double precision
- `longitude` double precision
- `contributed_by` uuid (auth user id, nullable so we keep history if user deleted)
- `usage_count` int default 1 (increment when someone picks it from suggestions)
- `is_flagged` boolean default false (admin moderation hook, off by default)
- `created_at`, `updated_at`

Indexes:
- `pg_trgm` extension + GIN index on `name_lower` for fuzzy suggestions
- B-tree on `usage_count desc` for ranking

RLS + GRANTs:
- `GRANT SELECT ON public.community_locations TO anon, authenticated`
- `GRANT INSERT, UPDATE ON public.community_locations TO authenticated`
- `GRANT ALL TO service_role`
- Policies:
  - SELECT: anyone where `is_flagged = false` (admins see all via `has_role`)
  - INSERT: `auth.uid() = contributed_by`
  - UPDATE: only `usage_count` bump allowed for any authenticated user, full update for admin / original contributor (use a small `bump_location_usage(id uuid)` security-definer RPC instead of broad UPDATE policy — cleaner and safer)
  - Admin manage-all policy via `has_role(auth.uid(), 'admin')`

No edits to existing `locations` table (that one stays as admin-curated zones for delivery pricing).

## 2. MapPicker changes (`src/components/maps/MapPicker.tsx`)

Replace the current Mapbox-only search with a hybrid suggestion box:

1. As the user types in the search input (debounced ~250ms), in parallel fetch:
   - Community matches: `supabase.from('community_locations').select().ilike('name_lower', '%q%').order('usage_count', { ascending: false }).limit(6)` (later upgradable to `pg_trgm` similarity).
   - Mapbox geocoding (existing call), limit 4, biased to Ghana (`country=gh&proximity=-0.187,5.6037`).
2. Render a dropdown under the input with two grouped sections:
   - "Community pins" (with a small user icon + usage count badge)
   - "Map results" (Mapbox icon)
3. Clicking a community pin: fly map to its coords, drop marker, call `bump_location_usage(id)` RPC, fire `onLocationSelect(lat, lng)`.
4. Clicking a Mapbox result: fly map, drop marker, then show an inline "Save this place" mini-form (name input prefilled with the Mapbox place name, Save / Skip buttons). On Save: insert into `community_locations` with `contributed_by = auth.uid()`.
5. Clicking a blank spot on the map (existing behavior): drop marker, then show the same "Name this place (optional)" inline prompt so anonymous map clicks can also become contributions.

New prop on MapPicker: `enableCommunityContributions?: boolean` (default `true`) so admin LocationsManager can opt out if needed.

UI: keep current Tailwind styling — dropdown uses `bg-popover border-border shadow-md rounded-md`, sections separated by `text-xs text-muted-foreground` headers, no hardcoded colors.

## 3. Where it's used
No changes needed in the call sites (`DeliveryOption.tsx`, `LocationsManager.tsx`) — they already consume `onLocationSelect(lat, lng)`. They just inherit the new search UX automatically.

## 4. Edge cases / guards
- Require auth to save a contribution; if unauthenticated, hide the "Save this place" form and show a small "Sign in to save this place for others" hint.
- Trim + collapse whitespace, enforce 2–80 char name, reject duplicates within ~50m of an existing pin with the same lower-cased name (check client-side before insert; on conflict, just bump usage on the existing row).
- Suggestions only fired for queries ≥ 2 chars.
- Suggestions list capped at 10 total, community first.

## 5. Not in scope (call out)
- No admin moderation UI in this pass — `is_flagged` column is added so we can build it later. If you want a quick "Hide bad pins" admin tab, say so and I'll add it.
- No reverse-geocoding of map clicks (we just let the user name it).

## Technical notes
- Migration enables `pg_trgm` and adds the GIN index; the `bump_location_usage` function runs as `SECURITY DEFINER` with `SET search_path = public` and only does `UPDATE community_locations SET usage_count = usage_count + 1 WHERE id = _id`.
- Mapbox geocoding URL gets `&country=gh&proximity=-0.187,5.6037&limit=4` to keep results local.
- Suggestion fetches are race-safe via an incrementing request id ref inside MapPicker.
