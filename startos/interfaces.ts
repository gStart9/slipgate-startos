import { storeJson } from './fileModels/store.json'
import { i18n } from './i18n'
import { sdk } from './sdk'
import { dnsPort, naiveListenPort, stunTlsListenPort } from './utils'

export const setInterfaces = sdk.setupInterfaces(async ({ effects }) => {
  const store = await storeJson.read().const(effects)
  const enabled = store?.enabledTunnels ?? []
  const receipts = []

  const dnsOrigin = await sdk.MultiHost.of(effects, 'dns').bindPort(dnsPort, {
    protocol: 'dns',
    preferredExternalPort: dnsPort,
  })
  receipts.push(
    await dnsOrigin.export([
      sdk.createInterface(effects, {
        name: i18n('DNS Tunnels'),
        id: 'dns',
        description: i18n(
          'Port 53 over UDP and TCP for the DNSTT, NoizDNS, Slipstream, VayDNS and Soar tunnels',
        ),
        type: 'p2p',
        masked: false,
        schemeOverride: null,
        username: null,
        path: '',
        query: {},
      }),
    ]),
  )

  if (store && enabled.includes('naive')) {
    const naiveOrigin = await sdk.MultiHost.of(effects, 'naive').bindPort(
      naiveListenPort,
      {
        protocol: null,
        preferredExternalPort: store.naivePort,
        secure: null,
        addSsl: {
          preferredExternalPort: store.naivePort,
          alpn: { specified: ['h2', 'http/1.1'] },
        },
      },
    )
    receipts.push(
      await naiveOrigin.export([
        sdk.createInterface(effects, {
          name: i18n('NaiveProxy'),
          id: 'naive',
          description: i18n(
            'HTTPS proxy tunnel. Add your SlipGate domain to this interface as a public domain.',
          ),
          type: 'p2p',
          masked: false,
          schemeOverride: null,
          username: null,
          path: '',
          query: {},
        }),
      ]),
    )
  }

  if (store && enabled.includes('stuntls')) {
    const stunOrigin = await sdk.MultiHost.of(effects, 'stuntls').bindPort(
      stunTlsListenPort,
      {
        protocol: null,
        preferredExternalPort: store.stunTlsPort,
        secure: { ssl: false },
        addSsl: null,
      },
    )
    receipts.push(
      await stunOrigin.export([
        sdk.createInterface(effects, {
          name: i18n('StunTLS'),
          id: 'stuntls',
          description: i18n('SSH over TLS and WebSocket tunnel'),
          type: 'p2p',
          masked: false,
          schemeOverride: null,
          username: null,
          path: '',
          query: {},
        }),
      ]),
    )
  }

  return receipts
})
