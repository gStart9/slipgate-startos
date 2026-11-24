import { addUser } from '../actions/addUser'
import { configure } from '../actions/configure'
import { showDnsRecords } from '../actions/showDnsRecords'
import { storeJson } from '../fileModels/store.json'
import { i18n } from '../i18n'
import { sdk } from '../sdk'
import { publicIpv4s } from '../utils'

export const watchSetup = sdk.setupOnInit(async (effects) => {
  const store = await storeJson.read().const(effects)

  if (!store?.domain) {
    await sdk.action.createOwnTask(effects, configure, 'critical', {
      reason: i18n('Set your domain before starting SlipGate'),
    })
  }

  const publicAddresses = (await publicIpv4s(effects).const()) ?? []
  if (!publicAddresses.length) {
    await sdk.action.createOwnTask(effects, showDnsRecords, 'important', {
      reason: i18n(
        'Publish the DNS Tunnels interface on a gateway with a public address, usually your StartTunnel, so clients can reach SlipGate',
      ),
    })
  } else {
    await sdk.action.clearTask(effects, `slipgate:${showDnsRecords.id}`)
  }

  if (!store?.users.length) {
    await sdk.action.createOwnTask(effects, addUser, 'critical', {
      reason: i18n('Add at least one user for the SOCKS and SSH tunnels'),
    })
  }
})
