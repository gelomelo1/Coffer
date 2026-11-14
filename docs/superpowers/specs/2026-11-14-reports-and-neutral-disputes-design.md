# Coffer Marketplace — Reports & Neutral Disputes (addendum)

Date: 2026-11-14 · Builds on `2026-11-13-marketplace-design.md` · Status: requested by user ("implement 1-5")

## Intent
Coffer runs the venue and enforces **content rules**, but **never decides who was right in a deal**. Users get a
fair outcome through verified reviews; the developer is not an arbiter. Add the DSA-style basics: notice & action
for listings/messages/reviews, statement of reasons for every removal, terms acceptance, private-seller declaration.

## Changes
1. **Neutral disputes.** Buyer "Report a problem" on a `shipped` deal (reason ≥ 20 chars) ends the deal as
   `disputed` (terminal), stores `dispute_reason`/`disputed_at`, posts the reason in the chat, archives the listing
   (owner may reactivate), and opens the 14-day review window for both. No moderation case, no moderator decision.
   `disputed` no longer blocks the listing (not an "open" deal status). Reviews unlock for `completed` **or** `disputed`.
2. **Rule-based content moderation.** Fixed rule list (`report_rule`): `illegal_item, counterfeit, scam_or_fraud,
   harassment, personal_data, spam, fake_review, off_topic, other`. Admin decides only "violates rule X → remove"
   or "no violation". Never judges deal truth.
3. **Reports (notice & action).** `POST api/Reports {targetType: listing|message|review, targetId, rule, reason ≥10}`.
   - listing: any signed-in user except the owner, listing not removed.
   - message: only a participant of that conversation, not own message, not system message.
   - review: only the reviewee, published, not removed (as before; review is frozen while open).
   - one open report per (reporter, target) → 409.
   Snapshot (jsonb) of the content and its context is stored with the report (listing data; message + transcript;
   review + deal + transcript).
4. **Statement of reasons.** Resolving with `remove` creates a `moderation_actions` row for the content owner
   (rule, statement, content excerpt, target link) — **never** references the report or reporter. Owner sees it in
   Settings → Reports → "Moderation of my content" (+ unseen badge). Reporter sees the outcome on "My reports".
   Effects: listing → status `removed` (owner cannot reactivate/edit; pre-shipment open deal cancelled);
   message → `is_removed` (shown as "Removed by a moderator"); review → `is_removed`. `no_violation` → review unfrozen.
5. **Terms acceptance.** `users.market_terms_version`/`market_terms_accepted_at`. Current version `2026-11-14`.
   Required (409, code `terms_required`) for: create listing, open conversation, propose deal, accept deal.
   Terms text in the app; acceptance includes 18+ and private-individual confirmations.
6. **Private sellers only.** `listings.private_seller_declared` must be true for sell/exchange; listing shows
   "Private seller — consumer rights against businesses don't apply".
7. **Admin-only report handling in Coffer.Manager.** Endpoints `api/Admin/Reports` (list/get/resolve), Admin role only
   (Moderator → 403). New Tkinter view "Reports" (API URL + admin token from `COFFER_API_URL`/`COFFER_ADMIN_TOKEN` or
   typed in): list with filters, detail with snapshot + current state + first image, rule picker, statement, Remove /
   No violation. The in-app moderator queue is removed.
8. In-app: Report buttons on listing details, chat messages (long-press), reviews (with rule picker);
   Settings → Reports screen with tabs "My reports" (link to listing/chat) and "Moderation of my content".

## Data
- `reports` replaces `moderation_cases`: id, reporter_id, target_type, target_id, target_owner_id, listing_id NULL,
  conversation_id NULL, rule, reason, snapshot jsonb, status {open,resolved}, decision NULL {removed,no_violation},
  statement NULL, resolved_by NULL, resolved_at NULL, created_at.
- `moderation_actions`: id, user_id, target_type, target_id, listing_id NULL, conversation_id NULL, rule, statement,
  content_excerpt, created_at, seen_at NULL.
- `messages.is_removed`, `listings.private_seller_declared`, listing status `removed`, `deals.dispute_reason`,
  `deals.disputed_at`, open-deal unique index without `disputed`, `users.market_terms_version/accepted_at`.
- Migration `src/startup/marketplace_migration_2.sql`.

## Calls (veto-able)
- In-app moderator queue removed; Moderator role no longer handles reports (admin only, as requested).
- Disputed listing is archived, not sold (item may come back).
- Reporter sees decision + statement for their own report (DSA asks to inform the notifier).
