# Tutorials Screen (TAT-112)

## Overview

Add a tutorials screen to the mobile app for managers, showing global video tutorials about how to use the app. Videos are stored in the database and open externally in YouTube.

## Database

New table `tutorials`:

| Column | Type | Description |
|---|---|---|
| id | uuid (PK, default gen_random_uuid) | Unique ID |
| title | text (not null) | Tutorial title |
| description | text (not null) | Short description |
| youtube_url | text (not null) | YouTube video URL |
| thumbnail_url | text (not null) | Thumbnail image URL |
| duration_seconds | integer (not null) | Video duration in seconds |
| sort_order | smallint (not null, default 0) | Display order (ascending) |
| created_at | timestamp (not null, default now) | Creation timestamp |

- No relation to academies or users — content is global
- Initial data populated via a seed migration
- Managed directly in the database when needed (no admin UI)

## API

New module `tutorial` following the existing pattern (`routes` + `service` + `repository`):

### `GET /tutorials`

- Auth: required (any authenticated user)
- Response: `Tutorial[]` ordered by `sort_order ASC`
- No pagination (small dataset)
- No filters

### Types

```typescript
type Tutorial = {
  id: string;
  title: string;
  description: string;
  youtubeUrl: string;
  thumbnailUrl: string;
  durationSeconds: number;
  sortOrder: number;
  createdAt: string;
};
```

## Mobile

### More Menu (existing: `apps/mobile/app/(app)/(manager)/(more)/index.tsx`)

Add a new `MenuItem` after "Notificacoes":

- Icon: `Youtube` from lucide-react-native, color `#A078E8`
- Title: "Tutoriais"
- Subtitle: "Videos de ajuda e suporte"
- Navigates to: `/(app)/(manager)/(more)/tutorials`

### Layout (existing: `apps/mobile/app/(app)/(manager)/(more)/_layout.tsx`)

Register new `<Stack.Screen name="tutorials" />`.

### Tutorials Screen (new: `apps/mobile/app/(app)/(manager)/(more)/tutorials.tsx`)

Structure matching design (Pencil Node ID: ArS5l):

- **Header**: back button (chevron-left in dark circle) + "Tutoriais" title (Sora 18 bold)
- **Counter**: "X videos disponiveis" in muted text (Inter 14)
- **Tutorial List**: FlatList of TutorialCard components, gap 12
- **TutorialCard**:
  - Thumbnail area (height 180): Image from `thumbnailUrl` with rounded top corners
    - Play button overlay (centered): purple circle (#A078E8) with play icon
    - Duration badge (bottom-right): black semi-transparent bg, white text showing formatted duration (e.g., "3:42")
  - Card body (padding 16, gap 8):
    - Title: Sora 15 semibold, white
    - Description: Inter 13 normal, muted (#8A8A8A), 2 lines max
  - Card styling: bg #1A1A1A, border #2A2A2A, rounded 16, clip
- **onPress**: `Linking.openURL(tutorial.youtubeUrl)` — opens YouTube app or browser

### Hook

`useTutorials()` — TanStack Query hook fetching `GET /tutorials`, following existing patterns (e.g., `useAcademyStats`).

## Email & Subscription Success (separate issue)

A separate Linear issue (TAT-XXX) covers:

1. **Email `pro-activated.tsx`**: Add step "4." to "Proximos passos" section:
   > "Acesse os **Tutoriais** no menu Mais do app para aprender a usar todas as funcionalidades"

2. **Web subscription success screen** (`apps/web/app/cadastro/page.tsx`): Add similar text after the authenticated/checkout success state indicating tutorials are available in the app.

## Non-goals

- No admin panel for tutorial management
- No embedded video player (YouTube opens externally)
- No unread/progress tracking
- No student/guardian/instructor access (manager only for now)
- No categories or search
