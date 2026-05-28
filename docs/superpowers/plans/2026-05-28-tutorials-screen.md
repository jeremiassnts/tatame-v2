# Tutorials Screen (TAT-112) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a tutorials screen to the manager's "More" menu that lists video tutorials from the database, opening YouTube externally on tap.

**Architecture:** New `tutorials` table in PostgreSQL, new `tutorial` API module (read-only), new mobile screen with FlatList of tutorial cards. Follows existing patterns: Drizzle schema, Express route + service + repository, TanStack Query hook.

**Tech Stack:** Drizzle ORM, Express, React Native (Expo Router), TanStack Query, lucide-react-native

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `packages/db/src/schema/tutorials.ts` | Drizzle table definition |
| Modify | `packages/db/src/schema/index.ts` | Re-export tutorials table |
| Create | `packages/db/drizzle/0019_tutorials.sql` | SQL migration |
| Modify | `packages/db/drizzle/meta/_journal.json` | Register migration |
| Create | `apps/api/src/modules/tutorial/tutorial.repository.ts` | Repository interface + types |
| Create | `apps/api/src/modules/tutorial/tutorial.repository.postgres.ts` | Postgres implementation |
| Create | `apps/api/src/modules/tutorial/tutorial.repository.in-memory.ts` | In-memory impl for tests |
| Create | `apps/api/src/modules/tutorial/tutorial.service.ts` | Service layer |
| Create | `apps/api/src/modules/tutorial/tutorial.service.test.ts` | Service unit tests |
| Create | `apps/api/src/modules/tutorial/tutorial.routes.ts` | Express router |
| Modify | `apps/api/src/router.ts` | Register tutorial route |
| Create | `apps/mobile/lib/hooks/use-tutorials.ts` | TanStack Query hook |
| Create | `apps/mobile/app/(app)/(manager)/(more)/tutorials.tsx` | Tutorials screen |
| Modify | `apps/mobile/app/(app)/(manager)/(more)/index.tsx` | Add menu item |
| Modify | `apps/mobile/app/(app)/(manager)/(more)/_layout.tsx` | Register screen in stack |

---

### Task 1: Database Schema & Migration

**Files:**
- Create: `packages/db/src/schema/tutorials.ts`
- Modify: `packages/db/src/schema/index.ts`
- Create: `packages/db/drizzle/0019_tutorials.sql`
- Modify: `packages/db/drizzle/meta/_journal.json`

- [ ] **Step 1: Create the Drizzle table definition**

Create `packages/db/src/schema/tutorials.ts`:

```typescript
import { integer, pgTable, smallint, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const tutorials = pgTable("tutorials", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  youtubeUrl: text("youtube_url").notNull(),
  thumbnailUrl: text("thumbnail_url").notNull(),
  durationSeconds: integer("duration_seconds").notNull(),
  sortOrder: smallint("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
```

- [ ] **Step 2: Re-export from schema index**

In `packages/db/src/schema/index.ts`, add at the end:

```typescript
export { tutorials } from "./tutorials.js";
```

Note: The schema/index.ts currently has all tables inline. Since we're adding a new table in a separate file, we export it from index. Check that `packages/db/src/index.ts` (or `client.ts`) imports from `./schema/index.js` — it already does via `import * as schema`.

- [ ] **Step 3: Create the SQL migration file**

Create `packages/db/drizzle/0019_tutorials.sql`:

```sql
CREATE TABLE "tutorials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"youtube_url" text NOT NULL,
	"thumbnail_url" text NOT NULL,
	"duration_seconds" integer NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Seed initial tutorials
INSERT INTO "tutorials" ("title", "description", "youtube_url", "thumbnail_url", "duration_seconds", "sort_order") VALUES
('Como cadastrar novos alunos', 'Aprenda o passo a passo para adicionar alunos, preencher dados e ativar matrículas na sua academia.', 'https://www.youtube.com/watch?v=PLACEHOLDER_1', 'https://img.youtube.com/vi/PLACEHOLDER_1/maxresdefault.jpg', 222, 1),
('Como criar e gerenciar aulas', 'Veja como montar a grade de aulas, definir horários e atribuir instrutores.', 'https://www.youtube.com/watch?v=PLACEHOLDER_2', 'https://img.youtube.com/vi/PLACEHOLDER_2/maxresdefault.jpg', 185, 2),
('Como gerenciar pagamentos', 'Entenda como registrar pagamentos, criar planos e acompanhar o financeiro.', 'https://www.youtube.com/watch?v=PLACEHOLDER_3', 'https://img.youtube.com/vi/PLACEHOLDER_3/maxresdefault.jpg', 310, 3),
('Como promover faixas', 'Saiba como registrar graduações e manter o histórico de faixas dos alunos.', 'https://www.youtube.com/watch?v=PLACEHOLDER_4', 'https://img.youtube.com/vi/PLACEHOLDER_4/maxresdefault.jpg', 148, 4);
```

