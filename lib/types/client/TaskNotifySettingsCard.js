import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * The task-notify settings card: five always-visible toggles over the
 * localStorage-backed settings store. Renders unconditionally (no settings
 * namespace dependency), so it always appears in the Web UI plugin group.
 */
import { useSyncExternalStore } from 'react';
import { getSettings, setSetting, subscribeSettings } from "./settings.js";
import { requestBrowserNotificationPermission } from "./notify.js";
const ROWS = [
    { key: 'enabled', label: 'settings.enabled', hint: 'settings.enabledHint' },
    { key: 'turn', label: 'settings.turn', hint: 'settings.turnHint' },
    { key: 'job', label: 'settings.job', hint: 'settings.jobHint' },
    { key: 'browser', label: 'settings.browser', hint: 'settings.browserHint' },
    { key: 'sound', label: 'settings.sound', hint: 'settings.soundHint' },
];
/**
 * Render the task-notify card.
 * @param props - locale copy.
 * @returns the card.
 */
export function TaskNotifySettingsCard(props) {
    const { t } = props;
    const settings = useSyncExternalStore(subscribeSettings, getSettings);
    return (_jsxs("li", { style: styles.card, children: [_jsx("div", { style: styles.title, children: t('settings.title') }), _jsx("div", { style: styles.desc, children: t('settings.description') }), ROWS.map((row) => (_jsxs("label", { style: styles.row, children: [_jsx("input", { type: "checkbox", style: styles.checkbox, checked: settings[row.key], onChange: (event) => {
                            const on = event.target.checked;
                            setSetting(row.key, on);
                            if (row.key === 'browser' && on)
                                void requestBrowserNotificationPermission();
                        } }), _jsxs("span", { style: styles.rowText, children: [_jsx("span", { style: styles.label, children: t(row.label) }), _jsx("span", { style: styles.hint, children: t(row.hint) })] })] }, row.key)))] }));
}
const styles = {
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
};
