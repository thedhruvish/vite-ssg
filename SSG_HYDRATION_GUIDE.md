# Complete Technical Guide: SSG Architecture, Hydration Engine & API Integration

This document provides a **complete, in-depth architectural breakdown** of how Static Site Generation (SSG), TanStack Data Dehydration/Hydration, Hono Backend API, and Neon PostgreSQL work together in this repository.

---

## 🏗️ System Architecture & Data Flow

```text
                               +-----------------------------+
                               |     Neon PostgreSQL DB      |
                               +-----------------------------+
                                              ^
                                              | Raw SQL (@neondatabase/serverless)
                                              v
                               +-----------------------------+
                               |     Hono API Backend        |
                               |    (ssg-api / Wrangler)     |
                               +-----------------------------+
                                              ^
                                              | HTTP REST / JSON
                 +----------------------------+----------------------------+
                 |                                                         |
  [BUILD TIME SSG PRE-RENDERING]                            [RUNTIME CLIENT EXECUTION]
                 |                                                         |
  1. bun scripts/prerender.ts                               1. Browser requests GET /courses
  2. Queries /public/courses                                2. Receives static dist/courses/index.html
  3. Prefetches TanStack Query cache                        3. Displays pre-built HTML immediately
  4. Dehydrates state to JSON script                        4. Loads bundle assets/index.js
  5. renderToString() to dist/*.html                        5. Hydrates state via window.__REACT_QUERY_STATE__
                 |                                          6. ReactDOM.hydrateRoot() attaches events
                 v                                                         |
  +------------------------------+                                         v
  |  Pre-rendered dist/ Output   |                        +----------------------------------+
  |  - dist/index.html           |                        |  Fully Interactive Dynamic App   |
  |  - dist/courses/index.html   |                        +----------------------------------+
  |  - dist/courses/1/index.html |
  |  - dist/non-ssg/index.html   |
  +------------------------------+
```

---

## 🛠️ Step-by-Step Technical Implementation

### 1. Backend API Layer (`ssg-api/src/index.ts`)

The backend is built with **Hono** running on Cloudflare Workers / Wrangler dev environment and executes **raw PostgreSQL queries** via `@neondatabase/serverless`:

```ts
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { sign, verify } from 'hono/jwt'
import { neon } from '@neondatabase/serverless'

const JWT_SECRET = 'super-secret-jwt-key'
const COOKIE_NAME = 'auth_token'
const app = new Hono()

function getDb(c: any) {
  return neon(c.env.DATABASE_URL)
}
```

#### Key API Routes:
- **`POST /login`**: Accepts `{ email }` (defaults to `user@example.com` if empty). Generates a signed JWT token and sets an HTTP `auth_token` cookie response header (`Set-Cookie`).
- **`POST /logout`**: Responds with `Set-Cookie: auth_token=; Max-Age=0` to destroy the session.
- **`GET /me`**: Reads the `Cookie` header, verifies the JWT using `verify(token, JWT_SECRET, 'HS256')`, and returns `{ email }`. Returns `401 Unauthorized` if no valid cookie exists.
- **`GET /public/courses`**: Returns `[{ id, title }]` using raw SQL `SELECT id, title FROM courses ORDER BY id DESC`. Used during build-time pre-rendering.
- **`GET /courses`**: Executes raw SQL query and checks auth status to append `isPurchased: boolean`.
- **`POST /courses`**: Executes `INSERT INTO courses (title) VALUES (${title}) RETURNING id, title`.
- **`DELETE /courses/:id`**: Deletes course by ID (`DELETE FROM courses WHERE id = ${id}`).
- **`GET /courses/:id`**: Returns course details and joined lectures (`SELECT id, title, course_id AS "courseId" FROM lectures`).
- **`POST /courses/:id`**: Adds a lecture (`INSERT INTO lectures (title, course_id)`).

---

### 2. Isolated SSG Route Tree (`src/publicRouteTree.ts`)

To guarantee that non-SSG routes (`/non-ssg`) are not pre-rendered into static HTML during build time, we construct a dedicated public route tree:

