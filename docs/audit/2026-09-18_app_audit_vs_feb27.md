# App Audit vs. Feb 27 Requirements

**Date:** 2026-09-18
**Branch:** `9Feb_1730`
**Auditor:** Claude (read-only, code-level evidence)

---

## 1. Route Inventory

| Route | Component | Supabase Tables (p0012_rotary) |
|---|---|---|
| `/login` | Login.tsx | (Supabase Auth only) |
| `/access-denied` | AccessDenied.tsx | none |
| `/` | Home.tsx | club_settings |
| `/profile-hub` | hubs/ProfileHub.tsx | none (nav only) |
| `/club-hub` | hubs/ClubHub.tsx | none (nav only) |
| `/connect-grow` | hubs/ConnectGrowHub.tsx | none (nav only) |
| `/service-gallery` | hubs/ServiceGalleryHub.tsx | none (nav only) |
| `/stories-bulletins` | hubs/StoriesBulletinsHub.tsx | none (nav only) |
| `/my-data` | placeholder/MyData.tsx | members, member_social_media |
| `/members` | placeholder/Members.tsx | members |
| `/members/:id` | MemberDetail.tsx | members, member_social_media |
| `/leadership` | placeholder/Leadership.tsx | (placeholder) |
| `/calendar` | placeholder/CalendarPage.tsx | calendar_events, club_settings, attendance_plans |
| `/stories` | placeholder/Stories.tsx | stories |
| `/stories/:slug` | StoryDetail.tsx | stories |
| `/bulletins` | placeholder/Bulletins.tsx | bulletins |
| `/bulletins/:slug` | BulletinDetail.tsx | bulletins |
| `/selfies` | placeholder/Selfies.tsx | service_selfies |
| `/message` | placeholder/Message.tsx | members |
| `/sponsors` | placeholder/Sponsors.tsx | (placeholder) |
| `/club-info` | placeholder/ClubInfo.tsx | club_settings |
| `/birthdays` | placeholder/Birthdays.tsx | members |
| `/settings` | Settings.tsx | members, club_settings |
| `/refer` | ReferSomeone.tsx | leads, lead_activities, members |
| `/prospective-members` | ProspectiveMembers.tsx | leads, members |
| `/attendance-plans` | AttendancePlans.tsx | attendance_plans, attendance_plan_history, calendar_events |
| `/deposit-ideas` | DepositIdeas.tsx | notes |
| `/scorecard` | Scorecard.tsx | members, club_settings, volunteer_hours, stories, fundraiser_campaigns |
| `/suggestions` | Suggestions.tsx (redirect to /deposit-ideas) | member_suggestions |
| `/leads` | admin/EZLeads.tsx | leads, members |
| `/leads/:id` | admin/LeadDetail.tsx | leads, lead_activities, members |
| `/admin/add-event` | placeholder/admin/AddEvent.tsx | calendar_events |
| `/admin/leadership-actions` | admin/LeadershipActions.tsx | leadership_actions, leadership_action_notes, notes, idea_jar, members |
| `/admin/fundraiser` | admin/Fundraiser.tsx | fundraiser_campaigns |
| `/fundraiser/:id` | FundraiserDetail.tsx | fundraiser_campaigns, fundraiser_notes, notes, members |
| `/admin/attendance` | placeholder/admin/Attendance.tsx | attendance_records, members |
| `/admin/members` | placeholder/admin/ManageMembers.tsx | members |
| `/admin/stories/new` | admin/StoryForm.tsx | stories |
| `/admin/stories/:slug` | admin/StoryForm.tsx | stories |
| `/admin/bulletins/new` | admin/BulletinForm.tsx | bulletins |
| `/admin/bulletins/:slug` | admin/BulletinForm.tsx | bulletins |
| `/share/story/:slug` | PublicStory.tsx (public) | stories, club_settings |
| `/share/bulletin/:slug` | PublicBulletin.tsx (public) | bulletins, club_settings |

**Note:** Many routes under `placeholder/` use the `PlaceholderPage` wrapper or are early-stage implementations. They render functional UI but may not be the "final" version intended by the Feb 27 plan.

---

## 2. Audit Table

