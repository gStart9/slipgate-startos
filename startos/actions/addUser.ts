import { storeJson } from '../fileModels/store.json'
import { i18n } from '../i18n'
import { sdk } from '../sdk'

const { InputSpec, Value } = sdk

const inputSpec = InputSpec.of({
  username: Value.text({
    name: i18n('Username'),
    description: i18n(
      'Lowercase letters, digits, hyphens and underscores, starting with a letter.',
    ),
    required: true,
    default: null,
    placeholder: 'alice',
    patterns: [
      {
        regex: '^[a-z][a-z0-9_-]{0,30}$',
        description: i18n(
          'Lowercase letters, digits, hyphens and underscores, starting with a letter.',
        ),
      },
    ],
  }),
  password: Value.text({
    name: i18n('Password'),
    description: i18n('The password for SOCKS and SSH logins.'),
    required: true,
    default: { charset: 'a-z,A-Z,0-9', len: 20 },
    generate: { charset: 'a-z,A-Z,0-9', len: 20 },
    masked: true,
    minLength: 8,
    placeholder: null,
    patterns: [
      {
        regex: '^[A-Za-z0-9._~+=-]{8,64}$',
        description: i18n(
          'Letters, digits and . _ ~ + = - only, between 8 and 64 characters.',
        ),
      },
    ],
  }),
})

export const addUser = sdk.Action.withInput(
  'add-user',

  async () => ({
    name: i18n('Add User'),
    description: i18n(
      'Add a login for the SOCKS and SSH tunnels. Each user gets their own client profiles.',
    ),
    warning: null,
    allowedStatuses: 'any',
    group: i18n('Users'),
    visibility: 'enabled',
  }),

  inputSpec,

  async () => ({}),

  async ({ effects, input }) => {
    const users = (await storeJson.read((s) => s.users).once()) ?? []
    if (users.some((u) => u.username === input.username)) {
      throw new Error(i18n('That user already exists'))
    }
    await storeJson.merge(effects, {
      users: [...users, { username: input.username, password: input.password }],
    })
  },
)