```ts
import { Route as rootRoute } from './routes/__root'
import { Route as indexRoute } from './routes/index'
import { Route as coursesIndexRoute } from './routes/courses/index'
import { Route as coursesIdRoute } from './routes/courses/$id'

const IndexRoute = indexRoute.update({
  id: '/',
  path: '/',
  getParentRoute: () => rootRoute,
} as any)

const CoursesIndexRoute = coursesIndexRoute.update({
  id: '/courses/',
  path: '/courses/',
  getParentRoute: () => rootRoute,
} as any)

const CoursesIdRoute = coursesIdRoute.update({
  id: '/courses/$id',
  path: '/courses/$id',
  getParentRoute: () => rootRoute,
} as any)

const ssgRouteChildren = {
  IndexRoute,
  CoursesIndexRoute,
  CoursesIdRoute,
}

export function getPublicRouteTree() {
  return rootRoute._addFileChildren(ssgRouteChildren as any)
}
```

---

### 3. Pre-rendering & Dehydration Engine (`scripts/prerender.ts`)

The pre-rendering engine executes post `vite build`:

#### A. Preserving Clean Template Shell:
```ts
const templatePath = path.join(distDir, "index.html");
const htmlTemplate = await fs.readFile(templatePath, "utf-8");
const cleanSpaShell = htmlTemplate; // Saved unrendered SPA shell with <div id="app"></div>
```

#### B. Data Prefetching & React Server Rendering:
For each route in public pages:
```ts
queryClient.clear();
if (page.prefetch) await page.prefetch(); // Prefetches API data into queryCache

memoryHistory.push(page.url);
await router.load();

let renderedContent = renderToString(
  React.createElement(
    QueryClientProvider,
    { client: queryClient },
    React.createElement(RouterProvider, { router })
  )
);
```

#### C. State Dehydration Script Injection:
The server-side query cache is serialized into JSON using TanStack Query's `dehydrate`:
```ts
const dehydratedState = dehydrate(queryClient);

const headAdditions = [
  `<script>window.__REACT_QUERY_STATE__ = ${JSON.stringify(dehydratedState)};</script>`,
].join("\n");

let pageHtml = htmlTemplate
  .replace("</head>", `${headAdditions}\n</head>`)
  .replace('<div id="app"></div>', `<div id="app">${renderedContent}</div>`);

await fs.writeFile(targetFile, pageHtml, "utf-8");
```

#### D. Non-SSG & SPA Fallback Clean Shell Generation:
For non-SSG routes (`/non-ssg`), the script outputs unrendered HTML containing **only** `<div id="app"></div>`:
```ts
const nonSsgDir = path.join(distDir, "non-ssg");
await fs.mkdir(nonSsgDir, { recursive: true });
await fs.writeFile(path.join(nonSsgDir, "index.html"), cleanSpaShell, "utf-8");
await fs.writeFile(path.join(distDir, "non-ssg.html"), cleanSpaShell, "utf-8");
await fs.writeFile(path.join(distDir, "404.html"), cleanSpaShell, "utf-8");
```

---

### 4. Client Hydration Entry (`src/main.tsx`)

On client load, the browser executes `src/main.tsx`:

```tsx
import ReactDOM from 'react-dom/client'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { QueryClientProvider, HydrationBoundary } from '@tanstack/react-query'
import { routeTree } from './routeTree.gen'
import { queryClient } from './lib/query-client'

declare global {
  interface Window {
    __REACT_QUERY_STATE__?: unknown
  }
}

const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  scrollRestoration: true,
  context: { queryClient },
})

const rootElement = document.getElementById('app')!

const appElement = (
  <QueryClientProvider client={queryClient}>
    <HydrationBoundary state={typeof window !== 'undefined' ? window.__REACT_QUERY_STATE__ : undefined}>
      <RouterProvider router={router} />
    </HydrationBoundary>
  </QueryClientProvider>
)

if (rootElement.hasChildNodes()) {
  // Hydrates existing pre-rendered HTML DOM nodes & attaches React listeners
  ReactDOM.hydrateRoot(rootElement, appElement)
} else {
  // Mounts standard SPA client render for non-SSG routes
  ReactDOM.createRoot(rootElement).render(appElement)
}
```

---

### 5. No-Loader Direct Rendering Pattern (`src/routes/*.tsx`)

In pre-rendered routes, loading skeletons are conditionally bypassed if hydrated data already exists:

```tsx
// src/routes/courses/index.tsx
function CoursesPage() {
  const { data: courses, isLoading } = useQuery(coursesQueryOptions)

  return (
    <div>
      {/* Show skeleton ONLY if data is not available (un-hydrated) */}
      {!courses && isLoading ? (
        <LoadingSkeleton />
      ) : courses && courses.length > 0 ? (
        <CourseGrid courses={courses} />
      ) : (
        <EmptyState />
      )}
    </div>
  )
}
```

