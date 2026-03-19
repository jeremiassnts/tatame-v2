# Tatame — MVP Screen Inventory

This document describes every screen needed for the MVP, organized by application and user flow. Each screen includes its purpose, key elements, and relevant business rules.

---

## Mobile App (React Native + Expo)

### Onboarding Flow

Shown only on first app launch (no `userType` in localStorage). After completion, the selected user type is persisted to localStorage and the user is sent to the auth flow. On subsequent launches, the app skips directly to auth.

#### M-ONBOARD-01: Welcome

- First screen the user sees on a fresh install
- App logo and branding
- Brief tagline / welcome message
- "Continue" button → M-ONBOARD-02

#### M-ONBOARD-02: User Type Selection

- "What best describes you?"
- Three options with icons and brief descriptions: Manager, Instructor, Student
- Tapping an option highlights it
- "Continue" button (enabled after selection)
- Saves selected user type to localStorage
- After selection → M-AUTH-01

---

### Authentication Flow

On app launch, if `userType` exists in localStorage but user is not logged in, the auth flow starts here. The user type from onboarding is carried through signup and used to assign the role after first login.

#### M-AUTH-01: Welcome / Landing

- App logo and branding
- "Sign In" button
- "Sign Up" button

#### M-AUTH-02: Sign Up

- Clerk-managed sign up screen (email or social login)
- Name, email, password fields (or social auth options)
- After successful signup → automatic sign in → role assignment using userType from localStorage → role-specific onboarding

#### M-AUTH-03: Sign In

- Clerk-managed sign in screen
- Email + password or social login
- Forgot password link
- After successful login:
  - If user has no active role → assign role from localStorage userType → role-specific onboarding
  - If user already has a role → role-specific home

---

### Forced Update Screen

#### M-SYS-01: Force Update

- Shown when the app version is below the minimum required
- Message: "A new version is available. Please update to continue."
- Single button: "Update Now" → opens app store link
- Blocks all app usage until updated

---

### Manager Flow

#### M-MGR-01: Create Academy

- Shown after role selection if user is a manager with no academy
- Fields: academy name, logo (image picker), address, contact email, contact phone, founded date
- "Create Academy" button
- After creation → M-MGR-02

#### M-MGR-02: Manager Home / Dashboard

- Academy overview: name, logo, quick stats
- Stats: total active members, pending requests, classes today, active subscription plans
- Quick action buttons: view pending requests, view today's schedule
- Navigation to all manager sections

#### M-MGR-03: Academy Settings

- Edit academy info: name, logo, address, contact email, contact phone, founded date
- View academy details
- Save changes

#### M-MGR-04: Member List

- List of all academy members (instructors + students)
- Filter by role (all, instructors, students)
- Filter by status (active, pending, blocked)
- Each row: name, profile image, role, belt (for students), membership status
- Tap → M-MGR-05

#### M-MGR-05: Member Detail

- Full member profile: name, photo, email, phone, instagram, birth date
- Role and membership status
- Current belt + stripes (for students)
- Membership history (joined/left dates)
- Actions (depending on status):
  - Pending → Approve / Reject buttons
  - Active → Block button
  - Blocked → Unblock button

#### M-MGR-06: Pending Requests

- List of pending membership requests
- Each row: name, profile image, role requested, request date
- Swipe or tap actions: Approve / Reject
- Rejecting blocks the user from re-requesting

#### M-MGR-07: Class Schedule (Weekly View)

- Weekly calendar view showing all classes
- Each class shows: name, time, instructor name, day of week
- Tap on a class → M-MGR-08
- Floating action button → M-MGR-09 (create class)

#### M-MGR-08: Class Detail

- Class info: name, description, instructor, day of week, start/end time, capacity
- List of today's check-ins (students who checked in)
- Number of spots remaining (if capacity is set)
- Edit button → M-MGR-09 (edit mode)
- Delete button with confirmation

