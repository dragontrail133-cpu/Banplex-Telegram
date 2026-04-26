import assert from 'node:assert/strict'
import test from 'node:test'
import process from 'node:process'

import {
  createManualStockOut,
  resolveStockOutServiceRoleKey,
} from '../../api/records.js'

function createQueuedTableClient(tableResults = {}) {
  const queues = new Map(
    Object.entries(tableResults).map(([tableName, results]) => [tableName, [...results]])
  )

  return {
    from(tableName) {
      const queue = queues.get(tableName)

      if (!queue || queue.length === 0) {
        throw new Error(`Unexpected table ${tableName}`)
      }

      const nextResult = queue.shift()
      const query = {
        select() {
          return query
        },
        eq() {
          return query
        },
        is() {
          return query
        },
        maybeSingle() {
          return Promise.resolve(nextResult)
        },
      }

      return query
    },
  }
}

test('resolveStockOutServiceRoleKey fails fast when service role env is missing', () => {
  const originalValue = process.env.SUPABASE_SERVICE_ROLE_KEY

  try {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY

    assert.throws(
      () => resolveStockOutServiceRoleKey(),
      (error) => {
        assert.equal(error.statusCode, 500)
        assert.match(
          error.message,
          /Environment records belum lengkap untuk stock-out manual/
        )
        return true
      }
    )
  } finally {
    if (originalValue === undefined) {
      delete process.env.SUPABASE_SERVICE_ROLE_KEY
    } else {
      process.env.SUPABASE_SERVICE_ROLE_KEY = originalValue
    }
  }
})

test('createManualStockOut uses a separate service client for the RPC call', async () => {
  const adminClient = createQueuedTableClient({
    materials: [
      {
        data: {
          id: 'material-1',
          team_id: 'team-1',
          name: 'Baja',
          material_name: 'Baja',
          unit: 'kg',
          current_stock: 12,
          reorder_point: 3,
          updated_at: '2026-04-26T00:00:00.000Z',
        },
        error: null,
      },
    ],
    team_members: [
      {
        data: {
          id: 'membership-1',
        },
        error: null,
      },
      {
        data: {
          id: 'membership-1',
          role: 'Logistik',
        },
        error: null,
      },
    ],
  })

  const rpcCalls = []
  const serviceClient = {
    rpc(name, payload) {
      rpcCalls.push({ name, payload })

      return Promise.resolve({
        data: [
          {
            material: {
              id: 'material-1',
              team_id: 'team-1',
              name: 'Baja',
              material_name: 'Baja',
              unit: 'kg',
              current_stock: 9,
              reorder_point: 3,
              updated_at: '2026-04-26T00:05:00.000Z',
            },
            stock_transaction: {
              id: 'stock-1',
              team_id: 'team-1',
              material_id: 'material-1',
              project_id: 'project-1',
              quantity: 3,
              direction: 'out',
              source_type: 'manual_out',
              transaction_date: '2026-04-26',
              notes: 'Stock-out manual untuk Baja',
              created_at: '2026-04-26T00:05:00.000Z',
              updated_at: '2026-04-26T00:05:00.000Z',
              materials: {
                material_name: 'Baja',
                unit: 'kg',
              },
              projects: {
                project_name: 'Proyek A',
              },
            },
          },
        ],
        error: null,
      })
    },
  }

  const result = await createManualStockOut(
    adminClient,
    serviceClient,
    {
      materialId: 'material-1',
      teamId: 'team-1',
      projectId: 'project-1',
      quantity: 3,
      notes: 'Stock-out manual untuk Baja',
    },
    'telegram-user-1',
    'profile-1'
  )

  assert.equal(rpcCalls.length, 1)
  assert.equal(rpcCalls[0].name, 'fn_create_atomic_manual_stock_out')
  assert.equal(rpcCalls[0].payload.p_material_id, 'material-1')
  assert.equal(rpcCalls[0].payload.p_quantity, 3)
  assert.equal(rpcCalls[0].payload.p_created_by_user_id, 'profile-1')
  assert.equal(result.material?.current_stock, 9)
  assert.equal(result.stockTransaction?.source_type, 'manual_out')
  assert.equal(result.stockTransaction?.project_name, 'Proyek A')
})

test('createManualStockOut rewrites permission denied errors into an actionable message', async () => {
  const adminClient = createQueuedTableClient({
    materials: [
      {
        data: {
          id: 'material-1',
          team_id: 'team-1',
          name: 'Baja',
          material_name: 'Baja',
          unit: 'kg',
          current_stock: 12,
          reorder_point: 3,
          updated_at: '2026-04-26T00:00:00.000Z',
        },
        error: null,
      },
    ],
    team_members: [
      {
        data: {
          id: 'membership-1',
        },
        error: null,
      },
      {
        data: {
          id: 'membership-1',
          role: 'Logistik',
        },
        error: null,
      },
    ],
  })

  const serviceClient = {
    rpc() {
      return Promise.resolve({
        data: null,
        error: {
          code: '42501',
          message: 'permission denied for function fn_create_atomic_manual_stock_out',
        },
      })
    },
  }

  await assert.rejects(
    createManualStockOut(
      adminClient,
      serviceClient,
      {
        materialId: 'material-1',
        teamId: 'team-1',
        projectId: 'project-1',
        quantity: 3,
        notes: 'Stock-out manual untuk Baja',
      },
      'telegram-user-1',
      'profile-1'
    ),
    (error) => {
      assert.equal(error.statusCode, 500)
      assert.match(
        error.message,
        /Kontrak stock-out manual belum lengkap di database/
      )
      assert.match(
        error.message,
        /20260419090000_create_atomic_manual_stock_out_function\.sql/
      )
      return true
    }
  )
})
