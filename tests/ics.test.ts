import { describe, expect, it } from 'vitest'
import { buildIcs, escapeText, foldLine } from '../src/lib/ics'

describe('ics', () => {
  it('échappe ; , \\ et les retours à la ligne (CRLF compris)', () => {
    expect(escapeText('Apéro; chips, bières\\ok\r\nligne 2\rligne 3')).toBe(
      'Apéro\\; chips\\, bières\\\\ok\\nligne 2\\nligne 3',
    )
  })

  it('plie les lignes à 75 octets sans couper un caractère multi-octets', () => {
    const line = 'DESCRIPTION:' + 'é'.repeat(100)
    const folded = foldLine(line)
    const parts = folded.split('\r\n')
    const enc = new TextEncoder()
    expect(parts.length).toBeGreaterThan(1)
    parts.forEach((p) => expect(enc.encode(p).length).toBeLessThanOrEqual(75))
    expect(parts.map((p, i) => (i ? p.slice(1) : p)).join('')).toBe(line)
  })

  it('produit un fichier sans CR isolé, terminé par CRLF', () => {
    const ics = buildIcs({
      slug: 'abc',
      title: 'Soirée; jeux',
      description: 'Ligne 1\r\nLigne 2',
      location: 'Lyon',
      starts_at: '2026-12-01T19:00:00Z',
      url: 'https://tfek.app/e/abc',
    })
    expect(ics).toContain('SUMMARY:Soirée\\; jeux')
    expect(ics.replace(/\r\n/g, '')).not.toMatch(/\r/)
    expect(ics.endsWith('\r\n')).toBe(true)
  })
})
