import { dnsRecordLines } from '../dnsRecords'
import { storeJson } from '../fileModels/store.json'
import { i18n } from '../i18n'
import { sdk } from '../sdk'
import { publicIpv4s } from '../utils'

export const showDnsRecords = sdk.Action.withoutInput(
  'show-dns-records',

  async () => ({
    name: i18n('Show DNS Records'),
    description: i18n(
      'List the DNS records your domain needs for the tunnels that are turned on.',
    ),
    warning: null,
    allowedStatuses: 'any',
    group: null,
    visibility: 'enabled',
  }),

  async ({ effects }) => {
    const store = await storeJson.read().once()
    if (!store?.domain) throw new Error(i18n('Run Configure first'))
    const [publicAddress] = (await publicIpv4s(effects).once()) ?? []
    if (!publicAddress) {
      throw new Error(
        i18n(
          'Publish the DNS Tunnels interface on a gateway with a public address, then run Show DNS Records.',
        ),
      )
    }
    return {
      version: '1',
      title: i18n('DNS records to create'),
      message: null,
      result: {
        type: 'single',
        value: dnsRecordLines(store, publicAddress).join('\n'),
        copyable: true,
        qr: false,
        masked: false,
        launchable: false,
      },
    }
  },
)
