import { setupManifest } from '@start9labs/start-sdk'
import { long, short } from './i18n'

export const manifest = setupManifest({
  id: 'slipgate',
  title: 'SlipGate',
  license: 'AGPL-3.0',
  packageRepo: 'https://github.com/gStart9/slipgate-startos',
  upstreamRepo: 'https://github.com/anonvector/slipgate',
  marketingUrl: 'https://github.com/anonvector/slipgate',
  donationUrl: null,
  description: { short, long },
  volumes: ['main'],
  images: {
    slipgate: {
      source: { dockerBuild: {} },
      arch: ['x86_64', 'aarch64'],
    },
  },
})
