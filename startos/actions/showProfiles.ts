import { storeJson } from '../fileModels/store.json'
import { i18n } from '../i18n'
import { prepare } from '../prepare'
import { sdk } from '../sdk'
import { configDir, publicIpv4s } from '../utils'

const { InputSpec, Value } = sdk

const inputSpec = InputSpec.of({
  username: Value.dynamicSelect(async ({ effects }) => {
    const users = (await storeJson.read((s) => s.users).once()) ?? []
    return {
      name: i18n('User'),
      description: i18n('Whose profiles to show'),
      values: Object.fromEntries(users.map((u) => [u.username, u.username])),
      default: users[0]?.username ?? null,
      disabled: users.length ? false : i18n('Add a user first'),
    }
  }),
})

type Profile = { label: string; user: string | null; uri: string }

function parseProfiles(out: string): Profile[] {
  const profiles: Profile[] = []
  let current: { label: string; user: string | null } | null = null
  for (const raw of out.split('\n')) {
    const line = raw.trim()
    const head = line.match(/^\[([^\]]+)\]\s*(.*)$/)
    if (head) {
      const who = head[2].trim()
      current = {
        label: head[1],
        user: who === '' || who.startsWith('(') ? null : who,
      }
      continue
    }
    if (current && line.startsWith('slipnet://')) {
      profiles.push({ ...current, uri: line })
      current = null
    }
  }
  return profiles
}

export const showProfiles = sdk.Action.withInput(
  'show-profiles',

  async () => ({
    name: i18n('Show Client Profiles'),
    description: i18n(
      'Show the slipnet:// profiles for a user, as text and QR codes, to import into the SlipNet app.',
    ),
    warning: null,
    allowedStatuses: 'any',
    group: i18n('Users'),
    visibility: 'enabled',
  }),

  inputSpec,

  async () => ({}),

  async ({ effects, input }) => {
    const store = await storeJson.read().once()
    if (!store?.domain) throw new Error(i18n('Run Configure first'))
    const [publicAddress] = (await publicIpv4s(effects).once()) ?? []

    const out = await sdk.SubContainer.withTemp(
      effects,
      { imageId: 'slipgate' },
      sdk.Mounts.of().mountVolume({
        volumeId: 'main',
        subpath: 'slipgate',
        mountpoint: configDir,
        readonly: false,
      }),
      'show-profiles',
      async (sub) => {
        await prepare(sub, store, publicAddress)
        const res = await sub.execFail(['slipgate', 'users', 'configs'])
        return res.stdout.toString()
      },
    )

    const profiles = parseProfiles(out).filter(
      (p) => p.user === null || p.user === input.username,
    )
    if (!profiles.length) throw new Error(i18n('No profiles were generated'))

    return {
      version: '1',
      title: i18n('Client profiles for ${user}', { user: input.username }),
      message: i18n(
        'Scan or paste each profile into SlipNet. Profiles marked "no login" work for anyone who has them.',
      ),
      result: {
        type: 'group',
        value: profiles.map((p) => ({
          type: 'single' as const,
          name: p.user === null ? `${p.label} (no login)` : p.label,
          description: null,
          value: p.uri,
          masked: true,
          copyable: true,
          qr: true,
          launchable: false,
        })),
      },
    }
  },
)
