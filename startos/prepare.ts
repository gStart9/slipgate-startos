import { SubContainer } from '@start9labs/start-sdk'
import { mkdir, readFile, writeFile } from 'fs/promises'
import { Store } from './fileModels/store.json'
import { manifest } from './manifest'
import { sdk } from './sdk'
import {
  configDir,
  dnsPort,
  naiveListenPort,
  socksPort,
  sshPort,
  TunnelDef,
  tunnelDefs,
  tunnelDir,
  tunnelDomain,
} from './utils'

const keyScript = `set -eu
cd ${configDir}
umask 077
mkdir -p tunnels ssh naive
curve() { d=tunnels/$2; mkdir -p "$d"; if [ ! -s "$d/server.key" ] || [ ! -s "$d/server.pub" ]; then "$1" -gen-key -privkey-file "$d/server.key" -pubkey-file "$d/server.pub" >/dev/null; fi; }
for t in dnstt dnstt-ssh; do curve dnstt-server "$t"; done
for t in vaydns vaydns-ssh; do curve vaydns-server "$t"; done
for t in soar soar-ssh; do
  d=tunnels/$t; mkdir -p "$d"
  if [ ! -s "$d/server.key" ] || [ ! -s "$d/server.pub" ]; then
    openssl genpkey -algorithm ed25519 -out "$d/seed.pem"
    openssl pkey -in "$d/seed.pem" -outform DER | tail -c 32 | base64 > "$d/server.key"
    openssl pkey -in "$d/seed.pem" -pubout -outform DER | tail -c 32 | base64 > "$d/server.pub"
    rm "$d/seed.pem"
  fi
done
selfsigned() { d=tunnels/$1; mkdir -p "$d"; if [ "$(cat "$d/cn" 2>/dev/null || true)" != "$2" ] || [ ! -s "$d/cert.pem" ]; then openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:P-256 -nodes -days 3650 -subj "/CN=$2" -keyout "$d/key.pem" -out "$d/cert.pem" 2>/dev/null; printf '%s' "$2" > "$d/cn"; fi; }
selfsigned slipstream "$SLIPSTREAM_CN"
selfsigned slipstream-ssh "$SLIPSTREAM_SSH_CN"
selfsigned stuntls stuntls
[ -s ssh/ssh_host_ed25519_key ] || ssh-keygen -q -t ed25519 -N '' -f ssh/ssh_host_ed25519_key
`

const volumePath = (path: string) =>
  sdk.volumes.main.subpath(`slipgate${path.slice(configDir.length)}`)

const readKey = async (path: string) =>
  (await readFile(volumePath(path), 'utf8')).trim()

async function tunnelEntry(def: TunnelDef, store: Store, domain: string) {
  const dir = tunnelDir(def.tag)
  const base = {
    tag: def.tag,
    transport: def.transport,
    backend: def.backend,
    enabled: true,
  }
  switch (def.transport) {
    case 'dnstt':
      return {
        ...base,
        domain: tunnelDomain(def, domain),
        port: def.port,
        dnstt: {
          mtu: 1232,
          private_key: `${dir}/server.key`,
          public_key: await readKey(`${dir}/server.pub`),
        },
      }
    case 'vaydns':
      return {
        ...base,
        domain: tunnelDomain(def, domain),
        port: def.port,
        vaydns: {
          mtu: 1232,
          private_key: `${dir}/server.key`,
          public_key: await readKey(`${dir}/server.pub`),
        },
      }
    case 'slipstream':
      return {
        ...base,
        domain: tunnelDomain(def, domain),
        port: def.port,
        slipstream: { cert: `${dir}/cert.pem`, key: `${dir}/key.pem` },
      }
    case 'soar':
      return {
        ...base,
        domain: tunnelDomain(def, domain),
        port: def.port,
        soar: {
          private_key: `${dir}/server.key`,
          public_key: await readKey(`${dir}/server.pub`),
        },
      }
    case 'naive':
      return {
        ...base,
        domain,
        naive: {
          email: '',
          decoy_url: 'https://www.wikipedia.org',
          port: store.naivePort,
          user: store.users[0]?.username ?? '',
          password: store.users[0]?.password ?? '',
        },
      }
    case 'stuntls':
      return {
        ...base,
        domain: '',
        stuntls: {
          cert: `${dir}/cert.pem`,
          key: `${dir}/key.pem`,
          port: store.stunTlsPort,
        },
      }
  }
}

export const enabledDefs = (store: Store) =>
  tunnelDefs.filter((d) => store.enabledTunnels.includes(d.tag))

/**
 * Generates any missing keys and certificates, then writes SlipGate's config and the
 * files its daemons read. Requires a subcontainer of the slipgate image with the
 * volume mounted at the config directory.
 */
export async function prepare(
  sub: SubContainer<typeof manifest>,
  store: Store,
  publicAddress: string | undefined,
) {
  const domain = store.domain
  if (!domain) throw new Error('SlipGate has no domain configured')

  await sub.execFail(['sh', '-c', keyScript], {
    env: {
      SLIPSTREAM_CN: `s.${domain}`,
      SLIPSTREAM_SSH_CN: `ss.${domain}`,
    },
  })

  const tunnels = []
  for (const def of enabledDefs(store)) {
    tunnels.push(await tunnelEntry(def, store, domain))
  }

  const config = {
    listen: { address: `:${dnsPort}` },
    tunnels,
    backends: [
      {
        tag: 'socks',
        type: 'socks',
        address: `127.0.0.1:${socksPort}`,
        socks: {},
      },
      { tag: 'ssh', type: 'ssh', address: `127.0.0.1:${sshPort}` },
    ],
    users: store.users,
    route: { mode: 'multi', active: '', default: '' },
    public_address: publicAddress ?? '',
  }

  await mkdir(volumePath(`${configDir}/naive`), { recursive: true })
  await writeFile(
    volumePath(`${configDir}/config.json`),
    JSON.stringify(config, null, 2) + '\n',
    { mode: 0o600 },
  )
  await writeFile(
    volumePath(`${configDir}/socks-users.conf`),
    store.users.map((u) => `${u.username}:${u.password}\n`).join(''),
    { mode: 0o600 },
  )
  await writeFile(
    volumePath(`${configDir}/naive/Caddyfile`),
    caddyfile(store),
    { mode: 0o600 },
  )
  await writeFile(volumePath(`${configDir}/ssh/sshd_config`), sshdConfig, {
    mode: 0o600,
  })
}

const caddyfile = (store: Store) => `{
  admin off
  auto_https off
  servers {
    protocols h1 h2c
  }
  log {
    output stdout
    level WARN
  }
}

http://:${naiveListenPort} {
  route {
    forward_proxy {
${store.users.map((u) => `      basic_auth ${u.username} ${u.password}\n`).join('')}      hide_ip
      hide_via
      probe_resistance
    }
    reverse_proxy https://www.wikipedia.org
  }
}
`

const sshdConfig = `Port ${sshPort}
ListenAddress 127.0.0.1
HostKey ${configDir}/ssh/ssh_host_ed25519_key
PidFile /run/sshd.pid
UsePAM no
PermitRootLogin no
PasswordAuthentication yes
KbdInteractiveAuthentication no
PubkeyAuthentication no
AllowGroups slipgate-ssh
AllowTcpForwarding yes
PermitTunnel no
X11Forwarding no
PermitTTY no
ForceCommand /bin/false
`
