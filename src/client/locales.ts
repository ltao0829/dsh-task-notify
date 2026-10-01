/**
 * The `task-notify` namespace dictionaries: copy for the reminder channels and
 * the plugin settings page.
 *
 * DSH 0.2 types a slot's `t` seat from the namespace its registration declares,
 * so this module also owns the `LocaleNamespaceMap` merge that makes the key
 * union below the compile-time contract of every `t(...)` call site.
 */

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'settings.title': '任务完成提醒',
  'settings.description': '任务或后台作业完成时弹出提醒。',
  'settings.enabled': '启用提醒',
  'settings.enabledHint': '关闭后不弹出任何完成提醒。',
  'settings.turn': '对话任务完成提醒',
  'settings.turnHint': '助手一轮任务（思考或工具调用结束）完成时提醒。',
  'settings.job': '后台任务完成提醒',
  'settings.jobHint': '后台命令或子代理作业结束时提醒。',
  'settings.allSessions': '监听全部会话的后台任务',
  'settings.allSessionsHint':
    '默认只监听本页面打开后活跃过的会话；开启后为会话列表中每个会话各开一条后台任务流，提醒更全但连接更多。',
  'settings.review': '需要审核时提醒',
  'settings.reviewHint': '任务运行中等待你审批 / 评审计划 / 回答提问时提醒。',
  'settings.failure': '失败时提醒',
  'settings.failureHint': '对话任务报错或后台任务失败 / 被终止时提醒。',
  'settings.browser': '浏览器系统通知',
  'settings.browserHint': '任务完成时发送操作系统通知（需授权）。',
  'settings.sound': '提示音',
  'settings.soundHint': '任务完成时播放提示音。',
  'event.turn': '任务已完成',
  'event.jobCompleted': '后台任务已完成',
  'event.jobFailed': '后台任务失败',
  'event.jobKilled': '后台任务被终止',
  'event.review': '需要你的审核',
  'event.failure': '任务失败',
  'review.approval': '操作审批',
  'review.planReview': '计划评审',
  'review.question': '提问',
} satisfies Record<string, string>

/** The task-notify key union — the exact key domain of every `t(...)` call. */
export type SettingsCardKey = keyof typeof zh

/** English dictionary, checked complete against the zh key set. */
export const en = {
  'settings.title': 'Task completion reminder',
  'settings.description': 'Pop up a reminder when a task or background job completes.',
  'settings.enabled': 'Enable reminders',
  'settings.enabledHint': 'When off, no completion reminder is shown.',
  'settings.turn': 'Turn completion reminder',
  'settings.turnHint': 'Remind when an agent turn (thinking or tool use) finishes.',
  'settings.job': 'Background job reminder',
  'settings.jobHint': 'Remind when a background command or subagent job settles.',
  'settings.allSessions': 'Watch background jobs in every session',
  'settings.allSessionsHint':
    'By default only sessions active since this page opened are watched; enabling this opens one job stream per session in the list — broader coverage, more connections.',
  'settings.review': 'Review-needed reminder',
  'settings.reviewHint': 'Remind when a running task waits for approval, plan review, or a question answer.',
  'settings.failure': 'Failure reminder',
  'settings.failureHint': 'Remind when an agent turn errors or a background job fails or is killed.',
  'settings.browser': 'Browser notification',
  'settings.browserHint': 'Also send an OS-level notification (requires permission).',
  'settings.sound': 'Sound',
  'settings.soundHint': 'Also play a short beep on completion.',
  'event.turn': 'Turn finished',
  'event.jobCompleted': 'Background job finished',
  'event.jobFailed': 'Background job failed',
  'event.jobKilled': 'Background job was killed',
  'event.review': 'Your review is needed',
  'event.failure': 'Task failed',
  'review.approval': 'Approval',
  'review.planReview': 'Plan review',
  'review.question': 'Question',
} satisfies Record<SettingsCardKey, string>

/** Dictionary namespace owned by this plugin. */
export const NS = 'task-notify'

/** Namespace-bound translate function shape used across this plugin. */
export type TaskNotifyTranslate = (key: SettingsCardKey, params?: Record<string, unknown>) => string

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** task-notify settings-page and toast copy. */
    'task-notify': SettingsCardKey
  }
}
