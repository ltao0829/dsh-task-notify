// @vitest-environment jsdom
/**
 * Render tests for the task-notify settings page. The card is the only React
 * surface this plugin ships, so these tests mount it for real (react-dom
 * createRoot) and drive the native controls through dispatchEvent, asserting
 * that every control round-trips through the localStorage settings store.
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { zh, type SettingsCardKey } from '../src/client/locales.ts'
import { getSettings, setSetting, type TaskNotifySettings } from '../src/client/settings.ts'
import { TaskNotifySettingsCard, type TaskNotifySettingsCardProps } from '../src/client/TaskNotifySettingsCard.tsx'

;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const t = (key: SettingsCardKey): string => zh[key]

function memoryStorage(): Storage {
  const map = new Map<string, string>()
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => { map.set(key, String(value)) },
    removeItem: (key) => { map.delete(key) },
    clear: () => { map.clear() },
    key: (index) => [...map.keys()][index] ?? null,
    get length() { return map.size },
  } as unknown as Storage
}

/** The store fields each test may have touched in an earlier test. */
const DEFAULTS: TaskNotifySettings = {
  enabled: true,
  turn: true,
  job: true,
  allSessions: false,
  review: true,
  failure: true,
  browser: true,
  soundMode: 'off',
  soundUrl: '',
  volume: 1,
  toastPosition: 'bottom-right',
  toastSeconds: 5,
  templateTitle: '',
  templateBody: '',
  quietEnabled: false,
  quietFrom: '22:00',
  quietTo: '08:00',
  mutedSessions: [],
}

let container: HTMLElement
let root: Root | null = null

async function renderCard(): Promise<HTMLElement> {
  container = document.createElement('div')
  document.body.appendChild(container)
  await act(async () => {
    root = createRoot(container)
    root.render(<TaskNotifySettingsCard {...({ t } as unknown as TaskNotifySettingsCardProps)} />)
  })
  return container
}

/**
 * Set a DOM value through the prototype's native setter and fire React's
 * onChange. React installs a value tracker on the node itself, so assigning
 * `node.value` directly updates the tracker too and the change event is then
 * deduplicated away — the native setter bypasses that interception.
 */
async function change(node: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, value: string): Promise<void> {
  const proto: object = node instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype
    : node instanceof HTMLSelectElement
      ? HTMLSelectElement.prototype
      : HTMLInputElement.prototype
  await act(async () => {
    Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(node, value)
    node.dispatchEvent(new Event('change', { bubbles: true }))
  })
}

