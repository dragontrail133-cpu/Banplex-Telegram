import assert from 'node:assert/strict'
import test from 'node:test'

import { softDeleteBill } from '../../api/records.js'

function createBillDeleteClient({ billRow, serviceError = null }) {
  const calls = {
    rpc: [],
    select: [],
  }

  const client = {
    calls,
    from(tableName) {
      assert.equal(tableName, 'bills')

      const query = {
        select(columns) {
          calls.select.push(columns)
          return query
        },
        eq(column, value) {
          calls.select.push({ column, value })
          return query
        },
        maybeSingle() {
          return Promise.resolve({
            data: billRow ?? null,
            error: null,
          })
        },
      }

      return query
    },
    rpc(name, payload) {
      calls.rpc.push({ name, payload })

      return Promise.resolve(
        serviceError
          ? { data: null, error: serviceError }
          : { data: null, error: null }
      )
    },
  }

  return client
}

test('softDeleteBill uses the service client for the bill history RPC', async () => {
  const adminClient = {
    from() {
      return {
        select() {
          return this
        },
        eq() {
          return this
        },
        maybeSingle() {
          return Promise.resolve({
            data: {
              updated_at: '2026-04-26T00:00:00.000Z',
            },
            error: null,
          })
        },
      }
    },
    rpc() {
      throw new Error('admin client RPC should not be used')
    },
  }

  const serviceClient = createBillDeleteClient({ billRow: null })

  await softDeleteBill(
    adminClient,
    serviceClient,
    'bill-delete-1',
    '2026-04-26T00:00:00.000Z'
  )

  assert.equal(serviceClient.calls.rpc.length, 1)
  assert.deepEqual(serviceClient.calls.rpc[0], {
    name: 'fn_soft_delete_bill_with_history',
    payload: {
      p_bill_id: 'bill-delete-1',
    },
  })
})

test('softDeleteBill rewrites permission denied errors into an actionable message', async () => {
  const adminClient = {
    from() {
      return {
        select() {
          return this
        },
        eq() {
          return this
        },
        maybeSingle() {
          return Promise.resolve({
            data: {
              updated_at: '2026-04-26T00:00:00.000Z',
            },
            error: null,
          })
        },
      }
    },
  }

  const serviceClient = createBillDeleteClient({
    serviceError: {
      code: '42501',
      message: 'permission denied for function fn_soft_delete_bill_with_history',
    },
  })

  await assert.rejects(
    softDeleteBill(
      adminClient,
      serviceClient,
      'bill-delete-1',
      '2026-04-26T00:00:00.000Z'
    ),
    (error) => {
      assert.equal(error.statusCode, 500)
      assert.match(error.message, /Kontrak soft delete tagihan belum lengkap di database/)
      assert.match(
        error.message,
        /20260418094000_soft_delete_bill_with_payment_history\.sql/
      )
      return true
    }
  )
})
