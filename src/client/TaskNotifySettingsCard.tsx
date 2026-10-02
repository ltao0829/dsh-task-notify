/**
 * The task-notify settings page: always-visible controls over the
 * localStorage-backed settings store, contributed to the Plugins settings
 * section's `settings.plugins.tab` seat.
 *
 * DSH 0.2 replaced the old `settings.plugin.item` card list with three seats —
 * a whole page (`settings.section`), a page inside the Plugins section
 * (`settings.plugins.tab`), or one row in General (`settings.general.item`).
 * This plugin owns a page, so it renders its toggles and customization fields
 * as a form rather than as a single `<li>` card. Controls are native elements
 * styled with DSH 0.2 theme tokens: the client bundle may only require the
 * frozen platform module table, so no additional component library is pulled
 * in here.
 */

import { useState, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { SettingsCardKey } from './locales.ts'
import { getSettings, setSetting, subscribeSettings, type SoundMode, type TaskNotifySettings, type ToastPosition } from './settings.ts'
import { requestBrowserNotificationPermission } from './notify.ts'

export type { TaskNotifySettings }

/** Props the renderer binds for the task-notify settings page. */
export type TaskNotifySettingsCardProps = PropsRuntime<'settings.plugins.tab'> & PropsLocale<'task-notify'>

interface RowSpec {
  key: BooleanSettingKey
  label: SettingsCardKey
  hint: SettingsCardKey
}

/** The boolean settings rendered as checkbox rows, in display order. */
type BooleanSettingKey = 'enabled' | 'turn' | 'job' | 'allSessions' | 'review' | 'failure' | 'browser'

const ROWS: RowSpec[] = [
  { key: 'enabled', label: 'settings.enabled', hint: 'settings.enabledHint' },
  { key: 'turn', label: 'settings.turn', hint: 'settings.turnHint' },
  { key: 'job', label: 'settings.job', hint: 'settings.jobHint' },
  { key: 'allSessions', label: 'settings.allSessions', hint: 'settings.allSessionsHint' },
  { key: 'review', label: 'settings.review', hint: 'settings.reviewHint' },
  { key: 'failure', label: 'settings.failure', hint: 'settings.failureHint' },
  { key: 'browser', label: 'settings.browser', hint: 'settings.browserHint' },
]

const SOUND_OPTIONS: ReadonlyArray<{ value: SoundMode; label: SettingsCardKey }> = [
  { value: 'off', label: 'settings.soundOff' },
  { value: 'single', label: 'settings.soundSingle' },
  { value: 'double', label: 'settings.soundDouble' },
  { value: 'custom', label: 'settings.soundCustom' },
]

const POSITION_OPTIONS: ReadonlyArray<{ value: ToastPosition; label: SettingsCardKey }> = [
  { value: 'bottom-right', label: 'settings.toastBottomRight' },
  { value: 'bottom-left', label: 'settings.toastBottomLeft' },
  { value: 'top-right', label: 'settings.toastTopRight' },
  { value: 'top-left', label: 'settings.toastTopLeft' },
]

const MIN_SECONDS = 3
const MAX_SECONDS = 15

/** Clamp a typed duration; out-of-range or junk input falls back to the default 5. */
function clampSeconds(raw: string): number {
  const value = Number(raw)
  if (raw === '' || !Number.isFinite(value)) return 5
  return Math.min(MAX_SECONDS, Math.max(MIN_SECONDS, Math.round(value)))
}

/** One labelled field block: label, optional hint, then the control(s). */
function Field(props: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div style={styles.field}>
      <span style={styles.label}>{props.label}</span>
      {props.hint !== undefined ? <span style={styles.hint}>{props.hint}</span> : null}
      {props.children}
    </div>
  )
}

/**
 * Render the task-notify settings page.
 * @param props - locale copy injected by the slot renderer.
 * @returns the settings page body.
 */
