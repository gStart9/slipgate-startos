import { T } from '@start9labs/start-sdk'
import { sdk } from './sdk'

export const configDir = '/etc/slipgate'
export const socksPort = 1080
export const sshPort = 22
export const dnsPort = 53
export const defaultNaivePort = 443
export const defaultStunTlsPort = 8443
export const naiveListenPort = 8444
export const stunTlsListenPort = 8443

export type Transport =
  | 'dnstt'
  | 'slipstream'
  | 'vaydns'
  | 'soar'
  | 'naive'
  | 'stuntls'
export type Backend = 'socks' | 'ssh' | 'direct'

export type TunnelDef = {
  tag: string
  transport: Transport
  backend: Backend
  subdomain: string | null
  port: number | null
}

export const tunnelDefs = [
  {
    tag: 'dnstt',
    transport: 'dnstt',
    backend: 'socks',
    subdomain: 't',
    port: 5310,
  },
  {
    tag: 'dnstt-ssh',
    transport: 'dnstt',
    backend: 'ssh',
    subdomain: 'ts',
    port: 5311,
  },
  {
    tag: 'slipstream',
    transport: 'slipstream',
    backend: 'socks',
    subdomain: 's',
    port: 5312,
  },
  {
    tag: 'slipstream-ssh',
    transport: 'slipstream',
    backend: 'ssh',
    subdomain: 'ss',
    port: 5313,
  },
  {
    tag: 'vaydns',
    transport: 'vaydns',
    backend: 'socks',
    subdomain: 'v',
    port: 5314,
  },
  {
    tag: 'vaydns-ssh',
    transport: 'vaydns',
    backend: 'ssh',
    subdomain: 'vs',
    port: 5315,
  },
  {
    tag: 'soar',
    transport: 'soar',
    backend: 'direct',
    subdomain: 'r',
    port: 5316,
  },
  {
    tag: 'soar-ssh',
    transport: 'soar',
    backend: 'ssh',
    subdomain: 'rs',
    port: 5317,
  },
  {
    tag: 'naive',
    transport: 'naive',
    backend: 'socks',
    subdomain: null,
    port: null,
  },
  {
    tag: 'stuntls',
    transport: 'stuntls',
    backend: 'ssh',
    subdomain: null,
    port: null,
  },
] as const satisfies readonly TunnelDef[]

export type TunnelTag = (typeof tunnelDefs)[number]['tag']

export const tunnelTags = tunnelDefs.map((t) => t.tag) as TunnelTag[]

export const defaultEnabledTunnels: TunnelTag[] = tunnelTags.filter(
  (t) => t !== 'soar',
)

export const tunnelDir = (tag: string) => `${configDir}/tunnels/${tag}`

export const tunnelDomain = (def: TunnelDef, domain: string) =>
  def.subdomain ? `${def.subdomain}.${domain}` : domain

export const usesSsh = (enabled: readonly string[]) =>
  tunnelDefs.some((t) => enabled.includes(t.tag) && t.backend === 'ssh')

export const nameserverHost = (domain: string) => `ns.${domain}`

/**
 * Public IPv4 addresses enabled on the DNS Tunnels interface, one per gateway the user
 * published it on.
 */
export const publicIpv4s = (effects: T.Effects) =>
  sdk.host.getOwn(effects, 'dns', (host) => {
    const iface =
      host &&
      Object.values(host.bindings)
        .flatMap((b) => Object.values(b.interfaces))
        .find((i) => i.id === 'dns')
    return iface
      ? [
          ...new Set(
            iface.addressInfo.public
              .filter({ kind: 'ipv4' })
              .hostnames.map((h) => h.hostname),
          ),
        ].sort()
      : []
  })