#### M-MGR-09: Create / Edit Class

- Fields: name, description, instructor (custom modal select from academy instructors), day of week (custom modal select), start time, end time, capacity (optional, null = unlimited)
- Save / Update button
- When creating, option to create for multiple days at once (batch creation)

#### M-MGR-10: Subscription Plans List

- List of all subscription plans created by this manager
- Each row: plan name, price, recurrence, weekly check-in limit, active/inactive badge
- Tap → M-MGR-11
- Floating action button → M-MGR-12

#### M-MGR-11: Subscription Plan Detail

- Plan info: name, price, recurrence (months), weekly check-in limit (or "Unlimited"), status
- Number of active subscribers on this plan
- Edit button → M-MGR-12 (edit mode)
- Toggle active/inactive (deactivating doesn't affect existing subscribers)

#### M-MGR-12: Create / Edit Subscription Plan

- Fields: plan name, price (currency input), recurrence in months (custom modal select: 1, 3, 6, 12), weekly check-in limit (number input, toggle for unlimited)
- Save / Update button

#### M-MGR-13: Student Subscriptions Overview

- List of all students with their subscription status
- Each row: student name, plan name, status (active/expired/cancelled), expires at
- Filter: all, active, expired, pending payment
- Tap → M-MGR-14

#### M-MGR-14: Student Subscription Detail

- Student info + current subscription details
- Payment history for this subscription
- Current payment status
- "Confirm Payment" button (for manual payment)
  - Opens confirmation: amount, reference month, optional notes
  - Creates a payment record with `method = manual`

#### M-MGR-15: Graduation Management

- List of students with their current belt + stripes
- Each row: student name, belt color indicator, stripe count
- Tap → M-MGR-16

#### M-MGR-16: Promote Student

- Student's current belt + stripes displayed
- Promotion form:
  - New belt (custom modal select, shows only valid next belts)
  - New stripe count (0-4, or 0-10 for black belt)
  - Notes (optional)
- "Promote" button with confirmation
- Promotion history list below the form

#### M-MGR-17: Financial Overview

- Summary: total revenue this month, pending payments count
- Payment history list (all students)
- Each row: student name, amount, date, method (manual), reference month
- Filter by month

#### M-MGR-18: Check-in Attendance View

- Select a class from today's schedule
- List of students who checked in for this class today
- Check-in timestamp for each student
- Total check-ins vs capacity

---

### Instructor Flow

#### M-INS-01: Search Academy

- Shown after role selection if instructor has no academy
- Search bar to find academies by name
- List of results: academy name, logo, address
- Tap → M-INS-02

#### M-INS-02: Academy Detail (Pre-Join)

- Academy info: name, logo, address, contact email, phone
- "Request to Join" button
- After request → M-INS-03

#### M-INS-03: Pending Approval

- Status screen: "Your request to join [Academy Name] is pending approval"
- Option to cancel the request
- Auto-refreshes or pull-to-refresh to check status
- After approval → M-INS-04

#### M-INS-04: Instructor Home

- Academy name + info
- Today's classes (taught by this instructor)
- Quick stats: total classes this week, students checked in today
- Navigation to instructor sections

#### M-INS-05: My Classes (Weekly View)

- Weekly view showing only this instructor's classes
- Each class: name, time, day, student count
- Tap → M-INS-06
- Floating action button → M-INS-07

#### M-INS-06: Class Detail (Instructor View)

- Same as M-MGR-08 but scoped to instructor's own class
- Class info, today's check-ins, spots remaining
- Edit button → M-INS-07 (own classes only)
- Cannot delete (only manager can)

#### M-INS-07: Create / Edit Class (Instructor)

- Same fields as M-MGR-09, but instructor is auto-set to current user
- Can only edit own classes

#### M-INS-08: Class Attendance

- Select one of instructor's classes
- List of students who checked in today
- Check-in timestamp, total count vs capacity

#### M-INS-09: Student Graduation (Instructor)

- List of students in the academy with current belt + stripes
- Tap to promote → same form as M-MGR-16

#### M-INS-10: Academy Info

- View-only academy details: name, logo, address, contact info
- "Leave Academy" button with confirmation
- After leaving → M-INS-01

---

### Student Flow

#### M-STU-01: Search Academy

- Same as M-INS-01: search bar, list of academies
- Tap → M-STU-02

#### M-STU-02: Academy Detail (Pre-Join)

- Academy info: name, logo, address, contact info
- "Request to Join" button
- After request → M-STU-03

#### M-STU-03: Pending Approval

- Same as M-INS-03: pending status screen
- Cancel request option
- After approval → M-STU-04

#### M-STU-04: Register Initial Belt

- Shown once after academy approval (if no current belt)
- Belt selection (custom modal select: white, blue, purple, brown, black)
- Stripe count (0-4, or 0-10 for black)
- "This is your current belt. Only your instructor or manager can change it after this."
- Confirm button → M-STU-05

#### M-STU-05: Student Home

- Academy name + info
- Today's classes with check-in buttons
- Current subscription status (plan name, expires at, or "No active subscription")
- Weekly check-in progress: "3/5 check-ins used this week" or "Unlimited"
- Current belt + stripes display
- Payment warning banner (if within grace period)

#### M-STU-06: Class Schedule (Weekly View)

- Full weekly schedule of all academy classes
- Each class: name, instructor, time, spots remaining (if capacity set)
- Classes available for check-in are highlighted
- Tap → M-STU-07

#### M-STU-07: Class Detail (Student View)

- Class info: name, description, instructor, time, capacity
- Check-in button (enabled only if within 12h window and before class end)
- Check-in button states:
  - "Check In" (available)
  - "Checked In" (already checked in today, disabled)
  - "Class Full" (capacity reached, disabled)
  - "Weekly Limit Reached" (disabled)
  - "Subscription Required" (no active subscription, disabled)
  - "Payment Overdue" (within grace period, shows warning but allows check-in)
  - "Payment Required" (past grace period, disabled)
  - "Not Available Yet" (outside 12h window, shows countdown)

#### M-STU-08: Subscription Plans

- List of available subscription plans for this academy
- Each plan: name, price, recurrence, weekly check-in limit (or "Unlimited")
- Current plan highlighted (if any)
- Tap → M-STU-09

#### M-STU-09: Subscription Plan Detail

- Plan details: name, price, recurrence, weekly check-in limit
- Current subscription info (if on this plan)
- "Select This Plan" button (if no active subscription or switching)
- After selection → student subscription becomes active, starts at today, expires based on recurrence

#### M-STU-10: My Subscription

- Current subscription details: plan name, start date, expiry date, status
- Weekly check-in usage: "3/5 this week" or "Unlimited"
- Payment history list
- Payment status: last payment date, next expected payment

#### M-STU-11: My Check-in History

- List of all check-ins, grouped by week
- Each entry: class name, date, time checked in
- Weekly summary: total check-ins that week

#### M-STU-12: My Belt History

- Current belt + stripes prominently displayed
- Promotion history: date, from → to (belt + stripes), promoted by, notes
- Timeline or list view

#### M-STU-13: Academy Info (Student View)

- View-only academy details: name, logo, address, contact info
- "Leave Academy" button with confirmation
- After leaving → M-STU-01

---

### Shared Screens (All Roles)

#### M-SHARED-01: Profile

- View and edit personal info: name, phone, instagram, birth date
- Profile image (synced from Clerk, read-only or editable via Clerk)
- Email (read-only, managed by Clerk)
- Current role displayed (read-only)

#### M-SHARED-02: Notifications / Alerts

- Membership approval/rejection notifications
- Payment reminders (for students)
- Check-in confirmations
- Belt promotion notifications
- This can be a simple list for MVP — no push notifications required initially

---

## Web Panel (Next.js 16)

### Public Pages (Landing)

#### W-PUB-01: Landing Page

- Hero section: product pitch, app screenshots, call-to-action
- Features section: key benefits for academy managers
- Pricing section: free vs paid plans (academy subscription, not student plans)
- Testimonials section (can be placeholder for MVP)
- Footer: links, contact info, social media
- "Get Started" / "Download App" call-to-action buttons

#### W-PUB-02: Pricing Page

- Detailed comparison of academy subscription plans (free vs paid)
- Feature matrix
- FAQ section
- Call-to-action

#### W-PUB-03: About Page

- Product story, mission
- Team info (optional for MVP)
- Contact information

---

### Manager Dashboard (Authenticated)

#### W-DASH-01: Dashboard Home

- Academy overview with key metrics
- Cards: total members, pending requests, classes today, revenue this month, overdue payments
- Charts: member growth, check-in activity, revenue trend (can be simple for MVP)
- Quick actions: approve pending requests, view today's schedule

#### W-DASH-02: Members Management

- Full members table with sorting, filtering, search
- Columns: name, role, belt (students), status, joined date, subscription status
- Bulk actions: approve/reject multiple pending requests
- Click row → side panel or modal with member detail (same info as M-MGR-05)

#### W-DASH-03: Class Schedule Management

- Full weekly calendar/grid view
- Drag-and-drop or click to create/edit classes (enhanced UX vs mobile)
- Class detail panel on click
- Batch creation: create a class for multiple days at once

#### W-DASH-04: Subscription Plans Management

- Table of all plans with inline editing
- Create new plan form
- View subscribers per plan
- Activate/deactivate toggle

#### W-DASH-05: Financial Management

- Revenue summary: this month, last month, trend
- Payment records table: student, amount, date, method, reference month, notes
- Filter by month, student, payment method
- "Confirm Payment" button for manual payments
- Export to CSV (nice-to-have for MVP)

#### W-DASH-06: Graduation Management

- Student belt overview table
- Promote student form (same as M-MGR-16)
- Promotion history per student

#### W-DASH-07: Check-in Reports

- Check-in activity by date range
- Per-class attendance stats
- Per-student attendance history
- Most popular classes, peak hours

#### W-DASH-08: Academy Settings

- Same as M-MGR-03: edit academy info
- Enhanced with logo upload, richer form fields

---

## Screen Count Summary

| Section | Count |
|---|---|
| Mobile — Onboarding Flow | 2 |
| Mobile — Auth Flow | 3 |
| Mobile — System | 1 |
| Mobile — Manager | 18 |
| Mobile — Instructor | 10 |
| Mobile — Student | 13 |
| Mobile — Shared | 2 |
| Web — Public | 3 |
| Web — Dashboard | 8 |
| **Total** | **60** |

---

## Notes for Design

- **Custom modal select**: used wherever a dropdown/picker is needed (day of week, belt, instructor, plan recurrence). Opens a modal with a scrollable list. Apply consistently across all screens.
- **Belt color system**: white, blue, purple, brown, black. Use actual belt colors in the UI for visual recognition. Stripes can be shown as small indicators (dots or lines) next to the belt.
- **Check-in button states**: M-STU-07 has 8 distinct states — design should make each state clearly distinguishable (color, icon, text).
- **Payment warning**: when a student is in the 3-day grace period, show a persistent but non-blocking warning banner on M-STU-05 and M-STU-07.
- **Role-based navigation**: the bottom tab bar or navigation structure changes based on the user's role. Design a consistent navigation pattern that adapts per role.
- **Empty states**: design empty states for: no members yet, no classes created, no check-ins today, no payment history, no subscription selected, no promotion history.
- **Offline indicator**: when the device is offline, show a subtle but visible indicator. Cached data is still viewable, but action buttons should be disabled.
