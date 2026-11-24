import { Daemons } from '@start9labs/start-sdk'
import { storeJson } from './fileModels/store.json'
import { i18n } from './i18n'
import { enabledDefs, prepare } from './prepare'
import { manifest } from './manifest'
import { sdk } from './sdk'
import {
  configDir,
  dnsPort,
  naiveListenPort,
  socksPort,
  sshPort,
  stunTlsListenPort,
  TunnelDef,
  tunnelDir,
  tunnelDomain,
  publicIpv4s,
  usesSsh,
} from './utils'

const backendAddress = (def: TunnelDef) =>
  def.backend === 'ssh' ? `127.0.0.1:${sshPort}` : `127.0.0.1:${socksPort}`

function tunnelCommand(
  def: TunnelDef,
  domain: string,
): { command: [string, ...string[]]; port: number } {
  const dir = tunnelDir(def.tag)
  const d = tunnelDomain(def, domain)
  switch (def.transport) {
    case 'dnstt':
      return {
        port: def.port!,
        command: [
          'dnstt-server',
          '-privkey-file',
          `${dir}/server.key`,
          '-mtu',
          '1232',
          d,
          `127.0.0.1:${def.port}`,
          backendAddress(def),
        ],
      }
    case 'slipstream':
      return {
        port: def.port!,
        command: [
          'slipstream-server',
          '--dns-listen-host',
          '127.0.0.1',
          '--dns-listen-port',
          String(def.port),
          '--cert',
          `${dir}/cert.pem`,
          '--key',
          `${dir}/key.pem`,
          '--domain',
          d,
          '--target-address',
          backendAddress(def),
        ],
      }
    case 'vaydns':
      return {
        port: def.port!,
        command: [
          'vaydns-server',
          '-udp',
          `127.0.0.1:${def.port}`,
          '-privkey-file',
          `${dir}/server.key`,
          '-mtu',
          '1232',
          '-domain',
          d,
          '-upstream',
          backendAddress(def),
          '-idle-timeout',
          '10s',
          '-keepalive',
          '2s',
          '-clientid-size',
          '2',
        ],
      }
    case 'soar':
      return {
        port: def.port!,
        command: [
          'slipgate',
          'soar',
          'serve',
          '--listen',
          `127.0.0.1:${def.port}`,
          '--zone',
          d,
          '--key-file',
          `${dir}/server.key`,
          ...(def.backend === 'ssh'
            ? ['--backend', `127.0.0.1:${sshPort}`]
            : ['--allow-ports', '80,443']),
        ],
      }
    case 'naive':
      return {
        port: naiveListenPort,
        command: [
          'caddy-naive',
          'run',
          '--config',
          `${configDir}/naive/Caddyfile`,
          '--adapter',
          'caddyfile',
        ],
      }
    case 'stuntls':
      return {
        port: stunTlsListenPort,
        command: [
          'slipgate',
          'stuntls',
          'serve',
          '--addr',
          '',
          '--port',
          String(stunTlsListenPort),
          '--ssh',
          `127.0.0.1:${sshPort}`,
          '--cert',
          `${dir}/cert.pem`,
          '--key',
          `${dir}/key.pem`,
        ],
      }
  }
}

export const main = sdk.setupMain(async ({ effects }) => {
  const store = await storeJson.read().const(effects)
  if (!store?.domain) {
    throw new Error(i18n('Run Configure before starting SlipGate'))
  }
  const domain = store.domain
  const [publicAddress] = (await publicIpv4s(effects).once()) ?? []
  const defs = enabledDefs(store)
  const withSsh = usesSsh(store.enabledTunnels)

  const sub = await sdk.SubContainer.of(
    effects,
    { imageId: 'slipgate' },
    sdk.Mounts.of().mountVolume({
      volumeId: 'main',
      subpath: 'slipgate',
      mountpoint: configDir,
      readonly: false,
    }),
    'slipgate',
  )

  const ready = (display: string, port: number) => ({
    display,
    fn: () =>
      sdk.healthCheck.checkPortListening(effects, port, {
        successMessage: display,
        errorMessage: display,
      }),
  })

  let daemons: Daemons<typeof manifest, string> = sdk.Daemons.of(effects)
    .addOneshot('prepare', {
      subcontainer: sub,
      exec: {
        fn: async (s) => {
          await prepare(s, store, publicAddress)
          return null
        },
      },
      requires: [],
    })
    .addDaemon('socks', {
      subcontainer: sub,
      exec: {
        command: [
          'slipgate',
          'socks',
          'serve',
          '--addr',
          '127.0.0.1',
          '--port',
          String(socksPort),
          '--creds-file',
          `${configDir}/socks-users.conf`,
        ],
      },
      ready: ready(i18n('SOCKS proxy'), socksPort),
      requires: ['prepare'],
    })

  const sshUsers = store.users
    .map((u) => `${u.username}:${u.password}`)
    .join('\n')

  if (withSsh) {
    daemons = daemons
      .addOneshot('ssh-users' as never, {
        subcontainer: sub,
        exec: {
          command: [
            'sh',
            '-c',
            `set -eu
getent group slipgate-ssh >/dev/null || groupadd slipgate-ssh
printf '%s\\n' "$SSH_USERS" | while IFS=: read -r u p; do
  [ -n "$u" ] || continue
  id -u "$u" >/dev/null 2>&1 || useradd --no-create-home --shell /usr/sbin/nologin --gid slipgate-ssh "$u"
done
[ -z "$SSH_USERS" ] || printf '%s\\n' "$SSH_USERS" | chpasswd`,
          ],
          env: { SSH_USERS: sshUsers },
        },
        requires: ['prepare'],
      })
      .addDaemon('sshd' as never, {
        subcontainer: sub,
        exec: {
          command: [
            '/usr/sbin/sshd',
            '-D',
            '-e',
            '-f',
            `${configDir}/ssh/sshd_config`,
          ],
        },
        ready: ready(i18n('SSH backend'), sshPort),
        requires: ['ssh-users'],
      })
  }

  const tunnelIds: string[] = []
  for (const def of defs) {
    const { command, port } = tunnelCommand(def, domain)
    const id = `tunnel-${def.tag}`
    tunnelIds.push(id)
    daemons = daemons.addDaemon(id as never, {
      subcontainer: sub,
      exec: {
        command,
        env:
          def.transport === 'naive'
            ? { XDG_DATA_HOME: `${configDir}/naive/data` }
            : undefined,
      },
      ready: {
        display: def.tag,
        fn: () =>
          sdk.healthCheck.checkPortListening(effects, port, {
            successMessage: i18n('Listening'),
            errorMessage: i18n('Not listening'),
          }),
      },
      requires: def.backend === 'ssh' ? ['socks', 'sshd'] : ['socks'],
    })
  }

  return daemons.addDaemon('dns-router' as never, {
    subcontainer: sub,
    exec: { command: ['slipgate', 'dnsrouter', 'serve'] },
    ready: {
      display: i18n('DNS Router'),
      fn: () =>
        sdk.healthCheck.checkPortListening(effects, dnsPort, {
          successMessage: i18n('Answering DNS on port 53'),
          errorMessage: i18n('Not answering DNS on port 53'),
        }),
    },
    requires: tunnelIds,
  })
})