---

## 📊 Summary Comparison Matrix

| Aspect | SSG Routes (`/`, `/courses`, `/courses/:id`) | Non-SSG Routes (`/non-ssg`) |
| :--- | :--- | :--- |
| **Prerendered File Output** | `dist/courses/index.html` (Full HTML + Dehydrated State) | `dist/non-ssg/index.html` (Unrendered `<div id="app"></div>`) |
| **Source View (`view-source:`)** | Pre-built markup + `<script>window.__REACT_QUERY_STATE__=...</script>` | Pure empty `<div id="app"></div>` shell |
| **First Contentful Paint** | **Instant (0ms wait time)** | Client-side render |
| **React Mounting Mode** | `ReactDOM.hydrateRoot()` | `ReactDOM.createRoot()` |
| **Loading Skeletons** | **Hidden** (Hydrated state displays immediately) | Visible while client fetches data |

---

## ❓ Does SSG + Hydration Depend Specifically on TanStack Router?

**Short Answer**: **No! SSG with Hydration is NOT tied specifically to TanStack Router.**

You can implement this exact same SSG + Hydration setup using **React Router (v6 / v7)**, **Wouter**, or any other router.

### Why Any Router Works:
Static Site Generation and Hydration rely on **3 router-agnostic React primitives**:
1. **Server Rendering (`react-dom/server`)**: React's `renderToString()` renders any component tree to an HTML string.
2. **State Dehydration (`@tanstack/react-query`)**: `dehydrate(queryClient)` serializes cached API data into JSON.
3. **Client Hydration (`react-dom/client`)**: `ReactDOM.hydrateRoot()` connects event handlers to existing static HTML nodes.

### React Router v6/v7 Comparison Example:

If using **React Router v6**, the setup is almost identical:

#### A. Prerender Script (`scripts/prerender.ts` with React Router):
```tsx
import { renderToString } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom/server'
import { QueryClientProvider, dehydrate } from '@tanstack/react-query'

const renderedContent = renderToString(
  <QueryClientProvider client={queryClient}>
    <StaticRouter location={page.url}>
      <AppRoutes />
    </StaticRouter>
  </QueryClientProvider>
)
```

#### B. Client Entry (`src/main.tsx` with React Router):
```tsx
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClientProvider, HydrationBoundary } from '@tanstack/react-query'

const rootElement = document.getElementById('app')!

const appElement = (
  <QueryClientProvider client={queryClient}>
    <HydrationBoundary state={window.__REACT_QUERY_STATE__}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </HydrationBoundary>
  </QueryClientProvider>
)

if (rootElement.hasChildNodes()) {
  ReactDOM.hydrateRoot(rootElement, appElement)
} else {
  ReactDOM.createRoot(rootElement).render(appElement)
}
```

TanStack Router was chosen for this project due to its automatic file-based routing and TypeScript safety, but **the underlying SSG + Hydration mechanism works seamlessly with any React router library!**

---

## ⚔️ Framework Comparison: Custom SSG vs. TanStack Start vs. Vike

| Feature | Custom SSG Setup (This Project) | TanStack Start | Vike (vite-plugin-ssr) |
| :--- | :--- | :--- | :--- |
| **Backend Coupling** | **Decoupled** (Independent Hono / Neon DB API) | Tightly coupled to Server Functions & Nitro | Flexible, but tied to Vite SSR plugin architecture |
| **Prerender Flexibility** | **Explicit Control** (`getPublicRouteTree()`) | Configuration-driven | Route export hooks |
| **Framework Overhead** | **Zero** (Pure React 19 + Vite) | High (Full meta-framework runtime) | Medium |
| **Hydration Control** | `window.__REACT_QUERY_STATE__` direct injection | Framework internal hydration | Extensible plugin hooks |

---

## 🏆 Who Wins & Why?

### 👑 **Winner: Custom SSG Prerender Setup**

#### **Why it Wins:**
1. **Zero Abstraction Lock-in**: Full ownership of the build output (`scripts/prerender.ts`) without hidden meta-framework bundler magic.
2. **API Independence**: The backend (Hono + Neon DB) is completely decoupled and can be deployed anywhere independently.
3. **Instant Hydration**: Dehydrating TanStack Query state directly into static `<head>` scripts prevents loading skeletons on first paint without requiring SSR servers.


