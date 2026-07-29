import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { sign, verify } from 'hono/jwt'
import { neon } from '@neondatabase/serverless'

type Bindings = {
  DATABASE_URL: string
}

type Variables = {
  userEmail?: string
}

const JWT_SECRET = 'super-secret-jwt-key'
const COOKIE_NAME = 'auth_token'

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// Enable CORS with credentials for cross-domain requests
app.use(
  '*',
  cors({
    origin: (origin) => origin || '*',
    credentials: true,
  }),
)

// Helper to parse cookies from Cookie header
function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) return {}
  return Object.fromEntries(
    header.split(';').map((c) => {
      const [key, ...v] = c.trim().split('=')
      return [key, v.join('=')]
    }),
  )
}

// Helper to serialize cookie with SameSite=None & Secure for cross-domain auth
function serializeCookie(
  name: string,
  value: string,
  options: { maxAge?: number; path?: string } = {},
): string {
  let cookieStr = `${name}=${value}`
  if (options.path) cookieStr += `; Path=${options.path}`
  if (options.maxAge !== undefined) cookieStr += `; Max-Age=${options.maxAge}`
  // SameSite=None; Secure ensures cross-domain cookie sending (Frontend & Backend on different domains)
  cookieStr += '; SameSite=None; Secure'
  return cookieStr
}

// Helper to get raw neon SQL executor
function getDb(c: any) {
  const dbUrl = c.env.DATABASE_URL
  if (!dbUrl) {
    throw new Error('DATABASE_URL is not set')
  }
  return neon(dbUrl)
}

// Auth Middleware: Check Authorization header FIRST (for cross-domain), fallback to Cookie header
app.use('*', async (c, next) => {
  let token: string | undefined

  // 1. Check Authorization Bearer Header
  const authHeader = c.req.header('Authorization')
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7)
  }

  // 2. Fallback to Cookie header
  if (!token) {
    const cookieHeader = c.req.header('Cookie')
    if (cookieHeader) {
      const cookies = parseCookies(cookieHeader)
      token = cookies[COOKIE_NAME]
    }
  }

  if (token) {
    try {
      const payload = await verify(token, JWT_SECRET, 'HS256')
      if (typeof payload.email === 'string') {
        c.set('userEmail', payload.email)
      }
    } catch (err) {
      // Token invalid or expired
    }
  }

  await next()
})

// --- AUTH ROUTERS ---

// POST /login - returns token in body AND sets Cookie
app.post('/login', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const email =
    body.email && typeof body.email === 'string' && body.email.trim()
      ? body.email.trim()
      : 'user@example.com'

  const token = await sign({ email }, JWT_SECRET)

  // Set Cookie on response (SameSite=None; Secure)
  const setCookie = serializeCookie(COOKIE_NAME, token, {
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  })

  c.header('Set-Cookie', setCookie)
  return c.json({ message: 'Logged in successfully', token, user: { email } })
})

// POST /logout
app.post('/logout', (c) => {
  const setCookie = serializeCookie(COOKIE_NAME, '', {
    path: '/',
    maxAge: 0,
  })
  c.header('Set-Cookie', setCookie)
  return c.json({ message: 'Logged out successfully' })
})

// GET /me
app.get('/me', (c) => {
  const userEmail = c.get('userEmail')
  if (!userEmail) {
    return c.json({ error: 'Not authenticated' }, 401)
  }
  return c.json({ email: userEmail })
})

// --- PUBLIC COURSES ROUTE FOR TANSTACK QUERY OPTIONS ---
app.get('/public/courses', async (c) => {
  const sql = getDb(c)
  const rows = await sql`SELECT id, title FROM courses ORDER BY id DESC`
  return c.json(rows)
})

// --- COURSES ROUTERS ---

// GET /courses - list all courses with purchase status
app.get('/courses', async (c) => {
  const sql = getDb(c)
  const rows = await sql`SELECT id, title FROM courses ORDER BY id DESC`

  const userEmail = c.get('userEmail')
  const isPurchased = !!userEmail

  const courses = rows.map((course: any) => ({
    id: course.id,
    title: course.title,
    isPurchased,
  }))

  return c.json(courses)
})

// POST /courses - create a course with title
app.post('/courses', async (c) => {
  const sql = getDb(c)
  const body = await c.req.json().catch(() => ({}))
  const { title } = body

  if (!title || typeof title !== 'string') {
    return c.json({ error: 'Title is required' }, 400)
  }

  const result =
    await sql`INSERT INTO courses (title) VALUES (${title}) RETURNING id, title`
  return c.json(result[0], 201)
})

// DELETE /courses/:id - delete a course
app.delete('/courses/:id', async (c) => {
  const sql = getDb(c)
  const id = c.req.param('id')

  await sql`DELETE FROM courses WHERE id = ${id}`
  return c.json({ message: 'Course deleted successfully' })
})

// --- LECTURES ROUTERS ---

// GET /courses/:id - detail view (single course & list all lectures for course)
app.get('/courses/:id', async (c) => {
  const sql = getDb(c)
  const id = c.req.param('id')

  const courseRows = await sql`SELECT id, title FROM courses WHERE id = ${id}`
  if (courseRows.length === 0) {
    return c.json({ error: 'Course not found' }, 404)
  }

  const lectures =
    await sql`SELECT id, title, course_id AS "courseId" FROM lectures WHERE course_id = ${id} ORDER BY id ASC`
  const userEmail = c.get('userEmail')

  return c.json({
    course: {
      ...courseRows[0],
      isPurchased: !!userEmail,
    },
    lectures,
  })
})

// POST /courses/:id - create a new lecture (fields: title, courseId)
app.post('/courses/:id', async (c) => {
  const sql = getDb(c)
  const id = c.req.param('id')
  const body = await c.req.json().catch(() => ({}))
  const { title } = body

  if (!title || typeof title !== 'string') {
    return c.json({ error: 'Title is required' }, 400)
  }

  const result =
    await sql`INSERT INTO lectures (title, course_id) VALUES (${title}, ${id}) RETURNING id, title, course_id AS "courseId"`
  return c.json(result[0], 201)
})

// DELETE /courses/:id/lectures/:lectureId - delete a lecture
app.delete('/courses/:id/lectures/:lectureId', async (c) => {
  const sql = getDb(c)
  const lectureId = c.req.param('lectureId')

  await sql`DELETE FROM lectures WHERE id = ${lectureId}`
  return c.json({ message: 'Lecture deleted successfully' })
})

export default app
