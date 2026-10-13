# CreatorLedger / TCH Financials
## Shared Design System and Page Migration Plan

**Audience:** Antigravity IDE implementation agent  
**Scope:** Frontend visual and responsive standardization only  
**Backend changes:** Not required  
**API changes:** Not required  
**Database changes:** Not required

---

## 1. Objective

Create one consistent visual language for Admin, Member, Creator and Accounts views while preserving all existing API behavior, permissions, routes and business workflows.

The implementation must be incremental:

```text
tokens → shared primitives → shared shell → page migration → responsive pass → cleanup
```

Do not rewrite the application in one pass. Migrate one page, validate it, then continue.

---

## 2. Non-goals

Do not change:

- Backend controllers or services
- Database schema or migrations
- Authentication
- Role permissions
- Bright Data integration
- OpenAI integration
- Campaign state transitions
- Existing API request or response shapes
- Existing chart data transformations
- Native mobile applications

This is a UI, layout, copy and responsive behavior project.

---

## 3. Repository rules

Before editing a file:

1. Search for existing components and styles.
2. Reuse an existing component when it already solves the problem.
3. Use shadcn/Radix patterns only where they remove duplication or improve accessibility.
4. Do not add a dependency for a component that can be implemented with existing code.
5. Do not create a new abstraction for a pattern used on only one page.
6. Preserve existing API hooks and mutation handlers.
7. Keep each page migration independently reviewable.

Run after each page:

```bash
cd frontend
npm run typecheck
git diff --check
```

Run before final completion:

```bash
cd frontend
npm run typecheck
npm run build
git diff --check
```

---

## 4. Current architecture to preserve

Existing important locations:

```text
frontend/app/globals.css
frontend/app/creator-portal/creator-flow.css
frontend/components/Sidebar.tsx
frontend/components/PageHeader.tsx
frontend/components/MetricCard.tsx
frontend/components/DataTable.tsx
frontend/components/Pagination.tsx
frontend/components/QueryErrorState.tsx
frontend/components/ui/Button.tsx
frontend/components/ui/Input.tsx
frontend/components/ui/Select.tsx
frontend/components/ui/Dialog.tsx
frontend/components/ui/Tag.tsx
frontend/components/ui/Card.tsx
frontend/components/ui/StatusPill.tsx
frontend/styles/tokens.css
frontend/features/campaign-content/
frontend/app/commercial/
frontend/app/creator-portal/
frontend/app/payments/
frontend/app/accounts-dashboard/
```

The Admin shell currently uses `Sidebar.tsx`. The Creator portal has its own layout in:

```text
frontend/app/creator-portal/layout.tsx
```

Do not duplicate either shell. Consolidate only where the existing behavior is compatible.

---

## 5. Design foundations

### 5.1 Typography

Use Inter as the product default wherever available.

```text
Page title:       28–32px, weight 600–700
Section title:    18–20px, weight 600
Body:             14–16px, weight 400
Supporting text:  12–13px, weight 400–500
Labels:           11–12px, weight 500–600
```

Avoid excessive bold text. Use spacing, size and color hierarchy before increasing weight.

### 5.2 Color tokens

Use tokens from `frontend/styles/tokens.css`. Do not add one-off hex values inside page components.

```css
--app-bg: #f7f7f5;
--app-surface: #ffffff;
--app-surface-muted: #f1f2ef;
--app-fg: #202124;
--app-muted: #6b7280;
--app-border: #e5e7eb;
--app-brand: #4f46e5;
--app-brand-soft: #eef2ff;
--app-success: #15803d;
--app-success-soft: #dcfce7;
--app-warning: #a16207;
--app-warning-soft: #fef3c7;
--app-danger: #b91c1c;
--app-danger-soft: #fee2e2;
--app-ai: #7c3aed;
--app-ai-soft: #ede9fe;
```

Color rules:

- Brand color: primary actions, active navigation, selected tabs and links.
- Success: approved, paid and completed states.
- Warning: waiting, pending and incomplete states.
- Danger: errors, rejected states and destructive actions.
- AI accent: generated suggestions only. Do not reuse status colors for AI.

### 5.3 Spacing and shape

Use the existing token scale:

```text
4, 8, 12, 16, 24, 32px
```

Use:

```text
Small control radius: 8px
Cards and panels:     12px
Large sections:       16px
Borders:              subtle 1px borders
Shadows:              minimal, only for overlays or elevated menus
```

---

## 6. Shared component contract

Use existing shadcn-style components where available. Keep components presentational and let pages own data fetching.

### 6.1 Required shared components

```text
frontend/components/ui/
  Button.tsx
  Card.tsx
  StatusPill.tsx
  Badge.tsx
  Input.tsx
  Select.tsx
  Textarea.tsx
  Tabs.tsx
  Table.tsx
  Dialog.tsx
  Drawer.tsx
  Popover.tsx
  Skeleton.tsx
  EmptyState.tsx
  Alert.tsx
  Pagination.tsx
```

Do not add every file immediately. Add or consolidate a component when the next page needs it.

### 6.2 Layout components

```text
frontend/components/layout/
  AppShell.tsx
  Sidebar.tsx
  Topbar.tsx
  PageHeader.tsx
  FilterBar.tsx
  MobileNavigation.tsx
```

The existing `Sidebar.tsx` and creator layout should be reused and gradually aligned. Avoid replacing both shells at once.

### 6.3 Component rules

Every interactive component must provide:

- Keyboard access
- Visible focus state
- Disabled state
- Loading state where it triggers a mutation
- Accessible label or visible label
- Minimum 44px touch target on mobile

Every data component must provide:

- Loading state
- Empty state
- Error state
- Permission-aware action visibility

---

## 7. Shared application shell

### Desktop

