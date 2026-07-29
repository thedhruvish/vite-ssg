import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { courseDetailQueryOptions, meQueryOptions, axiosClient } from '../../lib/api'
import { ArrowLeft, Plus, Trash2, CheckCircle, ShoppingBag, BookOpen, Video } from 'lucide-react'

export const Route = createFileRoute('/courses/$id')({
  component: CourseDetailPage,
})

function CourseDetailPage() {
  const { id } = Route.useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [lectureTitle, setLectureTitle] = useState('')
  const [showAddLecture, setShowAddLecture] = useState(false)

  const { data: user } = useQuery(meQueryOptions)
  const { data: courseDetail, isLoading, isError } = useQuery(courseDetailQueryOptions(id))

  // Create lecture mutation
  const createLectureMutation = useMutation({
    mutationFn: async (title: string) => {
      const { data } = await axiosClient.post(`/courses/${id}`, { title })
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['course', id] })
      setLectureTitle('')
      setShowAddLecture(false)
    },
  })

  // Delete lecture mutation
  const deleteLectureMutation = useMutation({
    mutationFn: async (lectureId: number) => {
      const { data } = await axiosClient.delete(`/courses/${id}/lectures/${lectureId}`)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['course', id] })
    },
  })

  // Delete course mutation
  const deleteCourseMutation = useMutation({
    mutationFn: async () => {
      const { data } = await axiosClient.delete(`/courses/${id}`)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courses'] })
      queryClient.invalidateQueries({ queryKey: ['public-courses'] })
      navigate({ to: '/courses' })
    },
  })

  const handleLectureSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!lectureTitle.trim()) return
    createLectureMutation.mutate(lectureTitle.trim())
  }

  if (!courseDetail && isLoading) {
    return (
      <div className="space-y-6 py-6 animate-pulse">
        <div className="h-8 bg-slate-800 rounded w-1/4"></div>
        <div className="h-40 bg-slate-900 rounded-xl border border-slate-800"></div>
      </div>
    )
  }

  if (isError || !courseDetail) {
    return (
      <div className="text-center py-12 space-y-4">
        <p className="text-rose-400 font-medium">Course not found or error loading details.</p>
        <Link to="/courses" className="text-indigo-400 text-sm hover:underline">
          &larr; Back to Courses
        </Link>
      </div>
    )
  }

  const { course, lectures } = courseDetail
  const isPurchased = user ? true : course.isPurchased

  return (
    <div className="space-y-8 py-4">
      {/* Back Button */}
      <Link
        to="/courses"
        className="inline-flex items-center space-x-2 text-sm text-slate-400 hover:text-slate-200 transition"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Courses</span>
      </Link>

      {/* Course Hero Banner */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <span className="text-xs font-semibold text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-md border border-indigo-500/20">
              Course #{course.id}
            </span>
            <h1 className="text-3xl font-extrabold text-slate-100 mt-2">{course.title}</h1>
          </div>

          <button
            onClick={() => {
              if (confirm('Are you sure you want to delete this course?')) {
                deleteCourseMutation.mutate()
              }
            }}
            disabled={deleteCourseMutation.isPending}
            className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition cursor-pointer self-start"
          >
            <Trash2 className="w-4 h-4" />
            <span>Delete Course</span>
          </button>
        </div>

        <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
          <div className="text-sm text-slate-400">
            Total Lectures: <span className="font-semibold text-slate-200">{lectures.length}</span>
          </div>

          {/* Dynamic Button */}
          {isPurchased ? (
            <span className="inline-flex items-center space-x-1.5 text-sm font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-4 py-2 rounded-lg">
              <CheckCircle className="w-4 h-4" />
              <span>Already Purchased</span>
            </span>
          ) : (
            <button
              onClick={() => alert('Please click Login in top header to authenticate and purchase!')}
              className="inline-flex items-center space-x-1.5 text-sm font-semibold bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 px-4 py-2 rounded-lg transition cursor-pointer"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Buy Now</span>
            </button>
          )}
        </div>
      </div>

      {/* Lectures Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <h2 className="text-xl font-bold text-slate-100 flex items-center space-x-2">
            <Video className="w-5 h-5 text-indigo-400" />
            <span>Lectures</span>
          </h2>
          <button
            onClick={() => setShowAddLecture(!showAddLecture)}
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center space-x-1 transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Lecture</span>
          </button>
        </div>

        {/* Add Lecture Form */}
        {showAddLecture && (
          <form onSubmit={handleLectureSubmit} className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
            <h3 className="text-sm font-bold text-slate-200">New Lecture</h3>
            <input
              type="text"
              required
              placeholder="Lecture title..."
              value={lectureTitle}
              onChange={(e) => setLectureTitle(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
            <div className="flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setShowAddLecture(false)}
                className="px-3 py-1 text-xs text-slate-400 hover:text-slate-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createLectureMutation.isPending}
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium px-3 py-1 rounded-lg transition disabled:opacity-50"
              >
                {createLectureMutation.isPending ? 'Adding...' : 'Save Lecture'}
              </button>
            </div>
          </form>
        )}

        {/* Lecture List */}
        {lectures.length > 0 ? (
          <div className="space-y-2">
            {lectures.map((lecture, idx) => (
              <div
                key={lecture.id}
                className="bg-slate-900/40 border border-slate-800/80 hover:border-slate-700/80 rounded-lg px-4 py-3 flex items-center justify-between transition"
              >
                <div className="flex items-center space-x-3">
                  <span className="text-xs font-semibold text-slate-500 w-6">#{idx + 1}</span>
                  <span className="text-slate-200 text-sm font-medium">{lecture.title}</span>
                </div>
                <button
                  onClick={() => deleteLectureMutation.mutate(lecture.id)}
                  disabled={deleteLectureMutation.isPending}
                  className="text-slate-500 hover:text-rose-400 p-1 rounded transition cursor-pointer"
                  title="Delete Lecture"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-slate-500 text-sm text-center py-6 bg-slate-900/20 border border-slate-800 rounded-xl">
            No lectures added to this course yet.
          </p>
        )}
      </div>
    </div>
  )
}
