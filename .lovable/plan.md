# Help Center Plan

## What we're building

A floating help button on public pages that opens a per-role Help Center. Admins author topics and problems (with rich-text steps + embedded YouTube/Shorts) from the admin dashboard. Each user only sees help for their role.

## User experience

**Floating Help button**
- Round orange button, bottom-right, just above the mobile tab bar.
- Visible on all public pages.
- Hidden on: `/admin/*`, `/auth`, `/reset-password`, `/select-city`, `/cart` (checkout), `/messages`.
- Clicking opens `/help`.

**Help page (`/help`) — strict role detection**
- Logged-out → Buyer help.
- Logged-in: role resolved once via existing data
  - has approved store → `seller`
  - else has active rider subscription / rider role → `delivery`
  - else → `buyer`
- No tabs, no switcher. Page title reflects the role ("Seller Help", etc.).
- Layout: list of Topics (e.g. "How to upload a product"). Expanding a topic reveals its Problems. Each Problem shows:
  1. Embedded YouTube/Shorts player (if a link was provided)
  2. Rich-text steps rendered below the video
- Search box filters topics/problems by title.

**Admin authoring (`/admin/help`)**
- New sidebar entry "Help Center".
- Audience selector: Buyer / Seller / Delivery.
- For the selected audience: CRUD list of Topics (title, sort order).
- Inside a topic: CRUD list of Problems with fields
  - Title
  - YouTube URL (any youtube.com / youtu.be / shorts URL — normalized to an embed URL on save)
  - Steps (rich-text editor: bold, italic, lists, links, inline images)
  - Sort order
- Reordering via up/down buttons (keeps scope tight).

## Technical notes

**Database (new migration)**
- `audience` enum: `buyer | seller | delivery`
- `help_topics`: `id, audience, title, sort_order, created_at, updated_at`
- `help_problems`: `id, topic_id (FK cascade), title, youtube_url, steps_html, sort_order, created_at, updated_at`
- GRANTs: `SELECT` to `anon` + `authenticated` (help is public-readable); full CRUD to `service_role`; admins write via policies.
- RLS:
  - SELECT: anyone
  - INSERT/UPDATE/DELETE: `has_role(auth.uid(), 'admin')`
- `updated_at` trigger using existing `update_updated_at_column()`.

**Role resolution for `/help`**
- Reuse existing checks: `useAuth`, `stores` table (user_id + is_verified), `has_active_rider_subscription` RPC. Resolved client-side in one hook (`useHelpAudience`).

**YouTube embed**
- Util `toYouTubeEmbed(url)` handles: `watch?v=`, `youtu.be/`, `shorts/`. Render in 16:9 (or 9:16 for Shorts) iframe with `loading="lazy"`.

**Rich-text editor**
- Use TipTap (`@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-link`, `@tiptap/extension-image`) — small, already React-friendly.
- Store sanitized HTML in `steps_html`. Render with DOMPurify (`dompurify`) before `dangerouslySetInnerHTML` to prevent XSS — non-negotiable since admins author HTML.
- Inline images: admin pastes image URLs (no new storage bucket needed for v1; if later requested, can add a `help-media` bucket).

**Files to add**
- `supabase/functions`-free; pure DB + frontend.
- `src/components/help/FloatingHelpButton.tsx` — mounted once in `App.tsx`, internally checks `useLocation` to hide on excluded routes.
- `src/pages/Help.tsx` — public help viewer.
- `src/pages/admin/HelpManagement.tsx` — admin CRUD.
- `src/components/admin/HelpTopicEditor.tsx`, `HelpProblemEditor.tsx` — dialogs.
- `src/components/ui/RichTextEditor.tsx` — TipTap wrapper.
- `src/hooks/useHelpAudience.ts`
- `src/lib/youtube.ts` — embed URL normalizer
- `src/lib/sanitizeHtml.ts` — DOMPurify wrapper

**Files to edit**
- `src/App.tsx` — mount `<FloatingHelpButton />`; add `/help` route and `/admin/help` admin route.
- `src/components/admin/AdminSidebar.tsx` — add "Help Center" menu item.

**Packages to install**
- `@tiptap/react @tiptap/starter-kit @tiptap/extension-link @tiptap/extension-image`
- `dompurify` + `@types/dompurify`

## Out of scope (v1)
- Per-user "Was this helpful?" feedback / analytics
- MP4 uploads or non-YouTube embeds
- Multi-language help
- Per-store custom help
