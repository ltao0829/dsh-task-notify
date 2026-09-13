import { describe, expect, it } from 'vitest'
import { apply, inject, name, TASK_NOTIFY_SETTINGS_NAMESPACE } from '../src/index.ts'

describe('host entry', () => {
  it('loads without depending on the version-specific DSH settings API', () => {
    expect(name).toBe('task-notify')
    expect(TASK_NOTIFY_SETTINGS_NAMESPACE).toBe('task-notify')
    expect(inject).toEqual([])
    expect(() => apply({} as never)).not.toThrow()
  })
})
