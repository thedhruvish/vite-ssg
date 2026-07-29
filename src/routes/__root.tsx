import { Outlet, Link, createRootRoute } from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { meQueryOptions, axiosClient, setAuthToken } from '../lib/api'
import {
  LogIn,
  LogOut,
  BookOpen,
  Home,
  Sparkles,
  User as UserIcon,
} from 'lucide-react'
import '../styles.css'

export const Route = createRootRoute({
  component: RootComponent,
})

function RootComponent() {
  const queryClient = useQueryClient()

  const { data: user, isLoading } = useQuery(meQueryOptions)

  const loginMutation = useMutation({
    mutationFn: async () => {
      const { data } = await axiosClient.post('/login', {})
      return data
    },
    onSuccess: (data) => {
      if (data?.token) {
        setAuthToken(data.token)
      }
      queryClient.invalidateQueries({ queryKey: ['me'] })
      queryClient.invalidateQueries({ queryKey: ['courses'] })
      queryClient.invalidateQueries({ queryKey: ['course'] })
    },
  })

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const { data } = await axiosClient.post('/logout')
      return data
    },
    onSuccess: () => {
      setAuthToken(null)
      queryClient.invalidateQueries({ queryKey: ['me'] })
      queryClient.invalidateQueries({ queryKey: ['courses'] })
      queryClient.invalidateQueries({ queryKey: ['course'] })
    },
  })

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col">
      {/* Top Header Navigation */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-8">
            <Link
              to="/"
              className="flex items-center space-x-2 text-indigo-400 font-bold text-xl hover:text-indigo-300 transition"
            >
              <Sparkles className="w-6 h-6" />
              <span>EduCourse SSG</span>
            </Link>
            <nav className="flex items-center space-x-6 text-sm font-medium">
              <Link
                to="/"
                activeProps={{ className: 'text-indigo-400 font-semibold' }}
                inactiveProps={{
                  className: 'text-slate-300 hover:text-white transition',
                }}
                activeOptions={{ exact: true }}
                className="flex items-center space-x-1.5"
              >
                <Home className="w-4 h-4" />
                <span>Home</span>
              </Link>
              <Link
                to="/courses"
                activeProps={{ className: 'text-indigo-400 font-semibold' }}
                inactiveProps={{
                  className: 'text-slate-300 hover:text-white transition',
                }}
                className="flex items-center space-x-1.5"
              >
                <BookOpen className="w-4 h-4" />
                <span>Courses</span>
              </Link>
              <Link
                to="/non-ssg"
                activeProps={{ className: 'text-indigo-400 font-semibold' }}
                inactiveProps={{
                  className: 'text-slate-300 hover:text-white transition',
                }}
                className="flex items-center space-x-1.5"
              >
                <Sparkles className="w-4 h-4" />
                <span>Non-SSG</span>
              </Link>
            </nav>
          </div>

          <div className="flex items-center space-x-4">
            {!user && isLoading ? (
              <div className="w-20 h-9 bg-slate-800 animate-pulse rounded-lg"></div>
            ) : user ? (
              <div className="flex items-center space-x-3">
                <span className="text-xs text-slate-300 bg-slate-800 px-3 py-1.5 rounded-full flex items-center space-x-1 border border-slate-700">
                  <UserIcon className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{user.email}</span>
                </span>
                <button
                  onClick={() => logoutMutation.mutate()}
                  disabled={logoutMutation.isPending}
                  className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 px-3.5 py-1.5 rounded-lg text-sm font-medium flex items-center space-x-1.5 transition cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>
                    {logoutMutation.isPending ? 'Logging out...' : 'Logout'}
                  </span>
                </button>
              </div>
            ) : (
              <button
                onClick={() => loginMutation.mutate()}
                disabled={loginMutation.isPending}
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-1.5 rounded-lg text-sm font-medium flex items-center space-x-1.5 transition shadow-lg shadow-indigo-600/20 cursor-pointer disabled:opacity-50"
              >
                <LogIn className="w-4 h-4" />
                <span>
                  {loginMutation.isPending ? 'Logging in...' : 'Login'}
                </span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-6">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-6 text-center text-slate-500 text-sm">
        <p>
          © 2026 EduCourse SSG Hydration Demo. Built with Hono, Neon DB,
          TanStack Query & Router.
        </p>
      </footer>

      {/* TanStack DevTools */}
      <TanStackDevtools
        config={{
          position: 'bottom-right',
        }}
        plugins={[
          {
            name: 'TanStack Router',
            render: <TanStackRouterDevtoolsPanel />,
          },
        ]}
      />
    </div>
  )
}
