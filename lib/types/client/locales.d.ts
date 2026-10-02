/**
 * The `task-notify` namespace dictionaries: copy for the reminder channels and
 * the plugin settings page.
 *
 * DSH 0.2 types a slot's `t` seat from the namespace its registration declares,
 * so this module also owns the `LocaleNamespaceMap` merge that makes the key
 * union below the compile-time contract of every `t(...)` call site.
 */
/** Simplified Chinese dictionary (the key-set source of truth). */
export declare const zh: {
    'settings.title': string;
    'settings.description': string;
    'settings.enabled': string;
    'settings.enabledHint': string;
    'settings.turn': string;
    'settings.turnHint': string;
    'settings.job': string;
    'settings.jobHint': string;
    'settings.allSessions': string;
    'settings.allSessionsHint': string;
    'settings.review': string;
    'settings.reviewHint': string;
    'settings.failure': string;
    'settings.failureHint': string;
    'settings.browser': string;
    'settings.browserHint': string;
    'settings.soundMode': string;
    'settings.soundModeHint': string;
    'settings.soundOff': string;
    'settings.soundSingle': string;
    'settings.soundDouble': string;
    'settings.soundCustom': string;
    'settings.soundUrl': string;
    'settings.soundUrlHint': string;
    'settings.volume': string;
    'settings.toastPosition': string;
    'settings.toastPositionHint': string;
    'settings.toastBottomRight': string;
    'settings.toastBottomLeft': string;
    'settings.toastTopRight': string;
    'settings.toastTopLeft': string;
    'settings.toastSeconds': string;
    'settings.toastSecondsHint': string;
    'settings.templateTitle': string;
    'settings.templateBody': string;
    'settings.templateHint': string;
    'settings.quietEnabled': string;
    'settings.quietEnabledHint': string;
    'settings.quietFrom': string;
    'settings.quietTo': string;
    'settings.mutedSessions': string;
    'settings.mutedSessionsHint': string;
    'event.turn': string;
    'event.jobCompleted': string;
    'event.jobFailed': string;
    'event.jobKilled': string;
    'event.review': string;
    'event.failure': string;
    'review.approval': string;
    'review.planReview': string;
    'review.question': string;
};
/** The task-notify key union — the exact key domain of every `t(...)` call. */
export type SettingsCardKey = keyof typeof zh;
/** English dictionary, checked complete against the zh key set. */
export declare const en: {
    'settings.title': string;
    'settings.description': string;
    'settings.enabled': string;
    'settings.enabledHint': string;
    'settings.turn': string;
    'settings.turnHint': string;
    'settings.job': string;
    'settings.jobHint': string;
    'settings.allSessions': string;
    'settings.allSessionsHint': string;
    'settings.review': string;
    'settings.reviewHint': string;
    'settings.failure': string;
    'settings.failureHint': string;
    'settings.browser': string;
    'settings.browserHint': string;
    'settings.soundMode': string;
    'settings.soundModeHint': string;
    'settings.soundOff': string;
    'settings.soundSingle': string;
    'settings.soundDouble': string;
    'settings.soundCustom': string;
    'settings.soundUrl': string;
    'settings.soundUrlHint': string;
    'settings.volume': string;
    'settings.toastPosition': string;
    'settings.toastPositionHint': string;
    'settings.toastBottomRight': string;
    'settings.toastBottomLeft': string;
    'settings.toastTopRight': string;
    'settings.toastTopLeft': string;
    'settings.toastSeconds': string;
    'settings.toastSecondsHint': string;
    'settings.templateTitle': string;
    'settings.templateBody': string;
    'settings.templateHint': string;
    'settings.quietEnabled': string;
    'settings.quietEnabledHint': string;
    'settings.quietFrom': string;
    'settings.quietTo': string;
    'settings.mutedSessions': string;
    'settings.mutedSessionsHint': string;
    'event.turn': string;
    'event.jobCompleted': string;
    'event.jobFailed': string;
    'event.jobKilled': string;
    'event.review': string;
    'event.failure': string;
    'review.approval': string;
    'review.planReview': string;
    'review.question': string;
};
/** Dictionary namespace owned by this plugin. */
export declare const NS = "task-notify";
/** Namespace-bound translate function shape used across this plugin. */
export type TaskNotifyTranslate = (key: SettingsCardKey, params?: Record<string, unknown>) => string;
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface LocaleNamespaceMap {
        /** task-notify settings-page and toast copy. */
        'task-notify': SettingsCardKey;
    }
}
//# sourceMappingURL=locales.d.ts.map