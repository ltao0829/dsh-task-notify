import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * The task-notify settings page: always-visible toggles over the
 * localStorage-backed settings store, contributed to the Plugins settings
 * section's `settings.plugins.tab` seat.
 *
 * DSH 0.2 replaced the old `settings.plugin.item` card list with three seats —
 * a whole page (`settings.section`), a page inside the Plugins section
 * (`settings.plugins.tab`), or one row in General (`settings.general.item`).
 * This plugin owns a page, so it renders its toggles as a form rather than as a
 * single `<li>` card.
 */
import { useSyncExternalStore } from 'react';
import { getSettings, setSetting, subscribeSettings } from "./settings.js";
import { requestBrowserNotificationPermission } from "./notify.js";
const ROWS = [
    { key: 'enabled', label: 'settings.enabled', hint: 'settings.enabledHint' },
    { key: 'turn', label: 'settings.turn', hint: 'settings.turnHint' },
    { key: 'job', label: 'settings.job', hint: 'settings.jobHint' },
    { key: 'allSessions', label: 'settings.allSessions', hint: 'settings.allSessionsHint' },
    { key: 'review', label: 'settings.review', hint: 'settings.reviewHint' },
    { key: 'failure', label: 'settings.failure', hint: 'settings.failureHint' },
    { key: 'browser', label: 'settings.browser', hint: 'settings.browserHint' },
    { key: 'sound', label: 'settings.sound', hint: 'settings.soundHint' },
];
/**
 * Render the task-notify settings page.
 * @param props - locale copy injected by the slot renderer.
 * @returns the settings page body.
 */
export function TaskNotifySettingsCard(props) {
    const { t } = props;
    const settings = useSyncExternalStore(subscribeSettings, getSettings);
    return (_jsxs("section", { style: styles.page, "aria-label": t('settings.title'), children: [_jsx("div", { style: styles.title, children: t('settings.title') }), _jsx("div", { style: styles.desc, children: t('settings.description') }), ROWS.map((row) => (_jsxs("label", { style: styles.row, children: [_jsx("input", { type: "checkbox", style: styles.checkbox, checked: settings[row.key], onChange: (event) => {
                            const on = event.target.checked;
                            setSetting(row.key, on);
                            if (row.key === 'browser' && on)
                                void requestBrowserNotificationPermission();
                        } }), _jsxs("span", { style: styles.rowText, children: [_jsx("span", { style: styles.label, children: t(row.label) }), _jsx("span", { style: styles.hint, children: t(row.hint) })] })] }, row.key)))] }));
}
const styles = {
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
    label: {
        fontSize: '13px',
        fontWeight: 500,
        color: 'var(--dsw-alias-label-primary)',
    },
    hint: {
        fontSize: '12px',
        color: 'var(--dsw-alias-label-secondary)',
    },
};
