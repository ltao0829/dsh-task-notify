// @vitest-environment jsdom
/**
 * Unit tests for the notification renderer (toast + browser notification).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

class MockNotification {
  static permission: NotificationPermission = 'granted'
  static requestPermission = vi.fn(() => Promise.resolve('granted' as NotificationPermission))
  static instances: MockNotification[] = []
  title: string
  body: string
  constructor(title: string, options?: NotificationOptions) {
    this.title = title
    this.body = options?.body ?? ''
    MockNotification.instances.push(this)
  }
}

beforeEach(() => {
  vi.resetModules()
  vi.useRealTimers()
  MockNotification.instances = []
  MockNotification.permission = 'granted'
  // @ts-expect-error installing a test double for the browser Notification API
  globalThis.Notification = MockNotification
  document.body.innerHTML = ''
  document.querySelectorAll('[data-task-notify-toasts]').forEach((node) => node.remove())
})

describe('notifyEvent', () => {
  it('shows a toast with title and body', async () => {
    const { notifyEvent } = await import('../src/client/notify.ts')
    notifyEvent({ kind: 'turn', sessionId: 's1', title: 'Build feature' }, { browser: false, sound: false })
    const host = document.querySelector('[data-task-notify-toasts]')
    expect(host).not.toBeNull()
    expect(host!.textContent).toContain('任务已完成')
    expect(host!.textContent).toContain('Build feature')
  })

  it('sends a browser notification when enabled and granted', async () => {
    const { notifyEvent } = await import('../src/client/notify.ts')
    notifyEvent(
      { kind: 'job', sessionId: 's1', job: { id: 'pwsh-1', kind: 'pwsh', label: 'deploy', status: 'completed' } },
      { browser: true, sound: false },
    )
    expect(MockNotification.instances).toHaveLength(1)
    expect(MockNotification.instances[0].title).toBe('后台任务已完成')
    expect(MockNotification.instances[0].body).toContain('deploy')
  })

  it('skips browser notification when permission is denied', async () => {
    MockNotification.permission = 'denied'
    const { notifyEvent } = await import('../src/client/notify.ts')
    notifyEvent({ kind: 'turn', sessionId: 's1' }, { browser: true, sound: false })
    expect(MockNotification.instances).toHaveLength(0)
  })

  it('labels failed jobs distinctly', async () => {
    const { notifyEvent } = await import('../src/client/notify.ts')
    notifyEvent(
      { kind: 'job', sessionId: 's1', job: { id: 'pwsh-1', kind: 'pwsh', label: 'x', status: 'failed' } },
      { browser: false, sound: false },
    )
    expect(document.querySelector('[data-task-notify-toasts]')!.textContent).toContain('后台任务失败')
  })

  it('labels review kinds in the body', async () => {
    const { notifyEvent } = await import('../src/client/notify.ts')
    notifyEvent({ kind: 'review', sessionId: 's1', pending: 'approval', title: 'Deploy' }, { browser: false, sound: false })
    expect(document.querySelector('[data-task-notify-toasts]')!.textContent).toContain('操作审批')
  })
})
