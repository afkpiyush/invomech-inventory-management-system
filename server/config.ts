import 'dotenv/config'
import { z } from 'zod'

const optionalString = z.preprocess((value) => typeof value === 'string' && value.trim() === '' ? undefined : value, z.string().optional())

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  CLIENT_ORIGIN: z.string().url().default('http://localhost:5173'),
  MYSQL_HOST: z.string().default('127.0.0.1'),
  MYSQL_PORT: z.coerce.number().int().positive().default(3306),
  MYSQL_DATABASE: z.string().default('invomech_inventory'),
  MYSQL_USER: z.string().default('root'),
  MYSQL_PASSWORD: z.string().default(''),
  SESSION_TTL_HOURS: z.coerce.number().positive().default(12),
  SMTP_HOST: optionalString,
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: optionalString,
  SMTP_PASSWORD: optionalString,
  SMTP_FROM: optionalString,
  EMAIL_PREVIEW_MODE: z.enum(['true', 'false']).default('true'),
})

export const config = configSchema.parse(process.env)
