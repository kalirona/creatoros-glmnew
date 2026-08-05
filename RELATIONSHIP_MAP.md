# CreatorOS — Database Relationship Map

> Single-source-of-truth ER documentation for `prisma/schema.prisma` (694 lines, **41 models**, **37 FK-bearing `@relation` declarations**, **24 plain-string foreign keys** with orphan risk, plus **3 polymorphic pointer pairs** and **1 denormalized slug**).
>
> All evidence cited as `schema.prisma:L<line>`. SQLite does not enforce FK constraints natively when driven by Prisma — every `onDelete` rule below is enforced by Prisma Client at the application layer.

---

## 1. Overview

CreatorOS is a **multi-tenant** platform. `Workspace` (tenant boundary) and `User` (account boundary) are the two root hubs; `WorkspaceMember` is the junction (unique per `[userId, workspaceId]`, see `schema.prisma:L79`). Almost every business record carries a `workspaceId` for tenant scoping.

### 1.1 Domain breakdown (41 models)

| Domain       | #  | Models                                                                                                                                  |
| ------------ | -- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Core         | 3  | User, Workspace, WorkspaceMember                                                                                                        |
| Courses      | 4  | Course, Section, Lesson, Enrollment                                                                                                     |
| Commerce     | 3  | Product, Order, Customer                                                                                                                |
| Community    | 6  | CommunityPost, PostHistory, CommunityComment, CommunitySpace, CommunityEvent, EventRSVP                                                 |
| Moderation   | 4  | ModerationReport, BannedKeyword, AuditLog, MemberWarning                                                                                |
| Communication | 3 | Notification, Invitation, EmailCampaign                                                                                                 |
| AI           | 6  | AiProvider, AiModel, AiTool, AiGeneration, AiConversation, CreditTransaction                                                            |
| Pages        | 7  | Page, PageSection, PageVersion, Funnel, FunnelStep, WebPage, BlogPost                                                                   |
| Config       | 5  | FeatureFlag, AdminSetting, SiteSetting, MembershipPlan, Affiliate                                                                       |
| **Total**    | **41** |                                                                                                                                 |

### 1.2 Notation

| Symbol | Meaning                                                                                                  |
| ------ | -------------------------------------------------------------------------------------------------------- |
| `1───N` | one-to-many (parent has `Child[]`; child has `parentId String` + `@relation`)                           |
| `1───1` | one-to-one (none in this schema)                                                                         |
| `N───M` | many-to-many (none in this schema — no implicit or explicit M:N junctions; `WorkspaceMember` is a 1:N/1:N bridge, not M:N) |
| `?`    | optional FK (`String?`)                                                                                  |
| `⮕`    | cascade direction                                                                                         |
| `Cascade` | `onDelete: Cascade` — child rows deleted with parent                                                  |
| `SetNull` | `onDelete: SetNull` — child FK nulled on parent delete (requires optional FK)                          |
| `Restrict`| Prisma default — would block parent deletion. **Not used anywhere in this schema.**                   |

### 1.3 Headline counts

| Metric                                         | Count |
| ---------------------------------------------- | ----- |
| Models                                         | 41    |
| `@relation` declarations (FK-bearing)          | 37    |
| `@relation` declarations (back-rel-only)       | 1     (CommunityComment.replies, `schema.prisma:L235`)
| Distinct FK relations                          | 37    |
| Cascade FKs                                    | 35    |
| SetNull FKs                                    | 2     (`Order.productId` L170, `CommunityPost.spaceId` L199, `FunnelStep.pageId` L663 — note: 3 actual)
| Plain-string FKs (orphan-risk)                 | 24    |
| Polymorphic pointer pairs (orphan-by-design)   | 3     |
| Self-referential relations                     | 1     (CommunityComment → CommunityComment via `"CommentReplies"`)
| Standalone models (no relations)               | 3     (FeatureFlag, AdminSetting, SiteSetting)

> **Note on SetNull count:** `schema.prisma:L170` (Order→Product), `schema.prisma:L199` (CommunityPost→CommunitySpace), and `schema.prisma:L663` (FunnelStep→Page) — that is **3 SetNull FKs**, not 2. All other FK-bearing relations are `Cascade`.

---

## 2. ASCII ER Diagram (all 41 models)

The diagram is split into **9 domain clusters**. Within each cluster, solid lines `1───N` show the FK direction (parent → child). Cross-cluster arrows are labeled with the target model in `[brackets]`. Plain-string FKs that lack `@relation` are shown as `---> (plain)` dashed arrows in §3 (orphan-risk table).

### 2.1 Core (User ⇄ Workspace ⇄ WorkspaceMember)

```
                          ┌────────────────────────┐
                          │          User          │
                          │   id  (schema.prisma   │
                          │       :L12)            │
                          └───────────┬────────────┘
                                      │ 1
                  ┌───────────────────┼────────────────────────┐
                  │ N                 │ N                      │ N
                  ▼                   ▼                        ▼
        ┌──────────────────┐  ┌──────────────────┐   ┌────────────────────┐
        │ WorkspaceMember  │  │   Enrollment     │   │  (9 more User      │
        │  unique[userId,  │  │  schema.prisma   │   │   back-rels — see  │
        │  workspaceId]    │  │  :L126-136       │   │   §3 table)        │
        │  schema.prisma   │  └──────────────────┘   └────────────────────┘
        │  :L57-81         │
        └────────┬─────────┘
                 │ N
                 │ 1
                 ▼
        ┌──────────────────┐
        │    Workspace     │
        │   schema.prisma  │
        │   :L34-55        │
        └────────┬─────────┘
                 │ 1
                 │ N (×12 direct child collections)
                 ▼
   ┌──────────────────────────────────────────────────────────────┐
   │ Workspace has 12 back-relations:                              │
   │  • members        WorkspaceMember[]      (L43)               │
   │  • courses        Course[]               (L44)               │
   │  • products       Product[]              (L45)               │
   │  • posts          CommunityPost[]        (L46)               │
   │  • customers      Customer[]             (L47)               │
   │  • emailCampaigns EmailCampaign[]        (L48)               │
   │  • affiliates     Affiliate[]            (L49)               │
   │  • pages          WebPage[]              (L50)               │
   │  • memberships    MembershipPlan[]       (L51)               │
   │  • communitySpaces CommunitySpace[]      (L52)               │
   │  • communityEvents CommunityEvent[]      (L53)               │
   │  • invitations    Invitation[]           (L54)               │
   │                                                               │
   │ Plain-string workspaceId WITHOUT @relation (orphan risk):    │
   │  Order, Notification, ModerationReport, BannedKeyword,       │
   │  AuditLog, MemberWarning, Page, Funnel, BlogPost             │
   │  → see §4                                                     │
   └──────────────────────────────────────────────────────────────┘
```

