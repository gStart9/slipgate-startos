import { storeJson } from '../fileModels/store.json'
import { i18n } from '../i18n'
import { sdk } from '../sdk'

const { InputSpec, Value } = sdk

const inputSpec = InputSpec.of({
  username: Value.dynamicSelect(async ({ effects }) => {
    const users = (await storeJson.read((s) => s.users).once()) ?? []
    return {
      name: i18n('User'),
      description: null,
      values: Object.fromEntries(users.map((u) => [u.username, u.username])),
      default: null,
      disabled: users.length ? false : i18n('There are no users'),
    }
  }),
})

export const removeUser = sdk.Action.withInput(
  'remove-user',

  async () => ({
    name: i18n('Remove User'),
    description: i18n(
      'Remove a login. Profiles issued to that user stop working.',
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
    await storeJson.merge(effects, {
      users: users.filter((u) => u.username !== input.username),
    })
  },
)
