# TAT-55 Review Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply all issues found in the code review of PR #16 (TAT-55 announcements).

**Architecture:** Fixes span the API layer (security, validation), service layer (ownership check), and mobile layer (form state, hooks, shared utils).

**Tech Stack:** Hono/Express API, Drizzle ORM, React Native + Expo, React Query, react-hook-form, TypeScript.

---

## Files Changed

| File | Change |
|------|--------|
| `apps/api/src/modules/announcement/announcement.routes.ts` | Add academy context to `GET /:id`; cap `limit` |
| `apps/api/src/modules/announcement/announcement.service.ts` | Add `academyId` param to `getById` |
| `apps/api/src/modules/announcement/announcement.service.test.ts` | Add cross-academy test + pagination page-2 test |
| `apps/mobile/app/(app)/(manager)/(more)/create-announcement.tsx` | Fix edit form race condition + imageUrl state + canGoBack |
| `apps/mobile/app/(app)/(manager)/(more)/announcements.tsx` | Remove useAnnouncementCount; derive total from pages[0]; canGoBack; import formatAnnouncementDate |
| `apps/mobile/app/(app)/(manager)/(more)/announcement/[id].tsx` | Import formatAnnouncementDate from shared util |
| `apps/mobile/app/(app)/(student)/(announcements)/index.tsx` | Remove useAnnouncementCount; derive total from pages[0] |
| `apps/mobile/app/(app)/(instructor)/(announcements)/index.tsx` | Remove useAnnouncementCount; derive total from pages[0] |
| `apps/mobile/lib/hooks/use-announcements.ts` | Remove useAnnouncementCount export |
| `apps/mobile/lib/utils/date.ts` | NEW — shared formatAnnouncementDate + formatShortAnnouncementDate |
| `apps/mobile/components/announcements/AnnouncementDetailContent.tsx` | Import from shared util |
| `apps/mobile/components/announcements/AnnouncementListCard.tsx` | Import from shared util |
| `apps/mobile/components/announcements/AnnouncementFeedCard.tsx` | Import from shared util; truncate body preview |

---

### Task 1: Fix security issue — `GET /:id` cross-academy leak + cap `limit`

**Files:**
- Modify: `apps/api/src/modules/announcement/announcement.service.ts`
- Modify: `apps/api/src/modules/announcement/announcement.routes.ts`

- [ ] **Step 1: Update `getById` in service to accept and validate `academyId`**

In `apps/api/src/modules/announcement/announcement.service.ts`, change `getById`:

```typescript
async getById(id: string, academyId: string): Promise<AnnouncementWithAuthor> {
  const row = await this.repo.findById(id);
  if (!row) throw new HttpError(404, "Announcement not found");
  if (row.academyId !== academyId)
    throw new HttpError(403, "Announcement does not belong to this academy");
  return row;
}
```

- [ ] **Step 2: Update `GET /:id` route — add academy context + pass academyId to service**

In `apps/api/src/modules/announcement/announcement.routes.ts`, replace the `GET /:id` handler:

```typescript
// GET /:id — detail
announcementRouter.get(
  "/:id",
  authorize(Role.Manager, Role.Instructor, Role.Student),
  attachActiveAcademyContext,
  requireActiveAcademy,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      if (!id) {
        res.status(400).json({ error: "id is required" });
        return;
      }
      const academyId = req.appAuth!.activeAcademyId!;
      const service = buildService();
      const announcement = await service.getById(id, academyId);
      res.json(announcement);
    } catch (e) {
      next(e);
    }
  },
);
```

- [ ] **Step 3: Cap `limit` query param in `GET /` route**

In `announcement.routes.ts`, change the limit line in the `GET /` handler from:
```typescript
const limit = typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) : 20;
```
to:
```typescript
const rawLimit = typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) : 20;
const limit = Math.min(Math.max(rawLimit, 1), 50);
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/announcement/announcement.service.ts \
        apps/api/src/modules/announcement/announcement.routes.ts
git commit -m "fix(tat-55): add academy ownership check to GET /announcements/:id and cap limit"
```

---

### Task 2: Add missing tests

**Files:**
- Modify: `apps/api/src/modules/announcement/announcement.service.test.ts`

- [ ] **Step 1: Add cross-academy test for `getById`**

Add inside `describe("getById", ...)`:

```typescript
it("throws 403 if announcement belongs to a different academy", async () => {
  const { service } = setup();
  const created = await service.create({
    academyId: "academy-1",
    authorId: "user-1",
    title: "Hello",
    body: "World",
  });
  await expect(service.getById(created.id, "academy-2")).rejects.toMatchObject({
    statusCode: 403,
  });
});
```