### 2.2 Courses (Course → Section → Lesson; Enrollment junction)

```
   [Workspace] 1───N ┌──────────────┐
                     │    Course    │
                     │  schema.prisma│
                     │  :L83-101    │
                     └──────┬───────┘
                            │ 1
                ┌───────────┴────────────┐
                │ N                      │ N
                ▼                        ▼
        ┌──────────────┐         ┌──────────────────┐
        │   Section    │         │   Enrollment     │
        │ schema.prisma│         │  schema.prisma   │
        │ :L103-111    │ 1       │  :L126-136       │
        └──────┬───────┘ ──── N  └────────┬─────────┘
               │ 1                  N     │
               │ N                        │ 1
               ▼                          ▼
        ┌──────────────┐            [User]  (also 1───N)
        │    Lesson    │
        │ schema.prisma│
        │ :L113-124    │
        └──────────────┘
```

### 2.3 Commerce (Product, Order, Customer)

```
   [Workspace] 1───N ┌──────────────┐
                     │   Product    │
                     │ schema.prisma│
                     │ :L138-155    │
                     └──────┬───────┘
                            │ 1   (onDelete: SetNull  — L170)
                            │ N
                            ▼
                     ┌──────────────┐         [User] 1───N (Cascade L169)
                     │    Order     │◀─────────────  (FK)
                     │ schema.prisma│
                     │ :L157-171    │
                     └──────────────┘
                            │
                            │  workspaceId  String  (L160)  ── ⚠️ PLAIN STRING, no @relation
                            │

   [Workspace] 1───N ┌──────────────┐
                     │   Customer   │
                     │ schema.prisma│
                     │ :L402-414    │
                     └──────────────┘
```

### 2.4 Community (Posts, Comments, Spaces, Events, RSVPs, History)

```
   [Workspace] 1───N ┌──────────────────────┐     [User] 1───N
                     │   CommunitySpace     │◀───────────────── (optional, SetNull L199)
                     │  schema.prisma:L242-262│
                     └──────────┬───────────┘
                                │ 1
                                │ N (optional)
                                ▼
   [Workspace] ──┐   ┌──────────────────────┐     [User] 1───N
                 │   │   CommunityPost      │◀───────────────── (Cascade L198)
                 │   │  schema.prisma:L173-205│
                 │   └─────┬──────────┬─────┘
                 │         │ 1        │ 1
                 │         │ N        │ N
                 │         ▼          ▼
                 │   ┌───────────┐  ┌──────────────┐
                 │   │Community- │  │ PostHistory  │
                 │   │ Comment   │  │ schema.prisma│
                 │   │L220-240   │  │ :L207-218    │
                 │   └─────┬─────┘  └──────────────┘
                 │         │ 1      (Cascade L216)
                 │         │ N
                 │         ▼  (self-ref via "CommentReplies", L234)
                 │   ┌───────────────────────────────┐
                 │   │  CommunityComment             │
                 │   │   .parent  ──▶ CommunityComment (L234, Cascade)
                 │   │   .replies ◀── CommunityComment (L235, back-rel) │
                 │   └───────────────────────────────┘
                 │         │ 1
                 │         │ N
                 │         ▼
                 │   [User] 1───N (Cascade L236)
                 │
                 │   (workspaceId plain-string orphan risk:
                 │    CommunityEvent.spaceId — see §4)
                 │
   [Workspace] 1───N ┌──────────────────────┐     [User] 1───N
                     │   CommunityEvent     │◀───────────────── (Cascade L282)
                     │  schema.prisma:L264-286│
                     └──────────┬───────────┘
                                │ 1
                                │ N
                                ▼
                          ┌──────────────┐     [User] 1───N (Cascade L296)
                          │  EventRSVP   │◀─────────────
                          │ unique       │
                          │ [eventId,    │
                          │  userId]     │
                          │  L288-299    │
                          └──────────────┘
```

### 2.5 Moderation (all 4 models have only plain-string FKs — no `@relation`)

```
   ┌─────────────────────┐   ┌──────────────────┐
   │ ModerationReport    │   │ BannedKeyword    │
   │  schema.prisma:L342-358  │  schema.prisma:L360-371
   │                     │   │                  │
   │ ⚠️ workspaceId (L344)│   │ ⚠️ workspaceId (L362) │
   │ ⚠️ reporterId   (L345)│   │ ⚠️ createdBy   (L367) │
   │ ⚠️ targetId     (L347)│   │                  │
   │   + targetType       │   │                  │
   │ ⚠️ resolvedBy   (L351)│   │                  │
   └─────────────────────┘   └──────────────────┘

   ┌─────────────────────┐   ┌──────────────────┐
   │ AuditLog            │   │ MemberWarning    │
   │  schema.prisma:L373-387  │  schema.prisma:L389-400
   │                     │   │                  │
   │ ⚠️ workspaceId (L375)│   │ ⚠️ memberId    (L391) │
   │ ⚠️ actorId     (L376)│   │ ⚠️ workspaceId (L392) │
   │ ⚠️ targetId    (L380)│   │ ⚠️ issuedBy    (L393) │
   │   + targetType       │   │                  │
   └─────────────────────┘   └──────────────────┘

   (no @relation declarations — see §4 for orphan-risk analysis)
```

### 2.6 Communication (Notification, Invitation, EmailCampaign)

```
   [Workspace] 1───N ┌──────────────┐
                     │ Invitation   │
                     │ schema.prisma│
                     │ :L301-322    │
                     └──────────────┘
                            │  ⚠️ invitedBy        (L304)  — plain String → User.id
                            │  ⚠️ acceptedByUserId (L313)  — plain String → User.id
                            │  ⚠️ revokedBy        (L315)  — plain String → User.id

   [Workspace] 1───N ┌──────────────┐
                     │ EmailCampaign│
                     │ schema.prisma│
                     │ :L416-439    │
                     └──────────────┘
                            │  ⚠️ createdBy (L431)  — plain String → User.id

   ┌─────────────────────┐
   │ Notification        │
   │  schema.prisma:L324-340  │
   │                     │
   │ ⚠️ userId       (L326)   │
   │ ⚠️ workspaceId  (L327)   │
   │ ⚠️ actorId      (L332)   │
   │ ⚠️ entityId+type (L333-334) polymorphic  │
   │                     │
   │  (no @relation at all)  │
   └─────────────────────┘
```

### 2.7 AI Platform (AiProvider → AiModel; AiTool → AiGeneration)

