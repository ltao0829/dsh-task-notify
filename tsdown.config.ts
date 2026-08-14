import { clientBundle } from './build/tsdown.client.ts'

export default clientBundle(
  '@linxin666/dsh-task-notify',
  ['src/index.ts'],
  {
    lib: {
      // The host half resolves the cordis framework and the settings service
      // from the dsh profile tree at runtime, never from this repo's install;
      // keep both external.
      external: ['@deepseek-ai/cordis', '@deepseek-ai/dsh-settings'],
    },
  },
)