async function click(node: Element): Promise<void> {
  await act(async () => {
    node.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
}

beforeEach(() => {
  globalThis.localStorage = memoryStorage()
  // This file imports the settings store statically and the store keeps a
  // module-level snapshot, so replacing `localStorage` alone would not reset
  // it. A dynamic import after `vi.resetModules()` is the alternative, but it
  // would hand the card a second React instance — the renderer and the
  // component would then disagree about the hook dispatcher. Every field is
  // put back to its documented default instead, so no test can observe
  // another test's edits.
  for (const key of Object.keys(DEFAULTS) as (keyof TaskNotifySettings)[]) {
    setSetting(key, DEFAULTS[key])
  }
  document.body.innerHTML = ''
})

afterEach(async () => {
  await act(async () => { root?.unmount() })
  root = null
  document.body.innerHTML = ''
})

describe('TaskNotifySettingsCard', () => {
  it('renders the page title, the boolean rows, and the customization controls', async () => {
    const page = await renderCard()
    expect(page.textContent).toContain('任务完成提醒')
    expect(page.querySelectorAll('input[type=checkbox]')).toHaveLength(8)
    expect(page.querySelectorAll('select')).toHaveLength(2)
    expect(page.querySelector('textarea')).not.toBeNull()
    expect(page.textContent).toContain('{title}（任务标题）')
  })

  it('reflects the current store state in the checkboxes', async () => {
    await renderCard()
    const boxes = container.querySelectorAll<HTMLInputElement>('input[type=checkbox]')
    expect(boxes[0]!.checked).toBe(true) // enabled
    expect(boxes[3]!.checked).toBe(false) // allSessions
  })

  it('toggles a boolean row through the store', async () => {
    await renderCard()
    const enabled = container.querySelectorAll<HTMLInputElement>('input[type=checkbox]')[0]!
    await click(enabled)
    expect(getSettings().enabled).toBe(false)
    await click(enabled)
    expect(getSettings().enabled).toBe(true)
  })

  it('shows the volume slider and URL field only for the matching sound modes', async () => {
    await renderCard()
    expect(container.querySelector('input[type=url]')).toBeNull()
    expect(container.querySelector('input[type=range]')).toBeNull()
    await change(container.querySelector('select')!, 'double')
    expect(getSettings().soundMode).toBe('double')
    expect(container.querySelector('input[type=range]')).not.toBeNull()
    await change(container.querySelector('select')!, 'custom')
    expect(container.querySelector('input[type=url]')).not.toBeNull()
  })

  it('writes the custom sound URL and clamped volume through the store', async () => {
    await renderCard()
    await change(container.querySelector('select')!, 'custom')
    await change(container.querySelector<HTMLInputElement>('input[type=url]')!, 'https://example.com/ding.mp3')
    expect(getSettings().soundUrl).toBe('https://example.com/ding.mp3')
    const volume = container.querySelector<HTMLInputElement>('input[type=range]')!
    await change(volume, '0.25')
    expect(getSettings().volume).toBe(0.25)
  })

  it('writes the toast position and the configured duration through the store', async () => {
    await renderCard()
    const [soundSelect, positionSelect] = container.querySelectorAll<HTMLSelectElement>('select')
    await change(positionSelect!, 'top-right')
    expect(getSettings().toastPosition).toBe('top-right')
    const seconds = container.querySelector<HTMLInputElement>('input[type=number]')!
    await change(seconds, '9')
    expect(getSettings().toastSeconds).toBe(9)
    // Out-of-range input is ignored while typing and clamped on blur.
    await change(seconds, '99')
    expect(getSettings().toastSeconds).toBe(9)
    await act(async () => {
      seconds.value = '99'
      // React delegates onBlur to the bubbling focusout event.
      seconds.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
    })
    expect(getSettings().toastSeconds).toBe(15)
  })

  it('renders the template fields and writes both templates through the store', async () => {
    await renderCard()
    const [title, body] = container.querySelectorAll<HTMLInputElement>('input[type=text]')
    await change(title!, '[{kind}] {title}')
    await change(body!, '{session}')
    expect(getSettings().templateTitle).toBe('[{kind}] {title}')
    expect(getSettings().templateBody).toBe('{session}')
  })

  it('reveals the quiet-time fields when enabled and writes them through the store', async () => {
    await renderCard()
    expect(container.querySelectorAll('input[type=time]')).toHaveLength(0)
    const quiet = container.querySelectorAll<HTMLInputElement>('input[type=checkbox]')[7]!
    await click(quiet)
    expect(getSettings().quietEnabled).toBe(true)
    const times = container.querySelectorAll<HTMLInputElement>('input[type=time]')
    expect(times).toHaveLength(2)
    expect(times[0]!.value).toBe('22:00')
    await change(times[1]!, '07:00')
    expect(getSettings().quietTo).toBe('07:00')
  })

  it('keeps the muted-sessions draft while storing the filtered id list', async () => {
    await renderCard()
    const textarea = container.querySelector<HTMLTextAreaElement>('textarea')!
    await change(textarea, 'sess_a\nsess_b')
    expect(getSettings().mutedSessions).toEqual(['sess_a', 'sess_b'])
    // The draft (with the trailing newline mid-edit) survives the re-render.
    expect(textarea.value).toBe('sess_a\nsess_b')
  })

  it('re-renders when the store changes from outside the card', async () => {
    await renderCard()
    await act(async () => {
      setSetting('toastPosition', 'top-left')
    })
    const [, positionSelect] = container.querySelectorAll<HTMLSelectElement>('select')
    expect(positionSelect!.value).toBe('top-left')
  })

  // Runs after the test above deliberately moved `toastPosition`: it fails if
  // the beforeEach reset stops restoring the documented defaults.
  it('starts from the documented defaults whatever an earlier test touched', async () => {
    await renderCard()
    const [, positionSelect] = container.querySelectorAll<HTMLSelectElement>('select')
    expect(getSettings()).toMatchObject(DEFAULTS)
    expect(positionSelect!.value).toBe('bottom-right')
  })
})
