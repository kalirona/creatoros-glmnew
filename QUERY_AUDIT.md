# CreatorOS — Query Audit

**Scope:** All 60 API route files under `src/app/api/`, the `src/lib/community.ts` service layer, and the 41-model Prisma schema (`prisma/schema.prisma`).
**Method:** Static review of every `db.*` call. Each finding cites the exact file path and line number, includes a code snippet, explains the impact, and proposes a concrete fix.
**Severity legend:** 🔴 Critical (data leak / mass incident) · 🟠 High (broken at modest scale) · 🟡 Medium (degrades as data grows) · 🔵 Low (polish).

---

## 0. Executive Summary

The **`/api/community/*`** surface (members, posts, comments, moderation, invitations, notifications) is generally well-engineered: it consistently scopes by `workspaceId`, paginates with the shared `paginate()` helper, batches relation lookups instead of looping, and wraps counter mutations in `db.$transaction([...])`. These files are the gold standard for the rest of the codebase.

The **`/api/data/*`** surface (analytics, dashboard, courses, products, orders, customers, blog, funnels, pages, page-sections, crm, email, affiliates, membership) is the opposite: it was written without `getContext()` workspace scoping, performs full table scans on every request, mutates records by `id` alone (IDOR), and updates counters across multiple round trips without transactions. These routes are unsafe today and will not scale past a few thousand rows.

The **`/api/ai/*`** surface has a recurring pattern of credit deduction + `creditTransaction.create` performed as two separate awaits — a missing-transaction defect that lets a crash between the two calls silently leak credits.

**Counts at a glance**

| Section | Critical 🔴 | High 🟠 | Medium 🟡 | Low 🔵 |
|---|---:|---:|---:|---:|
| 1. N+1 Query Risks | — | 6 | 2 | — |
| 2. Duplicate Queries | — | — | 3 | — |
| 3. Slow Queries | — | 9 | 11 | 1 |
| 4. Unsafe Queries (IDOR/BOLA) | 18 | 6 | — | — |
| 5. Missing Transactions | — | 7 | 5 | — |
| 6. Over-fetching | — | 7 | 5 | — |
| 7. Missing Pagination | — | 14 | — | — |
| 8. Positive Findings | — | — | — | 11 |

---

## 1. N+1 Query Risks

### 1.1 🟠 `/api/ai/publish-course/route.ts` — nested `for` loop, sequential inserts

**File:** `src/app/api/ai/publish-course/route.ts:43-65`

```ts
for (let mIdx = 0; mIdx < courseData.modules.length; mIdx++) {
  const mod = courseData.modules[mIdx]
  const section = await db.section.create({
    data: { courseId: course.id, title: mod.title || `Module ${mIdx + 1}`, position: mIdx },
  })
  if (Array.isArray(mod.lessons)) {
    for (let lIdx = 0; lIdx < mod.lessons.length; lIdx++) {
      const lesson = mod.lessons[lIdx]
      await db.lesson.create({
        data: { sectionId: section.id, ... },
      })
    }
  }
}
```

**Why N+1:** One `db.section.create()` per module **plus** one `db.lesson.create()` per lesson. A 10-module course with 5 lessons each = 10 + 50 = **60 sequential round trips** to SQLite. Each await blocks the next.

**Fix:** Use Prisma's nested `create` to persist the entire course tree in a single SQL `INSERT` (plus one per table):

```ts
await db.course.create({
  data: {
    workspaceId: workspace.id,
    title: courseData.title || gen.title,
    /* ... */
    sections: {
      create: (courseData.modules || []).map((mod, mIdx) => ({
        title: mod.title || `Module ${mIdx + 1}`,
        position: mIdx,
        lessons: {
          create: (mod.lessons || []).map((lesson, lIdx) => ({
            title: lesson.title || `Lesson ${lIdx + 1}`,
            content: lesson.content || lesson.objective || '',
            type: lesson.type || 'VIDEO',
            duration: lesson.duration || 8,
            position: lIdx,
            isPreview: lIdx === 0,
          })),
        },
      })),
    },
  },
})
```

Wrap in `db.$transaction` (see §5.1).

---

### 1.2 🟠 `/api/ai/landing-page/route.ts` — `for` loop, one insert per section

**File:** `src/app/api/ai/landing-page/route.ts:89-92`

```ts
for (let i = 0; i < data.sections.length; i++) {
  const sec = data.sections[i]
  await db.pageSection.create({ data: { pageId: page.id, type: sec.type, content: JSON.stringify(sec.content), position: i } })
}
```

**Why N+1:** A landing page is exactly 7 sections, but each `pageSection.create` is its own transaction and round trip. Worse, the loop runs *before* the credit deduction at line 95 — if it fails midway, the page exists with partial sections and credits are never charged (or the user is double-charged on retry).

**Fix:** Nested create inside the page insert:

```ts
const page = await db.page.create({
  data: {
    workspaceId: workspace.id, title, slug, type: 'LANDING', /* ... */
    sections: {
      create: data.sections.map((sec, i) => ({
        type: sec.type,
        content: JSON.stringify(sec.content),
        position: i,
      })),
    },
  },
})
```

---

### 1.3 🟠 `/api/data/courses/duplicate/route.ts` — nested `for…of`, sequential inserts

**File:** `src/app/api/data/courses/duplicate/route.ts:33-54`

```ts
for (const section of original.sections) {
  const newSection = await db.section.create({
    data: { courseId: copy.id, title: section.title, position: section.position },
  })
  for (const lesson of section.lessons) {
    await db.lesson.create({
      data: { sectionId: newSection.id, /* ... */ },
    })
  }
}
```

**Why N+1:** Same shape as §1.1. A 20-section course with 6 lessons each = 20 + 120 = **140 sequential inserts**.

**Fix:** Nested `create` (same pattern as §1.1), wrapped in `db.$transaction`.

---

### 1.4 🟠 `/api/data/page-sections/route.ts` — `for` loop re-indexes every section after delete

**File:** `src/app/api/data/page-sections/route.ts:96-99`

```ts
const remaining = await db.pageSection.findMany({ where: { pageId: section.pageId }, orderBy: { position: 'asc' } })
for (let i = 0; i < remaining.length; i++) {
  await db.pageSection.update({ where: { id: remaining[i].id }, data: { position: i } })
}
```

**Why N+1:** One `update` per remaining section. A page with 30 sections = 30 round trips just to renumber after a delete.

**Fix:** Batch with a CASE expression, or — since SQLite has no `UPDATE … FROM` — at minimum use `db.$transaction([...remaining.map((s, i) => db.pageSection.update({ where: { id: s.id }, data: { position: i } }))])` to issue them in a single round trip. Better still: skip renumbering entirely and just enforce `position > deletedPosition` shifts.

---

### 1.5 🟠 `/api/community/transfer-ownership/route.ts` — `Promise.all` of `sendNotification` over all members

**File:** `src/app/api/community/transfer-ownership/route.ts:98-118`

```ts
const allMembers = await db.workspaceMember.findMany({
  where: { workspaceId: ctx.workspaceId, userId: { notIn: [ctx.user.id, target.userId] } },
  select: { userId: true },
})
await Promise.all(
  allMembers.map((m) =>
    sendNotification(m.userId, ctx.workspaceId, 'SYSTEM', /* ... */)
  )
)
```

`sendNotification` (`src/lib/community.ts:126-149`) internally does `await db.notification.create({ ... })`. So `Promise.all` here fans out into N parallel `INSERT`s — one per workspace member. With 1 000 members this is 1 000 simultaneous SQLite writes (and SQLite serialises writers, so they queue).

**Why N+1:** One INSERT per notification, even though every row shares the same `type`, `title`, `body`, `actorId`, `entityType`, `entityId` and only `userId` differs.

**Fix:** Replace the loop with a single batch insert:

```ts
const allMembers = await db.workspaceMember.findMany({ /* ... */ })
if (allMembers.length > 0) {
  await db.notification.createMany({
    data: allMembers.map((m) => ({
      userId: m.userId,
      workspaceId: ctx.workspaceId,
      type: 'SYSTEM',
      title: 'Workspace ownership has changed',
      body: `${target.user.name} is now the owner of this workspace.`,
      actorId: ctx.user.id,
      entityId: target.id,
      entityType: 'WorkspaceMember',
    })),
  })
}
```

One `INSERT … VALUES (…), (…), …` instead of N.

---

### 1.6 🟠 `/api/community/moderation/queue/route.ts` — `Promise.all` of `fetchTargetPreview` over reports

**File:** `src/app/api/community/moderation/queue/route.ts:135-137`

```ts
const targetsWithPreviews = await Promise.all(
  reports.map((r) => fetchTargetPreview(ctx.workspaceId, r.targetType, r.targetId))
)
```

`fetchTargetPreview` (lines 8-53) branches on `targetType` and runs one `findFirst` per report — POST, COMMENT, EVENT, or USER.