| # | Item | Status | Evidence | Gap |
|---|---|---|---|---|
| **A. Header / Global** | | | | |
| 1 | WhatsApp share in header | **DONE** | `Layout.tsx:56-63` — WhatsApp button in header (via `onWhatsAppClick` prop); `BottomNav.tsx:52-61` — WhatsApp Chat button in bottom nav; `Home.tsx` passes `club_settings.whatsapp_group_link` to Layout | |
| 2 | Group texting removed | **DONE** | No group-texting feature exists anywhere in `src/`. The only `sms:` links are 1:1 text buttons on `MemberDetail.tsx:100`, `LeadDetail.tsx:310`, and `placeholder/Message.tsx:71`. No bulk SMS send UI. | |
| 3 | Sign-out lives only in Settings | **DONE** | `signOut` is called only in `Settings.tsx:186` (button at `Settings.tsx:461`). No sign-out button in `Layout.tsx` or `BottomNav.tsx`. | |
| 4 | Redundant bottom-bar settings removed | **DONE** | `BottomNav.tsx:35-39` — nav items are Home, Members, Calendar, Scorecard. No Settings icon. Settings gear moved to header in `Layout.tsx:64-71`. | |
| **B. Login** | | | | |
| 5 | Google-based login | **DONE** | `Login.tsx:36-52` — `supabase.auth.signInWithOAuth({ provider: 'google' })` with full button UI at line 265-288. | |
| 6 | Non-member routed to "Join Rotary" / "Refer a Friend" | **MISSING** | `AuthContext.tsx:32` — if no member record found after auth, user is signed out with error message "Your email is not registered..." and redirected. `AccessDenied.tsx` shows "Contact Admin" (mailto) and "Try a Different Email" — no "Join Rotary" or "Refer a Friend" links. | Add "Join Rotary" and "Refer a Friend" CTAs to `AccessDenied.tsx` instead of just "Contact Admin". |
| 7 | Magic link and email/password functional alongside Google | **DONE** | `Login.tsx:138-161` — magic link via `signInWithOtp`; `Login.tsx:72-96` — email/password via `signInWithPassword`; `Login.tsx:98-136` — password setup via `signUp`. All three paths coexist with Google. | |
| **C. Home — Four-Card Layout** | | | | |
| 8 | Four cards using "tabbed tiles" pattern | **DONE** | `Home.tsx` renders two tabs (Home / Club Admin). Home tab shows 4 NavCards in a CardGrid: Profile Hub (`/profile-hub`), Club Hub (`/club-hub`), Connect & Grow (`/connect-grow`), Service Gallery (`/service-gallery`). Each hub is a sub-nav with its own NavCards. | |
| 9 | Per-card share points (email/WhatsApp) | **MISSING** | No per-card share buttons on the Home NavCards or within the hub pages. Share functionality exists only on individual stories/bulletins (`StoryDetail.tsx`, `BulletinDetail.tsx` via Web Share API) and on `ClubInfo.tsx:86` (share meeting info). No email/WhatsApp share points on profile, attendance, or connect cards. | Add share icons to hub cards where sharing makes sense (Club Info, Refer a Friend, Stories). |
| **D. My Profile & Attendance** | | | | |
| 10 | Optional social-media fields on profile | **DONE** | `member_social_media` table (migration `20260227120000`). `placeholder/MyData.tsx:162,296,310` reads/writes `member_social_media`. `MemberDetail.tsx:66-74` displays social links in accordion. Platforms: dynamically stored (platform + url per row). | |
| 11 | Social links displayed on member list pages | **MISSING** | `placeholder/Members.tsx` does not query or display `member_social_media`. `MemberDetail.tsx:316-338` shows social media in an accordion, but only on the individual detail page. The member list/directory has no social indicators. | Add social-link icons or indicators to the members list view. |
| 12 | Attendance RSVP with timestamp | **DONE** | `AttendancePlans.tsx:210-226` — upserts `attendance_plans` with `updated_at: new Date().toISOString()`. History tracked in `attendance_plan_history` (insert on every toggle). | |
| 13 | RSVP deadline: end of Friday before the meeting | **DONE** | `AttendancePlans.tsx:45-61` — `isMeetingLocked()` calculates Friday before the meeting date, checks `nowMT >= deadlineDateMT + ' 23:59:00'` in Mountain Time. `lib/attendanceUtils.ts:1-5` has a configurable `daysBeforeDeadline` parameter (default 5 days). `Settings.tsx:715-716` exposes `rsvp_deadline_days` as admin-editable club setting. | |
| 14 | Data privacy: default visibility | **DONE** | `Settings.tsx:20` — `share_contact_info` defaults to `true` (opt-out model: shared by default). `MemberDetail.tsx:188-209` — contact sections hidden when `share_contact_info === false`. `placeholder/MyData.tsx:776-783` — toggle in profile edit. Note: this is opt-out (visible by default), not opt-in. | |
| **E. Club Hub** | | | | |
| 15 | Speaker name and topic on upcoming meetings | **PARTIAL** | `placeholder/CalendarPage.tsx:23-25` defines `speaker_name`, `speaker_topic`, `speaker_bio` fields. Lines 293-304 render them. Migration `20260227120100_add_speaker_to_events.sql` adds columns. However, the Calendar page is in `placeholder/` and the `MeetingOpsCard.tsx` (admin upcoming meetings section) does **not** display speaker info — it shows role assignments only. | Surface speaker info in `MeetingOpsCard.tsx` upcoming meetings and ensure CalendarPage is promoted from placeholder. |
| 16 | Shareable meeting/location link | **PARTIAL** | `placeholder/ClubInfo.tsx:86-155` has `handleShareMeetingInfo()` that shares meeting time, place, and a Google Maps URL via Web Share API. However, ClubInfo is in `placeholder/` and the share generates a text blob, not a deep-linkable URL pointing back to the app. | Promote ClubInfo from placeholder; consider generating a stable shareable URL. |
| 17 | Pre-assigned weekly roles visible; notification hook | **PARTIAL** | `MeetingOpsCard.tsx` — admin can assign Pledge, Four-Way Test, Prayer/Thought roles per meeting date using `meeting_assignments` table. Assignments visible in the admin card. **But:** no member-facing view of "you are assigned to X this week" outside admin. No push/email notification hook — the only notifications in the app are client-side localStorage toggles (`Settings.tsx:21-22,127-130`). | Add member-facing role assignment visibility (e.g., on CalendarPage or Home). Build notification delivery (push or email). |
| **F. Connect & Grow** | | | | |
| 18 | Current contents inventory | **DONE (inventory)** | `hubs/ConnectGrowHub.tsx` links to Members (`/members`) and Refer Someone (`/refer`). `ConnectGrowCard.tsx` (home widget) has member search + "Refer a Friend" button. On Home admin tab: `GrowthPipelineCard.tsx` shows lead pipeline summary. | |
| 19 | Join Rotary / Refer a Friend flows | **PARTIAL** | "Refer a Friend" exists: `ReferSomeone.tsx` (full form submitting to `leads` table) and `ConnectGrowCard.tsx` (button linking to `/refer` or external GHL form via `ghl_referral_form_url`). **"Join Rotary" does not exist** — no page, route, or link with that name. `AccessDenied.tsx` (where non-members land) has no Join Rotary flow. | Create a "Join Rotary" page/flow or external link, and add it to `AccessDenied.tsx` and `ConnectGrowHub`. |
| **G. Service Gallery / Stories** | | | | |
| 20 | Story submission with event selection + auto-filled metadata | **MISSING** | `admin/StoryForm.tsx` creates stories with title, body, images, and publish toggle. No event selection dropdown. No auto-fill of date/location/event name from `calendar_events`. Selfies (`placeholder/Selfies.tsx`) also have no event association — just image + caption. | Add event picker to StoryForm that auto-fills metadata from `calendar_events`. |
| 21 | Approval workflow routes to Public Image Chair | **PARTIAL** | `SelfieApprovalCard.tsx` implements approve/reject workflow for service selfies (`service_selfies.status`). Any leader can approve — there is no routing specifically to the Public Image Chair role. Stories (`StoryForm.tsx`) have publish/draft toggle but no approval queue — admin publishes directly. | Route selfie approvals to PI Chair specifically; add story approval queue under Leadership Actions. |
| 22 | Publish-to-social/blog with scheduling | **MISSING** | `SelfieApprovalCard.tsx` has a "GHL Social Planner" section that is explicitly marked "Coming Soon" (disabled). No scheduling UI, no GHL social-post API call, no blog publish endpoint. | Implement GHL Social Planner integration or alternative publish-to-social flow. |
| **H. Club Admin** | | | | |
| 23 | "Leadership Actions" exists as a section | **DONE** | `admin/LeadershipActions.tsx` — full CRUD with three tabs: All Actions, My Actions, Idea Jar. Route: `/admin/leadership-actions`. Linked from Home admin tab. | |
| 24 | Public Image approvals under Leadership Actions; no separate PI section | **PARTIAL** | Selfie approvals live in `SelfieApprovalCard.tsx` on the Home admin tab — **not** under Leadership Actions. There is no separate "Public Image" section/route, which is correct. But the approvals are on the Home admin tab rather than under Leadership Actions as specified. | Move selfie/story approval queue into Leadership Actions, or confirm current placement is acceptable. |
| 25 | Responsible committee routing; My Actions / All Actions views | **PARTIAL** | `LeadershipActions.tsx` has "All Actions" and "My Actions" tabs (filters by `assigned_to` matching current member). Actions have `assigned_to` (single member) and `poc_members` (multi-select). **No "Responsible Committee" field** — assignment is to individual members, not committees. The `committees` concept exists in members data but is not linked to actions. | Add committee field to leadership actions if committee-based routing is required. |
| 26 | Leadership Actions notifications | **MISSING** | No notification system exists. `Settings.tsx` has localStorage-only toggle stubs for "Meeting reminders" and "New stories" — these don't trigger actual notifications. No push notifications, no email sends, no "new story needs review" / "survey feedback requires action" / "idea jar" alerts. | Build notification delivery system (push notifications via service worker, or email via Netlify function). |
| 27 | Admin pages use "open-box card" pattern consistently | **DONE** | All admin cards (`MeetingOpsCard`, `InsightDashboardCard`, `GrowthPipelineCard`, `CampaignHubCard`, `SelfieApprovalCard`) use the same collapsible card pattern: header with icon + title + chevron, `isOpen` state toggle, content div that shows/hides. Consistent across all five admin cards. | |
| 28 | Task management in Supabase, not GHL | **DONE** | `leadership_actions` table in `p0012_rotary` (migration `20260222070926`). All CRUD in `LeadershipActions.tsx` goes to Supabase. No GHL task/pipeline integration. `idea_jar` is also in Supabase. | |
| **I. Surveys and GHL Integration** | | | | |
| 29 | Post-meeting survey link from app | **DONE** | `PostEventSurvey.tsx` — in-app star-rating survey (1-5) for meetings. Rendered on Home page via `ClubhouseCard.tsx`. Admin activates via `MeetingOpsCard.tsx:553-598`. Survey is native to the app (Supabase `post_event_surveys` + `post_event_responses`), **not** a GHL survey link. No external GHL survey URL. | |
| 30 | Survey results stored in Supabase | **DONE** | `post_event_surveys` table (migration `20260226120100`). `post_event_responses` table stores individual ratings + comments. Write path: `PostEventSurvey.tsx` inserts responses. Read path: `InsightDashboardCard.tsx` aggregates ratings and displays comments. `weekly_surveys` + `survey_responses` handle pre-meeting pulse surveys separately. | |
| 31 | Text-based meeting reminders via GHL | **MISSING** | No code path sends meeting reminders. `Settings.tsx:21` has a `meetingReminders` localStorage toggle but it controls nothing — no backend trigger, no GHL API call, no Netlify function for sending texts. The GHL integration (`netlify/functions/`) handles OAuth and API proxy only, with no reminder-specific endpoint. | Implement meeting reminder sends via GHL API (likely a new Netlify function triggered on schedule). |
| 32 | GHL env vars in netlify/functions | **DONE (inventory)** | `_ghl-client.mjs:9` — `process.env.SUPABASE_URL`; `:10` — `process.env.SUPABASE_SERVICE_ROLE_KEY`; `:99` — `process.env.GHL_CLIENT_ID`; `:100` — `process.env.GHL_CLIENT_SECRET`. `ghl-auth-init.mjs:73` — `GHL_CLIENT_ID`; `:74` — `GHL_REDIRECT_URI`. `ghl-callback.mjs:60` — `GHL_CLIENT_ID`; `:61` — `GHL_CLIENT_SECRET`; `:64` — `GHL_REDIRECT_URI`. `ghl-proxy.mjs:41` — `GHL_DEFAULT_LOCATION_ID`. All 6 env vars: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GHL_CLIENT_ID`, `GHL_CLIENT_SECRET`, `GHL_REDIRECT_URI`, `GHL_DEFAULT_LOCATION_ID`. Code paths reachable from UI via `src/lib/ghl.ts` (Settings page admin connect flow). | |
| **J. Known Defects** | | | | |
| 33 | `_ghl-client.mjs` validateAdminSession table | **DONE (correct)** | `_ghl-client.mjs:32-36` — queries `.schema('p0012_rotary').from('members')`. Does **not** reference the dead `0012-sr-members` table. Correct schema usage confirmed. | |
| 34 | Create-from-scratch migration for p0012_rotary.members | **MISSING** | No migration in `supabase/migrations/` contains `CREATE TABLE` for `p0012_rotary.members`. The 27 migration files reference the table (ALTER, policies, FKs) but assume it already exists. Needs DB confirmation — the table likely exists from an earlier setup outside version control. | Add a baseline migration or document that the members table is managed outside the migration set. |

---

## 3. Summary Counts

| Status | Count | Items |
|---|---|---|
| **DONE** | 18 | 1, 2, 3, 4, 5, 7, 8, 10, 12, 13, 14, 18, 23, 27, 28, 29, 30, 33 |
| **PARTIAL** | 7 | 15, 16, 17, 19, 21, 24, 25 |
| **MISSING** | 8 | 6, 9, 11, 20, 22, 26, 31, 34 |
| **UNCLEAR** | 0 | |
| **Inventory only** | 1 | 32 |
| **Total** | 34 | |

---

## 4. Recommended Build Order (Top 5 MISSING/PARTIAL)

| Rank | Item(s) | Size | Reasoning |
|---|---|---|---|
| 1 | **#6 + #19: Non-member routing + "Join Rotary" flow** | S | Highest member-visible impact — every non-member who tries to sign in currently hits a dead end. Adding two CTA buttons to `AccessDenied.tsx` and a simple Join Rotary page/link is a small change with outsized first-impression impact. |
| 2 | **#26: Leadership Actions notifications** | L | The notification system is the backbone for items 17 (role assignment alerts), 21 (approval routing), and 31 (meeting reminders). Building the delivery mechanism (push via service worker + optional email via Netlify function) unblocks three other PARTIAL/MISSING items. |
| 3 | **#17: Member-facing role assignments + #15: Speaker info on meetings** | M | Members currently can't see their weekly assignments or who's speaking. Surfacing `meeting_assignments` and `speaker_name/topic` on the Calendar page (already partially built in placeholder) gives members a reason to check the app before each meeting. |
| 4 | **#20 + #21: Story submission with event metadata + approval queue** | M | The stories module exists but lacks the event-linked workflow and approval routing that would make it a real content pipeline. Adding event selection to StoryForm and an approval queue under Leadership Actions completes the content lifecycle. |
| 5 | **#9: Per-card share points** | S | Adding share buttons (Web Share API, already used in StoryDetail) to relevant hub cards is a small UI change that makes the app a growth tool — members can invite friends by sharing club info, meeting details, or referral links directly from the home screen. |

---

## 5. Things Found Not on the Feb 27 List

1. **Extensive CRM/lead pipeline** — `EZLeads.tsx`, `LeadDetail.tsx`, `ContactListView.tsx` implement a full kanban pipeline with stage tracking, tags, bulk actions, and CSV export. Not mentioned in Feb 27 requirements.
2. **Fundraiser management system** — `CampaignHubCard.tsx`, `FundraiserDetail.tsx` with document uploads, progress bars, assigned members, and notes. Appears to be a standalone feature.
3. **Pre-meeting pulse surveys (WeeklyPulse)** — A separate survey system (`weekly_surveys` / `survey_responses`) for pre-meeting engagement questions, distinct from the post-meeting survey. Includes trend charts in `PulseChart.tsx`.
4. **Scorecard dashboard** — Full club health dashboard (`Scorecard.tsx`) with membership goals, service hours, impact stories, and fundraiser progress. Not referenced in Feb 27.
5. **Sponsor carousel** — `CampaignHubCard.tsx` loads and displays sponsor logos from `sponsors` table. Sponsor page route exists at `/sponsors` (placeholder).
6. **Idea Jar** — `LeadershipActions.tsx` Idea Jar tab and `idea_jar` table provide a separate ideation workflow beyond the Notes/Ideas/Suggestions page. Comments from surveys can be promoted to Idea Jar items.
7. **Public sharing pages** — `/share/story/:slug` and `/share/bulletin/:slug` are unauthenticated public endpoints. Good for social sharing but not mentioned in requirements.
8. **Deposit Ideas (Notes/Ideas/Suggestions)** — `DepositIdeas.tsx` is a full submission + review system with categories and approval flags, beyond a simple suggestion box.
9. **12 placeholder pages** — `src/pages/placeholder/` contains functional but early-stage versions of Members, Calendar, MyData, ClubInfo, Birthdays, Selfies, Stories, Bulletins, Message, Sponsors, Leadership, and admin pages (AddEvent, Attendance, ManageMembers). These are live in the router but not yet promoted.
10. **Hard-coded dev credentials** — `Login.tsx:499-502` contains `testleader@sandyrotary.test / TestPassword123` and `testmember@sandyrotary.test / TestPassword123!`, gated by `VITE_DEV_LOGIN` env var. Low risk in production but worth noting.
