import { clientBundle } from './build/tsdown.client.ts'

export default clientBundle(
  '@ltao0829/dsh-task-notify',
  ['src/index.ts'],
  {
    lib: {
      // The host half resolves the cordis framework from the dsh profile tree
      // at runtime, never from this repo's install; keep it external. The host
      // half imports nothing else — every notification behavior lives in the
      // browser bundle, whose externals come from the platform module table.
      external: ['@deepseek-ai/cordis'],
    },
  },
)
