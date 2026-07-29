import axios from 'axios'

export const API_BASE_URL = process.env.VITE_SERVER_URL

export const axiosClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
})

export interface PublicCourse {
  id: number
  title: string
}

export interface Course {
  id: number
  title: string
  isPurchased: boolean
}

export interface Lecture {
  id: number
  title: string
  courseId: number
}

export interface CourseDetail {
  course: Course
  lectures: Lecture[]
}

export interface User {
  email: string
}

// User me query options
export const meQueryOptions = {
  queryKey: ['me'],
  queryFn: async (): Promise<User | null> => {
    try {
      const { data } = await axiosClient.get<User>('/me')
      return data
    } catch (err: any) {
      if (err.response?.status === 401) {
        return null
      }
      throw err
    }
  },
  staleTime: 0,
  gcTime: 30 * 60 * 1000,
}

// Required exact publicCoursesQueryOptions hook/options requested by user
export const publicCoursesQueryOptions = {
  queryKey: ['public-courses'],
  queryFn: async (): Promise<PublicCourse[]> => {
    const { data } = await axiosClient.get<PublicCourse[]>('/public/courses')
    return data
  },
  staleTime: 0,
  gcTime: 30 * 60 * 1000,
}

// Courses list query options
export const coursesQueryOptions = {
  queryKey: ['courses'],
  queryFn: async (): Promise<Course[]> => {
    const { data } = await axiosClient.get<Course[]>('/courses')
    return data
  },
  staleTime: 0,
  gcTime: 30 * 60 * 1000,
}

// Course detail query options
export const courseDetailQueryOptions = (courseId: number | string) => ({
  queryKey: ['course', courseId],
  queryFn: async (): Promise<CourseDetail> => {
    const { data } = await axiosClient.get<CourseDetail>(`/courses/${courseId}`)
    return data
  },
  staleTime: 0,
  gcTime: 30 * 60 * 1000,
})
