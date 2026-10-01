import { describe, expect, it } from 'vitest'
import { apply, inject, name } from '../src/index.ts'

describe('host entry', () => {
  it('stays an inert loader anchor with no host services', () => {
    expect(name).toBe('task-notify')
    expect(inject).toEqual([])
    expect(() => apply({} as never)).not.toThrow()
  })
})