export function TaskNotifySettingsCard(props: TaskNotifySettingsCardProps) {
  const { t } = props
  const settings = useSyncExternalStore(subscribeSettings, getSettings)
  // Draft for the muted-sessions textarea: the store keeps the filtered id
  // list, but the text box must preserve what the user is mid-typing
  // (trailing newlines included) or adding a second line would be impossible.
  const [mutedDraft, setMutedDraft] = useState(() => getSettings().mutedSessions.join('\n'))
  return (
    <section style={styles.page} aria-label={t('settings.title')}>
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

      <Field label={t('settings.soundMode')} hint={t('settings.soundModeHint')}>
        <select
          style={styles.input}
          value={settings.soundMode}
          onChange={(event) => setSetting('soundMode', event.target.value as SoundMode)}
        >
          {SOUND_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{t(option.label)}</option>
          ))}
        </select>
        {settings.soundMode === 'custom' ? (
          <Field label={t('settings.soundUrl')} hint={t('settings.soundUrlHint')}>
            <input
              type="url"
              style={styles.input}
              value={settings.soundUrl}
              placeholder="https://example.com/ding.mp3"
              onChange={(event) => setSetting('soundUrl', event.target.value)}
            />
          </Field>
        ) : null}
        {settings.soundMode !== 'off' ? (
          <Field label={`${t('settings.volume')} ${Math.round(settings.volume * 100)}%`}>
            <input
              type="range"
              style={styles.range}
              min={0}
              max={1}
              step={0.05}
              value={settings.volume}
              onChange={(event) => setSetting('volume', Number(event.target.value))}
            />
          </Field>
        ) : null}
      </Field>

      <Field label={t('settings.toastPosition')} hint={t('settings.toastPositionHint')}>
        <select
          style={styles.input}
          value={settings.toastPosition}
          onChange={(event) => setSetting('toastPosition', event.target.value as ToastPosition)}
        >
          {POSITION_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{t(option.label)}</option>
          ))}
        </select>
      </Field>

      <Field label={t('settings.toastSeconds')} hint={t('settings.toastSecondsHint')}>
        <input
          type="number"
          style={styles.input}
          min={MIN_SECONDS}
          max={MAX_SECONDS}
          step={1}
          value={settings.toastSeconds}
          onChange={(event) => {
            // Commit only in-range values while typing so an intermediate
            // digit does not snap the field; the blur handler clamps the rest.
            const value = Number(event.target.value)
            if (event.target.value !== '' && value >= MIN_SECONDS && value <= MAX_SECONDS) {
              setSetting('toastSeconds', Math.round(value))
            }
          }}
          onBlur={(event) => setSetting('toastSeconds', clampSeconds(event.target.value))}
        />
      </Field>

      <Field label={t('settings.templateTitle')} hint={t('settings.templateHint')}>
        <input
          type="text"
          style={styles.input}
          value={settings.templateTitle}
          onChange={(event) => setSetting('templateTitle', event.target.value)}
        />
      </Field>

      {/* Its own field rather than a second box under the title label: a
          placeholder is not an accessible name. */}
      <Field label={t('settings.templateBody')}>
        <input
          type="text"
          style={styles.input}
          value={settings.templateBody}
          onChange={(event) => setSetting('templateBody', event.target.value)}
        />
      </Field>

      <label style={styles.row}>
        <input
          type="checkbox"
          style={styles.checkbox}
          checked={settings.quietEnabled}
          onChange={(event) => setSetting('quietEnabled', event.target.checked)}
        />
        <span style={styles.rowText}>
          <span style={styles.label}>{t('settings.quietEnabled')}</span>
          <span style={styles.hint}>{t('settings.quietEnabledHint')}</span>
        </span>
      </label>
      {settings.quietEnabled ? (
        <div style={styles.inlineFields}>
          <label style={styles.inlineField}>
            <span style={styles.hint}>{t('settings.quietFrom')}</span>
            <input
              type="time"
              style={styles.input}
              value={settings.quietFrom}
              onChange={(event) => setSetting('quietFrom', event.target.value)}
            />
          </label>
          <label style={styles.inlineField}>
            <span style={styles.hint}>{t('settings.quietTo')}</span>
            <input
              type="time"
              style={styles.input}
              value={settings.quietTo}
              onChange={(event) => setSetting('quietTo', event.target.value)}
            />
          </label>
        </div>
      ) : null}

      <Field label={t('settings.mutedSessions')} hint={t('settings.mutedSessionsHint')}>
        <textarea
          style={styles.input}
          rows={3}
          value={mutedDraft}
          onChange={(event) => {
            setMutedDraft(event.target.value)
            setSetting(
              'mutedSessions',
              event.target.value.split('\n').map((line) => line.trim()).filter((line) => line !== ''),
            )
          }}
        />
      </Field>
    </section>
  )
}

const styles: Record<string, CSSProperties> = {
  page: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    minWidth: 0,
    maxWidth: '560px',
  },
  title: {
    fontSize: '14px',
    fontWeight: 600,
    color: 'var(--dsw-alias-label-primary)',
  },
  desc: {
    fontSize: '12px',
    color: 'var(--dsw-alias-label-secondary)',
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
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
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
  input: {
    boxSizing: 'border-box',
    width: '100%',
    maxWidth: '280px',
    padding: '5px 8px',
    fontSize: '13px',
    color: 'var(--dsw-alias-label-primary, #e6edf3)',
    background: 'var(--dsw-alias-bg-overlay, #161b22)',
    border: '1px solid var(--dsw-alias-border-l2, #30363d)',
    borderRadius: '8px',
  },
  range: {
    width: '200px',
    accentColor: 'var(--dsw-alias-label-primary, #e6edf3)',
  },
  inlineFields: {
    display: 'flex',
    gap: '12px',
    paddingLeft: '24px',
  },
  inlineField: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
}
