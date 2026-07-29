import { createFileRoute } from '@tanstack/react-router'
import { Sparkles, ShieldAlert, Cpu } from 'lucide-react'

export const Route = createFileRoute('/non-ssg')({
  component: NonSSGPage,
})

function NonSSGPage() {
  return (
    <div className="py-12 space-y-8 max-w-3xl mx-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 space-y-6 shadow-xl">
        <div className="inline-flex items-center space-x-2 bg-amber-500/10 text-amber-400 border border-amber-500/20 px-3 py-1 rounded-full text-xs font-semibold">
          <ShieldAlert className="w-4 h-4" />
          <span>Client-Side Rendered (Non-SSG)</span>
        </div>

        <h1 className="text-3xl font-extrabold text-slate-100">
          Dynamic Non-SSG Route
        </h1>

        <p className="text-slate-300 text-base leading-relaxed">
          This route is{' '}
          <strong className="text-indigo-400">
            excluded from static site prerendering (SSG)
          </strong>
          . When requested directly, the server responds with the root SPA{' '}
          <code className="text-indigo-300 bg-slate-800 px-1.5 py-0.5 rounded text-xs">
            index.html
          </code>{' '}
          fallback file and renders entirely on the client side.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
          <div className="bg-slate-950/60 border border-slate-800 p-4 rounded-xl space-y-2">
            <Cpu className="w-5 h-5 text-indigo-400" />
            <h3 className="font-bold text-slate-200 text-sm">
              Client Hydration
            </h3>
            <p className="text-slate-400 text-xs">
              Renders content dynamically in browser memory without prebuilt
              static HTML files.
            </p>
          </div>
          <div className="bg-slate-950/60 border border-slate-800 p-4 rounded-xl space-y-2">
            <Sparkles className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-slate-200 text-sm">SPA Fallback</h3>
            <p className="text-slate-400 text-xs">
              Served via{' '}
              <code className="text-indigo-300 bg-slate-800 px-1 py-0.5 rounded text-xs">
                _redirects
              </code>{' '}
              SPA catch-all rule in production.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
