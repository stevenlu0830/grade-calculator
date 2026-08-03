# Conventions

> Patterns actually observed in this codebase. Follow them; don't introduce competing ones.

## Imports

- Always `@/...` for `src` — never relative `../`. Exception: sibling components inside `src/components/` use `./ComponentCard`.
- Order: types → local components → lib/helpers → `@/components/ui/*` → `lucide-react` icons → React hooks.
- Icons: `lucide-react` only, sized with classes (`h-4 w-4`), never an icon library mix.

## Components

- Named `export function Foo({...}: FooProps)` for feature components; `export default` **only** for pages.
- Props interface declared immediately above the component, named `<Component>Props`. Not exported.
- Callbacks are `on<Verb>` (`onUpdate`, `onDelete`, `onAddSubComponent`) and are prop-drilled — parents close over IDs so children never see them:
  ```tsx
  onUpdate={updates => onUpdateComponent(component.id, updates)}
  ```
- Partial updates: mutations take `Partial<T>`, never individual field setters.
- No `React.FC`. No `memo`/`useMemo` anywhere — grade math is cheap and recomputed on render.
- Feature components are presentational: **only `Index.tsx` touches the store.** Don't call `useGradeStore` deeper in the tree.
- Local UI-only state (`isOpen`, `showAdvanced`) lives in the component. Domain state never does.

## State & data

- Immutable updates via spread + `.map`/`.filter`. Never mutate; never add Immer/Redux/Zustand.
- Every store action is wrapped in `useCallback` with `[]` deps (uses functional `setCourses(prev => ...)`).
- `null` means "not set" for all numeric fields. Never use `0` or `undefined` as the empty value.
- Nullable reads use `??`, not `||`, so a real `0` survives: `component.weight ?? ''`.
- Persistence is implicit — the store's `useEffect` autosaves. Never write `localStorage` from a component.

## Grade logic

- All math lives in `src/lib/gradeCalculations.ts` as pure functions. No calculation inline in JSX.
- Functions returning a grade return `number | null`; `null` propagates rather than defaulting to 0.
- Clamp to `[0, 100]` at every ingest boundary — store `updateSubComponent` and `parseCSV` both do it.
- Never render a raw number: pass through `formatGrade`/`GradeDisplay` so `—` and 1-dp formatting stay consistent.
- Course-level totals are gated on `getTotalWeight(...) === 100` by the caller, not by the calc function.

## Styling

- Tailwind utilities inline. No CSS modules, no styled-components, no new `.css` files.
- Semantic tokens only — `bg-background`, `text-muted-foreground`, `border-border`, `text-grade-good`. **Never** raw colors like `text-red-500`.
- New colors: add an HSL var to both `:root` and `.dark` in `src/index.css`, then map it in `tailwind.config.ts`.
- Conditional classes use `cn()` from `@/lib/utils`; template literals are acceptable for a single toggle.
- Numeric values get `font-mono`; the `.grade-display` utility adds `tabular-nums`.
- Entry animations: `animate-fade-in` (containers) / `animate-scale-in` (cards).

## UI kit

- `src/components/ui/*` is vendored shadcn. Don't hand-edit — add via `npx shadcn@latest add <name>` and compose wrappers instead.
- Toasts: `import { toast } from 'sonner'`. Use `toast.success` / `toast.error`. The shadcn `use-toast` hook is legacy — don't add usages.

## TypeScript

- `strict` is **off**. Still annotate props, return types on lib functions, and avoid new `any` — the one existing cast (`doc as any` in the PDF export) is a jsPDF workaround, not a pattern.
- Domain types live in `src/types/grades.ts`. Don't redeclare shapes locally; use `Partial<Component>` etc.

## Naming & files

- Feature components `PascalCase.tsx`; lib/hooks/types `camelCase.ts`; shadcn primitives stay `kebab-case.tsx`.
- One feature component per file, named after the file.
- Handlers `handle<Event>` inside components, `on<Event>` when crossing a prop boundary.

## Tests

- Vitest + jsdom, globals enabled — `describe`/`it`/`expect` need no import (the existing file imports them anyway; either is fine).
- Location: `src/**/*.test.ts(x)`, colocated or under `src/test/`.
- Prefer testing `src/lib/*` pure functions over rendering; `@testing-library/react` is available if you must.

## Commits

- Short imperative subject, no scope prefix or Conventional Commits: `Fix CSV import column padding`, `Add weighted grade column to PDF`.
- Avoid the bare `Changes` messages that dominate the existing history.
