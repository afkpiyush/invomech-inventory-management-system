import type { NextFunction, Request, Response } from 'express'
import { ZodError } from 'zod'

export class AppError extends Error {
  constructor(public readonly statusCode: number, message: string, public readonly code = 'APP_ERROR') {
    super(message)
  }
}

export const errorHandler = (error: unknown, _request: Request, response: Response, _next: NextFunction) => {
  if (error instanceof ZodError) {
    response.status(400).json({ error: 'Validation failed', code: 'VALIDATION_ERROR', details: error.flatten() })
    return
  }
  if (error instanceof AppError) {
    response.status(error.statusCode).json({ error: error.message, code: error.code })
    return
  }
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const databaseCode = (error as { code?: string }).code
    if (databaseCode === 'ECONNREFUSED' || databaseCode === 'PROTOCOL_CONNECTION_LOST' || databaseCode === 'ETIMEDOUT') {
      response.status(503).json({ error: 'The database is unavailable. Ensure MySQL 8 is running.', code: 'DATABASE_UNAVAILABLE' })
      return
    }
    if (databaseCode === 'ER_BAD_DB_ERROR' || databaseCode === 'ER_NO_SUCH_TABLE') {
      response.status(503).json({ error: 'Database tables have not been initialized yet. Run "npm run db:migrate" to initialize.', code: 'DATABASE_NOT_INITIALIZED' })
      return
    }
    if (databaseCode === 'ER_ACCESS_DENIED_ERROR') {
      response.status(503).json({ error: 'Database authentication failed. Check your MYSQL_USER and MYSQL_PASSWORD in .env', code: 'DATABASE_AUTH_FAILED' })
      return
    }
    if (databaseCode === 'ER_DUP_ENTRY') {
      response.status(409).json({ error: 'A record with the same unique value already exists', code: 'DUPLICATE_RECORD' })
      return
    }
    if (databaseCode === 'ER_NO_REFERENCED_ROW_2') {
      response.status(400).json({ error: 'A referenced record does not exist', code: 'INVALID_REFERENCE' })
      return
    }
    if (databaseCode === 'ER_ROW_IS_REFERENCED_2') {
      response.status(409).json({ error: 'This record is still referenced by other records', code: 'RECORD_IN_USE' })
      return
    }
  }
  console.error(error)
  response.status(500).json({ error: 'An unexpected server error occurred', code: 'INTERNAL_ERROR' })
}
