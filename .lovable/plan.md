
## Goal
Get Jayee Express launch-ready for public use at scale by addressing all 12 launch-readiness items, in a sensible order (blockers first, polish last).

## Order of work

I'll do these in **four phases** so nothing that depends on something else runs first.

### Phase 1 — Blockers (must be done before public launch)
1. **Security scan pass**
   - Run `security--run_security_scan`, review Critical/High findings, fix each in code (RLS, GRANTs, exposed columns, edge-function JWT checks), then mark them fixed.
2. **Payment safety end-to-end**
   - Confirm you've swapped to Paystack **live** keys in secrets.
   - Verify `paystack-webhook` checks the `x-paystack-signature` HMAC against `PAYSTACK_SECRET_KEY` and rejects on mismatch (already in code — I'll audit).
   - Confirm the `finalize_order_payment` RPC + advisory lock + `reconcile-payments` cron are all still wired.
   - Test the refund path (`cancel-order-refund`) with a live-mode sandbox order.
3. **Custom OAuth branding + redirect URIs**
   - Guide you through Google Cloud + Apple Developer BYOC (already documented in the previous turn).
   - Add the `com.shodel.app://oauth-callback` redirect to Google/Apple client and the Cloud → Auth Settings additional redirect URLs so native sign-in works end-to-end.
4. **Legal pages + consent**
   - Audit `/terms`, `/privacy-policy`; add a **refund/return policy** page, a **community/marketplace rules** page, and a signup checkbox that stores acceptance timestamp on the profile.
   - Add a lightweight cookie/consent notice.
5. **Email deliverability**
   - `email_domain--check_email_domain_status` for `jayeeexpress.com`; if not verified, run through the email setup dialog so SPF/DKIM/DMARC are correct and `support@jayeeexpress.com` sends reliably.

### Phase 2 — Operational readiness
6. **Admin readiness**
   - Verify at least 2 active `admin` rows in `user_roles`; walk through a real withdrawal end-to-end on `/admin/payouts`; confirm each of the 7 category commission rows exists and matches the intended %.
7. **Backups & recovery**
   - Confirm the Cloud daily backup is on (Cloud → Advanced settings), document a restore drill in `.lovable/memory/`, and verify the `reconcile-payments` scheduled job is enabled.
8. **Performance & abuse limits**
   - Add server-side rate limiting via a `rate_limits` table + RPC used by `initialize-payment`, message sends, product creation, review creation, and auth email endpoints.
   - Enforce image size cap in `imageCompression.ts` (already 1600×900) and reject uploads > 3 MB in storage RLS.
   - Add a simple profanity/blocked-word filter for `messages` and product titles.
9. **Monitoring & error tracking**
   - Add lightweight client error capture that writes to a `client_errors` table (RLS: authenticated INSERT only) with route + message + userId, surfaced in `/admin` as a "Recent errors" panel. Keeps you inside Cloud instead of adding a third-party dependency.
   - Add a `payment_webhook_failures` count widget on the existing `PaymentsReconciliation` page.

### Phase 3 — Distribution
10. **App store readiness (Android)**
    - Confirm `capacitor.config.ts` (already `com.shodel.app` / Jayee Express).
    - Add the AndroidManifest deep-link intent-filter for OAuth (documented last turn).
    - Produce a Play Store checklist: signed AAB, `privacy_policy_url`, data-safety answers, screenshots, feature graphic, content rating.
11. **SEO & discoverability**
    - Regenerate `public/sitemap.xml` via `scripts/generate-sitemap.ts` in a build step, verify `robots.txt`, run `seo_chat--trigger_scan`, then walk through Google Search Console verification with a TXT record on `jayeeexpress.com`.

### Phase 4 — Support surface
12. **Support channel**
    - Confirm `support@jayeeexpress.com` receives mail (may require MX at your registrar — I'll surface the exact records).
    - Seed the Help Center with the essential starter topics for buyers/sellers/riders/admins (order placed, payment failed, delivery accepted, withdrawal rejected, account suspended, how to switch modes).
    - Test `/report` end-to-end.

## What I need from you along the way
- **Live Paystack keys** — I'll ask via `add_secret` when Phase 1.2 begins.
- **Google Cloud + Apple Developer access** — only you can register OAuth clients; I'll give exact fields to paste (Phase 1.3).
- **Confirmation to enable a scheduled cron** for reconcile-payments if it's not already on.
- **Which second admin email** to promote to `admin` role (Phase 2.6).
- **Play Store screenshots & feature graphic** when we get to Phase 3.10 (I can generate them if you want).

## Ground rules
- One phase per turn so we can verify each step before moving to the next.
- I won't change anything outside the item currently being worked.
- Every code change gets a build check; every DB change goes through a migration with GRANTs + RLS.

## Deliverable at the end
A launch checklist committed under `.lovable/launch-readiness.md` recording what was verified, what was changed, and what's still on you (Play Store submission, live-mode Paystack verification, etc.).

**Approve this plan and I'll start Phase 1 immediately with the security scan + fixes.**