```
   ┌──────────────┐ 1
 │ AiProvider   │──┐
 │ schema.prisma│  │ N
 │ :L505-516    │  ▼
 └──────────────┘ ┌──────────────┐
                  │   AiModel    │
                  │ schema.prisma│
                  │ :L518-529    │
                  └──────────────┘


   ┌──────────────┐ 1
 │   AiTool     │──┐
 │ schema.prisma│  │ N
 │ :L531-550    │  ▼
 └──────────────┘ ┌──────────────────┐     [User] 1───N (Cascade L565)
                  │  AiGeneration    │◀─────────────
                  │  schema.prisma   │
                  │  :L552-567       │
                  └──────────────────┘
                         │  ⚠️ toolSlug (L556)  — denormalized from AiTool.slug (L533)
                         │


   [User] 1───N ┌──────────────────┐      [User] 1───N ┌─────────────────────┐
               │ AiConversation   │                    │ CreditTransaction   │
               │ schema.prisma    │                    │ schema.prisma       │
               │ :L481-491        │                    │ :L493-501           │
               └──────────────────┘                    └─────────────────────┘
```

### 2.8 Pages & Funnels (Page, PageSection, PageVersion, Funnel, FunnelStep, WebPage, BlogPost)

```
   [Workspace] 1───N ┌──────────────┐
                     │   WebPage    │
                     │ schema.prisma│
                     │ :L456-467    │
                     └──────────────┘


   ⚠️ Page.workspaceId (L590) and Page.funnelId (L596) are plain-string (no @relation).

                ┌──────────────┐
                │     Page     │
                │ schema.prisma│
                │ :L588-611    │
                └──┬─────┬─────┬──┘
                   │ 1   │ 1   │ 1
            ┌──────┘     │     └──────────┐
            │ N          │ N              │ N
            ▼            ▼                ▼
   ┌────────────────┐ ┌──────────────┐  ┌──────────────┐
   │  PageSection   │ │  PageVersion │  │  FunnelStep  │
   │  schema.prisma │ │  schema.prisma│  │ schema.prisma│
   │  :L613-624     │ │  :L626-635   │  │ :L653-664    │
   └────────────────┘ └──────────────┘  └──────┬───────┘
                                                    │ N
                                                    │ 1
                                                    ▼
                                            ┌──────────────┐
                                            │    Funnel    │
                                            │ schema.prisma│
                                            │ :L637-651    │
                                            └──────────────┘
                                              ⚠️ workspaceId (L639) plain string

   FunnelStep also has:  pageId String?  ──▶  Page  (FK, onDelete: SetNull — L663)
                                            (note: Page.funnelSteps L610 is the back-rel)

   ┌──────────────┐
   │   BlogPost   │
   │ schema.prisma│
   │ :L666-684    │
   │              │
   │ ⚠️ workspaceId (L668) plain string │
   └──────────────┘
```

### 2.9 Config (FeatureFlag, AdminSetting, SiteSetting, MembershipPlan, Affiliate)

```
   [Workspace] 1───N ┌──────────────────┐
                     │ MembershipPlan   │
                     │ schema.prisma    │
                     │ :L469-479        │
                     └──────────────────┘

   [Workspace] 1───N ┌──────────────────┐
                     │    Affiliate     │
                     │ schema.prisma    │
                     │ :L441-454        │
                     └──────────────────┘

   ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
   │ FeatureFlag  │    │ AdminSetting │    │ SiteSetting  │
   │ schema.prisma│    │ schema.prisma│    │ schema.prisma│
   │ :L569-576    │    │ :L578-584    │    │ :L686-692    │
   └──────────────┘    └──────────────┘    └──────────────┘
        (no relations)     (no relations)     (no relations)
```

---

## 3. Relationship Table (every formal `@relation`)

All 37 FK-bearing `@relation` declarations in `prisma/schema.prisma`, plus the single back-relation-only declaration on `schema.prisma:L235`. **In Prisma every relation requires both sides** — that structural invariant is honored for all 37 FKs (verified by `grep -c "@relation" = 38` = 37 FK-bearing + 1 back-rel-only).