**Why N+1:** Up to 20 reports × 1 query each = up to 20 serialised round trips (parallel `Promise.all` still hits SQLite's single-writer lock).

**Fix:** Group reports by `targetType` and issue **four** batched `findMany` queries:

```ts
const byType = groupBy(reports, r => r.targetType)
const [posts, comments, events, members] = await Promise.all([
  byType.POST?.length   ? db.communityPost.findMany({    where: { id: { in: byType.POST.map(r => r.targetId) },   workspaceId }, select: { id: true, title: true, content: true } }) : [],
  byType.COMMENT?.length? db.communityComment.findMany({ where: { id: { in: byType.COMMENT.map(r => r.targetId) }, post: { workspaceId } }, select: { id: true, content: true } }) : [],
  byType.EVENT?.length  ? db.communityEvent.findMany({   where: { id: { in: byType.EVENT.map(r => r.targetId) },   workspaceId }, select: { id: true, title: true, description: true } }) : [],
  byType.USER?.length   ? db.workspaceMember.findMany({  where: { workspaceId, OR: [{ id: { in: byType.USER.map(r => r.targetId) } }, { userId: { in: byType.USER.map(r => r.targetId) } }] }, include: { user: { select: { id: true, name: true } } } }) : [],
])
```

The same pattern is duplicated in `/api/community/moderation/reports/route.ts:174-176` — fix both.

---

### 1.7 🟡 `/api/community/posts/[postId]/comments/[commentId]/route.ts` — BFS descendant count

**File:** `src/app/api/community/posts/[postId]/comments/[commentId]/route.ts:14-26`

```ts
async function countDescendants(commentId: string, postId: string): Promise<number> {
  let count = 0
  let currentLevel: string[] = [commentId]
  while (currentLevel.length > 0) {
    const replies = await db.communityComment.findMany({
      where: { postId, parentId: { in: currentLevel } },
      select: { id: true },
    })
    count += replies.length
    currentLevel = replies.map((r) => r.id)
  }
  return count
}
```

**Why borderline N+1:** One query per depth level. For a 5-level-deep thread that's 5 queries, which is bounded — but each call to `DELETE` invokes it, and there is no upper bound on depth (a hot thread can be 50+ levels deep). The `parentId` index helps, but the round trips still dominate.

**Fix:** Either (a) store a `descendantCount` denormalised column on `CommunityComment` updated by trigger, or (b) load all comments for the post once (`findMany({ where: { postId }, select: { id: true, parentId: true } })`) and count descendants in memory with a Map. Option (b) is one query regardless of depth.

---

### 1.8 🟡 `/api/data/page-sections/route.ts` — `moveUp`/`moveDown` swaps without batching

**File:** `src/app/api/data/page-sections/route.ts:71-72`

```ts
await db.pageSection.update({ where: { id: swap.id }, data: { position: section.position } })
await db.pageSection.update({ where: { id: section.id }, data: { position: newPos } })
```

**Why borderline N+1:** Two sequential updates where one transaction would do. Not strictly N+1, but the same anti-pattern: independent awaits when a single `db.$transaction([...])` would halve the round trips and guarantee atomicity (see §5.6).

---

## 2. Duplicate Queries

### 2.1 🟡 `/api/community/notifications/route.ts` — two `count` queries with overlapping filters

**File:** `src/app/api/community/notifications/route.ts:59-68`

```ts
const [total, unreadCount] = await Promise.all([
  db.notification.count({ where }),
  db.notification.count({
    where: {
      userId: ctx.user.id,
      workspaceId: ctx.workspaceId,
      read: false,
    },
  }),
])
```

**Duplication:** `where` is `{ userId, workspaceId, read?: false }` (depending on `unreadOnly`). The second query hard-codes `read: false` and re-states `userId` + `workspaceId`. The two queries overlap completely when `unreadOnly=true`.

**Fix:** Use `groupBy` to get both counts in one round trip:

```ts
const grouped = await db.notification.groupBy({
  by: ['read'],
  where: { userId: ctx.user.id, workspaceId: ctx.workspaceId },
  _count: { _all: true },
})
const total = grouped.reduce((s, g) => s + g._count._all, 0)
const unreadCount = grouped.find(g => g.read === false)?._count._all ?? 0
```

---

### 2.2 🟡 `/api/community/moderation/reports/[reportId]/route.ts` — `fetchTargetFull` re-runs query already in `findFirst`

**File:** `src/app/api/community/moderation/reports/[reportId]/route.ts:74-95`

```ts
const report = await db.moderationReport.findFirst({
  where: { id: reportId, workspaceId: ctx.workspaceId },
})
/* ... */
const target = await fetchTargetFull(ctx.workspaceId, report.targetType, report.targetId)
```

`fetchTargetFull` (lines 14-55) does **another** `findFirst` per target type — but for POST/COMMENT/EVENT targets, the `ModerationReport` row already contains `targetType` + `targetId`. Not a true duplicate of the *same* query, but for POST/COMMENT reports the same lookup is performed in two routes (`reports` list and `reports/[reportId]`), with the same target row fetched each time.

**Fix:** If preview data is needed, fetch it once and cache; better, add a polymorphic relation or a denormalised `targetTitle`/`targetPreview` on `ModerationReport` so the target's title is available without a second query.

---

### 2.3 🟡 `/api/data/dashboard/route.ts` — `workspace` include vs. separate `members` query

**File:** `src/app/api/data/dashboard/route.ts:7-22`

```ts
const workspace = await db.workspace.findFirst({
  include: { members: { include: { user: true } } },
})
/* ... */
const [courses, products, orders, customers, posts, campaigns, affiliates, pages, plans] = await Promise.all([
  db.course.findMany({ orderBy: { studentsCount: 'desc' } }),
  db.product.findMany({ orderBy: { salesCount: 'desc' } }),
  db.order.findMany({ orderBy: { createdAt: 'desc' }, include: { product: true } }),
  db.customer.findMany(),
  db.communityPost.findMany({ orderBy: { createdAt: 'desc' }, include: { user: true } }),
  db.emailCampaign.findMany(),
  db.affiliate.findMany(),
  db.webPage.findMany(),
  db.membershipPlan.findMany(),
])
```

**Duplication:** This endpoint loads the **same 9 tables** as `/api/data/analytics/route.ts:5-9` (with a couple of extra includes). Both routes return overlapping KPIs (revenue, MRR, customers, products, courses). Two endpoints computing identical aggregates = double the DB load when both are called from the same dashboard page.

**Fix:** Consolidate `/api/data/dashboard` and `/api/data/analytics` into a single `/api/data/overview` endpoint; have the frontend request the consolidated payload once. At minimum, share a `loadWorkspaceKPIs(workspaceId)` helper to avoid copy-paste drift.

---

## 3. Slow Queries

### 3.1 🟠 `/api/data/analytics/route.ts` — nine full table scans, no `where`, no `take`

**File:** `src/app/api/data/analytics/route.ts:5-9`

```ts
const [courses, products, orders, customers, posts, campaigns, affiliates, pages, plans] = await Promise.all([
  db.course.findMany(), db.product.findMany(), db.order.findMany({ include: { product: true } }),
  db.customer.findMany(), db.communityPost.findMany(), db.emailCampaign.findMany(),
  db.affiliate.findMany(), db.webPage.findMany(), db.membershipPlan.findMany(),
])
```

**Why slow:** Every `findMany()` has no `where` and no `take`. At 10k rows per table × 9 tables = 90k rows pulled into Node memory on every request. `db.order.findMany({ include: { product: true } })` triggers a second SELECT per batch (Prisma's join strategy) — multiplied by 9 tables. Also no `workspaceId` filter (see §4.1).

**Fix:**
- Add `where: { workspaceId }` to every query (requires `getContext()`).
- Replace `findMany` with `aggregate` / `groupBy` for the stats: revenue is `_sum: { amount: true }` on `Order` filtered by `status: 'COMPLETED'`; `customers` count is `db.customer.count({ where: { workspaceId } })`; MRR is `_sum: { price: { ... } }` on `MembershipPlan`.
- Keep `findMany` only for the arrays the frontend actually iterates (top pages, recent orders), and apply `take: 10`.

---

### 3.2 🟠 `/api/data/dashboard/route.ts` — nine unbounded `findMany` plus deep includes

**File:** `src/app/api/data/dashboard/route.ts:12-22`

```ts
const [courses, products, orders, customers, posts, campaigns, affiliates, pages, plans] = await Promise.all([
  db.course.findMany({ orderBy: { studentsCount: 'desc' } }),
  db.product.findMany({ orderBy: { salesCount: 'desc' } }),
  db.order.findMany({ orderBy: { createdAt: 'desc' }, include: { product: true } }),
  db.customer.findMany(),
  db.communityPost.findMany({ orderBy: { createdAt: 'desc' }, include: { user: true } }),
  db.emailCampaign.findMany(),
  db.affiliate.findMany(),
  db.webPage.findMany(),
  db.membershipPlan.findMany(),
])
```

**Why slow:** Same as §3.1 — no `where`, no `take`. The `include: { product: true }` on orders pulls full product rows (description, fileUrl, etc.) when only `product.type` is used (line 49) and `product.name` (line 55). `include: { user: true }` on posts pulls every user column when only `name` and `avatarUrl` would suffice. The `workspace.members` include at line 8 also over-fetches.

**Fix:** Use `aggregate` for sums/counts; `select` only needed columns; `take: 6` for `recentOrders`, `take: 5` for `topProducts`; filter every query by `workspaceId`.

---

### 3.3 🟠 `/api/data/courses/route.ts` — deep nested include, no `take`, no `where`

**File:** `src/app/api/data/courses/route.ts:8-11`

```ts
const courses = await db.course.findMany({
  orderBy: { createdAt: 'desc' },
  include: { sections: { include: { lessons: true }, orderBy: { position: 'asc' } } },
})
```

**Why slow:** Loads every course in the database with all its sections and all its lessons — including the full `content` column on every lesson (which can be tens of KB per row). No `where`, no `take`. With 50 courses × 10 sections × 10 lessons = 5 000 lesson rows fetched just to render a course list page.

**Fix:** Don't `include` lessons for the list view. Fetch counts via `_count`:

```ts
const courses = await db.course.findMany({
  where: { workspaceId },
  orderBy: { createdAt: 'desc' },
  take: 50,
  include: {
    _count: { select: { sections: true } },
    sections: { orderBy: { position: 'asc' }, select: { id: true, title: true, position: true, _count: { select: { lessons: true } } } },
  },
})
```

For lesson content, fetch on demand via `GET /api/courses/[id]/lessons/[lessonId]`.

---

### 3.4 🟠 `/api/data/funnels/route.ts` — `findMany` with nested `include` of `page`, no `where`

**File:** `src/app/api/data/funnels/route.ts:7`

```ts
const funnels = await db.funnel.findMany({ orderBy: { createdAt: 'desc' }, include: { steps: { orderBy: { position: 'asc' }, include: { page: { select: { id: true, title: true, slug: true } } } } } })
```

**Why slow:** No `workspaceId` filter (cross-tenant data leak — see §4.3). No `take`. The nested `steps → page` include fans out: each step row triggers a `Page` lookup. At 100 funnels × 6 steps × page = 600 page rows loaded.

**Fix:** Add `where: { workspaceId }`, `take: 50`, and ensure `Funnel.workspaceId` is indexed (see §3.10).

---

### 3.5 🟠 `/api/data/crm/route.ts` — three full scans, no `where`, no `take`

**File:** `src/app/data/crm/route.ts:5-9`

```ts
const [orders, customers, products] = await Promise.all([
  db.order.findMany({ orderBy: { createdAt: 'desc' }, include: { product: true } }),
  db.customer.findMany({ orderBy: { ltv: 'desc' } }),
  db.product.findMany(),
])
```

**Why slow:** Same unbounded pattern. Worse: `products` is loaded fully just to be referenced by name in the `orders` map at line 24, but the `include: { product: true }` on `orders` already does that. The `products` query is entirely redundant. The `customers` query loads all customers but the response only includes them as a flat array — no pagination.

**Fix:** Drop the `products` query entirely (use `o.product?.name` from the orders include). Add `where: { workspaceId }` to orders and customers, `take: 30` for orders. For customers, paginate.

---

### 3.6 🟡 `/api/data/community/route.ts` — `posts` query loads 50 rows with `JSON.parse` per row

**File:** `src/app/api/data/community/route.ts:13-21`

```ts
db.communityPost.findMany({
  where: { workspaceId: ctx.workspaceId, isArchived: false },
  orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
  take: 50,
  include: {
    user: { select: { id: true, name: true, avatarUrl: true } },
    space: { select: { id: true, name: true } },
  },
})
```

**Why slow (medium):** The query itself is good — `take: 50`, `where` on indexed `(workspaceId, createdAt)`, `select` on relations. But the serializer at lines 61-64 does four `JSON.parse` calls per post (`hashtags`, `mentions`, `attachments`, `reactions`). With 50 posts × 4 parses = 200 synchronous parse calls on the hot path. Not a SQL issue, but worth noting.

**Fix:** Use `safeJsonParse` (already imported in `community.ts`) consistently, and consider caching parsed shapes if this endpoint is hot.

---

### 3.7 🟡 `/api/community/posts/[postId]/route.ts` — 4-level nested `include` of replies

**File:** `src/app/api/community/posts/[postId]/route.ts:66-95`

```ts
const post = await db.communityPost.findFirst({
  where: { id: postId, workspaceId: ctx.workspaceId },
  include: {
    user: true,
    space: true,
    comments: {
      where: { parentId: null },
      orderBy: { createdAt: 'asc' },
      include: {
        user: true,
        replies: {
          orderBy: { createdAt: 'asc' },
          include: {
            user: true,
            replies: { /* ... 4 levels deep ... */ },
          },
        },
      },
    },
  },
})
```

**Why slow (medium):** Prisma translates each `replies` level into a separate `SELECT … WHERE parentId IN (…)`. Four levels = four sequential round trips, each producing a Cartesian fan-out. A post with 20 top-level comments, each with 5 replies × 5 replies × 5 replies = 2 500 comment rows + 4 user lookups per level. The `include: { user: true }` at every level fetches every User column when only `id`, `name`, `avatarUrl` are needed.

**Fix:**
- Replace `include: { user: true }` with `include: { user: { select: { id: true, name: true, avatarUrl: true } } }` at every level (see §6.3).
- Cap reply depth at 2 levels in the include; load deeper replies lazily via `GET /api/community/posts/[postId]/comments/[commentId]/replies`.
- Or, more efficiently: load all comments for the post in **one** `findMany({ where: { postId } })`, build the tree in memory with a `Map<parentId, Comment[]>`. Single round trip, arbitrary depth.

---

### 3.8 🟡 `/api/community/posts/[postId]/comments/route.ts` — same 3-level nested include

**File:** `src/app/api/community/posts/[postId]/comments/route.ts:53-71`

```ts
const NESTED_REPLIES_INCLUDE = {
  user: true,
  replies: {
    orderBy: { createdAt: 'asc' as const },
    include: {
      user: true,
      replies: {
        orderBy: { createdAt: 'asc' as const },
        include: { /* ... */ },
      },
    },
  },
}
```

Same issue as §3.7. Applied at line 115 via `include: NESTED_REPLIES_INCLUDE`. Same fix.

---

### 3.9 🟡 `/api/community/members/export/route.ts` — unbounded CSV export

**File:** `src/app/api/community/members/export/route.ts:54-58`

```ts
const members = await db.workspaceMember.findMany({
  where,
  orderBy: { joinedAt: 'desc' },
  include: { user: true },
})
```

**Why slow (medium):** Returns every member into memory to build a CSV string. At 50 000 members × 9 columns of UTF-8 text, the resulting JS string is ~5 MB and blocks the event loop while `.join('\r\n')` runs synchronously. SQLite will happily stream the rows, but Prisma materialises them all.

**Fix:**
- Use cursor pagination + stream rows to the response (`Response.body` writable stream) instead of building the entire CSV in memory.
- Add `take: 50000` upper bound as a safety net.
- Consider an async job that writes to object storage and emails a download link, instead of a synchronous GET.

---

### 3.10 🟡 Schema-wide — missing indexes on `workspaceId` for many models

The following models are filtered by `workspaceId` in API routes but have **no `@@index([workspaceId])`** in the schema:

| Model | Line in `schema.prisma` | Queries filtering on it |
|---|---|---|
| `Course` | 83-101 | `/api/data/courses` GET, `/api/data/dashboard`, `/api/data/analytics` |
| `Product` | 138-155 | `/api/data/products`, `/api/data/dashboard`, `/api/data/crm`, `/api/data/analytics` |
| `Order` | 157-171 | `/api/data/orders`, `/api/data/dashboard`, `/api/data/crm`, `/api/data/analytics` |
| `Customer` | 402-414 | `/api/data/customers`, `/api/data/dashboard`, `/api/data/crm`, `/api/data/analytics` |
| `EmailCampaign` | 416-439 | (indexed ✓) |
| `Affiliate` | 441-454 | `/api/data/affiliates`, `/api/data/dashboard`, `/api/data/analytics` |
| `WebPage` | 456-467 | `/api/data/dashboard`, `/api/data/analytics` |
| `MembershipPlan` | 469-479 | `/api/data/membership`, `/api/data/dashboard`, `/api/data/analytics` |
| `BlogPost` | 666-684 | `/api/data/blog` |
| `Page` | 588-611 | `/api/data/pages`, `/api/data/page-sections` |
| `Funnel` | 637-651 | `/api/data/funnels` |
| `Section` | 103-111 | course include joins |
| `Lesson` | 113-124 | section include joins |
| `Enrollment` | 126-136 | (no API yet) |
| `PageSection` | 613-624 | `/api/data/page-sections` GET |
| `FunnelStep` | 653-664 | funnel include |
| `AiGeneration` | 552-567 | `/api/admin/generations` |

**Fix:** Add `@@index([workspaceId])` to every model above, plus `@@index([courseId])` on `Section`, `@@index([sectionId])` on `Lesson`, `@@index([pageId])` on `PageSection`, `@@index([funnelId])` on `FunnelStep`, `@@index([userId, createdAt])` on `AiGeneration` and `CreditTransaction`.

---

### 3.11 🟡 `/api/community/posts/route.ts` — `search` filter on `title` / `content` is `contains`, no FTS

**File:** `src/app/api/community/posts/route.ts:103-108`

```ts
if (search) {
  where.OR = [
    { title: { contains: search } },
    { content: { contains: search } },
  ]
}
```

**Why slow:** `contains` in SQLite compiles to `LIKE '%search%'` which cannot use any index and scans every `CommunityPost` row in the workspace. With 100 000 posts, a search request scans all 100 000 rows.

**Fix:** Use SQLite FTS5 virtual table mirrored from `CommunityPost.title` + `CommunityPost.content`, queryable via `db.$queryRaw`. Or short-term: restrict search to `title` only and add `@@index([workspaceId, title])` (SQLite's `LIKE` still won't use it for `'%…'`, but `GLOB 'search*'` will).

---

### 3.12 🟡 `/api/community/members/route.ts` — `user.name contains` filter joins to User

**File:** `src/app/api/community/members/route.ts:83-90`

```ts
if (search) {
  where.user = {
    OR: [
      { name: { contains: search } },
      { email: { contains: search } },
    ],
  }
}
```

**Why slow:** Prisma implements this filter as a subquery against `User`. There is no index on `User.name` or `User.email` (`email` is `@unique`, so equality uses it, but `contains` won't). Every member search scans all Users.

**Fix:** Add a denormalised `userName` / `userEmail` column on `WorkspaceMember` (kept in sync via a Prisma middleware or trigger), index it, and filter directly. Or use FTS as in §3.11.

---

### 3.13 🟡 Offset pagination on growing tables

Every paginated community endpoint uses `skip` + `take` (via the shared `paginate()` helper at `src/lib/community.ts:169-176`):

- `/api/community/members/route.ts:118-130`
- `/api/community/notifications/route.ts:70-81`
- `/api/community/posts/route.ts:122-138`
- `/api/community/posts/[postId]/comments/route.ts:102-116`
- `/api/community/invitations/route.ts:80-92`
- `/api/community/moderation/audit-log/route.ts:34-46`
- `/api/community/moderation/reports/route.ts:141-153`

**Why slow:** `OFFSET 10000 LIMIT 20` still scans and discards the first 10 000 rows. On `CommunityPost` with 1M rows, deep pagination is O(n).

**Fix:** Switch to cursor-based pagination for time-ordered tables: `where: { createdAt: { lt: cursor } }` ordered by `createdAt desc`, `take: 21` (the 21st row is the next cursor). Keep offset only for the small admin tables (`ModerationReport`, `Invitation`, `AuditLog`) where row counts stay bounded.

---

### 3.14 🔵 `/api/community/moderation/check/route.ts` — full keyword scan per request

**File:** `src/app/api/community/moderation/check/route.ts:51-53`

```ts
const keywords = await db.bannedKeyword.findMany({
  where: { workspaceId: ctx.workspaceId },
})
```

**Why slow (low):** Loads every banned keyword on every content-check call (likely called on every post/comment create). With 1 000 keywords × 100 requests/sec = 100k rows/sec transferred. The keyword set changes rarely.

**Fix:** Cache the keyword list in-process with a 60-second TTL (`unstable_cache` or a simple `Map<workspaceId, { keywords, expiresAt }>`). Invalidate on POST/DELETE in `/api/community/moderation/keywords`.

---

## 4. Unsafe Queries (IDOR / BOLA)

These endpoints accept an `id` (path param or body) and look it up with `findUnique({ where: { id } })` or `findFirst({ where: { id, ... } })` **without** scoping by `workspaceId`. In a multi-tenant deployment, an authenticated user from workspace A can pass workspace B's resource id and read or mutate it.

### 4.1 🔴 `/api/data/courses/route.ts` — PUT and DELETE unscoped

**File:** `src/app/api/data/courses/route.ts:66, 93`

```ts
// PUT (line 66)
const existing = await db.course.findUnique({ where: { id } })
/* ... */
const course = await db.course.update({ where: { id }, data })

// DELETE (line 93)
const existing = await db.course.findUnique({ where: { id } })
/* ... */
await db.section.deleteMany({ where: { courseId: id } })
await db.course.delete({ where: { id } })
```

**Vulnerability:** Any caller who knows a course `id` from any workspace can rename, reprice, or delete it.

**Fix:** Resolve `workspaceId` via `getContext()` and replace with:
```ts
const existing = await db.course.findFirst({ where: { id, workspaceId: ctx.workspaceId } })
if (!existing) return 404
await db.course.update({ where: { id: existing.id }, data })
```

The `DELETE` also unnecessarily calls `db.section.deleteMany` — `Section.course` is `onDelete: Cascade` in the schema (line 110), so Prisma already cascades.

---

### 4.2 🔴 `/api/data/products/route.ts` — PUT and DELETE unscoped

**File:** `src/app/api/data/products/route.ts:60, 88`

```ts
const existing = await db.product.findUnique({ where: { id } })
/* ... */
const product = await db.product.update({ where: { id }, data })
```

Same pattern as §4.1. Same fix.

---

### 4.3 🔴 `/api/data/funnels/route.ts` — PUT and DELETE unscoped

**File:** `src/app/api/data/funnels/route.ts:62, 86`

```ts
const existing = await db.funnel.findUnique({ where: { id } })
/* ... */
const funnel = await db.funnel.update({ where: { id }, data })
```

Same fix: `findFirst({ where: { id, workspaceId: ctx.workspaceId } })`.

---

### 4.4 🔴 `/api/data/email/route.ts` — PUT and DELETE unscoped

**File:** `src/app/api/data/email/route.ts:77, 118`

```ts
const existing = await db.emailCampaign.findUnique({ where: { id } })
/* ... */
const campaign = await db.emailCampaign.update({ where: { id }, data })
```

Note that `EmailCampaign` is indexed on `[workspaceId, status]` but not on `id`+`workspaceId` — the lookup by `id` alone is the issue.

**Fix:** Scope by `workspaceId` from `getContext()`.

---

### 4.5 🔴 `/api/data/blog/route.ts` — PUT and DELETE unscoped

**File:** `src/app/api/data/blog/route.ts:61, 93`

```ts
const existing = await db.blogPost.findUnique({ where: { id } })
/* ... */
const post = await db.blogPost.update({ where: { id }, data })
```

`BlogPost` has a `workspaceId` column (line 668 of `schema.prisma`) but **no relation** to `Workspace` and **no index**. Even after adding the workspace scope, add `@@index([workspaceId])`.

---

### 4.6 🔴 `/api/data/page-sections/route.ts` — every mutation unscoped

**File:** `src/app/api/data/page-sections/route.ts:26, 56, 65, 92`

```ts
// GET (line 26)
const page = await db.page.findUnique({ where: { id: pageId }, include: { sections: { ... } } })

// PUT duplicate (line 56)
const orig = await db.pageSection.findUnique({ where: { id } })

// PUT moveUp/moveDown (line 65)
const section = await db.pageSection.findUnique({ where: { id } })

// DELETE (line 92)
const section = await db.pageSection.findUnique({ where: { id } })
await db.pageSection.delete({ where: { id } })
```

**Vulnerability:** Anyone who knows a `pageId` can read the full page with all sections. Anyone who knows a `sectionId` can duplicate, move, edit, or delete that section — and via the `pageId` on the section, reach into another workspace's page.

**Fix:** All four operations must verify the parent `Page.workspaceId` matches `ctx.workspaceId`. Add a helper:

```ts
async function getOwnedPage(id: string, workspaceId: string) {
  return db.page.findFirst({ where: { id, workspaceId }, select: { id: true } })
}
```

Use it in every branch before mutating sections.

---

### 4.7 🔴 `/api/data/courses/duplicate/route.ts` — duplicate any course from any workspace

**File:** `src/app/api/data/courses/duplicate/route.ts:13-17`

```ts
const original = await db.course.findUnique({
  where: { id },
  include: { sections: { include: { lessons: true }, orderBy: { position: 'asc' } } },
})
```

**Vulnerability:** A caller from workspace A can pass workspace B's `courseId` and clone B's entire course tree (including lesson content) into workspace A — a content exfiltration primitive.

**Fix:** `findFirst({ where: { id, workspaceId: ctx.workspaceId }, include: ... })`.

---

### 4.8 🔴 `/api/data/site-settings/route.ts` — PUT by id, no workspace check

**File:** `src/app/api/data/site-settings/route.ts:22`

```ts
const setting = await db.siteSetting.update({ where: { id }, data: { value: val } })
```

**Vulnerability:** `SiteSetting` has no `workspaceId` at all — it's a global singleton table. Any caller can rewrite any site setting (brand, analytics, SEO, domains). The model needs a `workspaceId` column or this endpoint needs admin-only auth (currently it has neither).

**Fix:** Add `workspaceId` to `SiteSetting`, scope by it, and require `canManageMembers(ctx.workspaceRole)`.

---

### 4.9 🔴 `/api/admin/providers/route.ts` — PUT by id, no auth at all

**File:** `src/app/api/admin/providers/route.ts:18`

```ts
const provider = await db.aiProvider.update({ where: { id }, data })
```

**Vulnerability:** No `getContext()` call, no auth check. Any unauthenticated caller can rewrite an AI provider's `apiKey` and `baseUrl`, silently redirecting all AI calls to an attacker-controlled endpoint.

**Fix:** Require admin auth, scope by an admin role check. (Same applies to `/api/admin/settings/route.ts:15`, `/api/admin/tools/route.ts:32`, `/api/admin/flags/route.ts:15`.)

---

### 4.10 🔴 `/api/admin/settings/route.ts` — PUT by id, no auth

**File:** `src/app/api/admin/settings/route.ts:15`

```ts
const setting = await db.adminSetting.update({ where: { id }, data: { value: String(value) } })
```

Same issue as §4.9. `AdminSetting` is global; no auth check.

---

### 4.11 🔴 `/api/admin/tools/route.ts` — PUT by id, no auth

**File:** `src/app/api/admin/tools/route.ts:32`

```ts
const tool = await db.aiTool.update({ where: { id }, data })
```

Same issue. An attacker can rewrite `systemPrompt` to inject arbitrary instructions into every AI tool's system prompt, or set `creditCost: 0` to make every tool free.

---

### 4.12 🔴 `/api/admin/flags/route.ts` — PUT by id, no auth

**File:** `src/app/api/admin/flags/route.ts:15`

```ts
const flag = await db.featureFlag.update({ where: { id }, data: { enabled: !!enabled } })
```

Same issue. An attacker can flip any feature flag.

---

### 4.13 🔴 `/api/ai/publish-course/route.ts` — `findUnique` by generationId, no ownership check

**File:** `src/app/api/ai/publish-course/route.ts:13`

```ts
const gen = await db.aiGeneration.findUnique({ where: { id: generationId } })
```

**Vulnerability:** Any caller can publish any other user's AI generation as a course in the first workspace (`db.workspace.findFirst()` at line 25).

**Fix:** `findFirst({ where: { id: generationId, userId: ctx.user.id } })` and resolve `workspaceId` from `ctx`.

---

### 4.14 🔴 `/api/data/orders/route.ts`, `/api/data/customers/route.ts`, `/api/data/affiliates/route.ts`, `/api/data/membership/route.ts` — no `workspaceId` filter

**Files:**
- `src/app/api/data/orders/route.ts:8-12`
- `src/app/api/data/customers/route.ts:8-11`
- `src/app/api/data/affiliates/route.ts:5`
- `src/app/api/data/membership/route.ts:5`

```ts
// orders
const orders = await db.order.findMany({
  orderBy: { createdAt: 'desc' },
  take: 100,
  include: { product: { select: { name: true } } },
})

// customers
const customers = await db.customer.findMany({
  orderBy: { createdAt: 'desc' },
  take: 100,
})

// affiliates
const affiliates = await db.affiliate.findMany({ orderBy: { earnings: 'desc' } })

// membership
const plans = await db.membershipPlan.findMany({ orderBy: { price: 'asc' } })
```

**Vulnerability:** All four list endpoints return rows from **every** workspace in the database. A user signed into workspace A sees workspace B's orders, customers, affiliates, and membership plans.

**Fix:** Resolve `ctx = await getContext()` and add `where: { workspaceId: ctx.workspaceId }` to every query.

---

### 4.15 🔴 `/api/data/analytics/route.ts` — entire dashboard data leaks across tenants

**File:** `src/app/api/data/analytics/route.ts:5-9` (snippet in §3.1)

All nine `findMany()` calls omit `workspaceId`. Revenue, MRR, customer counts, etc. are computed across every tenant.

**Fix:** Scope every query to `ctx.workspaceId`. Also affects `/api/data/dashboard/route.ts:12-22` (snippet in §3.2) and `/api/data/crm/route.ts:5-9` (snippet in §3.5).

---

### 4.16 🟠 `/api/community/posts/[postId]/comments/[commentId]/route.ts` — workspace check *after* fetch

**File:** `src/app/api/community/posts/[postId]/comments/[commentId]/route.ts:42-48`

```ts
const existing = await db.communityComment.findFirst({
  where: { id: commentId, postId },
  include: { post: { select: { workspaceId: true } } },
})
if (!existing || existing.post.workspaceId !== ctx.workspaceId) {
  return NextResponse.json({ error: 'Comment not found' }, { status: 404 })
}
```

**Why partial:** The `findFirst` does include the workspace via the post relation, and the guard correctly returns 404. But the comment is fetched **before** the workspace check; in Prisma this is fine (the row is discarded), but the pattern is fragile. The same file has this identical block at lines 113-119 for DELETE.

**Fix:** Move the workspace filter into the `where`:

```ts
const existing = await db.communityComment.findFirst({
  where: { id: commentId, postId, post: { workspaceId: ctx.workspaceId } },
  select: { id: true, userId: true, content: true, /* ... */ },
})
```

This is a defense-in-depth improvement, not a live vulnerability.

---

### 4.17 🟠 `/api/community/events/route.ts` — `DELETE ?id=` lacks ownership check

**File:** `src/app/api/community/events/route.ts:182-193`

```ts
const existing = await db.communityEvent.findFirst({
  where: { id: eventId, workspaceId: ctx.workspaceId },
  select: { id: true, title: true, status: true },
})
if (!existing) { /* 404 */ }
await db.communityEvent.update({
  where: { id: eventId },
  data: { status: 'CANCELLED' },
})
```

**Why partial:** Workspace scoping is correct (good — not IDOR across tenants). But there is **no check that the caller is the event organiser or a moderator**. Any workspace member can cancel any event in the workspace.

**Fix:** Add `if (existing.userId !== ctx.user.id && !canModerate(ctx.workspaceRole)) return 403`.

---

### 4.18 🟠 `/api/community/posts/[postId]/react/route.ts` — reaction mutation does not verify post is unlocked / not archived

**File:** `src/app/api/community/posts/[postId]/react/route.ts:46-52`

```ts
const post = await db.communityPost.findFirst({
  where: { id: postId, workspaceId: ctx.workspaceId },
  select: { id: true, userId: true, reactions: true },
})
```

**Why partial:** No `isArchived` or `isLocked` check. A user can react to an archived post, which the comments endpoint (line 157-162 of `comments/route.ts`) explicitly forbids for comments. Inconsistent policy.

**Fix:** Add `if (post.isArchived) return 400` and `if (post.isLocked && !canModerate(ctx.workspaceRole)) return 403`.

---

## 5. Missing Transactions

### 5.1 🟠 `/api/ai/publish-course/route.ts` — multi-insert course tree without transaction

**File:** `src/app/api/ai/publish-course/route.ts:28-65`

The `db.course.create` at line 28 and the subsequent `db.section.create` + `db.lesson.create` calls inside the `for` loop (lines 45, 51) are all separate transactions. If the lesson insert at module 5 lesson 3 fails, modules 1-4 plus module 5 lessons 1-2 are persisted, but the request returns 500. The caller has no `courseId` and the partial course is orphaned in the DB.

**Fix:** Wrap the entire publish operation:

```ts
const course = await db.$transaction(async (tx) => {
  const c = await tx.course.create({ data: { /* ... */ } })
  for (const mod of courseData.modules ?? []) {
    const s = await tx.section.create({ data: { courseId: c.id, /* ... */ } })
    for (const lesson of mod.lessons ?? []) {
      await tx.lesson.create({ data: { sectionId: s.id, /* ... */ } })
    }
  }
  return c
})
```

Or, better, the nested-create pattern from §1.1 which is inherently atomic.

---

### 5.2 🟠 `/api/ai/generate/route.ts` — credit deduction + transaction log not atomic

**File:** `src/app/api/generate/route.ts:75-76`

```ts
await db.user.update({ where: { id: user.id }, data: { credits: { decrement: tool.creditCost } } })
await db.creditTransaction.create({ data: { userId: user.id, amount: -tool.creditCost, reason: `AI: ${tool.name}` } })
```

**Why needs a transaction:** If the second `await` fails (DB disk full, constraint violation), the user's credit balance was decremented but no `CreditTransaction` row was written. The ledger is now out of sync with the balance — and the user has no audit trail for the missing credits.

Same pattern at:
- `/api/ai/chat/route.ts:53-56`
- `/api/ai/landing-page/route.ts:95-96`
- `/api/ai/section-rewrite/route.ts:50-51`

**Fix:**

```ts
await db.$transaction([
  db.user.update({ where: { id: user.id }, data: { credits: { decrement: tool.creditCost } } }),
  db.creditTransaction.create({ data: { userId: user.id, amount: -tool.creditCost, reason: `AI: ${tool.name}` } }),
])
```

The array form is a batched Prisma transaction — both statements commit together.

---

### 5.3 🟠 `/api/ai/landing-page/route.ts` — page + sections + credit deduction + generation record all separate

**File:** `src/app/api/ai/landing-page/route.ts:82-101`

```ts
const page = await db.page.create({ /* ... */ })
for (let i = 0; i < data.sections.length; i++) {
  await db.pageSection.create({ /* ... */ })
}
await db.user.update({ where: { id: user.id }, data: { credits: { decrement: tool.creditCost } } })
await db.creditTransaction.create({ /* ... */ })
await db.aiGeneration.create({ /* ... */ })
```

Five separate awaits, any of which can fail mid-sequence leaving partial state. If the `user.update` succeeds but `aiGeneration.create` fails, the user paid credits for a generation that wasn't recorded.

**Fix:** Wrap in `db.$transaction([...])` (use the array form for the batchable statements) or, even better, use a nested create:

```ts
await db.$transaction([
  db.page.create({
    data: { /* ... */ sections: { create: data.sections.map((sec, i) => ({ ... })) } },
  }),
  db.user.update({ where: { id: user.id }, data: { credits: { decrement: tool.creditCost } } }),
  db.creditTransaction.create({ data: { /* ... */ } }),
  db.aiGeneration.create({ data: { /* ... */ } }),
])
```

---

### 5.4 🟠 `/api/data/courses/route.ts` — DELETE manually cascades without transaction

**File:** `src/app/api/data/courses/route.ts:97-98`

```ts
await db.section.deleteMany({ where: { courseId: id } })
await db.course.delete({ where: { id } })
```

**Why needs a transaction:** If the `course.delete` fails (e.g. an existing `Enrollment` row blocks the cascade), the `section.deleteMany` has already run, orphaning all lessons. Note that `Section.course` is `onDelete: Cascade` in the schema (line 110), so the `deleteMany` is redundant anyway — but if you keep it for safety, wrap both in `db.$transaction([...])`.

**Fix:** Remove the redundant `deleteMany` (cascade handles it), or wrap both in a transaction.

---

### 5.5 🟠 `/api/data/page-sections/route.ts` — `duplicate` shifts positions without transaction

**File:** `src/app/api/data/page-sections/route.ts:58-60`

```ts
const dup = await db.pageSection.create({ data: { pageId: orig.pageId, type: orig.type, content: orig.content, position: orig.position + 1 } })
await db.pageSection.updateMany({ where: { pageId: orig.pageId, position: { gt: orig.position }, id: { not: dup.id } }, data: { position: { increment: 1 } } })
```

**Why needs a transaction:** If the `updateMany` fails, the new `dup` row exists at position `orig.position + 1` alongside whatever was already at that position — two sections with the same position, breaking UI ordering.

**Fix:** Wrap both in `db.$transaction([...])`.

---

### 5.6 🟠 `/api/data/page-sections/route.ts` — `moveUp`/`moveDown` swaps without transaction

**File:** `src/app/api/data/page-sections/route.ts:71-72`

```ts
await db.pageSection.update({ where: { id: swap.id }, data: { position: section.position } })
await db.pageSection.update({ where: { id: section.id }, data: { position: newPos } })
```

Same shape as §5.5. If the second update fails, two sections share a position.

**Fix:** `db.$transaction([...])`.

---

### 5.7 🟠 `/api/data/community/route.ts` — POST increments counters outside transaction

**File:** `src/app/api/data/community/route.ts:96-121`

```ts
const post = await db.communityPost.create({ /* ... */ })
await db.workspaceMember.update({ where: { id: ctx.memberId }, data: { postsCount: { increment: 1 } } })
if (spaceId) {
  await db.communitySpace.update({ where: { id: spaceId }, data: { postCount: { increment: 1 } } })
}
```

**Why needs a transaction:** Three separate awaits. Compare to the equivalent handler in `/api/community/posts/route.ts:233-264` which correctly wraps the counter increments in `db.$transaction([...])`. This `data/community` POST is a duplicate code path that forgot the transaction.

**Fix:** Wrap all three writes in `db.$transaction([...])`, or — better — delete this handler and have the frontend call `/api/community/posts` instead (which already does the right thing).

---

### 5.8 🟡 `/api/community/posts/[postId]/route.ts` — PATCH writes PostHistory then updates post, not atomic

**File:** `src/app/api/community/posts/[postId]/route.ts:214-231`

```ts
await db.postHistory.create({ data: { postId: existing.id, /* ... */ } })
const updated = await db.communityPost.update({ where: { id: postId }, data: { /* ... */ } })
```

**Why needs a transaction:** If the post update fails, a PostHistory row is created for a version that was never actually applied — corrupting the history → current state correspondence.

**Fix:** Wrap in `db.$transaction([...])`.

---

### 5.9 🟡 `/api/community/posts/[postId]/comments/[commentId]/route.ts` — DELETE: count + delete + counter-decrement not atomic

**File:** `src/app/api/community/posts/[postId]/comments/[commentId]/route.ts:127-143`

```ts
const descendantCount = await countDescendants(commentId, postId)
const removedTotal = descendantCount + 1
await db.communityComment.delete({ where: { id: commentId } })
await db.$transaction([
  db.communityPost.update({ where: { id: postId }, data: { commentsCount: { decrement: removedTotal } } }),
  db.workspaceMember.updateMany({ /* ... */ }),
])
```

**Why needs a transaction:** `countDescendants` is computed **before** the delete — but between count and delete, another user could post a reply, making the actual removed count larger than `removedTotal`. The decrement then under-counts and `commentsCount` drifts.

**Fix:** Compute the actual removed count inside the same transaction as the delete and counter updates. SQLite serialises writers, so a single transaction ensures no concurrent insert sneaks in.

---

### 5.10 🟡 `/api/community/transfer-ownership/route.ts` — `sendNotification` calls outside transaction

**File:** `src/app/api/community/transfer-ownership/route.ts:77-118`

The two role updates are correctly wrapped in `db.$transaction([...])` at line 57. But the three `sendNotification` calls (to old owner, new owner, and all members) and the audit log are outside the transaction. If `sendNotification` throws, the role transfer is committed but no notifications are sent. The current `sendNotification` swallows errors (line 147 of `community.ts`), so this is a soft issue — but if it's ever changed to throw, the role transfer will silently complete without notification.

**Fix:** Acceptable as-is given the swallow-error behaviour, but document it. Or move the notifications to a separate post-commit hook.

---

### 5.11 🟡 `/api/community/posts/[postId]/react/route.ts` — read-modify-write of `reactions` JSON without transaction

**File:** `src/app/api/community/posts/[postId]/react/route.ts:46-93`

```ts
const post = await db.communityPost.findFirst({
  where: { id: postId, workspaceId: ctx.workspaceId },
  select: { id: true, userId: true, reactions: true },
})
/* ... in-memory mutation of `reactions` map ... */
await db.communityPost.update({
  where: { id: postId },
  data: { reactions: JSON.stringify(reactions) },
})
```

**Why needs a transaction:** Two concurrent reactions by different users race: both read the same `reactions` JSON, both append their `userId`, both write — the second write overwrites the first, losing one reaction.

**Fix:** Wrap the read-modify-write in a transaction with the highest isolation level, or — better — model reactions as a separate `Reaction` table with a `@@unique([postId, userId])` constraint and use `upsert`/`delete` per reaction. JSON mutation as a concurrency primitive is an anti-pattern.

---

### 5.12 🟡 `/api/community/members/[memberId]/route.ts` — PATCH interleaves audit log writes with the update

**File:** `src/app/api/community/members/[memberId]/route.ts:200-311`

Multiple `writeAuditLog` calls (lines 200, 237, 251, 266, 281) happen **before** the actual `db.workspaceMember.update` at line 307. If the update fails, audit logs record actions that never took effect.

**Fix:** Wrap the entire PATCH body — audit logs and update — in `db.$transaction([...])`, or write audit logs only after the update succeeds.

---

## 6. Over-fetching

### 6.1 🟠 `/api/data/dashboard/route.ts` — `include: { product: true }` on orders, `include: { user: true }` on posts

**File:** `src/app/api/data/dashboard/route.ts:15, 17`

```ts
db.order.findMany({ orderBy: { createdAt: 'desc' }, include: { product: true } }),
/* ... */
db.communityPost.findMany({ orderBy: { createdAt: 'desc' }, include: { user: true } }),
```

**Over-fetched:** `Order.product` is full Product row (description, fileUrl, coverUrl, salesCount, rating, status, createdAt) — but only `product.name` (line 55) and `product.type` (line 49) are used. `CommunityPost.user` is full User row (email, bio, credits, role) — but `posts.length` is the only thing used at line 63.

**Fix:**

```ts
db.order.findMany({ orderBy: { createdAt: 'desc' }, take: 50, where: { workspaceId }, select: { id: true, customerName: true, customerEmail: true, amount: true, status: true, createdAt: true, product: { select: { name: true, type: true } } } }),
db.communityPost.count({ where: { workspaceId } }),  // only the count is needed
```

---

### 6.2 🟠 `/api/data/analytics/route.ts` — `include: { product: true }` on all orders

**File:** `src/app/api/data/analytics/route.ts:6`

```ts
db.order.findMany({ include: { product: true } }),
```

**Over-fetched:** Only `o.amount` and `o.status` are used (line 10). The product relation is loaded but never accessed. Pulls every Product column for every Order.

**Fix:** Drop the `include` entirely; add `select: { amount: true, status: true }` since those are the only fields used.

---

### 6.3 🟠 `/api/community/posts/[postId]/route.ts` — `include: { user: true }` and `space: true` at every reply level

**File:** `src/app/api/community/posts/[postId]/route.ts:69-93`

```ts
include: {
  user: true,
  space: true,
  comments: {
    /* ... */
    include: {
      user: true,
      replies: {
        include: {
          user: true,
          replies: { /* ... */ include: { user: true, replies: { include: { user: true } } } },
        },
      },
    },
  },
},
```

**Over-fetched:** `User` has columns `email`, `bio`, `role`, `credits`, `createdAt`, `updatedAt` — none used by `serializeComment` (which only reads `id`, `name`, `avatarUrl`). `Space` is loaded fully (description, icon, color, visibility, memberCount, postCount, status, createdAt, updatedAt) but only `id` and `name` are used.

**Fix:** Replace every `user: true` with `user: { select: { id: true, name: true, avatarUrl: true } }`, and `space: true` with `space: { select: { id: true, name: true } }`. The same fix applies to `/api/community/posts/[postId]/comments/route.ts:54-71` (`NESTED_REPLIES_INCLUDE`).

---

### 6.4 🟠 `/api/community/members/route.ts` and friends — `include: { user: true }` on member list

**File:** `src/app/api/community/members/route.ts:129`

```ts
const members = await db.workspaceMember.findMany({
  where, orderBy, skip, take,
  include: { user: true },
})
```

**Over-fetched:** `serializeMember` (lines 16-53) only reads `user.id`, `user.name`, `user.email`, `user.avatarUrl`, `user.bio`. But `include: { user: true }` pulls `credits`, `role`, `createdAt`, `updatedAt` too. Same pattern in:

- `/api/community/members/[memberId]/route.ts:74, 151, 310`
- `/api/community/members/[memberId]/warn/route.ts:36`
- `/api/community/members/export/route.ts:57`
- `/api/community/transfer-ownership/route.ts:45`

**Fix:** Replace with `include: { user: { select: { id: true, name: true, email: true, avatarUrl: true, bio: true } } }` (and drop `bio` for the export route which doesn't use it).

---

### 6.5 🟠 `/api/community/events/route.ts` — `include: { user: true }` loads full User

**File:** `src/app/api/community/events/route.ts:29-36`

```ts
include: {
  user: true,
  _count: { select: { rsvps: true } },
  rsvps: { where: { userId: ctx.user.id }, select: { status: true } },
},
```

The serializer at lines 54-58 only uses `e.user.id`, `e.user.name`, `e.user.avatarUrl`.

**Fix:** `user: { select: { id: true, name: true, avatarUrl: true } }`.

---

### 6.6 🟠 `/api/data/crm/route.ts` — `include: { product: true }` then accesses only `product?.name` and `product.type`

**File:** `src/app/api/data/crm/route.ts:6`

```ts
db.order.findMany({ orderBy: { createdAt: 'desc' }, include: { product: true } }),
```

Uses: `o.product?.name` (line 24) and `o.product.type` (line 49).

**Fix:** `include: { product: { select: { name: true, type: true } } }`.

---

### 6.7 🟠 `/api/data/dashboard/route.ts` — `workspace.members` include loads full user for every member

**File:** `src/app/api/data/dashboard/route.ts:7-9`

```ts
const workspace = await db.workspace.findFirst({
  include: { members: { include: { user: true } } },
})
```

The team serializer at line 72 only reads `m.user.name`, `m.user.email`, `m.role`. But `include: { user: true }` loads credits, bio, avatarUrl, role (User.role, not Member.role), createdAt, updatedAt.

**Fix:** `include: { members: { select: { role: true, user: { select: { name: true, email: true } } } } }`. Also add `where: { workspaceId }` — see §4.

---

### 6.8 🟡 `/api/data/courses/route.ts` — `include: { sections: { include: { lessons: true } } }` loads full lesson content

**File:** `src/app/api/data/courses/route.ts:10`

```ts
include: { sections: { include: { lessons: true }, orderBy: { position: 'asc' } } },
```

`Lesson.content` can be tens of KB per row. The list serializer at lines 16-22 reads `l.id, l.title, l.type, l.duration, l.isPreview, l.content`. Content is included — likely to render preview, but for a course *list* view that's over-fetching.

**Fix:** Drop `content` from the list query: `lessons: { select: { id: true, title: true, type: true, duration: true, isPreview: true }, orderBy: { position: 'asc' } }`. Fetch content via a separate `GET /api/courses/[id]/lessons/[lessonId]`.

---

### 6.9 🟡 `/api/community/posts/route.ts` — `include: { user: true, space: true }` over-fetches

**File:** `src/app/api/community/posts/route.ts:134-138`

```ts
const posts = await db.communityPost.findMany({
  where, orderBy, skip, take,
  include: { user: true, space: true },
})
```

`serializePost` (lines 14-68) only uses `p.user.id`, `p.user.name`, `p.user.avatarUrl` and `p.space.id`, `p.space.name`.

**Fix:** `include: { user: { select: { id: true, name: true, avatarUrl: true } }, space: { select: { id: true, name: true } } }`.

---

### 6.10 🟡 `/api/community/spaces/[spaceId]/route.ts` — `include: { user: true }` on posts, also exposes email

**File:** `src/app/api/community/spaces/[spaceId]/route.ts:30-38`

```ts
include: {
  posts: {
    take: 20,
    orderBy: { createdAt: 'desc' },
    include: { user: true },
  },
},
```

The serializer at lines 69-74 reads `p.user.id`, `p.user.name`, `p.user.email`, `p.user.avatarUrl`. Returning `email` to the client in a list of space posts is itself questionable (PII leak), but at minimum the `include` should be a `select` so credits/role/createdAt are not pulled.

**Fix:** `user: { select: { id: true, name: true, avatarUrl: true } }` — and reconsider whether `email` should be exposed.

---

### 6.11 🟡 `/api/admin/tools/route.ts` — loads every tool then maps `generationCount: 0`

**File:** `src/app/api/admin/tools/route.ts:7-19`

```ts
const tools = await db.aiTool.findMany({ orderBy: [{ category: 'asc' }, { name: 'asc' }] })
const generations = await db.aiGeneration.count()
const totalCreditsUsed = await db.creditTransaction.aggregate({ where: { amount: { lt: 0 } }, _sum: { amount: true } })
return NextResponse.json({
  tools: tools.map((t) => ({ ...t, generationCount: 0 })),
  /* ... */
})
```

**Over-fetched:** Every AiTool field including `systemPrompt` and `userInputPrompt` (potentially kilobytes of text per tool) is loaded for the list view. The serializer spreads `...t` so all fields are returned to the client. Also, `generationCount: 0` is hardcoded — the comment is misleading; the actual count is never computed per tool.

**Fix:** `select: { id: true, slug: true, name: true, description: true, icon: true, category: true, creditCost: true, isVisible: true, isPro: true, createdAt: true, updatedAt: true }`. Compute `generationCount` per tool with `db.aiGeneration.groupBy({ by: ['toolId'], _count: { _all: true } })` if actually needed.

---

### 6.12 🟡 `/api/community/posts/[postId]/history/route.ts` — full PostHistory content fetched

**File:** `src/app/api/community/posts/[postId]/history/route.ts:30-33`

```ts
const history = await db.postHistory.findMany({
  where: { postId },
  orderBy: { createdAt: 'desc' },
})
```

The serializer at lines 46-54 returns `title`, `content`, `version`, `createdAt`, `editor`. `content` is the full post content at that version — for a long post (50 KB) with 20 edits, that's 1 MB per request. The history list view typically shows only `version`, `editor`, `createdAt` until the user expands a row.

**Fix:** Default to `select: { id: true, postId: true, title: true, version: true, createdAt: true, editedBy: true }` and add a `?includeContent=true` query param for the expand case.

---

## 7. Missing Pagination

### 7.1 🟠 `/api/data/courses/route.ts` GET — no `take`, no pagination

**File:** `src/app/api/data/courses/route.ts:8-11`

```ts
const courses = await db.course.findMany({
  orderBy: { createdAt: 'desc' },
  include: { sections: { include: { lessons: true }, orderBy: { position: 'asc' } } },
})
```

**Fix:** Add `take: 50` (or paginate with `skip`/`take`); add `where: { workspaceId }`.

---

### 7.2 🟠 `/api/data/products/route.ts` GET — no `take`, no pagination

**File:** `src/app/api/data/products/route.ts:8`

```ts
const products = await db.product.findMany({ orderBy: { createdAt: 'desc' } })
```

**Fix:** `take: 50` and `where: { workspaceId }`.

---

### 7.3 🟠 `/api/data/customers/route.ts` GET — `take: 100` is not real pagination

**File:** `src/app/api/data/customers/route.ts:8-11`

```ts
const customers = await db.customer.findMany({
  orderBy: { createdAt: 'desc' },
  take: 100,
})
```

**Fix:** Add `skip` + `where: { workspaceId }`; expose `?page=&pageSize=` like the community endpoints do.

---

### 7.4 🟠 `/api/data/orders/route.ts` GET — `take: 100` is not real pagination

**File:** `src/app/api/data/orders/route.ts:8-12`

```ts
const orders = await db.order.findMany({
  orderBy: { createdAt: 'desc' },
  take: 100,
  include: { product: { select: { name: true } } },
})
```

**Fix:** Same as §7.3. Also add `where: { workspaceId }`.

---

### 7.5 🟠 `/api/data/affiliates/route.ts` GET — no `take`, no pagination

**File:** `src/app/api/data/affiliates/route.ts:5`

```ts
const affiliates = await db.affiliate.findMany({ orderBy: { earnings: 'desc' } })
```

**Fix:** `take: 50`, `where: { workspaceId }`, and add `skip`/`take` pagination.

---

### 7.6 🟠 `/api/data/membership/route.ts` GET — no `take`, no pagination

**File:** `src/app/api/data/membership/route.ts:5`

```ts
const plans = await db.membershipPlan.findMany({ orderBy: { price: 'asc' } })
```

**Fix:** Bounded data (typically <20 plans per workspace) but still add `where: { workspaceId }` and a defensive `take: 100`.

---

### 7.7 🟠 `/api/data/blog/route.ts` GET — `take: 100` is not real pagination

**File:** `src/app/api/data/blog/route.ts:8`

```ts
const posts = await db.blogPost.findMany({ orderBy: { createdAt: 'desc' }, take: 100 })
```

**Fix:** Add `skip` and `where: { workspaceId }`.

---

### 7.8 🟠 `/api/data/pages/route.ts` GET — no `take`, no pagination

**File:** `src/app/api/data/pages/route.ts:9`

```ts
const pages = await db.page.findMany({ where, orderBy: { createdAt: 'desc' }, include: { _count: { select: { sections: true } } } })
```

**Fix:** `take: 50`, `where: { ...where, workspaceId }`, paginate with `skip`/`take`.

---

### 7.9 🟠 `/api/data/funnels/route.ts` GET — no `take`, no pagination

**File:** `src/app/api/data/funnels/route.ts:7`

```ts
const funnels = await db.funnel.findMany({ orderBy: { createdAt: 'desc' }, include: { steps: { orderBy: { position: 'asc' }, include: { page: { select: { id: true, title: true, slug: true } } } } } })
```

**Fix:** `take: 50`, `where: { workspaceId }`, paginate.

---

### 7.10 🟠 `/api/data/email/route.ts` GET — `take: 100` is not real pagination

**File:** `src/app/api/data/email/route.ts:7`

```ts
const campaigns = await db.emailCampaign.findMany({ orderBy: { createdAt: 'desc' }, take: 100 })
```

**Fix:** Add `skip` and `where: { workspaceId }`.

---

### 7.11 🟠 `/api/community/events/route.ts` GET — no `take`, no pagination

**File:** `src/app/api/community/events/route.ts:23-37`

```ts
const events = await db.communityEvent.findMany({
  where: { workspaceId: ctx.workspaceId, status: { not: 'CANCELLED' } },
  orderBy: { startTime: 'asc' },
  include: { user: true, _count: { select: { rsvps: true } }, rsvps: { where: { userId: ctx.user.id }, select: { status: true } } },
})
```

Returns every non-cancelled event in the workspace. A workspace that's been running for years could have thousands of past events.

**Fix:** Default `take: 50`, optional `?from=&to=` date range, and `where: { startTime: { gte: from, lt: to } }`.

---

### 7.12 🟠 `/api/community/spaces/route.ts` GET — no `take`, no pagination

**File:** `src/app/api/community/spaces/route.ts:21-27`

```ts
const spaces = await db.communitySpace.findMany({
  where: { workspaceId: ctx.workspaceId, status: 'ACTIVE' },
  orderBy: { createdAt: 'asc' },
})
```

Bounded data (typically <100 spaces per workspace), but defensive `take: 100` recommended.

---

### 7.13 🟠 `/api/community/posts/[postId]/history/route.ts` GET — no `take`

**File:** `src/app/api/community/posts/[postId]/history/route.ts:30-33`

```ts
const history = await db.postHistory.findMany({
  where: { postId },
  orderBy: { createdAt: 'desc' },
})
```

A heavily-edited post could have hundreds of history rows.

**Fix:** `take: 50` + pagination.

---

### 7.14 🟠 `/api/community/moderation/warnings/route.ts` GET — no `take`

**File:** `src/app/api/community/moderation/warnings/route.ts:39-42`

```ts
const warnings = await db.memberWarning.findMany({
  where: { memberId, workspaceId: ctx.workspaceId },
  orderBy: { createdAt: 'desc' },
})
```

A repeatedly-warned member could have hundreds of warnings.

**Fix:** `take: 50` + pagination.

---

## 8. Positive Findings

These are the queries that are done right — keep them as the reference standard for the rest of the codebase.

### 8.1 `src/lib/community.ts:23-61` — `getContext()` caching

```ts
let cached: ResolvedContext | null = null
export async function getContext(): Promise<ResolvedContext | null> {
  if (cached) return cached
  /* ... */
}
```

Caches the resolved workspace + user across the lifetime of a request (and across requests in dev). Avoids the four-query lookup (workspace, owner membership, fallback membership, user) running on every API call. In production this would be replaced by JWT/session auth, but the caching pattern is correct for the demo environment.

### 8.2 `src/lib/community.ts:169-176` — shared `paginate()` helper with safety clamps

```ts
export function paginate(page: number, pageSize: number, total: number) {
  const safePage = Math.max(1, page)
  const safeSize = Math.min(100, Math.max(1, pageSize))
  const skip = (safePage - 1) * safeSize
  const take = safeSize
  /* ... */
}
```

Single source of truth for pagination arithmetic. Clamps `pageSize` to 100 (DoS protection). Used by every community list endpoint.

### 8.3 `/api/community/notifications/route.ts:83-98` — batched actor lookup

```ts
const actorIds = Array.from(new Set(notifications.map((n) => n.actorId).filter((x): x is string => !!x)))
const actors = actorIds.length > 0
  ? await db.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true, avatarUrl: true } })
  : []
const actorMap = new Map(actors.map((u) => [u.id, u]))
```

The pattern for resolving N relations without N+1: collect IDs, dedupe, single `findMany` with `in:`, build a `Map`, hydrate in memory. This is correctly applied in:

- `/api/community/notifications/route.ts:83-98` (actors)
- `/api/community/invitations/route.ts:95-102` (inviters)
- `/api/community/posts/[postId]/history/route.ts:36-43` (editors)
- `/api/community/moderation/warnings/route.ts:45-55` (issuers)
- `/api/community/moderation/audit-log/route.ts:49-57` (actors)
- `/api/community/moderation/queue/route.ts:118-133` (reporters + resolvers)
- `/api/community/moderation/reports/route.ts:157-172` (reporters + resolvers)

### 8.4 `/api/community/posts/route.ts:251-264` — `db.$transaction([...])` for counter increments

```ts
await db.$transaction([
  db.workspaceMember.update({
    where: { id: ctx.memberId },
    data: { postsCount: { increment: 1 } },
  }),
  ...(spaceId
    ? [db.communitySpace.update({ where: { id: spaceId }, data: { postCount: { increment: 1 } } })]
    : []),
])
```

Two writes that must succeed or fail together are wrapped in a batched transaction. Same pattern is correctly applied in:

- `/api/community/posts/[postId]/route.ts:290-303` (DELETE counter decrement)
- `/api/community/posts/[postId]/comments/route.ts:217-226` (comment counter increment)
- `/api/community/posts/[postId]/comments/[commentId]/route.ts:134-143` (comment counter decrement)
- `/api/community/transfer-ownership/route.ts:57-66` (dual role swap)

### 8.5 `/api/community/notifications/[notificationId]/route.ts:21-31` — workspace + user scoped `findFirst` with `select`

```ts
const existing = await db.notification.findFirst({
  where: { id: notificationId, userId: ctx.user.id, workspaceId: ctx.workspaceId },
  select: { id: true },
})
```

Triple-scoped (id + user + workspace) and selects only the `id`. This is the canonical BOLA-safe lookup pattern. Same pattern in `/api/community/posts/[postId]/pin/route.ts:25-31`, `lock/route.ts:25-31`, `archive/route.ts:25-31`, `report/route.ts:23-29`, `react/route.ts:46-52`.

### 8.6 `/api/community/members/[memberId]/route.ts:80-111` — parallel `Promise.all` for independent reads

```ts
const [recentPosts, recentComments] = await Promise.all([
  db.communityPost.findMany({ where: { ... }, orderBy: { createdAt: 'desc' }, take: 10, select: { /* narrow */ } }),
  db.communityComment.findMany({ where: { ... }, orderBy: { createdAt: 'desc' }, take: 10, select: { /* narrow */ } }),
])
```

Two independent `findMany` calls issued in parallel rather than sequentially. Both have `take: 10`, both use `select` to fetch only the fields the serializer needs, and the comment query joins through `post: { workspaceId }` for workspace scoping.

### 8.7 `/api/community/posts/[postId]/comments/route.ts:217-226` — counter increment wrapped in transaction

Already cited in §8.4 — but worth noting that this handler also validates `isLocked` (line 163) and `isArchived` (line 157) before allowing the comment, and resolves the parent comment's author atomically (line 186-198) for the reply notification. Solid example of validation + transactional write + side-effect notification done right.

### 8.8 `/api/community/invitations/route.ts:180-196` — duplicate-detection guard before insert

```ts
if (email) {
  const existing = await db.invitation.findFirst({
    where: { workspaceId: ctx.workspaceId, email, status: 'PENDING' },
    select: { id: true },
  })
  if (existing) {
    return NextResponse.json({ error: 'A pending invitation for this email already exists in this workspace' }, { status: 409 })
  }
}
```

Pre-check for duplicate before insert, with `select: { id: true }` to minimise the read. Note: a unique constraint on `[workspaceId, email, status]` would be even better (race-safe), but the pre-check is the right pattern when the constraint can't be added.

### 8.9 `/api/community/moderation/reports/route.ts:251-266` — duplicate-report guard with composite condition

```ts
const existing = await db.moderationReport.findFirst({
  where: {
    workspaceId: ctx.workspaceId,
    reporterId: ctx.user.id,
    targetType, targetId,
    status: { in: ['PENDING', 'REVIEWING'] },
  },
  select: { id: true },
})
```

Prevents the same user from spamming reports on the same target while a previous report is still open. Composite filter on all relevant fields, narrow `select`. Same pattern in `/api/community/moderation/keywords/route.ts:123-132` for banned-keyword uniqueness.

### 8.10 `/api/community/events/rsvp/route.ts:40-68` — capacity check with existing-RSVP exception

```ts
const event = await db.communityEvent.findFirst({
  where: { id: eventId, workspaceId: ctx.workspaceId },
  select: { id: true, title: true, status: true, maxAttendees: true },
})
/* ... */
if (status === 'GOING' && event.maxAttendees !== null) {
  const goingCount = await db.eventRSVP.count({ where: { eventId, status: 'GOING' } })
  const existing = await db.eventRSVP.findUnique({
    where: { eventId_userId: { eventId, userId: ctx.user.id } },
    select: { status: true },
  })
  const wasGoing = existing?.status === 'GOING'
  if (!wasGoing && goingCount >= event.maxAttendees) {
    return NextResponse.json({ error: 'Event is at maximum capacity' }, { status: 409 })
  }
}
```

Capacity check that correctly excludes the caller's own prior GOING RSVP (so toggling GOING → MAYBE → GOING doesn't fail the cap). Uses the compound unique `eventId_userId` for the lookup. Then `upsert` at line 70 makes the actual mutation idempotent.

### 8.11 `/api/admin/generations/route.ts:6-11` — narrow `select` with `take`

```ts
const generations = await db.aiGeneration.findMany({
  orderBy: { createdAt: 'desc' },
  take: 50,
  select: { id: true, toolSlug: true, title: true, status: true, creditsUsed: true, createdAt: true },
})
```

Exactly the fields the admin list view needs, capped at 50 rows. The reference for how every `/api/data/*` GET should look.

---

## Appendix A — Schema Index Audit

Indexes that exist and are used well:
- `WorkspaceMember @@unique([userId, workspaceId])` + `@@index([workspaceId, memberStatus])`
- `CommunityPost @@index([workspaceId, createdAt])` + `@@index([spaceId, createdAt])`
- `CommunityComment @@index([postId, createdAt])` + `@@index([parentId])`
- `CommunitySpace @@unique([workspaceId, slug])` + `@@index([workspaceId])`
- `CommunityEvent @@index([workspaceId, startTime])`
- `EventRSVP @@unique([eventId, userId])`
- `Invitation @@index([workspaceId, status])` + `@@index([email])`
- `Notification @@index([userId, read])` + `@@index([workspaceId, createdAt])`
- `ModerationReport @@index([workspaceId, status])` + `@@index([targetType, targetId])`
- `BannedKeyword @@index([workspaceId])`
- `AuditLog @@index([workspaceId, createdAt])` + `@@index([actorId])`
- `MemberWarning @@index([workspaceId])`
- `EmailCampaign @@index([workspaceId, status])` + `@@index([workspaceId, createdAt])`
- `PostHistory @@index([postId])`

Indexes missing (see §3.10):
- `Course`, `Product`, `Order`, `Customer`, `Affiliate`, `WebPage`, `MembershipPlan`, `BlogPost`, `Page`, `Funnel` — all need `@@index([workspaceId])`
- `Section` — `@@index([courseId])`
- `Lesson` — `@@index([sectionId])`
- `PageSection` — `@@index([pageId])`
- `FunnelStep` — `@@index([funnelId])`
- `Enrollment` — `@@index([userId])` + `@@index([courseId])`
- `AiGeneration` — `@@index([userId, createdAt])` + `@@index([toolId])`
- `CreditTransaction` — `@@index([userId, createdAt])`
- `Page` — `@@index([slug])` (lookups by slug in public routes)

---

## Appendix B — Recommended Next Actions (priority order)

1. **Add workspace scoping to every `/api/data/*` route** (§4.1–§4.7, §4.13–§4.15). This is the only Critical-class defect: live tenant data leak. Estimated effort: ~1 day, mechanical change.
2. **Add auth to every `/api/admin/*` route** (§4.9–§4.12). Currently any unauthenticated caller can rewrite AI providers, tools, flags, and admin settings.
3. **Wrap credit deduction + ledger write in `db.$transaction([...])`** in every `/api/ai/*` route (§5.2, §5.3). One-line fix per route.
4. **Add the missing indexes** listed in §3.10 / Appendix A. One Prisma migration, zero code changes.
5. **Replace the `for`-loop inserts in `/api/ai/publish-course`, `/api/ai/landing-page`, `/api/data/courses/duplicate`, `/api/data/page-sections` DELETE** with nested `create` + `db.$transaction` (§1.1, §1.2, §1.3, §1.4, §5.1).
6. **Replace `include: { user: true }` with `select`** in the 10 files listed in §6.3–§6.7. Mechanical, low-risk.
7. **Add `take` + `where: { workspaceId }` to every unbounded `/api/data/*` GET** (§7.1–§7.10).
8. **Consolidate `/api/data/dashboard` and `/api/data/analytics`** into a single KPI endpoint backed by `aggregate` queries, not `findMany` + reduce (§3.1, §3.2, §2.3).
9. **Switch `/api/community/posts` and `/api/community/members` to cursor pagination** (§3.13).
10. **Replace the `reactions` JSON read-modify-write** in `/api/community/posts/[postId]/react` with a normalised `Reaction` table + `upsert` (§5.11).
