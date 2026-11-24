import { Store } from './fileModels/store.json'
import { enabledDefs } from './prepare'
import { nameserverHost, tunnelDomain } from './utils'

export function dnsRecordLines(store: Store, publicAddress: string): string[] {
  const domain = store.domain
  if (!domain) return []
  const ns = nameserverHost(domain)
  const lines = [`A    ${ns}  →  ${publicAddress}`]
  for (const def of enabledDefs(store)) {
    if (def.subdomain) lines.push(`NS   ${tunnelDomain(def, domain)}  →  ${ns}`)
  }
  if (store.enabledTunnels.includes('naive')) {
    lines.push(`A    ${domain}  →  ${publicAddress}`)
  }
  return lines
}
