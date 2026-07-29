import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { coursesQueryOptions, meQueryOptions, axiosClient } from '../../lib/api'
import {
  BookOpen,
  Plus,
  Trash2,
  CheckCircle,
  ShoppingBag,
  LogIn,
} from 'lucide-react'

export const Route = createFileRoute('/courses/')({
  component: CoursesPage,
})

function CoursesPage() {
  const queryClient = useQueryClient()
  const [newTitle, setNewTitle] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  const { data: user } = useQuery(meQueryOptions)
  const { data: courses, isLoading } = useQuery(coursesQueryOptions)

  const createCourseMutation = useMutation({
    mutationFn: async (title: string) => {
      const { data } = await axiosClient.post('/courses', { title })
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courses'] })
      queryClient.invalidateQueries({ queryKey: ['public-courses'] })
      setNewTitle('')
      setIsCreating(false)
    },
  })

  const deleteCourseMutation = useMutation({
    mutationFn: async (id: number) => {
      const { data } = await axiosClient.delete(`/courses/${id}`)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courses'] })
      queryClient.invalidateQueries({ queryKey: ['public-courses'] })
    },
  })

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTitle.trim()) return
    createCourseMutation.mutate(newTitle.trim())
  }

  return (
    <div className="space-y-8 py-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-100 flex items-center space-x-3">
            <BookOpen className="w-8 h-8 text-indigo-400" />
            <span>Course Catalog</span>
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Manage & explore courses. Login status dynamically updates purchase
            state.
          </p>
        </div>
        <button
          onClick={() => setIsCreating(!isCreating)}
          className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-4 py-2 rounded-lg flex items-center space-x-2 transition shadow-md shadow-indigo-600/20 cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Add Course</span>
        </button>
      </div>

      {/* Create Course Form */}
      {isCreating && (
        <form
          onSubmit={handleCreateSubmit}
          className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 shadow-lg"
        >
          <h2 className="text-lg font-bold text-slate-200">
            Create New Course
          </h2>
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Course Title
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Advanced TypeScript & Vite SSG"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div className="flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createCourseMutation.isPending}
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition disabled:opacity-50"
            >
              {createCourseMutation.isPending ? 'Saving...' : 'Save Course'}
            </button>
          </div>
        </form>
      )}

      {/* Course Cards List */}
      {!courses && isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-44 bg-slate-900/50 animate-pulse rounded-xl border border-slate-800"
            ></div>
          ))}
        </div>
      ) : courses && courses.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {courses.map((course) => {
            const isPurchased = user ? true : course.isPurchased

            return (
              <div
                key={course.id}
                className="bg-slate-900/60 border border-slate-800 hover:border-slate-700 rounded-xl p-6 flex flex-col justify-between space-y-4 transition"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-md border border-indigo-500/20">
                      ID #{course.id}
                    </span>
                    <button
                      onClick={() => deleteCourseMutation.mutate(course.id)}
                      disabled={deleteCourseMutation.isPending}
                      className="text-slate-500 hover:text-rose-400 p-1 rounded transition cursor-pointer"
                      title="Delete Course"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <Link
                    to="/courses/$id"
                    params={{ id: course.id.toString() }}
                    className="block mt-3"
                  >
                    <h2 className="text-xl font-bold text-slate-100 hover:text-indigo-400 transition">
                      {course.title}
                    </h2>
                  </Link>
                </div>

                <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between">
                  <Link
                    to="/courses/$id"
                    params={{ id: course.id.toString() }}
                    className="text-sm font-semibold text-slate-300 hover:text-indigo-400 transition"
                  >
                    View Lectures &rarr;
                  </Link>

                  {/* Dynamic Purchase / Buy Now Button */}
                  {isPurchased ? (
                    <span className="inline-flex items-center space-x-1.5 text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1.5 rounded-lg">
                      <CheckCircle className="w-4 h-4" />
                      <span>Already Purchased</span>
                    </span>
                  ) : (
                    <button
                      onClick={() => {
                        alert(
                          'Please click Login in the header to authenticate and purchase!',
                        )
                      }}
                      className="inline-flex items-center space-x-1.5 text-xs font-semibold bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 px-3 py-1.5 rounded-lg transition cursor-pointer"
                    >
                      <ShoppingBag className="w-4 h-4" />
                      <span>Buy Now</span>
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="text-center py-12 bg-slate-900/30 border border-slate-800 rounded-xl space-y-3">
          <BookOpen className="w-10 h-10 text-slate-600 mx-auto" />
          <h3 className="text-lg font-medium text-slate-300">
            No courses available
          </h3>
          <p className="text-slate-500 text-sm">
            Click "Add Course" above to create your first course.
          </p>
        </div>
      )}
    </div>
  )
}
