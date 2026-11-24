import { sdk } from '../sdk'
import { addUser } from './addUser'
import { configure } from './configure'
import { removeUser } from './removeUser'
import { showDnsRecords } from './showDnsRecords'
import { showProfiles } from './showProfiles'

export const actions = sdk.Actions.of()
  .addAction(configure)
  .addAction(showDnsRecords)
  .addAction(addUser)
  .addAction(removeUser)
  .addAction(showProfiles)
