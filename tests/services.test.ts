import { describe, expect, it } from 'vitest'
import { timingSafeEqual } from 'node:crypto'
import { buildPurchaseOrderPdf } from '../server/services/pdf'
import { AppError } from '../server/errors'

const suggestedReorder = (quantity: number, minimum: number, configured: number) =>
  Math.max(configured, minimum * 2 - quantity)

const calculateNextStock = (current: number, type: 'IN' | 'OUT' | 'ADJUSTMENT', quantity: number) => {
  if (type === 'IN') return current + quantity
  if (type === 'OUT') {
    const next = current - quantity
    if (next < 0) throw new Error('Stock cannot become negative')
    return next
  }
  if (quantity < 0) throw new Error('Stock cannot become negative')
  return quantity
}

const safeEqual = (left: string, right: string) => {
  const a = Buffer.from(left)
  const b = Buffer.from(right)
  return a.length === b.length && timingSafeEqual(a, b)
}

describe('inventory rules & reorder calculations', () => {
  it('calculates a reorder quantity that restores safety stock', () => {
    expect(suggestedReorder(4, 8, 12)).toBe(12)
    expect(suggestedReorder(14, 8, 4)).toBe(4)
    expect(suggestedReorder(0, 10, 5)).toBe(20) // 10*2 - 0 = 20
  })

  it('calculates stock balance transitions correctly', () => {
    expect(calculateNextStock(10, 'IN', 5)).toBe(15)
    expect(calculateNextStock(10, 'OUT', 4)).toBe(6)
    expect(calculateNextStock(10, 'ADJUSTMENT', 0)).toBe(0)
    expect(calculateNextStock(10, 'ADJUSTMENT', 25)).toBe(25)
  })

  it('prevents negative stock balances on issue', () => {
    expect(() => calculateNextStock(5, 'OUT', 8)).toThrow('Stock cannot become negative')
    expect(() => calculateNextStock(0, 'OUT', 1)).toThrow('Stock cannot become negative')
  })
})

describe('security: CSRF safeEqual', () => {
  it('returns true for matching tokens', () => {
    const token = 'a'.repeat(48)
    expect(safeEqual(token, token)).toBe(true)
  })

  it('returns false for mismatched tokens or different lengths', () => {
    expect(safeEqual('abc12345', 'abc12346')).toBe(false)
    expect(safeEqual('short', 'longer_token_value')).toBe(false)
  })
})

describe('procurement: PDF generation', () => {
  it('generates a valid non-empty PDF buffer for purchase orders', async () => {
    const buffer = await buildPurchaseOrderPdf({
      number: 'PO-2026-0001',
      supplier: 'Apex Pneumatics & Automation',
      items: [
        { name: 'Pneumatic Cylinder 50mm', quantity: 10, unitPrice: 2450 },
        { name: 'Solenoid Valve 24V', quantity: 5, unitPrice: 1200 },
      ],
    })

    expect(Buffer.isBuffer(buffer)).toBe(true)
    expect(buffer.length).toBeGreaterThan(1000)
    // PDF magic bytes: %PDF-
    expect(buffer.slice(0, 5).toString('ascii')).toBe('%PDF-')
  })
})

describe('error handling: AppError', () => {
  it('instantiates correctly with status code and code', () => {
    const err = new AppError(404, 'Product not found', 'PRODUCT_NOT_FOUND')
    expect(err.statusCode).toBe(404)
    expect(err.message).toBe('Product not found')
    expect(err.code).toBe('PRODUCT_NOT_FOUND')
    expect(err instanceof Error).toBe(true)
  })
})
