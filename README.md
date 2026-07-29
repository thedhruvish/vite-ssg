# SSG with Hydration Guide (Hono + Neon DB + TanStack Query & Router)

This project demonstrates **Static Site Generation (SSG) with React Client Hydration** using Vite, TanStack Router, TanStack Query.

> 📘 **Looking for complete technical architecture details?**  
> Read the full in-depth breakdown in [`SSG_HYDRATION_GUIDE.md`](./SSG_HYDRATION_GUIDE.md).

---

## 🌟 Overview & Architecture

- **Backend API (`ssg-api`)**: Powered by **Hono** running on Cloudflare Workers / Wrangler dev server. Connects directly to **Neon PostgreSQL** 
- **Frontend App**: Built with React 19, Vite, and TailwindCSS.
- **Routing**: **TanStack Router** managing both static SSG pages and non-SSG client-only SPA routes.
- **Data Fetching & State Hydration**: **TanStack Query** (`@tanstack/react-query`) fetching data with Axios and dehydrating query state into static HTML during SSG prerendering.


---

## ⚙️ How SSG & Hydration is Implemented Step-by-Step

### 1. Dedicated Public Route Tree (`src/publicRouteTree.ts`)
To prevent non-SSG routes (e.g. `/non-ssg`) from being prerendered as full static HTML pages, we create an explicit SSG route tree containing **only** public routes meant for pre-rendering:

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

### 2. Pre-rendering Script (`scripts/prerender.ts`)
During `bun run ssg`:
1. **Reads Clean SPA Shell**: Loads `dist/index.html` produced by `vite build` and saves `cleanSpaShell` containing `<div id="app"></div>`.
2. **Queries Live Database API**: Fetches course data dynamically from `http://localhost:8787/public/courses` to extract active course IDs (`/courses/:id`).
3. **Prefetches TanStack Queries**: Executes query options (e.g., `publicCoursesQueryOptions`, `coursesQueryOptions`, `courseDetailQueryOptions`) using a server-side `QueryClient`.
4. **Dehydrates State**: Calls `dehydrate(queryClient)` to serialize query results into JSON.
5. **Renders HTML**: Uses `renderToString` with React 19 to generate HTML markup.
6. **Injects Dehydrated State**: Injects `<script>window.__REACT_QUERY_STATE__ = ${JSON.stringify(dehydratedState)};</script>` into the `<head>` of each pre-rendered HTML file (`dist/index.html`, `dist/courses/index.html`, `dist/courses/:id/index.html`).
7. **Clean Non-SSG Fallback**: Writes `cleanSpaShell` (unrendered `<div id="app"></div>`) to `dist/non-ssg/index.html` and `dist/404.html` so non-SSG client pages remain pure SPAs.

---

### 3. React Client Hydration (`src/main.tsx`)
On client load:
1. React detects if `#app` has pre-rendered child DOM nodes using `rootElement.hasChildNodes()`.
2. If nodes exist, it calls **`ReactDOM.hydrateRoot()`** instead of `render()`.
3. Wraps the app with `<HydrationBoundary state={window.__REACT_QUERY_STATE__}>`.
4. TanStack Query immediately populates query cache from `window.__REACT_QUERY_STATE__` — **preventing loading skeletons/spinners from flickering on initial page load**.

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
  ReactDOM.hydrateRoot(rootElement, appElement)
} else {
  ReactDOM.createRoot(rootElement).render(appElement)
}
```

---

### 4. Router Independence
Does SSG + Hydration depend on TanStack Router? **No!**  
SSG and Hydration rely on standard React primitives (`renderToString`, `dehydrate`, `ReactDOM.hydrateRoot`). You can implement this exact setup with React Router v6/v7 or any router. Read more in [`SSG_HYDRATION_GUIDE.md`](./SSG_HYDRATION_GUIDE.md#--does-ssg--hydration-depend-specifically-on-tanstack-router).

---

## 🛠️ Hono API Endpoints (`ssg-api/src/index.ts`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/login` | Authenticates user (defaults to `user@example.com`), signs JWT, sets `auth_token` cookie |
| `POST` | `/logout` | Clears `auth_token` cookie (`Max-Age=0`) |
| `GET` | `/me` | Verifies JWT cookie, returns `{ email }` or `401 Unauthorized` |
| `GET` | `/public/courses` | Returns public course list for SSG pre-rendering |
| `GET` | `/courses` | Returns courses list with dynamic `isPurchased` flag based on auth status |
| `POST` | `/courses` | Creates a course with `{ title }` (Raw SQL `INSERT INTO courses`) |
| `DELETE` | `/courses/:id` | Deletes a course by ID |
| `GET` | `/courses/:id` | Returns single course details and associated lectures |
| `POST` | `/courses/:id` | Adds a lecture to course with `{ title }` |
| `DELETE` | `/courses/:id/lectures/:lectureId` | Deletes a lecture by ID |