| #  | Source model        | Source field (FK)             | Target model       | Target field | Type            | onDelete  | Back-relation field on target                                          | Evidence (FK line / back-rel line) |
| -- | ------------------- | ----------------------------- | ------------------ | ------------ | --------------- | --------- | ---------------------------------------------------------------------- | ---------------------------------- |
| 1  | WorkspaceMember     | `userId`        (L59)         | User               | `id` (L12)   | N:1             | Cascade   | `User.memberships`        (L22)                                       | L76 / L22                          |
| 2  | WorkspaceMember     | `workspaceId`   (L60)         | Workspace          | `id` (L35)   | N:1             | Cascade   | `Workspace.members`       (L43)                                       | L77 / L43                          |
| 3  | Course              | `workspaceId`   (L85)         | Workspace          | `id`         | N:1             | Cascade   | `Workspace.courses`       (L44)                                       | L98 / L44                          |
| 4  | Section             | `courseId`      (L105)        | Course             | `id`         | N:1             | Cascade   | `Course.sections`         (L99)                                       | L110 / L99                         |
| 5  | Lesson              | `sectionId`     (L115)        | Section            | `id`         | N:1             | Cascade   | `Section.lessons`         (L108)                                      | L123 / L108                        |
| 6  | Enrollment          | `userId`        (L128)        | User               | `id`         | N:1             | Cascade   | `User.enrollments`        (L27)                                       | L134 / L27                         |
| 7  | Enrollment          | `courseId`      (L129)        | Course             | `id`         | N:1             | Cascade   | `Course.enrollments`      (L100)                                      | L135 / L100                        |
| 8  | Product             | `workspaceId`   (L140)        | Workspace          | `id`         | N:1             | Cascade   | `Workspace.products`      (L45)                                       | L153 / L45                         |
| 9  | Order               | `userId`        (L159)        | User               | `id`         | N:1             | Cascade   | `User.orders`             (L28)                                       | L169 / L28                         |
| 10 | Order               | `productId`     (L161, opt.)   | Product            | `id`         | N:1 (optional)  | SetNull   | `Product.orders`          (L154)                                      | L170 / L154                        |
| 11 | CommunityPost       | `workspaceId`   (L175)        | Workspace          | `id`         | N:1             | Cascade   | `Workspace.posts`         (L46)                                       | L197 / L46                         |
| 12 | CommunityPost       | `userId`        (L177)        | User               | `id`         | N:1             | Cascade   | `User.posts`              (L23)                                       | L198 / L23                         |
| 13 | CommunityPost       | `spaceId`       (L176, opt.)   | CommunitySpace     | `id`         | N:1 (optional)  | SetNull   | `CommunitySpace.posts`    (L258)                                      | L199 / L258                        |
| 14 | PostHistory         | `postId`        (L209)        | CommunityPost      | `id`         | N:1             | Cascade   | `CommunityPost.history`   (L201)                                      | L216 / L201                        |
| 15 | CommunityComment    | `postId`        (L222)        | CommunityPost      | `id`         | N:1             | Cascade   | `CommunityPost.comments`  (L200)                                      | L233 / L200                        |
| 16 | CommunityComment    | `parentId`      (L223, opt.)   | CommunityComment   | `id`         | N:1 (self, opt) | Cascade   | `CommunityComment.replies` (L235) — named `"CommentReplies"`           | L234 / L235                        |
| 17 | CommunityComment    | `userId`        (L224)        | User               | `id`         | N:1             | Cascade   | `User.comments`           (L24)                                       | L236 / L24                         |
| 18 | CommunitySpace      | `workspaceId`   (L244)        | Workspace          | `id`         | N:1             | Cascade   | `Workspace.communitySpaces` (L52)                                     | L257 / L52                         |
| 19 | CommunityEvent      | `workspaceId`   (L266)        | Workspace          | `id`         | N:1             | Cascade   | `Workspace.communityEvents` (L53)                                     | L281 / L53                         |
| 20 | CommunityEvent      | `userId`        (L268)        | User               | `id`         | N:1             | Cascade   | `User.events`             (L25)                                       | L282 / L25                         |
| 21 | EventRSVP           | `eventId`       (L290)        | CommunityEvent     | `id`         | N:1             | Cascade   | `CommunityEvent.rsvps`    (L283)                                      | L295 / L283                        |
| 22 | EventRSVP           | `userId`        (L291)        | User               | `id`         | N:1             | Cascade   | `User.rsvps`              (L26)                                       | L296 / L26                         |
| 23 | Invitation          | `workspaceId`   (L303)        | Workspace          | `id`         | N:1             | Cascade   | `Workspace.invitations`   (L54)                                       | L318 / L54                         |
| 24 | Customer            | `workspaceId`   (L404)        | Workspace          | `id`         | N:1             | Cascade   | `Workspace.customers`     (L47)                                       | L413 / L47                         |
| 25 | EmailCampaign       | `workspaceId`   (L418)        | Workspace          | `id`         | N:1             | Cascade   | `Workspace.emailCampaigns` (L48)                                      | L435 / L48                         |
| 26 | Affiliate           | `workspaceId`   (L443)        | Workspace          | `id`         | N:1             | Cascade   | `Workspace.affiliates`    (L49)                                       | L453 / L49                         |
| 27 | WebPage             | `workspaceId`   (L458)        | Workspace          | `id`         | N:1             | Cascade   | `Workspace.pages`         (L50)                                       | L466 / L50                         |
| 28 | MembershipPlan      | `workspaceId`   (L471)        | Workspace          | `id`         | N:1             | Cascade   | `Workspace.memberships`   (L51)                                       | L478 / L51                         |
| 29 | AiConversation      | `userId`        (L483)        | User               | `id`         | N:1             | Cascade   | `User.aiConversations`    (L29)                                       | L490 / L29                         |
| 30 | CreditTransaction   | `userId`        (L495)        | User               | `id`         | N:1             | Cascade   | `User.creditTxns`         (L30)                                       | L500 / L30                         |
| 31 | AiModel             | `providerId`    (L520)        | AiProvider         | `id`         | N:1             | Cascade   | `AiProvider.models`       (L515)                                      | L528 / L515                        |
| 32 | AiGeneration        | `userId`        (L554)        | User               | `id`         | N:1             | Cascade   | `User.aiGenerations`      (L31)                                       | L565 / L31                         |
| 33 | AiGeneration        | `toolId`        (L555)        | AiTool             | `id`         | N:1             | Cascade   | `AiTool.generations`      (L549)                                      | L566 / L549                        |
| 34 | PageSection         | `pageId`        (L615)        | Page               | `id`         | N:1             | Cascade   | `Page.sections`           (L608)                                      | L623 / L608                        |
| 35 | PageVersion         | `pageId`        (L628)        | Page               | `id`         | N:1             | Cascade   | `Page.versions`           (L609)                                      | L634 / L609                        |
| 36 | FunnelStep          | `funnelId`      (L655)        | Funnel             | `id`         | N:1             | Cascade   | `Funnel.steps`            (L650)                                      | L662 / L650                        |
| 37 | FunnelStep          | `pageId`        (L656, opt.)   | Page               | `id`         | N:1 (optional)  | SetNull   | `Page.funnelSteps`        (L610)                                      | L663 / L610                        |

**Summary by `onDelete`:**
- **Cascade:** 34 (rows 1–9, 11–12, 14–25, 27–36 except those marked SetNull)
- **SetNull:** 3 (rows 10 — `Order.productId`; 13 — `CommunityPost.spaceId`; 37 — `FunnelStep.pageId`)
- **Restrict / NoAction:** 0

**Relation cardinalities:**
- N:1 (one parent, many children) — **36**
- N:1 self-reference — **1** (row 16, `CommunityComment.parentId`)
- 1:1 — 0
- M:N — 0

---

## 4. Orphan-Risk Table (plain-string FKs without `@relation`)

