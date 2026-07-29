import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { publicCoursesQueryOptions } from '../lib/api'
import { BookOpen, ArrowRight, CheckCircle2, ShieldCheck, Zap } from 'lucide-react'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  const { data: publicCourses, isLoading } = useQuery(publicCoursesQueryOptions)

  return (
    <div className="space-y-12 py-6">
      {/* Hero Section */}
      <section className="text-center space-y-4 max-w-3xl mx-auto pt-8">
        <div className="inline-flex items-center space-x-2 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-3 py-1 rounded-full text-xs font-semibold">
          <Zap className="w-3.5 h-3.5" />
          <span>SSG with Client Hydration</span>
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
          Master Modern Tech with Interactive Courses
        </h1>
        <p className="text-slate-400 text-lg">
          Fast static generation combined with reactive TanStack Query hydration powered by Neon PostgreSQL raw queries.
        </p>
        <div className="pt-4 flex items-center justify-center space-x-4">
          <Link
            to="/courses"
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-6 py-3 rounded-lg shadow-lg shadow-indigo-600/30 flex items-center space-x-2 transition"
          >
            <span>Explore Courses</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Public Courses Showcase */}
      <section className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-xl font-bold text-slate-100 flex items-center space-x-2">
              <BookOpen className="w-5 h-5 text-indigo-400" />
              <span>Public Course Catalog</span>
            </h2>
            <p className="text-slate-400 text-sm mt-1">Fetched using <code className="text-indigo-300 bg-slate-800 px-1.5 py-0.5 rounded text-xs">publicCoursesQueryOptions</code></p>
          </div>
          <Link to="/courses" className="text-sm font-semibold text-indigo-400 hover:text-indigo-300 flex items-center space-x-1">
            <span>View All</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-slate-800/50 animate-pulse rounded-xl border border-slate-800"></div>
            ))}
          </div>
        ) : publicCourses && publicCourses.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {publicCourses.map((course) => (
              <div key={course.id} className="bg-slate-800/40 border border-slate-700/60 p-5 rounded-xl flex flex-col justify-between hover:border-indigo-500/50 transition">
                <div>
                  <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">Course #{course.id}</span>
                  <h3 className="font-semibold text-lg text-slate-100 mt-1 line-clamp-2">{course.title}</h3>
                </div>
                <Link
                  to="/courses/$id"
                  params={{ id: course.id.toString() }}
                  className="mt-4 text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center space-x-1"
                >
                  <span>Course Details</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-slate-500 text-sm text-center py-6">No public courses created yet.</p>
        )}
      </section>

      {/* Highlights Grid */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-900/30 border border-slate-800 p-5 rounded-xl space-y-2">
          <ShieldCheck className="w-6 h-6 text-emerald-400" />
          <h3 className="font-bold text-slate-200">Raw SQL with Neon</h3>
          <p className="text-slate-400 text-sm">Direct database queries without an ORM using serverless Postgres connection pools.</p>
        </div>
        <div className="bg-slate-900/30 border border-slate-800 p-5 rounded-xl space-y-2">
          <Zap className="w-6 h-6 text-indigo-400" />
          <h3 className="font-bold text-slate-200">JWT Cookie Auth</h3>
          <p className="text-slate-400 text-sm">Seamless authorization set in HTTP cookies with <code className="text-indigo-300 bg-slate-800 px-1 py-0.5 rounded text-xs">/me</code> user verification.</p>
        </div>
        <div className="bg-slate-900/30 border border-slate-800 p-5 rounded-xl space-y-2">
          <CheckCircle2 className="w-6 h-6 text-amber-400" />
          <h3 className="font-bold text-slate-200">Dynamic Hydration</h3>
          <p className="text-slate-400 text-sm">Instant UI state toggles between "Buy Now" and "Purchased" upon authentication.</p>
        </div>
      </section>
    </div>
  )
}
