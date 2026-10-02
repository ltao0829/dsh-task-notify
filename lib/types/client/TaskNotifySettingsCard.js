import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
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
import { useState, useSyncExternalStore } from 'react';
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
];
const SOUND_OPTIONS = [
    { value: 'off', label: 'settings.soundOff' },
    { value: 'single', label: 'settings.soundSingle' },
    { value: 'double', label: 'settings.soundDouble' },
    { value: 'custom', label: 'settings.soundCustom' },
];
const POSITION_OPTIONS = [
    { value: 'bottom-right', label: 'settings.toastBottomRight' },
    { value: 'bottom-left', label: 'settings.toastBottomLeft' },
    { value: 'top-right', label: 'settings.toastTopRight' },
    { value: 'top-left', label: 'settings.toastTopLeft' },
];
const MIN_SECONDS = 3;
const MAX_SECONDS = 15;
/** Clamp a typed duration; out-of-range or junk input falls back to the default 5. */
function clampSeconds(raw) {
    const value = Number(raw);
    if (raw === '' || !Number.isFinite(value))
        return 5;
    return Math.min(MAX_SECONDS, Math.max(MIN_SECONDS, Math.round(value)));
}
/** One labelled field block: label, optional hint, then the control(s). */
function Field(props) {
    return (_jsxs("div", { style: styles.field, children: [_jsx("span", { style: styles.label, children: props.label }), props.hint !== undefined ? _jsx("span", { style: styles.hint, children: props.hint }) : null, props.children] }));
}
/**
 * Render the task-notify settings page.
 * @param props - locale copy injected by the slot renderer.
 * @returns the settings page body.
 */
export function TaskNotifySettingsCard(props) {
    const { t } = props;
    const settings = useSyncExternalStore(subscribeSettings, getSettings);
    // Draft for the muted-sessions textarea: the store keeps the filtered id
    // list, but the text box must preserve what the user is mid-typing
    // (trailing newlines included) or adding a second line would be impossible.
    const [mutedDraft, setMutedDraft] = useState(() => getSettings().mutedSessions.join('\n'));
    return (_jsxs("section", { style: styles.page, "aria-label": t('settings.title'), children: [_jsx("div", { style: styles.title, children: t('settings.title') }), _jsx("div", { style: styles.desc, children: t('settings.description') }), ROWS.map((row) => (_jsxs("label", { style: styles.row, children: [_jsx("input", { type: "checkbox", style: styles.checkbox, checked: settings[row.key], onChange: (event) => {
                            const on = event.target.checked;
                            setSetting(row.key, on);
                            if (row.key === 'browser' && on)
                                void requestBrowserNotificationPermission();
                        } }), _jsxs("span", { style: styles.rowText, children: [_jsx("span", { style: styles.label, children: t(row.label) }), _jsx("span", { style: styles.hint, children: t(row.hint) })] })] }, row.key))), _jsxs(Field, { label: t('settings.soundMode'), hint: t('settings.soundModeHint'), children: [_jsx("select", { style: styles.input, value: settings.soundMode, onChange: (event) => setSetting('soundMode', event.target.value), children: SOUND_OPTIONS.map((option) => (_jsx("option", { value: option.value, children: t(option.label) }, option.value))) }), settings.soundMode === 'custom' ? (_jsx(Field, { label: t('settings.soundUrl'), hint: t('settings.soundUrlHint'), children: _jsx("input", { type: "url", style: styles.input, value: settings.soundUrl, placeholder: "https://example.com/ding.mp3", onChange: (event) => setSetting('soundUrl', event.target.value) }) })) : null, settings.soundMode !== 'off' ? (_jsx(Field, { label: `${t('settings.volume')} ${Math.round(settings.volume * 100)}%`, children: _jsx("input", { type: "range", style: styles.range, min: 0, max: 1, step: 0.05, value: settings.volume, onChange: (event) => setSetting('volume', Number(event.target.value)) }) })) : null] }), _jsx(Field, { label: t('settings.toastPosition'), hint: t('settings.toastPositionHint'), children: _jsx("select", { style: styles.input, value: settings.toastPosition, onChange: (event) => setSetting('toastPosition', event.target.value), children: POSITION_OPTIONS.map((option) => (_jsx("option", { value: option.value, children: t(option.label) }, option.value))) }) }), _jsx(Field, { label: t('settings.toastSeconds'), hint: t('settings.toastSecondsHint'), children: _jsx("input", { type: "number", style: styles.input, min: MIN_SECONDS, max: MAX_SECONDS, step: 1, value: settings.toastSeconds, onChange: (event) => {
                        // Commit only in-range values while typing so an intermediate
                        // digit does not snap the field; the blur handler clamps the rest.
                        const value = Number(event.target.value);
                        if (event.target.value !== '' && value >= MIN_SECONDS && value <= MAX_SECONDS) {
                            setSetting('toastSeconds', Math.round(value));
                        }
                    }, onBlur: (event) => setSetting('toastSeconds', clampSeconds(event.target.value)) }) }), _jsx(Field, { label: t('settings.templateTitle'), hint: t('settings.templateHint'), children: _jsx("input", { type: "text", style: styles.input, value: settings.templateTitle, onChange: (event) => setSetting('templateTitle', event.target.value) }) }), _jsx(Field, { label: t('settings.templateBody'), children: _jsx("input", { type: "text", style: styles.input, value: settings.templateBody, onChange: (event) => setSetting('templateBody', event.target.value) }) }), _jsxs("label", { style: styles.row, children: [_jsx("input", { type: "checkbox", style: styles.checkbox, checked: settings.quietEnabled, onChange: (event) => setSetting('quietEnabled', event.target.checked) }), _jsxs("span", { style: styles.rowText, children: [_jsx("span", { style: styles.label, children: t('settings.quietEnabled') }), _jsx("span", { style: styles.hint, children: t('settings.quietEnabledHint') })] })] }), settings.quietEnabled ? (_jsxs("div", { style: styles.inlineFields, children: [_jsxs("label", { style: styles.inlineField, children: [_jsx("span", { style: styles.hint, children: t('settings.quietFrom') }), _jsx("input", { type: "time", style: styles.input, value: settings.quietFrom, onChange: (event) => setSetting('quietFrom', event.target.value) })] }), _jsxs("label", { style: styles.inlineField, children: [_jsx("span", { style: styles.hint, children: t('settings.quietTo') }), _jsx("input", { type: "time", style: styles.input, value: settings.quietTo, onChange: (event) => setSetting('quietTo', event.target.value) })] })] })) : null, _jsx(Field, { label: t('settings.mutedSessions'), hint: t('settings.mutedSessionsHint'), children: _jsx("textarea", { style: styles.input, rows: 3, value: mutedDraft, onChange: (event) => {
                        setMutedDraft(event.target.value);
                        setSetting('mutedSessions', event.target.value.split('\n').map((line) => line.trim()).filter((line) => line !== ''));
                    } }) })] }));
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
};