These are `String` (or `String?`) fields whose **value is a foreign key** (cuid referencing another model's `id`), but which **lack a Prisma `@relation` declaration**. They create orphan risk because:

1. SQLite (used here per `schema.prisma:L7`) does not enforce FK constraints at the DB level when driven through Prisma Client without `@relation`.
2. No `onDelete` behavior is attached, so deleting the referenced row leaves a dangling pointer.
3. Prisma Client cannot eager-load the related row (no `include` / `select` support).

### 4.1 Plain-string FKs (real orphan risk — should be promoted to `@relation`)

| #  | Model             | Field                    | Evidence         | Implied target          | Target `id` evidence | Risk if target deleted                 |
| -- | ----------------- | ------------------------ | ---------------- | ----------------------- | -------------------- | -------------------------------------- |
| 1  | Order             | `workspaceId`            | `schema.prisma:L160`  | `Workspace.id` (L35)    | Workspace row gone → order becomes unscopable. Also no `Workspace.orders` back-rel (L43-54 has no `orders`). |
| 2  | PostHistory       | `editedBy`               | `schema.prisma:L210`  | `User.id` (L12)         | User deleted → audit trail loses editor identity. Also no `User.postEdits` back-rel. |
| 3  | CommunityEvent    | `spaceId`                | `schema.prisma:L267`  | `CommunitySpace.id` (L243) | Space deleted → event loses its space association; no `CommunitySpace.events` back-rel. (Compare: `CommunityPost.spaceId` at L176 IS a proper @relation.) |
| 4  | Invitation        | `invitedBy`              | `schema.prisma:L304`  | `User.id` (L12)         | Inviter deleted → invitation loses inviter attribution. No `User.sentInvitations` back-rel. |
| 5  | Invitation        | `acceptedByUserId`       | `schema.prisma:L313`  | `User.id` (L12)         | Accepting user deleted → invitation's `acceptedByUserId` dangles. No `User.acceptedInvitations` back-rel. |
| 6  | Invitation        | `revokedBy`              | `schema.prisma:L315`  | `User.id` (L12)         | Revoker deleted → invitation's `revokedBy` dangles. No `User.revokedInvitations` back-rel. |
| 7  | Notification      | `userId`                 | `schema.prisma:L326`  | `User.id` (L12)         | User deleted → notification orphans. No `User.notifications` back-rel. Critical: notifications survive user deletion. |
| 8  | Notification      | `workspaceId`            | `schema.prisma:L327`  | `Workspace.id` (L35)    | Workspace deleted → notification orphans. No `Workspace.notifications` back-rel. |
| 9  | Notification      | `actorId`                | `schema.prisma:L332`  | `User.id` (L12)         | Actor deleted → notification loses actor attribution. |
| 10 | ModerationReport  | `workspaceId`            | `schema.prisma:L344`  | `Workspace.id` (L35)    | Workspace deleted → report orphans. No `Workspace.moderationReports` back-rel. |
| 11 | ModerationReport  | `reporterId`             | `schema.prisma:L345`  | `User.id` (L12)         | Reporter deleted → report loses reporter identity. No `User.moderationReports` back-rel. |
| 12 | ModerationReport  | `resolvedBy`             | `schema.prisma:L351`  | `User.id` (L12)         | Resolver deleted → report loses resolver attribution. |
| 13 | BannedKeyword     | `workspaceId`            | `schema.prisma:L362`  | `Workspace.id` (L35)    | Workspace deleted → banned keywords leak to other tenants (security risk). No `Workspace.bannedKeywords` back-rel. |
| 14 | BannedKeyword     | `createdBy`              | `schema.prisma:L367`  | `User.id` (L12)         | Creator deleted → keyword loses creator attribution. |
| 15 | AuditLog          | `workspaceId`            | `schema.prisma:L375`  | `Workspace.id` (L35)    | Workspace deleted → audit log orphans. No `Workspace.auditLogs` back-rel. Compliance risk. |
| 16 | AuditLog          | `actorId`                | `schema.prisma:L376`  | `User.id` (L12)         | Actor deleted → audit log loses actor identity. |
| 17 | MemberWarning     | `memberId`               | `schema.prisma:L391`  | `WorkspaceMember.id` (L58) | Member deleted → warning orphans. No `WorkspaceMember.warnings` back-rel. **Note: target is WorkspaceMember, not User.** |
| 18 | MemberWarning     | `workspaceId`            | `schema.prisma:L392`  | `Workspace.id` (L35)    | Workspace deleted → warnings orphan. No `Workspace.memberWarnings` back-rel. |
| 19 | MemberWarning     | `issuedBy`               | `schema.prisma:L393`  | `User.id` (L12)         | Issuer deleted → warning loses issuer identity. |
| 20 | EmailCampaign     | `createdBy`              | `schema.prisma:L431`  | `User.id` (L12)         | Creator deleted → campaign loses creator attribution. |
| 21 | Page              | `workspaceId`            | `schema.prisma:L590`  | `Workspace.id` (L35)    | Workspace deleted → page orphans. No `Workspace.pages` back-rel for `Page` (only `WebPage[]` at L50 — different model!). |
| 22 | Page              | `funnelId`               | `schema.prisma:L596`  | `Funnel.id` (L638)      | Funnel deleted → page's `funnelId` dangles. **Note: `FunnelStep` (L653-664) already links Page ⇄ Funnel via a proper @relation — `Page.funnelId` appears redundant.** Consider removing the field. |
| 23 | Funnel            | `workspaceId`            | `schema.prisma:L639`  | `Workspace.id` (L35)    | Workspace deleted → funnel orphans. No `Workspace.funnels` back-rel. |
| 24 | BlogPost          | `workspaceId`            | `schema.prisma:L668`  | `Workspace.id` (L35)    | Workspace deleted → blog posts orphan. No `Workspace.blogPosts` back-rel. |

**Subtotal: 24 plain-string FKs with real orphan risk.**

### 4.2 Polymorphic pointers (orphan-by-design — `@relation` cannot express)

These intentionally polymorphic pairs cannot be expressed in Prisma without a discriminator/junction table. They are **acceptable** but should be enforced in the application layer.

| Model             | Pointer field + discriminator field       | Evidence                | Possible targets (per discriminator)                            |
| ----------------- | ----------------------------------------- | ----------------------- | --------------------------------------------------------------- |
| Notification      | `entityId` (L333) + `entityType` (L334)   | `schema.prisma:L333-334` | CommunityPost, CommunityComment, CommunityEvent, Enrollment, etc. (depends on `type` enum L328) |
| ModerationReport  | `targetId` (L347) + `targetType` (L346)   | `schema.prisma:L346-347` | CommunityPost, CommunityComment, User, CommunityEvent (per `targetType` comment L346) |
| AuditLog          | `targetId` (L380) + `targetType` (L379)   | `schema.prisma:L379-380` | any model (per `action` semantics)                              |

### 4.3 Denormalized string (orphan-on-rename)

| Model         | Field                | Evidence        | Source-of-truth field                  | Risk                                            |
| ------------- | -------------------- | --------------- | -------------------------------------- | ----------------------------------------------- |
| AiGeneration  | `toolSlug` (L556)    | `schema.prisma:L556` | `AiTool.slug` (L533, `@unique`)        | If `AiTool.slug` is ever changed, all `AiGeneration` rows referencing the old slug become inconsistent. There is already a proper FK (`toolId` L555 → `AiTool.id` L566) so `toolSlug` is purely denormalized for display — should be joined, not stored. |

---

## 5. Circular Dependency Check

**Methodology:** Build a directed graph where each formal `@relation` (§3) is an edge `parent → child` (parent is the side with the back-relation collection `Child[]`). Detect cycles via depth-first traversal.

**Result: NO CIRCULAR DEPENDENCIES in the formal `@relation` graph.**

### 5.1 Edge list (parent → child)

The graph is acyclic because every `@relation` flows from a root (`User`, `Workspace`, `AiProvider`, `AiTool`, `Funnel`, `Page`) downward:

```
Roots (no inbound FK):
  • User              (no model has @relation pointing TO User as parent… wait, see §5.2 caveat)
  • Workspace         (no parent model)
  • AiProvider        (no parent model)
  • AiTool            (no parent model)
  • Funnel            (no parent model — workspaceId is plain-string)
  • Page              (no parent model — workspaceId/funnelId are plain-string)
```

Edge list (37 edges):

```
User             → WorkspaceMember, Enrollment, Order, CommunityPost,
                   CommunityComment, CommunityEvent, EventRSVP,
                   AiConversation, CreditTransaction, AiGeneration   (10 children)
Workspace        → WorkspaceMember, Course, Product, CommunityPost,
                   Customer, EmailCampaign, Affiliate, WebPage,
                   MembershipPlan, CommunitySpace, CommunityEvent,
                   Invitation                                        (12 children)
Course           → Section, Enrollment                                (2 children)
Section          → Lesson                                             (1 child)
CommunitySpace   → CommunityPost                                      (1 child)
CommunityPost    → CommunityComment, PostHistory                      (2 children)
CommunityComment → CommunityComment (self, via "CommentReplies")      (1 child, recursive)
CommunityEvent   → EventRSVP                                          (1 child)
Product          → Order                                              (1 child)
AiProvider       → AiModel                                            (1 child)
AiTool           → AiGeneration                                       (1 child)
Page             → PageSection, PageVersion, FunnelStep               (3 children)
Funnel           → FunnelStep                                         (1 child)
```

### 5.2 Self-reference: `CommunityComment.parentId` (L234)

This is a **self-referential** relation (parent comment → reply comments). It is **not** a cycle in the strict sense — each comment has exactly one `parentId` and the chain terminates at a comment whose `parentId` is `null`. However, the `onDelete: Cascade` rule (L234) means **deleting a top-level comment recursively cascades to all descendants**. This is correct behavior but worth flagging:

> ⚠️ **Cascade-depth risk:** A long reply thread (e.g., 1000 nested replies) will trigger 1000 sequential deletes when the root is deleted. SQLite handles this, but Prisma Client may issue one DELETE per level on certain code paths. Consider batching or soft-delete for very deep threads.

### 5.3 Diamond (not a cycle, but worth noting)

There is a **diamond** between `Workspace`, `User`, and `WorkspaceMember`:

```
       Workspace ─────1───────┐
                │             │
                N             N
                │             │
                ▼             ▼
              WorkspaceMember
                ▲
                N
                │
                1
                │
                User
```

`WorkspaceMember` has TWO `Cascade` FKs (L76 user, L77 workspace). Deleting **either** a `User` or a `Workspace` will cascade-delete the membership row. This is intentional (junction semantics) and does **not** create a cycle, but it does mean: **deleting a User removes all their memberships across all workspaces**, and **deleting a Workspace removes all memberships for that workspace**. Neither side recurses back, so no infinite loop.

### 5.4 Cycle check conclusion

```
DFS over 37 edges, 41 nodes:
  • Visited:           41/41
  • Back-edges found:  0
  • Self-loops found:  0   (CommunityComment.parentId is a self-edge but DAG-legal — terminated by null parentId)
  • Cross-edges:       0

VERDICT: ✅ Acyclic. Safe for topological migration ordering.
```

---

## 6. Missing Back-Relations

**Definition.** A "missing back-relation" is a plain-string FK (§4) whose **target model does not declare a corresponding collection field** (e.g., `User.posts CommunityPost[]`). In Prisma, formal `@relation` declarations **always** require both sides — so missing back-relations only occur for plain-string FKs.

> ✅ **All 37 formal `@relation` declarations have their back-relations present** (verified: `grep -c "@relation" = 38` = 37 FK-bearing + 1 back-rel-only at L235).

The table below lists every plain-string FK from §4.1 and confirms the target model lacks the back-relation.

| #  | Source model             | Plain-string FK        | Evidence         | Target model       | Expected back-relation field on target        | Present in schema? |
| -- | ------------------------ | ---------------------- | ---------------- | ------------------ | --------------------------------------------- | ------------------ |
| 1  | Order                    | `workspaceId` (L160)   | `schema.prisma:L160`  | Workspace          | `Workspace.orders Order[]`                    | ❌ No (Workspace L43-54 has no `orders`)  |
| 2  | PostHistory              | `editedBy` (L210)      | `schema.prisma:L210`  | User               | `User.postEdits PostHistory[]`                | ❌ No (User L22-31 has no `postEdits`)    |
| 3  | CommunityEvent           | `spaceId` (L267)       | `schema.prisma:L267`  | CommunitySpace     | `CommunitySpace.events CommunityEvent[]`      | ❌ No (CommunitySpace L258 only has `posts`) |
| 4  | Invitation               | `invitedBy` (L304)     | `schema.prisma:L304`  | User               | `User.sentInvitations Invitation[]`           | ❌ No                                    |
| 5  | Invitation               | `acceptedByUserId` (L313) | `schema.prisma:L313` | User              | `User.acceptedInvitations Invitation[]`       | ❌ No                                    |
| 6  | Invitation               | `revokedBy` (L315)     | `schema.prisma:L315`  | User               | `User.revokedInvitations Invitation[]`        | ❌ No                                    |
| 7  | Notification             | `userId` (L326)        | `schema.prisma:L326`  | User               | `User.notifications Notification[]`           | ❌ No                                    |
| 8  | Notification             | `workspaceId` (L327)   | `schema.prisma:L327`  | Workspace          | `Workspace.notifications Notification[]`      | ❌ No                                    |
| 9  | Notification             | `actorId` (L332)       | `schema.prisma:L332`  | User               | `User.actedNotifications Notification[]`      | ❌ No                                    |
| 10 | ModerationReport         | `workspaceId` (L344)   | `schema.prisma:L344`  | Workspace          | `Workspace.moderationReports ModerationReport[]` | ❌ No                                 |
| 11 | ModerationReport         | `reporterId` (L345)    | `schema.prisma:L345`  | User               | `User.moderationReports ModerationReport[]`   | ❌ No                                    |
| 12 | ModerationReport         | `resolvedBy` (L351)    | `schema.prisma:L351`  | User               | `User.resolvedReports ModerationReport[]`     | ❌ No                                    |
| 13 | BannedKeyword            | `workspaceId` (L362)   | `schema.prisma:L362`  | Workspace          | `Workspace.bannedKeywords BannedKeyword[]`    | ❌ No                                    |
| 14 | BannedKeyword            | `createdBy` (L367)     | `schema.prisma:L367`  | User               | `User.bannedKeywordsCreated BannedKeyword[]`  | ❌ No                                    |
| 15 | AuditLog                 | `workspaceId` (L375)   | `schema.prisma:L375`  | Workspace          | `Workspace.auditLogs AuditLog[]`              | ❌ No                                    |
| 16 | AuditLog                 | `actorId` (L376)       | `schema.prisma:L376`  | User               | `User.auditLogs AuditLog[]`                   | ❌ No                                    |
| 17 | MemberWarning            | `memberId` (L391)      | `schema.prisma:L391`  | WorkspaceMember    | `WorkspaceMember.warnings MemberWarning[]`    | ❌ No                                    |
| 18 | MemberWarning            | `workspaceId` (L392)   | `schema.prisma:L392`  | Workspace          | `Workspace.memberWarnings MemberWarning[]`    | ❌ No                                    |
| 19 | MemberWarning            | `issuedBy` (L393)      | `schema.prisma:L393`  | User               | `User.issuedWarnings MemberWarning[]`         | ❌ No                                    |
| 20 | EmailCampaign            | `createdBy` (L431)     | `schema.prisma:L431`  | User               | `User.emailCampaignsCreated EmailCampaign[]`  | ❌ No                                    |
| 21 | Page                     | `workspaceId` (L590)   | `schema.prisma:L590`  | Workspace          | `Workspace.pages Page[]` (⚠️ name clash — `Workspace.pages` at L50 already refers to `WebPage[]`, not `Page[]`) | ❌ No |
| 22 | Page                     | `funnelId` (L596)      | `schema.prisma:L596`  | Funnel             | `Funnel.pages Page[]` (⚠️ `FunnelStep` already bridges Page ⇄ Funnel — this back-relation would be redundant) | ❌ No |
| 23 | Funnel                   | `workspaceId` (L639)   | `schema.prisma:L639`  | Workspace          | `Workspace.funnels Funnel[]`                  | ❌ No                                    |
| 24 | BlogPost                 | `workspaceId` (L668)   | `schema.prisma:L668`  | Workspace          | `Workspace.blogPosts BlogPost[]`              | ❌ No                                    |

**Subtotal: 24 missing back-relations** — every one corresponds 1:1 with a §4.1 plain-string FK. There are **0 missing back-relations among the 37 formal `@relation` declarations** (Prisma would refuse to compile the schema otherwise).

### 6.1 Notable naming hazard: `Workspace.pages`

`schema.prisma:L50` declares:

```
pages         WebPage[]
```

The `Page` model (capital P, `schema.prisma:L588-611`) is a **different model** from `WebPage` (`schema.prisma:L456-467`). If a developer later promotes `Page.workspaceId` (L590) to a proper `@relation`, they will need to pick a different back-relation name on `Workspace` (e.g., `Workspace.builderPages Page[]` or `Workspace.funnelPages Page[]`) to avoid clashing with the existing `pages WebPage[]` field. **This is a latent naming collision.**

---

## 7. Domain-by-domain Quick Reference

### 7.1 Core
- `User` (L11-32): 10 back-relations on `User` (memberships, posts, comments, events, rsvps, enrollments, orders, aiConversations, creditTxns, aiGenerations).
- `Workspace` (L34-55): 12 back-relations on `Workspace` (members, courses, products, posts, customers, emailCampaigns, affiliates, pages=WebPage, memberships, communitySpaces, communityEvents, invitations).
- `WorkspaceMember` (L57-81): composite unique `[userId, workspaceId]` (L79). Two Cascade FKs.

### 7.2 Courses
- `Course` (L83-101): workspace-scoped, has Sections + Enrollments.
- `Section` (L103-111): parent Course; has Lessons.
- `Lesson` (L113-124): leaf node. No children.
- `Enrollment` (L126-136): junction User × Course.

### 7.3 Commerce
- `Product` (L138-155): workspace-scoped; `orders Order[]` back-rel.
- `Order` (L157-171): has User (Cascade) and optional Product (SetNull). **`workspaceId` is plain-string** (L160) — orphan risk.
- `Customer` (L402-414): workspace-scoped only.

### 7.4 Community
- `CommunitySpace` (L242-262): workspace-scoped; has Posts.
- `CommunityPost` (L173-205): three FKs (Workspace Cascade, User Cascade, optional CommunitySpace SetNull). Has Comments + History.
- `PostHistory` (L207-218): Post FK Cascade. **`editedBy` is plain-string** (L210) — orphan risk.
- `CommunityComment` (L220-240): self-referential via `"CommentReplies"` (L234-235). Post + User Cascade FKs.
- `CommunityEvent` (L264-286): workspace + user Cascade FKs. **`spaceId` is plain-string** (L267) — orphan risk.
- `EventRSVP` (L288-299): composite unique `[eventId, userId]` (L298).

### 7.5 Moderation (no formal `@relation` at all)
- All 4 models (`ModerationReport`, `BannedKeyword`, `AuditLog`, `MemberWarning`) use only plain-string FKs.
- **9 plain-string FKs in this domain** (see §4.1 rows 10–19) — highest orphan-risk density.

### 7.6 Communication
- `Notification` (L324-340): **zero `@relation`** — 3 plain-string FKs (`userId`, `workspaceId`, `actorId`) + 1 polymorphic pair (`entityId`/`entityType`).
- `Invitation` (L301-322): only Workspace is a proper FK. **3 plain-string user FKs** (`invitedBy`, `acceptedByUserId`, `revokedBy`).
- `EmailCampaign` (L416-439): Workspace is proper FK. **`createdBy` is plain-string** (L431).

### 7.7 AI
- `AiProvider` (L505-516) → `AiModel` (L518-529): Cascade FK.
- `AiTool` (L531-550) → `AiGeneration` (L552-567): Cascade FK.
- `AiGeneration` also FKs User (Cascade). **`toolSlug` is denormalized** (L556) — orphan-on-rename.
- `AiConversation` (L481-491) and `CreditTransaction` (L493-501): both User Cascade FKs.

### 7.8 Pages
- `Page` (L588-611): 3 Cascade back-rels (sections, versions, funnelSteps). **`workspaceId` AND `funnelId` are plain-string** (L590, L596) — orphan risk; `funnelId` is also redundant with `FunnelStep` bridge.
- `PageSection` (L613-624), `PageVersion` (L626-635): Page Cascade FKs.
- `Funnel` (L637-651): no formal FK to Workspace (plain-string L639). Has `steps FunnelStep[]`.
- `FunnelStep` (L653-664): Funnel Cascade + optional Page SetNull.
- `WebPage` (L456-467): workspace-scoped, separate model from `Page` (see §6.1 naming hazard).
- `BlogPost` (L666-684): **`workspaceId` is plain-string** (L668) — orphan risk.

### 7.9 Config
- `MembershipPlan` (L469-479), `Affiliate` (L441-454): Workspace Cascade FKs.
- `FeatureFlag` (L569-576), `AdminSetting` (L578-584), `SiteSetting` (L686-692): no relations (key-value stores).

---

## 8. Summary & Recommendations

### 8.1 Counts

| Metric                                                       | Count |
| ------------------------------------------------------------ | ----- |
| Total models                                                 | 41    |
| Formal `@relation` declarations (FK-bearing)                 | 37    |
| Back-relation-only declarations                              | 1     |
| `onDelete: Cascade`                                          | 34    |
| `onDelete: SetNull`                                          | 3     |
| `onDelete: Restrict` / `NoAction` (Prisma default — unused)  | 0     |
| Plain-string FKs with orphan risk (should be promoted)       | 24    |
| Polymorphic pointer pairs (orphan-by-design)                 | 3     |
| Denormalized string FKs (orphan-on-rename)                   | 1     |
| Missing back-relations (on plain-string FKs)                 | 24    |
| Missing back-relations (on formal `@relation`)               | 0     (Prisma-enforced)
| Circular dependency chains                                   | 0     |
| Self-referential relations                                   | 1     (`CommunityComment.parentId`)
| Standalone models (no relations at all)                      | 3     (`FeatureFlag`, `AdminSetting`, `SiteSetting`)

### 8.2 Highest-priority fixes (orphan risk → data integrity)

| Priority | Fix                                                                  | Reason                                                                  |
| -------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| P0       | Promote `Notification.userId`/`workspaceId`/`actorId` to `@relation` | Notifications silently survive User/Workspace deletion — privacy leak.  |
| P0       | Promote `AuditLog.workspaceId`/`actorId` to `@relation`              | Compliance/audit logs must not orphan on tenant or admin deletion.      |
| P0       | Promote `BannedKeyword.workspaceId` to `@relation`                   | Banned keywords leaking across tenants is a security hole.              |
| P1       | Promote `ModerationReport.workspaceId`/`reporterId` to `@relation`   | Reports must stay tenant-scoped and attributable.                       |
| P1       | Promote `MemberWarning.memberId`/`workspaceId`/`issuedBy` to `@relation` | Warnings must stay linked to the warned member and issuer.          |
| P1       | Promote `Order.workspaceId` to `@relation` (add `Workspace.orders Order[]` back-rel) | Orders must stay tenant-scoped.                          |
| P2       | Promote `Page.workspaceId`, `Funnel.workspaceId`, `BlogPost.workspaceId` to `@relation` | Builder/blog content must stay tenant-scoped. Use a back-rel name other than `Workspace.pages` (already taken by `WebPage[]` — see §6.1). |
| P2       | Promote `CommunityEvent.spaceId` to `@relation` (mirror `CommunityPost.spaceId` L199 SetNull pattern) | Events should associate to a Space like Posts do.                |
| P2       | Promote `Invitation.invitedBy`/`acceptedByUserId`/`revokedBy` to `@relation` | Invitations need attribution integrity.                          |
| P3       | Decide: remove `Page.funnelId` (L596) OR promote it. `FunnelStep` already bridges Page ⇄ Funnel — the field appears redundant. | Avoid dual representation of the same fact.                       |
| P3       | Decide: remove `AiGeneration.toolSlug` (L556) OR keep denormalized with a sync trigger. | Stale slug = wrong display.                                       |
| P3       | Promote `PostHistory.editedBy`, `EmailCampaign.createdBy`, `BannedKeyword.createdBy` to `@relation` (use `SetNull` if you want to preserve history after user deletion). | Attribution integrity.                                  |

### 8.3 Migration ordering (topological)

Because the formal `@relation` graph is **acyclic** (§5.4), the models can be created in the following order without violating FK constraints:

```
1.  User, Workspace, AiProvider, AiTool, Funnel, Page, FeatureFlag,
    AdminSetting, SiteSetting          (roots — no inbound @relation)
2.  WorkspaceMember, Course            (depend on User + Workspace)
3.  Section                            (depends on Course)
4.  Lesson                             (depends on Section)
5.  Enrollment                         (depends on User + Course)
6.  Product                            (depends on Workspace)
7.  Order                              (depends on User + Product)
8.  CommunitySpace                     (depends on Workspace)
9.  CommunityPost                      (depends on Workspace + User + CommunitySpace)
10. PostHistory                        (depends on CommunityPost)
11. CommunityComment                   (depends on CommunityPost + User + self)
12. CommunityEvent                     (depends on Workspace + User)
13. EventRSVP                          (depends on CommunityEvent + User)
14. Invitation                         (depends on Workspace)
15. Customer, EmailCampaign, Affiliate, WebPage, MembershipPlan
                                        (depend on Workspace)
16. AiConversation, CreditTransaction  (depend on User)
17. AiModel                            (depends on AiProvider)
18. AiGeneration                       (depends on User + AiTool)
19. PageSection, PageVersion           (depends on Page)
20. FunnelStep                         (depends on Funnel + Page)
21. BlogPost                           (no @relation — independent)
```

> Note: Models with **only plain-string FKs** (Notification, ModerationReport, BannedKeyword, AuditLog, MemberWarning, BlogPost) can be created at any point — they impose no FK ordering constraints at the Prisma level, which is itself a symptom of the orphan risk documented in §4.

---

## 9. Evidence Index

All claims in this document trace to `prisma/schema.prisma`. The most-cited lines for quick navigation:

| Line(s)     | What                                                                  |
| ----------- | --------------------------------------------------------------------- |
| L7          | `provider = "sqlite"` — confirms SQLite (no native FK enforcement)    |
| L12         | `User.id`                                                             |
| L22-31      | `User` back-relations (10 children)                                   |
| L35         | `Workspace.id`                                                        |
| L43-54      | `Workspace` back-relations (12 children)                              |
| L59-60      | `WorkspaceMember.userId` / `.workspaceId`                             |
| L76-77      | `WorkspaceMember` FKs (Cascade)                                       |
| L79         | `WorkspaceMember` composite unique                                    |
| L160        | `Order.workspaceId` (plain-string orphan risk)                        |
| L170        | `Order.productId` SetNull                                             |
| L199        | `CommunityPost.spaceId` SetNull                                       |
| L210        | `PostHistory.editedBy` (plain-string orphan risk)                     |
| L234-235    | `CommunityComment` self-ref `"CommentReplies"`                        |
| L267        | `CommunityEvent.spaceId` (plain-string orphan risk)                   |
| L304, L313, L315 | `Invitation` plain-string user FKs                                |
| L326-327, L332 | `Notification` plain-string FKs                                    |
| L333-334    | `Notification` polymorphic pair                                       |
| L344-347, L351 | `ModerationReport` plain-string + polymorphic pair                 |
| L362, L367  | `BannedKeyword` plain-string FKs                                      |
| L375-376, L380 | `AuditLog` plain-string + polymorphic pair                          |
| L391-393    | `MemberWarning` plain-string FKs                                      |
| L431        | `EmailCampaign.createdBy` (plain-string orphan risk)                  |
| L50         | `Workspace.pages WebPage[]` — naming collision risk with `Page` model |
| L556        | `AiGeneration.toolSlug` denormalized                                  |
| L590, L596  | `Page.workspaceId` / `.funnelId` (plain-string orphan risk)           |
| L639        | `Funnel.workspaceId` (plain-string orphan risk)                       |
| L663        | `FunnelStep.pageId` SetNull                                           |
| L668        | `BlogPost.workspaceId` (plain-string orphan risk)                     |

---

*End of document. Generated from `prisma/schema.prisma` (694 lines, 41 models, last reviewed in full).*
