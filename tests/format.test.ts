import { describe, expect, it } from 'vitest'
import { formatEventDate, ticketDate, ticketTime } from '../src/lib/format'

describe('formatEventDate', () => {
  it('met une majuscule à la date de fin quand elle est un autre jour', () => {
    const out = formatEventDate('2026-12-05T19:00:00', '2026-12-06T01:00:00')
    expect(out).toMatch(/^Samedi 5 décembre à 19:00 → Dimanche 6 décembre à 01:00$/)
  })
})

describe('billet', () => {
  it('formate la date en abrégé', () => {
    expect(ticketDate('2026-12-01T20:00:00')).toBe('MAR 01.12')
  })
  it('donne l’heure, avec la fin si elle est le même jour', () => {
    expect(ticketTime('2026-12-01T20:00:00')).toBe('20:00')
    expect(ticketTime('2026-12-01T20:00:00', '2026-12-01T23:30:00')).toBe('20:00 – 23:30')
    expect(ticketTime('2026-12-05T19:00:00', '2026-12-06T01:00:00')).toBeNull()
  })
})