Note: Replace `PLACEHOLDER_X` with actual YouTube video IDs when the videos are produced. The seed data ensures the feature works immediately.

- [ ] **Step 4: Register migration in journal**

Add a new entry at the end of the `entries` array in `packages/db/drizzle/meta/_journal.json`:

```json
{
  "idx": 19,
  "version": "7",
  "when": 1780200000000,
  "tag": "0019_tutorials",
  "breakpoints": true
}
```

- [ ] **Step 5: Verify the DB package builds**

Run: `cd packages/db && pnpm build`
Expected: Compiles with no errors.

- [ ] **Step 6: Commit**

```bash
git add packages/db/src/schema/tutorials.ts packages/db/src/schema/index.ts packages/db/drizzle/0019_tutorials.sql packages/db/drizzle/meta/_journal.json
git commit -m "feat(db): add tutorials table and seed migration (TAT-112)"
```

---

### Task 2: API — Repository Interface & Implementations

**Files:**
- Create: `apps/api/src/modules/tutorial/tutorial.repository.ts`
- Create: `apps/api/src/modules/tutorial/tutorial.repository.postgres.ts`
- Create: `apps/api/src/modules/tutorial/tutorial.repository.in-memory.ts`

- [ ] **Step 1: Create repository interface**

Create `apps/api/src/modules/tutorial/tutorial.repository.ts`:

```typescript
import type { InferSelectModel } from "drizzle-orm";
import type { tutorials } from "@tatame/db";

export type TutorialRow = InferSelectModel<typeof tutorials>;

export interface ITutorialRepository {
  findAll(): Promise<TutorialRow[]>;
}
```

- [ ] **Step 2: Create Postgres repository**

Create `apps/api/src/modules/tutorial/tutorial.repository.postgres.ts`:

```typescript
import { asc } from "drizzle-orm";
import { tutorials, type Database } from "@tatame/db";
import type { ITutorialRepository, TutorialRow } from "./tutorial.repository.js";

export class PostgresTutorialRepository implements ITutorialRepository {
  constructor(private readonly db: Database) {}

  async findAll(): Promise<TutorialRow[]> {
    return this.db
      .select()
      .from(tutorials)
      .orderBy(asc(tutorials.sortOrder));
  }
}
```

- [ ] **Step 3: Create in-memory repository**

Create `apps/api/src/modules/tutorial/tutorial.repository.in-memory.ts`:

```typescript
import { randomUUID } from "node:crypto";
import type { ITutorialRepository, TutorialRow } from "./tutorial.repository.js";

export class InMemoryTutorialRepository implements ITutorialRepository {
  rows: TutorialRow[] = [];

  async findAll(): Promise<TutorialRow[]> {
    return [...this.rows].sort((a, b) => a.sortOrder - b.sortOrder);
  }

  /** Test helper to seed data */
  seed(data: Omit<TutorialRow, "id" | "createdAt">): TutorialRow {
    const row: TutorialRow = {
      id: randomUUID(),
      createdAt: new Date(),
      ...data,
    };
    this.rows.push(row);
    return row;
  }
}
```

- [ ] **Step 4: Verify API builds**

Run: `cd apps/api && pnpm exec tsc --noEmit`
Expected: Compiles with no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/tutorial/
git commit -m "feat(api): add tutorial repository interface and implementations (TAT-112)"
```

---

### Task 3: API — Service & Tests

**Files:**
- Create: `apps/api/src/modules/tutorial/tutorial.service.ts`
- Create: `apps/api/src/modules/tutorial/tutorial.service.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/modules/tutorial/tutorial.service.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { InMemoryTutorialRepository } from "./tutorial.repository.in-memory.js";
import { TutorialService } from "./tutorial.service.js";

