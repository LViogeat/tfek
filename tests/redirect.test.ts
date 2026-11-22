import { describe, expect, it } from 'vitest'
import { safeRedirect } from '../src/lib/redirect'

describe('retour après connexion', () => {
  it('garde les chemins de l’app, requête comprise', () => {
    expect(safeRedirect('/e/abc')).toBe('/e/abc')
    expect(safeRedirect('/new?publish=1')).toBe('/new?publish=1')
    expect(safeRedirect('/account')).toBe('/account')
  })

  it('refuse tout ce qui sort de l’app', () => {
    for (const bad of ['//evil.com', '/\\evil.com', '/\\/evil.com', 'https://evil.com', 'evil.com', 'javascript:alert(1)', '', undefined, ['/e/abc']]) {
      expect(safeRedirect(bad)).toBe('/')
    }
  })
})
