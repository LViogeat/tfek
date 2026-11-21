import { describe, expect, it } from 'vitest'
import { formatEventDate } from '../src/lib/format'

describe('formatEventDate', () => {
  it('met une majuscule à la date de fin quand elle est un autre jour', () => {
    const out = formatEventDate('2026-12-05T19:00:00', '2026-12-06T01:00:00')
    expect(out).toMatch(/^Samedi 5 décembre à 19:00 → Dimanche 6 décembre à 01:00$/)
  })
})