---

## 🚀 How to Run Locally

### 1. Start the Hono Backend API
```bash
cd ssg-api
bun dev
# Server running at http://localhost:8787
```

### 2. Start the Vite Frontend Dev Server
```bash
bun dev
# App running at http://localhost:3000
```

### 3. Build & Run SSG Prerender
```bash
bun run ssg
# Builds Vite assets & executes scripts/prerender.ts
```

### 4. Preview SSG Production Dist Output
```bash
bun run preview
# Serves static SSG files from dist/ at http://localhost:4173
```

---

## ⚔️ Comparison: Custom SSG Script vs. TanStack Start vs. Vike

How does this custom SSG + Hydration setup compare against full-stack meta-framework solutions like **TanStack Start** or **Vike (like vite-plugin-ssr)**?

| Feature | Custom SSG Setup (This Repo) | TanStack Start | Vike (vite-plugin-ssr) |
| :--- | :--- | :--- | :--- |
| **Architecture** | Lightweight Vite SPA + Node Prerender script | Full-stack SSR/SSG meta-framework | Flexible SSR/SSG framework for Vite |
| **Backend Coupling** | **100% Decoupled** (Use Hono, Express, FastAPI, Cloudflare, Go, etc.) | Tied to TanStack Server Functions & Nitro | Flexible, but designed for Node/Vite server integrations |
| **Prerender Control** | **Total Control** (Explicitly choose which routes get static HTML vs empty SPA shell) | Automated build-time prerendering | Page-by-page `.page.server.js` export config |
| **Bundle Size & Overhead** | **Lowest** (Zero framework abstraction lock-in) | High (Includes server functions runtime, SSR hydration wrappers) | Medium |
| **Learning Curve** | Low (Standard React + TanStack Router/Query) | High (New framework APIs, loader conventions) | Medium |
| **Deployability** | Static CDN (Cloudflare Pages, S3, Netlify) + API Worker | Requires SSR server or static adapter | Requires SSR server or static exporter |

---

## 🏆 Who Wins & Why?

### 👑 The Winner: **Custom SSG Setup (This Architecture)**

#### 🎯 Why This Setup Wins:

1. **Maximum Performance with Zero Lock-in**:
   - Meta-frameworks like **TanStack Start** and **Vike** add complex server-function abstractions and hidden build magic.
   - This setup uses **pure Vite** + **standard React 19** + **TanStack Query**. You own 100% of the build process in `scripts/prerender.ts`.

2. **Perfect API Decoupling**:
   - **TanStack Start** pushes you toward colocated server functions.
   - This setup keeps your backend (**Hono + Neon DB**) completely independent from your frontend SSG build. Your backend can run anywhere (Cloudflare Workers, Lambda, Bun, Go, etc.) without altering the frontend.

3. **Fine-Grained Route Control (SSG vs. Pure SPA)**:
   - You can pre-render high-SEO pages (`/`, `/courses`, `/courses/:id`) into static HTML while serving clean, unrendered `<div id="app"></div>` shells for private client routes (`/non-ssg`).

4. **Zero Loading Flickers**:
   - By serializing `window.__REACT_QUERY_STATE__` directly into static `<head>` scripts during pre-rendering, TanStack Query hydrates the cache instantly without showing skeleton loaders or triggering duplicate initial API calls.