```text
┌──────────── Sidebar ────────────┬──────────── Main ────────────┐
│ workspace / role navigation     │ Topbar                       │
│                                 │ Page header                  │
│                                 │ Content                      │
│ account menu                    │                              │
└─────────────────────────────────┴──────────────────────────────┘
```

### Mobile

- Sidebar becomes a drawer.
- Topbar remains visible.
- Page title and primary action remain accessible.
- Filters move into a drawer or sheet.
- Tables become cards or horizontal scroll containers.
- Do not hide critical actions behind hover.

The shell must accept role-specific navigation without duplicating layout markup:

```tsx
<AppShell role="creator" navigation={creatorNavigation}>
  {children}
</AppShell>
```

The shell must not decide business permissions. The API and existing role checks remain authoritative.

---

## 8. Page migration order

Migrate in vertical slices. Complete and validate one page before starting the next.

### Slice A — Admin campaigns

Routes:

```text
/commercial
/commercial/[id]
```

Tasks:

- Use shared page header.
- Use shared Card for metrics.
- Use shared StatusPill for campaign status.
- Keep existing filters and API hooks.
- Make table usable on mobile.
- Preserve card/table view toggle.
- Preserve edit and detail actions.
- Add consistent loading, empty and error states.

Acceptance:

- Existing campaigns still load.
- Filters still update results.
- Add/edit campaign still works.
- Status colors use semantic tokens.
- Mobile view remains usable.

### Slice B — Admin payments

Routes:

```text
/payments
/payments/*
```

Tasks:

- Standardize metric cards.
- Standardize invoice/payment status.
- Reuse DataTable and Pagination.
- Convert filters to shared FilterBar.
- Preserve all payment mutations.

### Slice C — Creator campaign workspace

Routes:

```text
/creator-portal/campaigns
/creator-portal/campaigns/[id]/brief
```

Tasks:

- Keep Brief / Ideas / Feedback behavior.
- Keep References / Ideas / Submitted rail.
- Use shared Card, StatusPill, Skeleton and EmptyState.
- Keep AI generation and campaign reference APIs unchanged.
- Preserve URL state for `view` and `panel`.
- Validate mobile interaction for rail, cards and forms.

### Slice D — Creator brand kit and content library

Routes:

```text
/creator-portal/media-kit
/creator-portal/portfolio
/creator-portal/profile
/creator-portal/socials
```

Tasks:

- Standardize section cards.
- Make featured content editing obvious.
- Keep image and snapshot behavior unchanged.
- Add responsive card sizing.
- Keep publishing and removal actions intact.

### Slice E — Creator work and earnings

Routes:

```text
/creator-portal/deals
/creator-portal/enquiries
/creator-portal/invoices
/creator-portal/payments
```

Tasks:

- Use shared status labels.
- Use shared financial metric cards.
- Use shared tables and empty states.
- Preserve invoice and payment behavior.

### Slice F — Accounts

Routes:

```text
/accounts-dashboard
/payments
/entity-summary
```

Tasks:

- Standardize financial overview cards.
- Standardize transactions and payment tables.
- Use the same status vocabulary as Admin.
- Keep fiscal year and existing filters working.

### Slice G — Member

Reuse Admin pages and components.

Change only:

- Navigation visibility
- Available actions
- Editable fields
- Financial visibility

Do not create a separate member component system.

---

## 9. Charts

Existing chart components:

```text
frontend/components/BillingBarChart.tsx
frontend/components/CreatorDashboardCharts.tsx
frontend/components/DonutChart.tsx
frontend/components/TrajectoryAreaChart.tsx
```

Do not rewrite working charts during the first migration pass.

When a chart page is migrated:

- Use token-based colors.
- Add a consistent chart container.
- Add responsive sizing.
- Add accessible labels where practical.
- Add loading and empty states.
- Keep the current data transformation.

Only add Recharts or shadcn chart patterns if a new chart is required or an existing chart needs substantial work.

---

## 10. Page implementation checklist

For every page:

```text
[ ] Existing route preserved
[ ] Existing API query preserved
[ ] Existing mutation preserved
[ ] Permission behavior preserved
[ ] Shared shell applied
[ ] Shared PageHeader applied
[ ] Shared tokens used
[ ] Shared components reused
[ ] Loading state present
[ ] Empty state present
[ ] Error state present
[ ] Disabled state present
[ ] Keyboard focus checked
[ ] Desktop checked
[ ] Tablet checked
[ ] Mobile checked
[ ] Typecheck passes
[ ] Diff check passes
[ ] Old duplicate styles removed only after migration
```

---

## 11. Acceptance criteria

The implementation is complete only when:

1. Admin, Member, Creator and Accounts use the same token vocabulary.
2. Shared primitives have consistent spacing, typography and focus behavior.
3. No migrated page introduces new one-off colors for existing states.
4. Existing API actions work without changes.
5. Mobile layouts do not hide critical actions.
6. Tables remain usable on small screens.
7. Loading, empty and error states are consistent.
8. Typecheck and build pass.
9. Old styles are removed only after their pages are migrated.

---

## 12. Rollback strategy

Each page migration should be a small commit or isolated diff.

If a migrated page breaks:

1. Revert only that page’s visual changes.
2. Keep the shared tokens and primitives if they are unused elsewhere.
3. Do not revert backend or API work because this plan does not modify it.
4. Fix the shared primitive if the defect affects multiple pages.

---

## 13. Ponytail constraints

Skip until there is a demonstrated need:

- Separate native desktop and mobile applications
- A standalone design-system package
- A full atomic-design hierarchy
- A widget registry
- Theme customization
- A charting rewrite
- A new state-management layer
- API changes for visual work

The implementation should stop at the smallest complete solution: shared tokens, a few reusable primitives, responsive shells and page-by-page migration.
