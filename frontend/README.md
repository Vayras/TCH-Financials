# TCH Financials Frontend

Next.js 15 (App Router) client application for TCH Financials.

## Tech Stack

- **Framework**: Next.js 15 + React 19
- **Styling**: Tailwind CSS v4 + Vanilla CSS Modules
- **State & Data Fetching**: TanStack Query v5 + Axios
- **Components & Icons**: Lucide React, Radix UI Dialog primitives, Sonner (Toasts)
- **Tables & Charts**: TanStack Table v8, Recharts

## Local Development

```bash
npm install
npm run dev      # http://localhost:5050
```

## Scripts

- `npm run dev`: Start Next.js dev server on port 5050 (`-p 5050 -H 0.0.0.0`)
- `npm run build`: Production Next.js build
- `npm run start`: Start production server on port 5050
- `npm run lint`: Run ESLint
- `npm run typecheck`: Run TypeScript type checking (`tsc --noEmit`)
