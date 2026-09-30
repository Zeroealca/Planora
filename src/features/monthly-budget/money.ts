/**
 * Monetary arithmetic for the monthly-budget domain.
 *
 * Values cross the module boundary as ordinary decimal numbers for ergonomic
 * forms and rendering, but every sum, subtraction, and comparison is done in
 * integer cents. This module intentionally does not alter the legacy project
 * budget calculations.
 */

export type Cents = number

function assertFinite(value: number, name: string): void {
  if (!Number.isFinite(value)) throw new Error(`${name} must be a finite number.`)
}

function assertWholeCents(value: Cents): void {
  assertFinite(value, 'Cents')
  if (!Number.isInteger(value)) throw new Error('Cents must be an integer.')
}

export function toCents(amount: number): Cents {
  assertFinite(amount, 'Amount')
  return Math.round((amount + Math.sign(amount) * Number.EPSILON) * 100)
}

export function fromCents(cents: Cents): number {
  assertWholeCents(cents)
  return cents / 100
}

export function addCents(...values: readonly Cents[]): Cents {
  return values.reduce<Cents>((total, value) => {
    assertWholeCents(value)
    return total + value
  }, 0)
}

export function subtractCents(minuend: Cents, subtrahend: Cents): Cents {
  assertWholeCents(minuend)
  assertWholeCents(subtrahend)
  return minuend - subtrahend
}

export function maxCents(left: Cents, right: Cents): Cents {
  assertWholeCents(left)
  assertWholeCents(right)
  return Math.max(left, right)
}
