import { utils } from '@start9labs/start-sdk'
import { dnsRecordLines } from '../dnsRecords'
import { storeJson } from '../fileModels/store.json'
import { i18n } from '../i18n'
import { sdk } from '../sdk'
import {
  defaultEnabledTunnels,
  defaultNaivePort,
  defaultStunTlsPort,
  publicIpv4s,
  TunnelTag,
  tunnelTags,
} from '../utils'

const { InputSpec, Value } = sdk

const tunnelLabels: Record<TunnelTag, string> = {
  dnstt: 'DNSTT and NoizDNS (SOCKS)',
  'dnstt-ssh': 'DNSTT and NoizDNS (SSH)',
  slipstream: 'Slipstream (SOCKS)',
  'slipstream-ssh': 'Slipstream (SSH)',
  vaydns: 'VayDNS (SOCKS)',
  'vaydns-ssh': 'VayDNS (SSH)',
  soar: 'Soar (direct, no login)',
  'soar-ssh': 'Soar (SSH)',
  naive: 'NaiveProxy',
  stuntls: 'StunTLS (SSH over TLS)',
}

const portSpec = (name: string, description: string, def: number) =>
  Value.number({
    name,
    description,
    required: true,
    default: def,
    integer: true,
    min: 1,
    max: 65535,
    step: 1,
    units: null,
    placeholder: null,
  })

export const inputSpec = InputSpec.of({
  domain: Value.text({
    name: i18n('Domain'),
    description: i18n(
      'The domain whose subdomains carry the DNS tunnels, for example example.com. SlipGate uses ns.<domain> as its nameserver and t., s., v., r. and their SSH variants as tunnel zones.',
    ),
    required: true,
    default: null,
    placeholder: 'example.com',
    patterns: [utils.Patterns.domain],
  }),
  enabledTunnels: Value.multiselect({
    name: i18n('Tunnels'),
    description: i18n(
      'Which tunnels to run. Soar (direct) has no login, so anyone who finds its zone can use your server to reach websites.',
    ),
    values: tunnelLabels,
    default: [...defaultEnabledTunnels],
  }),
  naivePort: portSpec(
    i18n('NaiveProxy port'),
    i18n(
      'The public port clients connect to for NaiveProxy. Forward this port on your StartTunnel to the NaiveProxy interface.',
    ),
    defaultNaivePort,
  ),
  stunTlsPort: portSpec(
    i18n('StunTLS port'),
    i18n(
      'The public port clients connect to for StunTLS. Forward this port on your StartTunnel to the StunTLS interface.',
    ),
    defaultStunTlsPort,
  ),
})

export const configure = sdk.Action.withInput(
  'configure',

  async () => ({
    name: i18n('Configure'),
    description: i18n(
      'Set the domain SlipGate serves, and choose which tunnels run.',
    ),
    warning: null,
    allowedStatuses: 'any',
    group: null,
    visibility: 'enabled',
  }),

  inputSpec,

  async () => {
    const store = await storeJson.read().once()
    return {
      domain: store?.domain,
      enabledTunnels: store?.enabledTunnels.filter((t): t is TunnelTag =>
        (tunnelTags as string[]).includes(t),
      ),
      naivePort: store?.naivePort,
      stunTlsPort: store?.stunTlsPort,
    }
  },

  async ({ effects, input }) => {
    if (input.naivePort === input.stunTlsPort) {
      throw new Error(i18n('NaiveProxy and StunTLS need different ports'))
    }

    await storeJson.merge(effects, {
      domain: input.domain.trim().toLowerCase(),
      enabledTunnels: input.enabledTunnels,
      naivePort: input.naivePort,
      stunTlsPort: input.stunTlsPort,
    })
    const updated = await storeJson.read().once()
    const [publicAddress] = (await publicIpv4s(effects).once()) ?? []
    return {
      version: '1',
      title: i18n('DNS records to create'),
      message: i18n(
        'Create these records at your DNS provider, then forward the ports on the DNS Tunnels, NaiveProxy and StunTLS interfaces from your StartTunnel.',
      ),
      result: {
        type: 'single',
        value:
          updated && publicAddress
            ? dnsRecordLines(updated, publicAddress).join('\n')
            : i18n(
                'Publish the DNS Tunnels interface on a gateway with a public address, then run Show DNS Records.',
              ),
        copyable: true,
        qr: false,
        masked: false,
        launchable: false,
      },
    }
  },
)
