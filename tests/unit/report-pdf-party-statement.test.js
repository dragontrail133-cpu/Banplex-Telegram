import assert from 'node:assert/strict'
import test from 'node:test'

import {
  shouldRenderBusinessReportHeaderKpis,
  shouldRenderBusinessReportKindBadge,
} from '../../src/lib/report-pdf.js'

test('party statement suppresses header badge and header KPIs', () => {
  assert.equal(shouldRenderBusinessReportKindBadge('party_statement'), false)
  assert.equal(shouldRenderBusinessReportHeaderKpis('party_statement'), false)
})

test('other business report kinds keep header badge and header KPIs', () => {
  assert.equal(shouldRenderBusinessReportKindBadge('executive_finance'), true)
  assert.equal(shouldRenderBusinessReportHeaderKpis('cash_flow'), true)
})

test('beneficiary statement suppresses the badge but keeps header KPIs', () => {
  assert.equal(shouldRenderBusinessReportKindBadge('beneficiary_statement'), false)
  assert.equal(shouldRenderBusinessReportHeaderKpis('beneficiary_statement'), true)
})

test('applicant statement suppresses the badge but keeps header KPIs', () => {
  assert.equal(shouldRenderBusinessReportKindBadge('applicant_statement'), false)
  assert.equal(shouldRenderBusinessReportHeaderKpis('applicant_statement'), true)
})
