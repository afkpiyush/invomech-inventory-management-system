import crypto from 'node:crypto'
import type { NextFunction, Request, Response } from 'express'
import { query } from '../db.js'
import { AppError } from '../errors.js'
import type { AuthUser, Role } from '../types.js'

declare global {
  namespace Express {
    interface Request { user?: AuthUser }
  }
}

const sessionCookie = 'invomech_session'

export const getSessionCookieName = () => sessionCookie

export const requireAuth = async (request: Request, _response: Response, next: NextFunction) => {
  try {
    const token = request.cookies?.[sessionCookie]
    if (!token) throw new AppError(401, 'Authentication required', 'AUTH_REQUIRED')
    const rows = await query<(AuthUser & { session_id: string })[]>(
      `SELECT u.id, u.email, u.name, u.role, s.id AS session_id
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.id = ? AND s.expires_at > UTC_TIMESTAMP() AND u.active = 1`,
      [token],
    )
    if (!rows[0]) throw new AppError(401, 'Authentication required', 'AUTH_REQUIRED')
    request.user = rows[0]
    next()
  } catch (error) {
    next(error)
  }
}

export const requireRole = (...roles: Role[]) => (request: Request, _response: Response, next: NextFunction) => {
  if (!request.user || !roles.includes(request.user.role)) {
    next(new AppError(403, 'You do not have permission to perform this action', 'FORBIDDEN'))
    return
  }
  next()
}

export const createSessionToken = () => crypto.randomBytes(32).toString('hex')
export const createCsrfToken = () => crypto.randomBytes(24).toString('hex')
