## 1. Fix Messages page layout (sticky, non-scrolling shell)

**Problem:** The outer page scrolls along with the chat, and the conversation/chat panes shrink awkwardly on small/large screens.

**Fix in `src/pages/Messages.tsx`:**
- Replace the current `min-h-screen` + container layout with a fixed-viewport shell: `h-[100dvh]` (dynamic viewport, handles mobile browser chrome) with `overflow-hidden` on the root, and `flex flex-col`.
- Navbar sits at the top (non-scrolling). Footer is removed on this page (chat apps don't have footers — it just steals space). On desktop a compact footer can remain below; on mobile it's hidden behind the bottom tab bar anyway.
- Main area becomes `flex-1 min-h-0` so the chat grid fills exactly the remaining viewport.
- Inner two-pane grid: `min-h-0` on both columns so only the message list and conversation list scroll internally (via existing `ScrollArea`), never the page.
- Sticky chat header and sticky composer inside the chat column (`shrink-0`), messages area is the only flexible `min-h-0` scroll region.
- Mobile: when a conversation is open, hide the bottom tab bar collision by adding `pb-[env(safe-area-inset-bottom)]` on the composer and ensuring the page itself doesn't add `pb-16`.
- Remove the outer `container mx-auto px-4` padding on mobile so the chat goes edge-to-edge like WhatsApp; keep padding on `md:` breakpoints.

## 2. Media file sharing in messages (WhatsApp-style)

**Database migration (`messages` table):**
- Add columns: `media_url text`, `media_type text` (one of `image`, `video`, `audio`, `file`), `media_name text`, `media_size bigint`, `media_mime text`.
- Make `content` nullable (media-only messages have no text) — update with a CHECK that requires either content or media_url.

**Storage:**
- Create new private bucket `message-media` via `supabase--storage_create_bucket`.
- RLS policies on `storage.objects` for that bucket: only sender or receiver of a message referencing the file can read; only authenticated users can insert into their own `{user_id}/...` path prefix.

**Client work in `src/pages/Messages.tsx` (+ small new components):**
- New `MessageComposer` controls: attach button (paperclip icon) opening a hidden file input accepting `image/*,video/*,audio/*,application/pdf` (cap at ~25 MB).
- On select: show inline preview chip above the textarea (image thumbnail, video first-frame poster, file name/size for others) with a remove button. Send is enabled with media even if text is empty.
- Upload flow:
  1. Compress images via existing `src/lib/imageCompression.ts` when `image/*`.
  2. Upload to `message-media/{user_id}/{uuid}.{ext}` (private bucket).
  3. Insert `messages` row with `media_url` = storage path, `media_type`, `media_name`, `media_size`, `media_mime`, plus optional caption in `content`.
  4. Generate a short-lived signed URL for rendering (60 min).
- New `MessageBubble` rendering:
  - `image` → rounded thumbnail, click to open a lightbox dialog (reuse `dialog.tsx`).
  - `video` → inline `<video controls poster>` capped at ~320 px height.
  - `audio` → inline `<audio controls>`.
  - other files → file card with icon, name, size, and a download button.
  - Optional caption text below media.
- Re-sign URLs on fetch (batch sign all media paths in the active conversation after `fetchMessages`).
- Push/email notification text becomes `"📷 Photo"`, `"🎥 Video"`, `"📎 File"` when content is empty.

**Out of scope:** voice-note recording, multi-file selection (single attachment per message for v1), document previews beyond filename, gallery view.

## Technical notes

- Files: edit `src/pages/Messages.tsx`; add `src/components/messaging/MessageBubble.tsx`, `src/components/messaging/MediaPreview.tsx`, `src/lib/messageMedia.ts` (upload + signed URL helpers).
- One migration adds the 5 new columns + check constraint; types regenerate after approval.
- Bucket created via tool, then a follow-up migration writes `storage.objects` policies.
- Existing realtime channel already covers new columns — no subscription changes needed.
