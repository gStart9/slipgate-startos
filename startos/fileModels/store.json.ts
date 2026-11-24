import { FileHelper, z } from '@start9labs/start-sdk'
import { sdk } from '../sdk'
import {
  defaultEnabledTunnels,
  defaultNaivePort,
  defaultStunTlsPort,
} from '../utils'

const user = z.object({ username: z.string(), password: z.string() })

const shape = z.looseObject({
  domain: z.string().optional().catch(undefined),
  enabledTunnels: z.array(z.string()).catch([...defaultEnabledTunnels]),
  naivePort: z.number().int().catch(defaultNaivePort),
  stunTlsPort: z.number().int().catch(defaultStunTlsPort),
  users: z.array(user).catch([]),
})

export type Store = z.infer<typeof shape>

export const storeJson = FileHelper.json(
  { base: sdk.volumes.main, subpath: 'store.json' },
  shape,
)
