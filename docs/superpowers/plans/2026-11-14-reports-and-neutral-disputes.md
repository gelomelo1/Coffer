# Reports & Neutral Disputes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Neutral disputes, rule-based reports with statements of reasons, terms + private-seller gates, admin report handling in Coffer.Manager.
**Architecture:** Replace `ModerationCase`/`ModerationCaseFactory`/`ModerationService` with `Report` + `ModerationAction` entities, `ReportService` (user side) and `AdminReportService` (admin side). DealService loses moderator resolution; ReviewService report goes through ReportService.
**Tech Stack:** as before + Tkinter/requests/Pillow (Manager).
**Spec:** `docs/superpowers/specs/2026-11-14-reports-and-neutral-disputes-design.md` (+ base spec 2026-11-13).

## Global Constraints
- Terms version `2026-11-14`; error body `{ "message", "code": "terms_required" }` with 409.
- Rules (snake_case): illegal_item, counterfeit, scam_or_fraud, harassment, personal_data, spam, fake_review, off_topic, other.
- Report reason 10..1000; statement 10..1000; dispute reason 20..1000.
- Admin endpoints: Admin role only; Moderator gets 403.
- Moderation actions never expose reporter id/name or report id.
- No commits unless asked. dotnet at `"C:\Program Files\dotnet\dotnet.exe"`.

## Review Focus
1. Reporter identity leaking into "moderation of my content" → DTO has no reporter/report fields (test `AgainstMe_DoesNotRevealReporter`).
2. Removed listing still searchable/editable/reactivatable → 409/hidden (tests in Task 2).
3. Removed message content still returned in messages/transcript → body masked (test `RemovedMessage_IsMasked`).
4. Duplicate reports spam → 409 (test `Report_DuplicateOpen_Conflicts`).
5. Disputed deal blocks a new deal on reactivated listing → must not (test `Dispute_FreesListingForNewDeal`).

---

### Task 1: Model + migration
Files: Domain/Marketplace (Enums, Entities: Report, ModerationAction, new fields), DataAccess/MarketplaceModel, User entity, `src/startup/marketplace_migration_2.sql`, Tests/Marketplace/ModelTests.
- [ ] RED: `Report_EnumsSnakeCase`, `Disputed_DoesNotBlockNewOpenDeal` (index). GREEN: implement. Full suite.

### Task 2: Neutral disputes + terms + private seller (backend)
Files: Deals/DealService, Reviews/ReviewService, Listings/ListingService, Messaging (open conversation gate), new `Terms/TermsService` + `MarketController` (Terms endpoints), MarketplaceException code, filter.
- [ ] RED tests: `Dispute_EndsDealAsDisputed_OpensReviews_ArchivesListing`, `Dispute_FreesListingForNewDeal`, `Review_AllowedOnDisputedDeal`, `TermsRequired_ForCreateListing_OpenConversation_Propose_Accept`, `AcceptTerms_WrongVersion_Validation`, `Create_SellWithoutPrivateDeclaration_Validation`, API `TermsRequired_Returns409WithCode`.
- [ ] GREEN, full suite.

### Task 3: Reports + moderation actions (user side)
Files: Reports/ReportService (+DTOs, Rules), ReportSnapshotBuilder, ReportsController (`POST api/Reports`, `GET api/Reports/Mine`, `GET api/Reports/Rules`, `GET api/Moderation/AgainstMe`, `POST api/Moderation/AgainstMe/Seen`); remove ModerationCase*, old moderation controller, review Report endpoint.
- [ ] RED: `ReportListing_ByNonOwner`, `ReportListing_ByOwner_Forbidden`, `ReportMessage_OnlyParticipant_NotOwnOrSystem`, `ReportReview_OnlyReviewee_FreezesReview`, `Report_DuplicateOpen_Conflicts`, `Report_ReasonTooShort_Validation`, `Mine_ShowsOutcome`, `AgainstMe_DoesNotRevealReporter`.

### Task 4: Admin report handling
Files: Reports/AdminReportService, AdminReportsController (`GET api/Admin/Reports`, `GET api/Admin/Reports/{id}`, `POST api/Admin/Reports/{id}/Resolve {decision, rule, statement}`).
- [ ] RED: `NonAdmin_Forbidden_EvenModerator`, `Remove_Listing_SetsRemoved_CancelsPreShipmentDeal_CreatesAction`, `Remove_Message_Masks`, `Remove_Review_HidesAndUnfreezes`, `NoViolation_UnfreezesReview_NoAction`, `Resolve_Twice_Conflicts`, `Remove_RequiresStatement`, `RemovedListing_NotSearchable_NotReactivatable`, `RemovedMessage_IsMasked`.

### Task 5: Frontend
Files: types/const/api, report overlay (rule chips), report buttons (listing, message long-press, review), Settings → Reports screen (2 tabs + badge), terms overlay gate on Market tab, private-seller checkbox + label, dispute UI wording, removed states; delete in-app moderation screen.
- [ ] tsc-check + lint, then emulator check.

### Task 6: Coffer.Manager Reports view
Files: `Coffer.Manager/reports/api.py`, `reports/view.py`, `initialize.py` (register view).
- [ ] `python -m py_compile`; `api.py` unit test against a stub (`reports/test_api.py`) with `unittest` + monkeypatched `requests`.
- [ ] Live check against local API.

### Task 7: DB migration + E2E
- [ ] Back up DB, apply migration_2, emulator: report listing/message, Manager resolve, user sees outcome & action; dispute flow via API.
