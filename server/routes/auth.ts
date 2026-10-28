import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { config } from '../config.js'
import { execute, query } from '../db.js'
import { AppError } from '../errors.js'
import { createCsrfToken, createSessionToken, getSessionCookieName, requireAuth } from '../middleware/auth.js'

const router = Router()
const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1).max(128) })
const cookieOptions = { path: '/', httpOnly: true, secure: config.NODE_ENV === 'production', sameSite: 'lax' as const, signed: false }

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again after 15 minutes.', code: 'RATE_LIMIT_EXCEEDED' },
})

router.get('/csrf', (_request, response) => {
  const token = createCsrfToken()
  response.cookie('invomech_csrf', token, { ...cookieOptions, httpOnly: false, maxAge: 60 * 60 * 1000 })
  response.json({ csrfToken: token })
})

router.post('/login', loginLimiter, async (request, response) => {
  const { email, password } = loginSchema.parse(request.body)
  const rows = await query<{ id: number; email: string; name: string; role: 'admin' | 'inventory_manager'; password_hash: string }[]>(
    'SELECT id, email, name, role, password_hash FROM users WHERE email = ? AND active = 1',
    [email.toLowerCase()],
  )
  const user = rows[0]
  const valid = user ? await import('bcryptjs').then(({ compare }) => compare(password, user.password_hash)) : false
  if (!user || !valid) throw new AppError(401, 'Invalid email or password', 'AUTH_INVALID')
  
  // Clean up any expired sessions
  void execute('DELETE FROM sessions WHERE expires_at <= UTC_TIMESTAMP()').catch(() => {})

  const token = createSessionToken()
  await execute('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? HOUR))', [token, user.id, config.SESSION_TTL_HOURS])
  response.cookie(getSessionCookieName(), token, { ...cookieOptions, maxAge: config.SESSION_TTL_HOURS * 60 * 60 * 1000 })
  response.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role } })
})

router.post('/logout', requireAuth, async (request, response) => {
  if (request.cookies?.invomech_session) {
    await execute('DELETE FROM sessions WHERE id = ?', [request.cookies.invomech_session]).catch(() => {})
  }
  response.clearCookie(getSessionCookieName(), cookieOptions)
  response.clearCookie('invomech_csrf', { ...cookieOptions, httpOnly: false })
  response.status(204).send()
})

router.get('/me', requireAuth, (request, response) => response.json({ user: request.user }))

export default router
