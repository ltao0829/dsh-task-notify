/**
 * The `task-notify` namespace dictionaries: copy for the reminder channels
 * and the plugin settings card (the `web-ui.plugin.item` seat).
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
  'settings.browser': '浏览器系统通知',
  'settings.browserHint': '任务完成时发送操作系统通知（需授权）。',
  'settings.sound': '提示音',
  'settings.soundHint': '任务完成时播放提示音。',
  'settings.overridden': '已覆盖',
  'settings.reset': '恢复默认',
  'settings.readOnly': '当前部署的设置只读。',
  'settings.inherit': '继承',
  'settings.on': '开',
  'settings.off': '关',
  'settings.expand': '展开设置',
  'settings.collapse': '收起设置',
  'settings.save': '保存',
  'settings.saving': '保存中…',
  'settings.discard': '放弃',
  'settings.unsaved': '未保存',
  'settings.saveFailed': '部署未接受这些值，已保留供你修改。',
  'settings.invalidNumber': '请输入数字，留空则使用默认值。',
} satisfies Record<string, string>

/** The task-notify key union. */
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
  'settings.browser': 'Browser notification',
  'settings.browserHint': 'Also send an OS-level notification (requires permission).',
  'settings.sound': 'Sound',
  'settings.soundHint': 'Also play a short beep on completion.',
  'settings.overridden': 'Overridden',
  'settings.reset': 'Reset to default',
  'settings.readOnly': 'This deployment stores settings read-only.',
  'settings.inherit': 'Inherit',
  'settings.on': 'On',
  'settings.off': 'Off',
  'settings.expand': 'Show settings',
  'settings.collapse': 'Hide settings',
  'settings.save': 'Save',
  'settings.saving': 'Saving…',
  'settings.discard': 'Discard',
  'settings.unsaved': 'Unsaved',
  'settings.saveFailed': 'The deployment did not accept these values; they were left for you to correct.',
  'settings.invalidNumber': 'Enter a number, or leave blank to use the default.',
} satisfies Record<SettingsCardKey, string>

/** Dictionary namespace owned by this plugin. */
export const NS = 'task-notify'
