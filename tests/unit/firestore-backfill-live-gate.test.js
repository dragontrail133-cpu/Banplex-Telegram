import assert from 'node:assert/strict'
import test from 'node:test'

import { assertLiveWriteReady } from '../../scripts/firestore-backfill/load.mjs'
import { assertLiveSyncReady } from '../../scripts/firestore-backfill/sync-assets.mjs'
import { createAssetSyncArgs, createLoadArgs, createStepName } from '../../scripts/firestore-backfill/stage.mjs'

test('firestore backfill live gate rejects direct live load without confirmation', () => {
  assert.throws(
    () => assertLiveWriteReady({ dryRun: false, confirmLive: false }),
    /--confirm-live/
  )
  assert.doesNotThrow(() => assertLiveWriteReady({ dryRun: false, confirmLive: true }))
  assert.doesNotThrow(() => assertLiveWriteReady({ dryRun: true, confirmLive: false }))
})

test('firestore backfill live gate rejects direct asset sync without confirmation', () => {
  assert.throws(
    () => assertLiveSyncReady({ dryRun: false, confirmLive: false }),
    /--confirm-live/
  )
  assert.doesNotThrow(() => assertLiveSyncReady({ dryRun: false, confirmLive: true }))
  assert.doesNotThrow(() => assertLiveSyncReady({ dryRun: true, confirmLive: false }))
})

test('firestore backfill stage runner forwards confirm-live to live subcommands', () => {
  const loadArgs = createLoadArgs({ batchSize: 200, envFile: '.env.backfill.local', targetTeamId: '11111111-1111-4111-8111-111111111111', live: true }, '/tmp/artifact')
  const assetSyncArgs = createAssetSyncArgs({ batchSize: 200, envFile: '.env.backfill.local', live: true }, '/tmp/artifact')

  assert.ok(loadArgs.includes('--confirm-live'))
  assert.ok(assetSyncArgs.includes('--confirm-live'))
  assert.ok(!loadArgs.includes('--dry-run'))
  assert.ok(!assetSyncArgs.includes('--dry-run'))
  assert.equal(createStepName('load dry-run', { live: true }), 'load live')
  assert.equal(createStepName('asset sync dry-run', { live: true }), 'asset sync live')
})

test('firestore backfill direct script helpers preserve dry-run behavior', () => {
  const loadArgs = createLoadArgs({ batchSize: 200, envFile: '.env.backfill.local', targetTeamId: '11111111-1111-4111-8111-111111111111', live: false }, '/tmp/artifact')
  const assetSyncArgs = createAssetSyncArgs({ batchSize: 200, envFile: '.env.backfill.local', live: false }, '/tmp/artifact')

  assert.ok(loadArgs.includes('--dry-run'))
  assert.ok(assetSyncArgs.includes('--dry-run'))
  assert.ok(!loadArgs.includes('--confirm-live'))
  assert.ok(!assetSyncArgs.includes('--confirm-live'))
  assert.equal(createStepName('load dry-run', { live: false }), 'load dry-run')
})
