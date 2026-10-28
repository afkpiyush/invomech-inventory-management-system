import type { NextFunction, Request, Response } from 'express'
import { timingSafeEqual } from 'node:crypto'
import { AppError } from '../errors.js'

const safeEqual = (left: string, right: string) => {
  const a = Buffer.from(left)
  const b = Buffer.from(right)
  return a.length === b.length && timingSafeEqual(a, b)
}

export const csrfProtection = (request: Request, _response: Response, next: NextFunction) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method) || request.path === '/api/auth/login') {
    next()
    return
  }
  const cookieToken = request.cookies?.invomech_csrf
  const headerToken = request.header('x-csrf-token')
  if (!cookieToken || !headerToken || !safeEqual(cookieToken, headerToken)) {
    next(new AppError(403, 'Invalid CSRF token', 'CSRF_INVALID'))
    return
  }
  next()
}
