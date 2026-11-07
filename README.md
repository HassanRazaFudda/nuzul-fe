# Nuzul frontend

React 19.3, TypeScript 6, Vite 8, React Compiler, Tailwind CSS 4.3, React Router 8, TanStack Query 5.

This is a prototype running on sample data in the browser (IndexedDB). There is no server and no login yet. Do not enter real bookings.

**All work here follows `../docs/coding-guide.md`.** Its opening note lists how Nuzul applies it. This repository holds only the frontend; the NestJS backend will be a separate repository.

## Run

Needs Node 22.22 or newer and pnpm.

```bash
pnpm install
pnpm dev          # http://localhost:5180
```

| Command          | Does                                                   |
| ---------------- | ------------------------------------------------------ |
| `pnpm verify`    | Typecheck, lint, format check and tests: run before PR |
| `pnpm test`      | Tests in watch mode (`pnpm test:run` runs them once)   |
| `pnpm lint`      | ESLint, including the React Compiler rules             |
| `pnpm typecheck` | TypeScript                                             |
| `pnpm format`    | Prettier (`pnpm format:check` only checks)             |
| `pnpm build`     | Production build into `dist/`                          |

## Where things live

```text
src/
  app/          App, router, query client, layout and menu
  components/   shared UI: ui/, form/, feedback/, layout/, data-table/
  features/     one folder per module, each with a public index.ts
    <feature>/  api/ (schemas, transport, queries), domain/, components/, pages/, routes.tsx
  lib/          money, dates, form rules, list params in the URL
  mock-api/     stand-in for the backend: IndexedDB and JSON seed
  styles/       design tokens
  test/         test setup and renderApp
```

## Rules that keep the later backend cheap

- **Screens never touch `src/mock-api`.** They go through `features/*/api/`. When the API exists, those transport functions change and `src/mock-api` is deleted.
- **Features import each other only through `index.ts`.**
- **Business rules live in `domain/` folders and `lib/money`,** free of React and storage, so the backend can mirror them against the same test cases.
- **Money is never a JS number.** Use `src/lib/money`.
- **Overbooking comes from the night grid,** never from the ledger's Result table. See `../docs/inventory-ledger-rules.md`.
- **No raw colours in components.** Use the tokens in `src/styles/index.css`.
- **No manual `useMemo`, `useCallback` or `memo`:** the React Compiler handles them.
- **React questions go to the docs,** starting at https://react.dev/llms.txt. Do not guess.

The UI/UX Pro Max tool is not committed; reinstall it with `pnpm dlx ui-ux-pro-max-cli init --ai claude`.
