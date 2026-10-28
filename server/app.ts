import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import { config } from './config.js'
import { errorHandler } from './errors.js'
import { csrfProtection } from './middleware/csrf.js'
import authRouter from './routes/auth.js'
import dashboardRouter from './routes/dashboard.js'
import inventoryRouter from './routes/inventory.js'
import procurementRouter from './routes/procurement.js'
import suppliersRouter from './routes/suppliers.js'
import operationsRouter from './routes/operations.js'

export const app = express()
app.use(helmet())
app.use(cors({ origin: config.CLIENT_ORIGIN, credentials: true, exposedHeaders: ['Content-Disposition'] }))
app.use(express.json({ limit: '1mb' }))
app.use(cookieParser())
app.use(csrfProtection)
app.get('/api/health', (_request, response) => response.json({ status: 'ok' }))
app.use('/api/auth', authRouter)
app.use('/api/dashboard', dashboardRouter)
app.use('/api/inventory', inventoryRouter)
app.use('/api/suppliers', suppliersRouter)
app.use('/api/purchase-orders', procurementRouter)
app.use('/api/operations', operationsRouter)
app.use('/api', (_request, response) => response.status(404).json({ error: 'API route not found', code: 'NOT_FOUND' }))
app.use(errorHandler)