Also update the existing passing test to pass `academyId`:
```typescript
it("returns an announcement by id with author name", async () => {
  const { service } = setup();
  const created = await service.create({
    academyId: "academy-1",
    authorId: "user-1",
    title: "Hello",
    body: "World",
  });
  const found = await service.getById(created.id, "academy-1");
  expect(found.id).toBe(created.id);
  expect(found.authorName).toBeDefined();
});

it("throws 404 if not found", async () => {
  const { service } = setup();
  await expect(service.getById("nonexistent", "academy-1")).rejects.toThrow(HttpError);
  await expect(service.getById("nonexistent", "academy-1")).rejects.toMatchObject({
    statusCode: 404,
  });
});
```

- [ ] **Step 2: Add pagination page-2 test**

Add inside `describe("listByAcademy", ...)`:

```typescript
it("returns correct items on second page using cursor", async () => {
  const { service } = setup();
  for (let i = 0; i < 5; i++) {
    await service.create({
      academyId: "academy-1",
      authorId: "user-1",
      title: `Title ${i}`,
      body: "body",
    });
  }
  const page1 = await service.listByAcademy("academy-1", undefined, 3);
  expect(page1.items).toHaveLength(3);
  expect(page1.nextCursor).not.toBeNull();

  const page2 = await service.listByAcademy("academy-1", page1.nextCursor!, 3);
  expect(page2.items).toHaveLength(2);
  expect(page2.nextCursor).toBeNull();

  const allIds = [...page1.items, ...page2.items].map((i) => i.id);
  expect(new Set(allIds).size).toBe(5); // no duplicates
});
```

- [ ] **Step 3: Run tests**

```bash
cd /Volumes/ExternalDisk1/repos/tatame-v2
pnpm --filter @tatame/api test:unit
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/announcement/announcement.service.test.ts
git commit -m "test(tat-55): add cross-academy getById rejection and pagination page-2 tests"
```

---

### Task 3: Fix edit form race condition + imageUrl state (mobile)

**Files:**
- Modify: `apps/mobile/app/(app)/(manager)/(more)/create-announcement.tsx`

- [ ] **Step 1: Add `useEffect` import and fix form initialization**

Replace the `useState` import line to also include `useEffect`:
```typescript
import { useState, useEffect } from "react";
```

Change `useForm` to have empty defaults (not dependent on `existing`), and add `reset` to destructuring:
```typescript
const {
  control,
  handleSubmit,
  reset,
  formState: { isSubmitting },
} = useForm<FormData>({
  defaultValues: {
    title: "",
    body: "",
  },
});
```

Change `useState` for `imageUrl` to always start as `null`:
```typescript
const [imageUrl, setImageUrl] = useState<string | null>(null);
```

Add a `useEffect` after the `useState` call to populate form when `existing` loads:
```typescript
useEffect(() => {
  if (existing) {
    reset({ title: existing.title, body: existing.body });
    setImageUrl(existing.imageUrl ?? null);
  }
}, [existing, reset]);
```

- [ ] **Step 2: Add `canGoBack` guard to back button**

Change:
```tsx
<Pressable onPress={() => router.back()}>
```
to:
```tsx
<Pressable onPress={() => router.canGoBack() ? router.back() : router.replace("/(app)/(manager)/(more)/announcements")}>
```

- [ ] **Step 3: Typecheck**

```bash
pnpm turbo run typecheck
```

Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/app/\(app\)/\(manager\)/\(more\)/create-announcement.tsx
git commit -m "fix(tat-55): fix edit form blank fields and imageUrl race condition on create-announcement screen"
```

---

### Task 4: Extract shared date utils (mobile)

**Files:**
- Create: `apps/mobile/lib/utils/date.ts`
- Modify: `apps/mobile/components/announcements/AnnouncementDetailContent.tsx`
- Modify: `apps/mobile/components/announcements/AnnouncementListCard.tsx`
- Modify: `apps/mobile/components/announcements/AnnouncementFeedCard.tsx`
- Modify: `apps/mobile/app/(app)/(manager)/(more)/announcements.tsx`
- Modify: `apps/mobile/app/(app)/(manager)/(more)/announcement/[id].tsx`

- [ ] **Step 1: Create shared date util**

Create `apps/mobile/lib/utils/date.ts`:
```typescript
const PT_MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export function formatAnnouncementDate(dateStr: string): string {
  const d = new Date(dateStr);
  const day = d.getDate().toString().padStart(2, "0");
  const month = PT_MONTHS[d.getMonth()] ?? "";
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
}