function setup() {
  const repo = new InMemoryTutorialRepository();
  const service = new TutorialService(repo);
  return { repo, service };
}

describe("TutorialService", () => {
  describe("listAll", () => {
    it("returns an empty array when no tutorials exist", async () => {
      const { service } = setup();
      const result = await service.listAll();
      expect(result).toEqual([]);
    });

    it("returns tutorials sorted by sortOrder", async () => {
      const { repo, service } = setup();
      repo.seed({
        title: "Second",
        description: "desc",
        youtubeUrl: "https://youtube.com/watch?v=2",
        thumbnailUrl: "https://img.youtube.com/vi/2/maxresdefault.jpg",
        durationSeconds: 120,
        sortOrder: 2,
      });
      repo.seed({
        title: "First",
        description: "desc",
        youtubeUrl: "https://youtube.com/watch?v=1",
        thumbnailUrl: "https://img.youtube.com/vi/1/maxresdefault.jpg",
        durationSeconds: 60,
        sortOrder: 1,
      });

      const result = await service.listAll();
      expect(result).toHaveLength(2);
      expect(result[0]!.title).toBe("First");
      expect(result[1]!.title).toBe("Second");
    });

    it("returns all fields for each tutorial", async () => {
      const { repo, service } = setup();
      repo.seed({
        title: "Test Tutorial",
        description: "A test description",
        youtubeUrl: "https://youtube.com/watch?v=abc",
        thumbnailUrl: "https://img.youtube.com/vi/abc/maxresdefault.jpg",
        durationSeconds: 200,
        sortOrder: 1,
      });

      const [tutorial] = await service.listAll();
      expect(tutorial).toMatchObject({
        title: "Test Tutorial",
        description: "A test description",
        youtubeUrl: "https://youtube.com/watch?v=abc",
        thumbnailUrl: "https://img.youtube.com/vi/abc/maxresdefault.jpg",
        durationSeconds: 200,
        sortOrder: 1,
      });
      expect(tutorial!.id).toBeDefined();
      expect(tutorial!.createdAt).toBeInstanceOf(Date);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && pnpm vitest run --project unit src/modules/tutorial/tutorial.service.test.ts`
Expected: FAIL — `TutorialService` not found (module doesn't exist yet).

- [ ] **Step 3: Write the service implementation**

Create `apps/api/src/modules/tutorial/tutorial.service.ts`:

```typescript
import type { ITutorialRepository, TutorialRow } from "./tutorial.repository.js";

export class TutorialService {
  constructor(private readonly repo: ITutorialRepository) {}

  async listAll(): Promise<TutorialRow[]> {
    return this.repo.findAll();
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/api && pnpm vitest run --project unit src/modules/tutorial/tutorial.service.test.ts`
Expected: 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/tutorial/tutorial.service.ts apps/api/src/modules/tutorial/tutorial.service.test.ts
git commit -m "feat(api): add tutorial service with tests (TAT-112)"
```

---

### Task 4: API — Route & Router Registration

**Files:**
- Create: `apps/api/src/modules/tutorial/tutorial.routes.ts`
- Modify: `apps/api/src/router.ts`

- [ ] **Step 1: Create the route handler**

Create `apps/api/src/modules/tutorial/tutorial.routes.ts`:

```typescript
import { Router } from "express";
import { Role } from "@tatame/types";
import { getDb } from "../../lib/db.js";
import { authorize } from "../../middleware/authorize.js";
import { PostgresTutorialRepository } from "./tutorial.repository.postgres.js";
import { TutorialService } from "./tutorial.service.js";

export const tutorialRouter = Router();

function buildService() {
  return new TutorialService(new PostgresTutorialRepository(getDb()));
}

// GET / — list all tutorials
tutorialRouter.get(
  "/",
  authorize(Role.Manager, Role.Instructor, Role.Student, Role.Guardian),
  async (_req, res, next) => {
    try {
      const service = buildService();
      const tutorials = await service.listAll();
      res.json(tutorials);
    } catch (e) {
      next(e);
    }
  },
);
```

Note: No `attachActiveAcademyContext` or `requireActiveAcademy` needed — tutorials are global, not academy-scoped. Authorization is still required so only authenticated users can access.

- [ ] **Step 2: Register in the main router**

In `apps/api/src/router.ts`, add the import near the other module imports:

```typescript
import { tutorialRouter } from "./modules/tutorial/tutorial.routes.js";
```

And add the route after the last `apiRouter.use(...)` line (before or after `/admin`):

```typescript
apiRouter.use("/tutorials", tutorialRouter);
```

- [ ] **Step 3: Verify API builds**

Run: `cd apps/api && pnpm exec tsc --noEmit`
Expected: Compiles with no errors.

- [ ] **Step 4: Run all API unit tests**

Run: `cd apps/api && pnpm vitest run --project unit`
Expected: All tests pass (existing + 3 new tutorial tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/tutorial/tutorial.routes.ts apps/api/src/router.ts
git commit -m "feat(api): add GET /tutorials route (TAT-112)"
```

---

### Task 5: Mobile — Hook & Types

**Files:**
- Create: `apps/mobile/lib/hooks/use-tutorials.ts`

- [ ] **Step 1: Create the TanStack Query hook**

Create `apps/mobile/lib/hooks/use-tutorials.ts`:

```typescript
import { useApi } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";

export type TutorialItem = {
  id: string;
  title: string;
  description: string;
  youtubeUrl: string;
  thumbnailUrl: string;
  durationSeconds: number;
  sortOrder: number;
  createdAt: string;
};

export function useTutorials() {
  const api = useApi();
  return useQuery({
    queryKey: ["tutorials"],
    queryFn: () => api.get<TutorialItem[]>("/tutorials"),
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/lib/hooks/use-tutorials.ts
git commit -m "feat(mobile): add useTutorials hook (TAT-112)"
```

---

### Task 6: Mobile — Tutorials Screen

**Files:**
- Create: `apps/mobile/app/(app)/(manager)/(more)/tutorials.tsx`

- [ ] **Step 1: Create the tutorials screen**

Create `apps/mobile/app/(app)/(manager)/(more)/tutorials.tsx`:

```tsx
import { useTutorials, type TutorialItem } from "@/lib/hooks/use-tutorials";
import { useRouter } from "expo-router";
import { ChevronLeft, Play } from "lucide-react-native";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Linking,
  Pressable,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const ACCENT = "#A078E8";

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function TutorialCard({ item }: { item: TutorialItem }) {
  return (
    <Pressable
      onPress={() => Linking.openURL(item.youtubeUrl)}
      className="overflow-hidden rounded-2xl border border-surface-border bg-surface"
    >
      {/* Thumbnail */}
      <View style={{ height: 180, backgroundColor: "#2A2A2A" }}>
        <Image
          source={{ uri: item.thumbnailUrl }}
          style={{ width: "100%", height: "100%" }}
          resizeMode="cover"
        />
        {/* Play button */}
        <View
          className="absolute items-center justify-center rounded-full"
          style={{
            width: 48,
            height: 48,
            backgroundColor: ACCENT,
            top: "50%",
            left: "50%",
            transform: [{ translateX: -24 }, { translateY: -24 }],
          }}
        >
          <Play size={22} color="#FFFFFF" fill="#FFFFFF" />
        </View>
        {/* Duration badge */}
        <View
          className="absolute rounded-md"
          style={{
            bottom: 8,
            right: 8,
            backgroundColor: "#000000CC",
            paddingHorizontal: 8,
            paddingVertical: 4,
          }}
        >
          <Text
            className="font-poppins-semibold text-primary"
            style={{ fontSize: 11 }}
          >
            {formatDuration(item.durationSeconds)}
          </Text>
        </View>
      </View>

      {/* Card body */}
      <View style={{ padding: 16, gap: 8 }}>
        <Text
          className="font-poppins-semibold text-primary"
          style={{ fontSize: 15 }}
          numberOfLines={2}
        >
          {item.title}
        </Text>
        <Text
          className="font-poppins text-xs"
          style={{ color: "#8A8A8A", lineHeight: 18 }}
          numberOfLines={2}
        >
          {item.description}
        </Text>
      </View>
    </Pressable>
  );
}

export default function TutorialsScreen() {
  const router = useRouter();
  const { data: tutorials, isLoading } = useTutorials();

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      {/* Header */}
      <View
        className="flex-row items-center"
        style={{ paddingHorizontal: 24, paddingTop: 8, gap: 12 }}
      >
        <Pressable
          onPress={() => router.back()}
          className="items-center justify-center rounded-xl border border-surface-border bg-surface"
          style={{ width: 40, height: 40 }}
        >
          <ChevronLeft size={20} color="#FFFFFF" />
        </Pressable>
        <Text className="flex-1 font-poppins-bold text-lg text-primary">
          Tutoriais
        </Text>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={ACCENT} />
        </View>
      ) : (
        <FlatList
          data={tutorials ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{
            paddingHorizontal: 24,
            paddingTop: 20,
            paddingBottom: 32,
            gap: 12,
          }}
          ListHeaderComponent={
            <Text
              className="font-poppins-medium"
              style={{ fontSize: 14, color: "#ABABAB", marginBottom: 8 }}
            >
              {tutorials?.length ?? 0} vídeo{(tutorials?.length ?? 0) !== 1 ? "s" : ""}{" "}
              disponíve{(tutorials?.length ?? 0) !== 1 ? "is" : "l"}
            </Text>
          }
          renderItem={({ item }) => <TutorialCard item={item} />}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/app/\(app\)/\(manager\)/\(more\)/tutorials.tsx
git commit -m "feat(mobile): add tutorials screen (TAT-112)"
```

---

### Task 7: Mobile — Wire Up More Menu & Layout

**Files:**
- Modify: `apps/mobile/app/(app)/(manager)/(more)/index.tsx`
- Modify: `apps/mobile/app/(app)/(manager)/(more)/_layout.tsx`

- [ ] **Step 1: Add the Tutorials menu item**

In `apps/mobile/app/(app)/(manager)/(more)/index.tsx`:

1. Add `Youtube` to the lucide imports (line 12 area):

```typescript
import {
  Bell,
  ChevronRight,
  Megaphone,
  UserCheck,
  Youtube,
} from "lucide-react-native";
```

2. Add a new `MenuItem` after the "Notificacoes" item (after line 135, before the closing `</View>` of the menu items section):

```tsx
<MenuItem
  icon={<Youtube size={18} color={ACCENT} />}
  title="Tutoriais"
  subtitle="Vídeos de ajuda e suporte"
  onPress={() => router.push("/(app)/(manager)/(more)/tutorials")}
/>
```

- [ ] **Step 2: Register screen in stack layout**

In `apps/mobile/app/(app)/(manager)/(more)/_layout.tsx`, add a new `Stack.Screen` inside the `<Stack>`:

```tsx
<Stack.Screen name="tutorials" />
```

- [ ] **Step 3: Verify the app compiles**

Run: `cd apps/mobile && pnpm exec tsc --noEmit` (or check that the existing typecheck script passes)
Expected: No type errors. Note: if mobile typecheck is skipped (NativeWind), verify manually by checking the import paths are correct.

- [ ] **Step 4: Run the full test suite**

Run: `pnpm turbo test:unit`
Expected: All tests pass including the 3 new tutorial service tests.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/app/\(app\)/\(manager\)/\(more\)/index.tsx apps/mobile/app/\(app\)/\(manager\)/\(more\)/_layout.tsx
git commit -m "feat(mobile): add tutorials to More menu (TAT-112)"
```

---

### Task 8: Run Migration Locally & Smoke Test

- [ ] **Step 1: Apply the migration**

Run: `cd packages/db && pnpm drizzle-kit push`
Expected: Migration applies successfully, `tutorials` table created with 4 seed rows.

- [ ] **Step 2: Verify seed data**

Connect to the local database and run:
```sql
SELECT id, title, sort_order FROM tutorials ORDER BY sort_order;
```
Expected: 4 rows returned in order.

- [ ] **Step 3: Start the API and test the endpoint**

Run: `cd apps/api && pnpm dev` (in one terminal)

Then curl the endpoint:
```bash
curl -H "Authorization: Bearer <your-dev-token>" http://localhost:3000/tutorials
```
Expected: JSON array with 4 tutorial objects.

- [ ] **Step 4: Start the mobile app and verify**

Run: `cd apps/mobile && pnpm start`

Navigate to: Manager tab bar > Mais > Tutoriais
Expected: Screen shows 4 tutorial cards with thumbnails, titles, descriptions, and duration badges. Tapping a card opens YouTube.

- [ ] **Step 5: Final commit (if any adjustments needed)**

If any adjustments were made during smoke testing, commit them with an appropriate message.
