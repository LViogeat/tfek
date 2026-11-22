import { describe, expect, it } from 'vitest'
import { changeSummary, formatEventDate, joinNames, parseNames, shiftWeeks, ticketDate, ticketTime, weeksUntilFuture } from '../src/lib/format'

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

describe('prénoms', () => {
  it('découpe une liste collée', () => {
    expect(parseNames('Alex, Inès et Sam\nLéa ; Jo')).toEqual(['Alex', 'Inès', 'Sam', 'Léa', 'Jo'])
    expect(parseNames('Bernadette')).toEqual(['Bernadette'])
  })

  it('assemble une liste en français', () => {
    expect(joinNames(['Alex'])).toBe('Alex')
    expect(joinNames(['Alex', 'Inès'])).toBe('Alex et Inès')
    expect(joinNames(['Alex', 'Inès', 'Sam'])).toBe('Alex, Inès et Sam')
  })
})

describe('changeSummary', () => {
  const iso = (local: string) => new Date(local).toISOString()
  const base = { starts_at: iso('2026-12-05T20:00:00'), ends_at: null, location: 'Chez moi' }

  it('rien d’important : null', () => {
    expect(changeSummary(base, { ...base })).toBeNull()
    expect(changeSummary(base, { ...base, location: ' Chez moi ' })).toBeNull()
  })

  it('nouvelle heure le même jour', () => {
    expect(changeSummary(base, { ...base, starts_at: iso('2026-12-05T21:00:00') })).toBe(
      'Nouvelle heure : samedi 5 décembre à 21:00 (au lieu de 20:00)',
    )
  })

  it('nouvelle date, avec ou sans changement d’heure', () => {
    expect(changeSummary(base, { ...base, starts_at: iso('2026-12-12T20:00:00') })).toBe(
      'Nouvelle date : samedi 12 décembre à 20:00 (au lieu du samedi 5 décembre)',
    )
    expect(changeSummary(base, { ...base, starts_at: iso('2026-12-12T19:00:00') })).toBe(
      'Nouvelle date : samedi 12 décembre à 19:00 (au lieu du samedi 5 décembre à 20:00)',
    )
  })

  it('fin et lieu, une ligne par changement', () => {
    const after = { ...base, ends_at: iso('2026-12-05T23:00:00'), location: 'Bar du Marché' }
    expect(changeSummary(base, after)).toBe('Fin : 23:00\nNouveau lieu : Bar du Marché (au lieu de Chez moi)')
    expect(changeSummary(after, { ...after, ends_at: null, location: null })).toBe('Plus d’heure de fin\nLieu à préciser')
    expect(changeSummary({ ...base, location: null }, base)).toBe('Lieu : Chez moi')
  })
})

describe('dupliquer : date de la copie', () => {
  it('une semaine plus tard, à la même heure locale', () => {
    const start = new Date('2026-12-03T20:00:00').toISOString()
    const copy = new Date(shiftWeeks(start, 1))
    expect([copy.getDate(), copy.getHours()]).toEqual([10, 20])
  })

  it('avance de semaine en semaine jusqu’à une date future', () => {
    const start = new Date('2026-11-01T20:00:00').toISOString()
    const now = new Date('2026-11-20T12:00:00').getTime()
    expect(weeksUntilFuture(start, now)).toBe(3)
    expect(weeksUntilFuture(new Date('2026-12-24T20:00:00').toISOString(), now)).toBe(1)
  })
})