export function formatShortAnnouncementDate(dateStr: string): string {
  const d = new Date(dateStr);
  const day = d.getDate().toString().padStart(2, "0");
  const month = PT_MONTHS[d.getMonth()] ?? "";
  return `${day} ${month}`;
}
```

- [ ] **Step 2: Update `AnnouncementDetailContent.tsx`**

Remove the local `PT_MONTHS` and `formatAnnouncementDate` definition. Add import at top:
```typescript
import { formatAnnouncementDate } from "@/lib/utils/date";
```
(The function is already named `formatAnnouncementDate` — no other code changes needed.)

- [ ] **Step 3: Update `AnnouncementListCard.tsx`**

Remove local `PT_MONTHS` and `formatAnnouncementDate`. Add import:
```typescript
import { formatAnnouncementDate } from "@/lib/utils/date";
```

- [ ] **Step 4: Update `AnnouncementFeedCard.tsx`**

Remove local `PT_MONTHS` and `formatShortDate`. Add import:
```typescript
import { formatShortAnnouncementDate } from "@/lib/utils/date";
```
Rename `formatShortDate(createdAt)` call to `formatShortAnnouncementDate(createdAt)`.

Also truncate body preview to 80 chars. Change the subtitle text to:
```tsx
{formatShortAnnouncementDate(createdAt)} · {body.length > 80 ? body.slice(0, 80) + "…" : body}
```

- [ ] **Step 5: Update manager `announcements.tsx`**

Remove local `PT_MONTHS` and `formatDate`. Add import:
```typescript
import { formatAnnouncementDate } from "@/lib/utils/date";
```
Replace `formatDate(createdAt)` call in `AnnouncementCard` with `formatAnnouncementDate(createdAt)`.

Also add `canGoBack` guard on back button:
```tsx
<Pressable onPress={() => router.canGoBack() ? router.back() : router.replace("/(app)/(manager)/(more)")}>
```

- [ ] **Step 6: Update manager `announcement/[id].tsx`**

Remove local `PT_MONTHS` and `formatDate`. Add import:
```typescript
import { formatAnnouncementDate } from "@/lib/utils/date";
```
Replace `formatDate(announcement.createdAt)` with `formatAnnouncementDate(announcement.createdAt)`.

- [ ] **Step 7: Typecheck**

```bash
pnpm turbo run typecheck
```

Expected: zero errors.

- [ ] **Step 8: Commit**

```bash
git add apps/mobile/lib/utils/date.ts \
        "apps/mobile/components/announcements/AnnouncementDetailContent.tsx" \
        "apps/mobile/components/announcements/AnnouncementListCard.tsx" \
        "apps/mobile/components/announcements/AnnouncementFeedCard.tsx" \
        "apps/mobile/app/(app)/(manager)/(more)/announcements.tsx" \
        "apps/mobile/app/(app)/(manager)/(more)/announcement/[id].tsx"
git commit -m "refactor(tat-55): extract shared announcement date formatters to lib/utils/date.ts"
```

---

### Task 5: Remove redundant `useAnnouncementCount` hook

**Files:**
- Modify: `apps/mobile/lib/hooks/use-announcements.ts`
- Modify: `apps/mobile/app/(app)/(manager)/(more)/announcements.tsx`
- Modify: `apps/mobile/app/(app)/(student)/(announcements)/index.tsx`
- Modify: `apps/mobile/app/(app)/(instructor)/(announcements)/index.tsx`

- [ ] **Step 1: Remove `useAnnouncementCount` from `use-announcements.ts`**

Delete the entire `useAnnouncementCount` function (lines 55-65). Also remove the `useAnnouncementCount` invalidation calls from `useCreateAnnouncement`, `useUpdateAnnouncement`, and `useDeleteAnnouncement` mutations:

In `useCreateAnnouncement` `onSuccess`, remove:
```typescript
queryClient.invalidateQueries({ queryKey: ["announcement-count"] });
```

In `useUpdateAnnouncement` `onSuccess`, remove:
```typescript
queryClient.invalidateQueries({ queryKey: ["announcement-count"] });
```

In `useDeleteAnnouncement` `onSuccess`, remove:
```typescript
queryClient.invalidateQueries({ queryKey: ["announcement-count"] });
```

- [ ] **Step 2: Update manager `announcements.tsx`**

Remove `useAnnouncementCount` import and usage. Change the total derivation:
```typescript
// Remove:
const { data: countData } = useAnnouncementCount(academyId);
// ...
const total = countData ?? 0;

// Replace with:
const total = data?.pages[0]?.total ?? 0;
```

- [ ] **Step 3: Update student `(announcements)/index.tsx`**

Same change:
```typescript
// Remove useAnnouncementCount import and:
const { data: countData } = useAnnouncementCount(academyId);
// ...
const total = countData ?? 0;

// Replace with:
const total = data?.pages[0]?.total ?? 0;
```

- [ ] **Step 4: Update instructor `(announcements)/index.tsx`**

Same change as Step 3.

- [ ] **Step 5: Typecheck**

```bash
pnpm turbo run typecheck
```

Expected: zero errors.

- [ ] **Step 6: Commit**

```bash
git add "apps/mobile/lib/hooks/use-announcements.ts" \
        "apps/mobile/app/(app)/(manager)/(more)/announcements.tsx" \
        "apps/mobile/app/(app)/(student)/(announcements)/index.tsx" \
        "apps/mobile/app/(app)/(instructor)/(announcements)/index.tsx"
git commit -m "refactor(tat-55): remove useAnnouncementCount, derive total from pages[0].total"
```

---

### Final: Push to remote

- [ ] **Push branch**

```bash
git push origin feature/tat-55-announcements
```
