/**
 * The task-notify settings card: five always-visible toggles over the
 * localStorage-backed settings store. Renders unconditionally (no settings
 * namespace dependency), so it always appears in the Web UI plugin group.
 */

import { useSyncExternalStore, type CSSProperties } from 'react'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { SettingsCardKey } from './locales.ts'
import { getSettings, setSetting, subscribeSettings, type TaskNotifySettings } from './settings.ts'
import { requestBrowserNotificationPermission } from './notify.ts'

export type { TaskNotifySettings }

/** Props the renderer binds for the task-notify card. */
export type TaskNotifySettingsCardProps = PropsRuntime<'web-ui.plugin.item'> & PropsLocale<'task-notify'>

interface RowSpec {
  key: keyof TaskNotifySettings
  label: SettingsCardKey
  hint: SettingsCardKey
}

const ROWS: RowSpec[] = [
  { key: 'enabled', label: 'settings.enabled', hint: 'settings.enabledHint' },
  { key: 'turn', label: 'settings.turn', hint: 'settings.turnHint' },
  { key: 'job', label: 'settings.job', hint: 'settings.jobHint' },
  { key: 'browser', label: 'settings.browser', hint: 'settings.browserHint' },
  { key: 'sound', label: 'settings.sound', hint: 'settings.soundHint' },
]

/**
 * Render the task-notify card.
 * @param props - locale copy.
 * @returns the card.
 */
export function TaskNotifySettingsCard(props: TaskNotifySettingsCardProps) {
  const { t } = props
  const settings = useSyncExternalStore(subscribeSettings, getSettings)
  return (
    <li style={styles.card}>
      <div style={styles.title}>{t('settings.title')}</div>
      <div style={styles.desc}>{t('settings.description')}</div>
      {ROWS.map((row) => (
        <label key={row.key} style={styles.row}>
          <input
            type="checkbox"
            style={styles.checkbox}
            checked={settings[row.key]}
            onChange={(event) => {
              const on = event.target.checked
              setSetting(row.key, on)
              if (row.key === 'browser' && on) void requestBrowserNotificationPermission()
            }}
          />
          <span style={styles.rowText}>
            <span style={styles.label}>{t(row.label)}</span>
            <span style={styles.hint}>{t(row.hint)}</span>
          </span>
        </label>
      ))}
    </li>
  )
}

const styles: Record<string, CSSProperties> = {
  card: {
    listStyle: 'none',
    border: '1px solid var(--dsw-alias-border-l2)',
    borderRadius: '8px',
    background: 'var(--dsw-alias-bg-layer-3)',
    padding: '12px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    minWidth: 0,
  },
  title: {
    fontSize: '14px',
    fontWeight: 600,
    color: 'var(--dsw-alias-label-primary)',
  },
  desc: {
    fontSize: '12px',
    color: 'var(--dsw-alias-label-tertiary)',
  },
  row: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
    cursor: 'pointer',
    minWidth: 0,
  },
  checkbox: {
    marginTop: '2px',
    flexShrink: 0,
  },
  rowText: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    minWidth: 0,
  },
  label: {
    fontSize: '13px',
    fontWeight: 500,
    color: 'var(--dsw-alias-label-primary)',
  },
  hint: {
    fontSize: '12px',
    color: 'var(--dsw-alias-label-secondary)',
  },
}
