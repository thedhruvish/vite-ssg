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
  context: {
    queryClient,
  },
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

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
