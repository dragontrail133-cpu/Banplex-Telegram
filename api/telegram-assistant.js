import { createClient } from '@supabase/supabase-js'
import { APP_TIME_ZONE, getAppTodayKey, shiftAppDateKey, toAppDateKey } from '../src/lib/date-time.js'
import { normalizeRole } from '../src/lib/rbac.js'
import {
  createTelegramAssistantHandoffToken,
  normalizeTelegramAssistantHandoffToken,
  redeemTelegramAssistantHandoff,
  saveTelegramAssistantHandoff,
} from './telegram-assistant-handoff.js'
import {
  buildTelegramAssistantLink,
  buildTelegramAssistantChatLink,
  normalizeAssistantRoutePath,
} from '../src/lib/telegram-assistant-links.js'
import {
  allowedLanguages,
  buildAssistantMemoryPayload,
  buildPendingSessionPayload,
  maxAssistantEntityHints,
  normalizeAssistantPendingPayload,
} from '../src/lib/telegram-assistant-session.js'
import {
  allowedAnalyticsEntityTypes,
  allowedAnalyticsMetricKeys,
  allowedAnalyticsWindows,
  assistantCallbackPrefixes,
  assistantRouteTargets,
  buildAssistantCommandInput,
  buildAssistantCommandRawText,
  extractAssistantCommand,
  getAssistantRouteLabel,
  resolveAssistantCallbackAction,
  resolveAssistantMenuCommandFromText,
  shouldUseAssistantDmFallback,
} from '../src/lib/telegram-assistant-routing.js'
import {
  answerTelegramCallback,
  deleteTelegramMessage,
  editTelegramMessageText,
  sendTelegramChatAction,
  sendTelegramMessage,
} from '../src/lib/telegram-assistant-transport.js'

const assistantSelectColumns =
  'team_id, source_type, type, id, sort_at, transaction_date, income_date, expense_date, due_date, created_at, updated_at, amount, principal_amount:amount, description, project_name_snapshot, supplier_name_snapshot, creditor_name_snapshot, worker_name_snapshot, expense_type, document_type, bill_id, bill_type, bill_status, status:bill_status, bill_amount, repayment_amount:bill_amount, bill_paid_amount, paid_amount:bill_paid_amount, bill_remaining_amount, remaining_amount:bill_remaining_amount, bill_due_date, bill_paid_at, bill_description, bill_project_name_snapshot, bill_supplier_name_snapshot, bill_worker_name_snapshot, search_text'
const sessionStates = new Set([
  'idle',
  'awaiting_workspace_choice',
  'awaiting_clarification',
])
const allowedIntents = new Set(['status', 'search', 'navigate', 'analytics', 'clarify', 'refuse'])
const allowedStatuses = new Set(['any', 'paid', 'partial', 'unpaid'])
const allowedKinds = new Set(['all', 'transaction', 'bill', 'loan'])
const allowedClarificationCodes = new Set([
  'specific_filter',
  'followup_context',
  'analytics_metric',
  'analytics_entity',
  'analytics_window',
])
const financeCoreScopes = new Set(['project-income', 'expense', 'loan-disbursement', 'bill'])
const payrollScopeKeywords = [
  'gaji',
  'upah',
  'payroll',
  'absensi',
  'attendance',
  'hrd',
  'beneficiary',
  'penerima manfaat',
  'pagawai',
  'pagawé',
  'pekerja',
]
const mutationKeywords = [
  'buat',
  'tambah',
  'hapus',
  'delete',
  'edit',
  'ubah',
  'update',
  'perbarui',
  'approve',
  'setujui',
  'restore',
  'kembalikan',
  'submit',
  'posting',
  'bayarkan',
  'hapuskeun',
  'robah',
  'ganti',
  'tambahkeun',
  'batalkeun',
  'balikeun',
  'bayarkeun',
]
const routeKeywordMap = [
  { pattern: /\b(riwayat|history|histori)\b/, path: '/transactions?tab=history', label: 'Riwayat' },
  { pattern: /\b(tagihan|invoice|tunggakan)\b/, path: '/transactions?tab=tagihan', label: 'Tagihan' },
  { pattern: /\b(pembayaran|payment|bayaran)\b/, path: '/pembayaran', label: 'Pembayaran' },
  { pattern: /\b(jurnal|transaksi|ledger|catetan transaksi|catetan)\b/, path: '/transactions', label: 'Jurnal' },
  { pattern: /\b(pinjaman|loan|hutang|utang|nginjeum)\b/, path: '/transactions', label: 'Jurnal Pinjaman' },
  { pattern: /\b(payroll|absensi|attendance|kehadiran|rekap absensi|catatan absensi)\b/, path: '/payroll', label: 'Absensi' },
]
const assistantCreateRouteMap = [
  {
    pattern: /\b(pemasukan|income|termin|uang masuk)\b/,
    path: assistantRouteTargets.incomeCreate,
    label: 'Pemasukan',
  },
  {
    pattern: /\b(pengeluaran|expense|uang keluar)\b/,
    path: assistantRouteTargets.expenseCreate,
    label: 'Pengeluaran',
  },
  {
    pattern: /\b(pinjaman|loan|kasbon|hutang|utang|nginjeum)\b/,
    path: assistantRouteTargets.loanCreate,
    label: 'Pinjaman',
  },
  {
    pattern: /\b(faktur|material|barang|surat jalan)\b/,
    path: assistantRouteTargets.invoiceCreate,
    label: 'Faktur Barang',
  },
  {
    pattern: /\b(absensi|attendance|kehadiran|gaji|upah)\b/,
    path: assistantRouteTargets.attendanceCreate,
    label: 'Absensi',
  },
]
const assistantCoreRouteMap = [
  {
    pattern: /\b(dashboard|beranda|home)\b/,
    path: assistantRouteTargets.dashboard,
    label: 'Dashboard',
  },
  {
    pattern: /\b(jurnal|transaksi|ledger|catetan transaksi|catetan)\b/,
    path: assistantRouteTargets.ledger,
    label: 'Jurnal',
  },
  {
    pattern: /\b(tagihan|invoice|tunggakan)\b/,
    path: assistantRouteTargets.billLedger,
    label: 'Tagihan',
  },
  {
    pattern: /\b(pembayaran|payment|bayaran)\b/,
    path: assistantRouteTargets.payment,
    label: 'Pembayaran',
  },
  {
    pattern: /\b(payroll|absensi|attendance|kehadiran|rekap absensi|catatan absensi)\b/,
    path: assistantRouteTargets.attendance,
    label: 'Absensi',
  },
]
const assistantStatusBucketRoutes = [
  {
    status: 'paid',
    label: 'Lunas',
    path: assistantRouteTargets.history,
  },
  {
    status: 'partial',
    label: 'Dicicil',
    path: assistantRouteTargets.payment,
  },
  {
    status: 'unpaid',
    label: 'Belum lunas',
    path: assistantRouteTargets.billLedger,
  },
]
function findAssistantRouteConfigFromText(text, routeMap) {
  const normalizedText = normalizeText(text, '').toLowerCase()

  if (!normalizedText) {
    return null
  }

  return routeMap.find((route) => route.pattern.test(normalizedText)) ?? null
}

function resolveAssistantCreateRoutePath(text) {
  return findAssistantRouteConfigFromText(text, assistantCreateRouteMap)?.path ?? null
}

function resolveAssistantCoreRoutePath(text) {
  return findAssistantRouteConfigFromText(text, assistantCoreRouteMap)?.path ?? null
}
const stopWordPatterns = [
  /\b(tolong|mohon|bantu|punten|mangga|parios|neangan|milarian|tingali|muka|buka|cek|status|cari|temukan|search|tampilkan|pindah|masuk|ke)\b/g,
  /\b(total|nominal|jumlah|berapa|data|ringkasan|rekap|siapa|mana|terbesar|paling|besar|hadir|pengeluaran|saldo|toko)\b/g,
  /\b(hari ini|kemarin|minggu ini|minggu lalu|bulan ini|bulan lalu|lalu|sekarang)\b/g,
  /\b(unpaid|paid|partial|lunas|belum lunas|terbayar|sudah dibayar|acan lunas|can lunas|acan dibayar|can dibayar|beres)\b/g,
  /\b(tagihan|pembayaran|payment|jurnal|transaksi|riwayat|history|pinjaman|loan|tunggakan|bayaran|hutang|utang)\b/g,
  /\b(worker|pekerja|karyawan|supplier|creditor|kreditur|gaji|upah|absensi|attendance|hrd|beneficiary|penerima manfaat)\b/g,
  /\b(yang|memiliki|mempunyai|punya|ada|dengan)\b/g,
  /\b(mang|kang|teh|teteh|pak|bu|bapak|ibu|si)\b/g,
  /\b(rp\.?|rupiah)\b/g,
]
const assistantTopicSignals = [
  'tagihan',
  'pembayaran',
  'payment',
  'jurnal',
  'transaksi',
  'rekap',
  'laporan',
  'riwayat',
  'history',
  'pinjaman',
  'loan',
  'bayaran',
  'tunggakan',
  'hutang',
  'utang',
  'total',
  'nominal',
  'jumlah',
  'berapa',
  'siapa',
  'mana',
  'terbesar',
  'paling besar',
  'hadir',
  'pengeluaran',
  'saldo',
  'worker',
  'pekerja',
  'supplier',
  'creditor',
  'kreditur',
  'gaji',
  'upah',
  'absensi',
  'attendance',
  'kehadiran',
  'hrd',
  'beneficiary',
  'penerima manfaat',
  'toko',
  'payroll',
  'rekap absensi',
  'analitik',
  'status',
  'cek',
  'parios',
  'neangan',
  'milarian',
  'buka',
  'tingali',
  'muka',
]
const followUpSignals = [
  'itu',
  'yang tadi',
  'yang itu',
  'tadi',
  'anu',
  'eta',
  'nu tadi',
  'nu eta',
  'kumaha',
  'gimana',
  'maksudnya',
  'maksudna',
  'terus',
  'lanjut',
  'lagi',
  'ulang',
  'jelas',
  'jelaskan',
  'barusan',
  'saterasna',
]
const clarifySpecificFilterTemplate = {
  id: 'Saya butuh filter yang lebih spesifik: ID, nama proyek/supplier, nominal, tanggal, atau status.',
  su: 'Kuring peryogi filter nu leuwih spésifik: ID, nami proyek/supplier, nominal, tanggal, atawa status.',
}
const clarifyFollowUpTemplate = {
  id: 'Maksudnya yang tadi itu ID, nama proyek/supplier, nominal, tanggal, atau status?',
  su: 'Maksudna nu tadi téh ID, nami proyek/supplier, nominal, tanggal, atawa status?',
}
const clarifyAnalyticsMetricTemplate = {
  id: 'Mau saya cek tagihan, pengeluaran, kehadiran, atau ranking terbesar?',
  su: 'Mau dipariksa tagihan, pangeluaran, kahadiran, atawa ranking panggedena?',
}
const clarifyAnalyticsEntityTemplate = {
  id: 'Mau saya baca untuk supplier, worker, atau kreditur?',
  su: 'Mau dibaca pikeun supplier, worker, atawa kreditur?',
}
const clarifyAnalyticsWindowTemplate = {
  id: 'Mau periode hari ini, kemarin, minggu ini, atau bulan ini?',
  su: 'Mau periodena poé ieu, kamari, minggu ieu, atawa bulan ieu?',
}

const localeTemplates = {
  id: {
    workspaceChoiceIntro: 'Saya menemukan beberapa workspace aktif. Pilih workspace yang dipakai:',
    workspaceChoiceHint: 'Kirim angka, nama workspace, atau tekan tombol pilihan di bawah.',
    workspaceChoiceCancelled: 'Pilihan workspace dibatalkan.',
    workspaceMissing: 'Saya tidak menemukan workspace aktif untuk akun ini. Hubungi admin untuk akses workspace yang valid.',
    membershipMissing: 'Saya tidak menemukan membership aktif yang bisa dipakai untuk workspace ini.',
    sessionExpired: 'Sesi sudah kedaluwarsa. Kirim ulang pesan.',
    handoffInvalid: 'Tautan DM ini tidak valid, sudah dipakai, atau kedaluwarsa. Minta kirim ulang dari grup.',
    workspaceNotFound: 'Workspace tidak ditemukan.',
    menuIntro: 'Pilih aksi assistant yang dibutuhkan.',
    menuHint: 'Command step-by-step: tambah, buka, status, dan menu.',
    summaryLoading: 'Bot sedang memproses ringkasan...',
    summaryLoadingFailed: 'Maaf, ringkasan belum selesai diproses. Coba lagi sebentar.',
    analyticsLoading: 'Bot sedang memproses analytics...',
    analyticsLoadingFailed: 'Maaf, analytics belum selesai diproses. Coba lagi sebentar.',
    addRoutePrompt: 'Pilih domain input yang mau dibuka.',
    openRoutePrompt: 'Pilih halaman core yang ingin dibuka.',
    statusRoutePrompt: 'Pilih bucket status yang ingin dilihat.',
    noResultStatus: (queryLabel) =>
      queryLabel
        ? `Tidak ada tagihan atau pinjaman outstanding yang cocok untuk "${queryLabel}".\nBuka Jurnal untuk melihat riwayat lengkap.`
        : 'Tidak ada tagihan atau pinjaman outstanding yang cocok.\nBuka Jurnal untuk melihat riwayat lengkap.',
    statusIntro: (queryLabel) =>
      queryLabel ? `Status untuk "${queryLabel}":` : 'Status finance core workspace ini:',
    statusBills: (count, amountLabel) => `• Tagihan aktif: ${count} item, sisa ${amountLabel}`,
    statusLoans: (count, amountLabel) => `• Pinjaman aktif: ${count} item, sisa ${amountLabel}`,
    noResultSearch: (queryLabel) =>
      queryLabel
        ? `Belum ketemu data yang cocok untuk "${queryLabel}".\nTambah ID, nama proyek/supplier, nominal, tanggal, atau status yang lebih spesifik.`
        : 'Belum ketemu data yang cocok.\nTambah ID, nama proyek/supplier, nominal, tanggal, atau status yang lebih spesifik.',
    searchIntro: (queryLabel, count) =>
      queryLabel
        ? `Saya menemukan ${count} data paling relevan untuk "${queryLabel}":`
        : `Saya menemukan ${count} data paling relevan:`,
    searchMore: (count) => `Dan ${count} hasil lain yang serupa.`,
    navigateIntro: (routeLabel) => `Membuka ${routeLabel}.`,
    analyticsIntro: (label) =>
      label ? `Ringkasan untuk "${label}":` : 'Ringkasan analytics workspace ini:',
    analyticsNoData: (label) =>
      label ? `Tidak ada data ${label} yang bisa dirangkum.` : 'Tidak ada data yang bisa dirangkum.',
    analyticsTotalBills: (count, amountLabel) =>
      `• Total tagihan aktif: ${count} item, sisa ${amountLabel}`,
    analyticsCashOutflow: (windowLabel, amountLabel) =>
      `• Pengeluaran ${windowLabel}: ${amountLabel}`,
    analyticsAttendance: (windowLabel, countLabel, breakdownLabel = '') =>
      `• Kehadiran ${windowLabel}: ${countLabel}${breakdownLabel ? ` (${breakdownLabel})` : ''}`,
    analyticsRankingIntro: (entityLabel) =>
      `• ${entityLabel} dengan sisa terbesar:`,
    analyticsRankingEmpty: (entityLabel) =>
      `Tidak ada data ${entityLabel} yang bisa dirangkum.`,
    analyticsTopRanking: (nameLabel, amountLabel) => `  1. ${nameLabel} — ${amountLabel}`,
    analyticsMoreRanking: (count) => `  + ${count} data lain.`,
    analyticsTotalLoans: (count, amountLabel) =>
      `â€¢ Total pinjaman aktif: ${count} item, sisa ${amountLabel}`,
    analyticsRankingItem: (rankLabel, nameLabel, amountLabel) =>
      `  ${rankLabel}. ${nameLabel} â€” ${amountLabel}`,
    refusal:
      'Saya hanya melayani finance core read-only: jurnal, tagihan, pembayaran, dan pinjaman. Permintaan ini berada di luar scope v1 atau bersifat mutasi.',
    clarifySpecific: clarifySpecificFilterTemplate.id,
    clarifyFollowUp: clarifyFollowUpTemplate.id,
    clarifyAnalyticsMetric: clarifyAnalyticsMetricTemplate.id,
    clarifyAnalyticsEntity: clarifyAnalyticsEntityTemplate.id,
    clarifyAnalyticsWindow: clarifyAnalyticsWindowTemplate.id,
    workspaceSelected: 'Workspace dipilih.',
    actionDetail: 'Buka detail',
    actionPayment: 'Buka pembayaran',
    actionLedger: 'Buka Jurnal',
    openRoute: (routeLabel) => `Buka ${routeLabel}`,
    addRoute: (routeLabel) => `Tambah ${routeLabel}`,
    searchRoute: (routeLabel) => `Cari ${routeLabel}`,
    noWorkspaceChoice: 'Saya tidak menemukan membership aktif yang bisa dipakai untuk workspace ini.',
    workspacePicked: (workspaceName) => `${workspaceName ?? 'Workspace'} dipilih.`,
    callbackSessionExpired: 'Sesi sudah kedaluwarsa. Kirim ulang pesan.',
    callbackWorkspaceNotFound: 'Workspace tidak ditemukan.',
    noActiveMembership: 'Akun ini belum punya membership workspace aktif. Hubungi admin untuk akses workspace yang valid.',
    quickStatus: 'Status',
    quickMenu: 'Menu',
    quickAdd: 'Tambah',
    quickOpen: 'Buka',
    routeLedger: 'Jurnal',
    routeHistory: 'Riwayat',
    routePayment: 'Pembayaran',
    routeAttendance: 'Absensi',
    statusBucketPaid: 'Lunas',
    statusBucketPartial: 'Dicicil',
    statusBucketUnpaid: 'Belum lunas',
    groupFallbackIntro: 'Untuk detail atau klarifikasi, lanjutkan di DM bot.',
    groupFallbackHint:
      'Review cepat tetap tersedia di Jurnal, Riwayat, Pembayaran, dan Absensi di Mini Web.',
    groupFallbackDmButton: 'Lanjut ke DM',
    analyticsMetricBillSummary: 'Tagihan',
    analyticsMetricCashOutflow: 'Pengeluaran',
    analyticsMetricAttendance: 'Kehadiran',
    analyticsMetricRanking: 'Ranking',
    analyticsEntitySupplier: 'Supplier',
    analyticsEntityWorker: 'Worker',
    analyticsEntityCreditor: 'Kreditur',
    analyticsWindowToday: 'Hari ini',
    analyticsWindowYesterday: 'Kemarin',
    analyticsWindowWeekCurrent: 'Minggu ini',
    analyticsWindowMonthCurrent: 'Bulan ini',
  },
  su: {
    menuIntro: 'Pilih aksi assistant nu diperlukeun.',
    menuHint: 'Command step-by-step: tambah, buka, status, jeung menu.',
    summaryLoading: 'Bot keur ngolah ringkesan...',
    summaryLoadingFailed: 'Punten, ringkesan can réngsé diolah. Coba deui sakedapan.',
    analyticsLoading: 'Bot keur ngolah analytics...',
    analyticsLoadingFailed: 'Punten, analytics can réngsé diolah. Coba deui sakedapan.',
    addRoutePrompt: 'Pilih domain input nu rek dibuka.',
    openRoutePrompt: 'Pilih halaman core nu rek dibuka.',
    statusRoutePrompt: 'Pilih bucket status nu rek ditempo.',
    workspaceChoiceIntro: 'Kuring manggihan sababaraha workspace aktip. Pilih workspace nu dipaké:',
    workspaceChoiceHint: 'Kirim angka, nami workspace, atawa pencét tombol pilihan di handap.',
    workspaceChoiceCancelled: 'Pilihan workspace dibatalkeun.',
    workspaceMissing: 'Kuring teu manggihan workspace aktip pikeun akun ieu. Hubungi admin pikeun aksés workspace nu valid.',
    membershipMissing: 'Kuring teu manggihan membership aktip nu bisa dipaké pikeun workspace ieu.',
    sessionExpired: 'Sési geus kadaluwarsa. Kirim deui pesen.',
    handoffInvalid: 'Tautan DM ieu teu valid, geus dipaké, atawa geus kadaluwarsa. Menta kirim deui ti grup.',
    workspaceNotFound: 'Workspace teu kapanggih.',
    noResultStatus: (queryLabel) =>
      queryLabel
        ? `Teu aya tagihan atawa pinjaman outstanding nu cocog pikeun "${queryLabel}".\nBuka Jurnal pikeun ningali riwayat lengkep.`
        : 'Teu aya tagihan atawa pinjaman outstanding nu cocog.\nBuka Jurnal pikeun ningali riwayat lengkep.',
    statusIntro: (queryLabel) =>
      queryLabel ? `Status pikeun "${queryLabel}":` : 'Status finance core workspace ieu:',
    statusBills: (count, amountLabel) => `• Tagihan aktip: ${count} item, sésa ${amountLabel}`,
    statusLoans: (count, amountLabel) => `• Pinjaman aktip: ${count} item, sésa ${amountLabel}`,
    noResultSearch: (queryLabel) =>
      queryLabel
        ? `Can kapanggih data nu cocog pikeun "${queryLabel}".\nTambah ID, nami proyek/supplier, nominal, tanggal, atawa status nu leuwih spésifik.`
        : 'Can kapanggih data nu cocog.\nTambah ID, nami proyek/supplier, nominal, tanggal, atawa status nu leuwih spésifik.',
    searchIntro: (queryLabel, count) =>
      queryLabel
        ? `Kuring manggihan ${count} data nu paling relevan pikeun "${queryLabel}":`
        : `Kuring manggihan ${count} data nu paling relevan:`,
    searchMore: (count) => `Jeung ${count} hasil séjén nu sarupa.`,
    navigateIntro: (routeLabel) => `Muka ${routeLabel}.`,
    analyticsIntro: (label) =>
      label ? `Ringkesan pikeun "${label}":` : 'Ringkesan analytics workspace ieu:',
    analyticsNoData: (label) =>
      label ? `Teu aya data ${label} nu bisa diringkes.` : 'Teu aya data nu bisa diringkes.',
    analyticsTotalBills: (count, amountLabel) =>
      `• Tagihan aktip total: ${count} item, sésa ${amountLabel}`,
    analyticsCashOutflow: (windowLabel, amountLabel) =>
      `• Pangeluaran ${windowLabel}: ${amountLabel}`,
    analyticsAttendance: (windowLabel, countLabel, breakdownLabel = '') =>
      `• Kahadiran ${windowLabel}: ${countLabel}${breakdownLabel ? ` (${breakdownLabel})` : ''}`,
    analyticsRankingIntro: (entityLabel) =>
      `• ${entityLabel} kalayan sésa panggedena:`,
    analyticsRankingEmpty: (entityLabel) =>
      `Teu aya data ${entityLabel} nu bisa diringkes.`,
    analyticsTopRanking: (nameLabel, amountLabel) => `  1. ${nameLabel} — ${amountLabel}`,
    analyticsMoreRanking: (count) => `  + ${count} data deui.`,
    analyticsTotalLoans: (count, amountLabel) =>
      `â€¢ Pinjaman aktip total: ${count} item, sÃ©sa ${amountLabel}`,
    analyticsRankingItem: (rankLabel, nameLabel, amountLabel) =>
      `  ${rankLabel}. ${nameLabel} â€” ${amountLabel}`,
    refusal:
      'Kuring ngan ngalayanan finance core read-only: jurnal, tagihan, pembayaran, jeung pinjaman. Pamundut ieu di luar scope v1 atawa mangrupakeun mutasi.',
    clarifySpecific: clarifySpecificFilterTemplate.su,
    clarifyFollowUp: clarifyFollowUpTemplate.su,
    clarifyAnalyticsMetric: clarifyAnalyticsMetricTemplate.su,
    clarifyAnalyticsEntity: clarifyAnalyticsEntityTemplate.su,
    clarifyAnalyticsWindow: clarifyAnalyticsWindowTemplate.su,
    workspaceSelected: 'Workspace dipilih.',
    actionDetail: 'Buka detil',
    actionPayment: 'Buka pembayaran',
    actionLedger: 'Buka Jurnal',
    openRoute: (routeLabel) => `Muka ${routeLabel}`,
    addRoute: (routeLabel) => `Tambah ${routeLabel}`,
    searchRoute: (routeLabel) => `Milarian ${routeLabel}`,
    noWorkspaceChoice: 'Kuring teu manggihan membership aktip nu bisa dipaké pikeun workspace ieu.',
    workspacePicked: (workspaceName) => `${workspaceName ?? 'Workspace'} dipilih.`,
    callbackSessionExpired: 'Sési geus kadaluwarsa. Kirim deui pesen.',
    callbackWorkspaceNotFound: 'Workspace teu kapanggih.',
    noActiveMembership: 'Akun ieu can boga membership workspace aktip. Hubungi admin pikeun aksés workspace nu valid.',
    quickStatus: 'Status',
    quickMenu: 'Menu',
    quickAdd: 'Tambah',
    quickOpen: 'Muka',
    routeLedger: 'Jurnal',
    routeHistory: 'Riwayat',
    routePayment: 'Pembayaran',
    routeAttendance: 'Absensi',
    statusBucketPaid: 'Lunas',
    statusBucketPartial: 'Dicicil',
    statusBucketUnpaid: 'Belum lunas',
    groupFallbackIntro: 'Pikeun detail atawa klarifikasi, lanjutkeun di DM bot.',
    groupFallbackHint:
      'Review gancang tetep aya di Jurnal, Riwayat, Pembayaran, jeung Absensi dina Mini Web.',
    groupFallbackDmButton: 'Lanjut ka DM',
    analyticsMetricBillSummary: 'Tagihan',
    analyticsMetricCashOutflow: 'Pangeluaran',
    analyticsMetricAttendance: 'Kahadiran',
    analyticsMetricRanking: 'Ranking',
    analyticsEntitySupplier: 'Supplier',
    analyticsEntityWorker: 'Worker',
    analyticsEntityCreditor: 'Kreditur',
    analyticsWindowToday: 'Poe ieu',
    analyticsWindowYesterday: 'Kamari',
    analyticsWindowWeekCurrent: 'Minggu ieu',
    analyticsWindowMonthCurrent: 'Bulan ieu',
  },
}

const assistantSafetyBaseVocabulary = (() => {
  const tokens = new Set()
  const safeVocabularySources = [
    followUpSignals,
    assistantTopicSignals,
    payrollScopeKeywords,
    Array.from(allowedIntents),
    Array.from(allowedStatuses),
    Array.from(allowedKinds),
    Array.from(allowedClarificationCodes),
    Array.from(allowedAnalyticsMetricKeys),
    Array.from(allowedAnalyticsEntityTypes),
    Array.from(allowedAnalyticsWindows),
    Array.from(financeCoreScopes),
    [
      'ada',
      'detail',
      'halaman',
      'informasi',
      'jawaban',
      'jawab',
      'kembali',
      'kirim',
      'lanjut',
      'langsung',
      'lebih',
      'maksudnya',
      'menu',
      'minta',
      'mohon',
      'muka',
      'opsi',
      'pilih',
      'perlu',
      'pertanyaan',
      'ringkas',
      'saya',
      'silakan',
      'singkat',
      'spesifik',
      'selanjutnya',
      'sudah',
      'tidak',
      'tetap',
      'tolong',
      'tujuan',
      'untuk',
      'dengan',
      'tanpa',
      'atau',
      'dan',
      'yang',
      'di',
      'ke',
      'dari',
      'ini',
      'itu',
      'hari',
      'minggu',
      'bulan',
      'waktu',
      'periode',
      'saat',
      'baru',
      'lama',
      'semua',
      'beberapa',
      'cukup',
      'bisa',
      'bukan',
      'jika',
      'kalau',
      'bila',
      'saja',
      'terkait',
      'aktif',
      'hasil',
      'data',
      'pesan',
      'cek',
      'lihat',
      'buka',
      'membuka',
    ],
  ]

  for (const source of safeVocabularySources) {
    collectAssistantStringValues(source).forEach((value) => {
      for (const token of extractAssistantWordTokens(value)) {
        tokens.add(token)
      }
    })
  }

  return tokens
})()

function truncateText(value, maxLength = 240) {
  const normalizedValue = normalizeText(value, '')

  if (normalizedValue.length <= maxLength) {
    return normalizedValue
  }

  return `${normalizedValue.slice(0, Math.max(maxLength - 1, 1)).trim()}…`
}

function countKeywordHits(text, keywords = []) {
  const normalizedText = normalizeText(text, '').toLowerCase()

  return keywords.reduce(
    (count, keyword) => count + (normalizedText.includes(normalizeText(keyword, '').toLowerCase()) ? 1 : 0),
    0
  )
}

function hasAnyKeyword(text, keywords = []) {
  return countKeywordHits(text, keywords) > 0
}

function getLocaleTemplate(language) {
  return allowedLanguages.has(normalizeText(language, '').toLowerCase()) ? normalizeText(language, '').toLowerCase() : 'id'
}

function getLocaleText(language) {
  return localeTemplates[getLocaleTemplate(language)] ?? localeTemplates.id
}

function buildAssistantMenuCommandLabels(language) {
  const locale = getLocaleText(language)

  return {
    menu: locale.quickMenu,
    add: locale.quickAdd,
    open: locale.quickOpen,
    status: locale.quickStatus,
  }
}

function getAssistantLanguageFromText(text, session = null) {
  const normalizedText = normalizeText(text, '').toLowerCase()
  const previousLanguage = getLocaleTemplate(session?.pending_payload?.last_language)
  const previousSummary = normalizeText(session?.pending_payload?.context_summary, '').toLowerCase()
  const sourceText = [normalizedText, previousSummary].filter(Boolean).join(' ')

  const sundaneseHits = countKeywordHits(sourceText, [
    'punten',
    'mangga',
    'parios',
    'neangan',
    'milarian',
    'tingali',
    'muka',
    'acan',
    'can',
    'anjeunna',
    'kuring',
    'kumaha',
    'maksudna',
    'anjeunna',
    'sabaraha',
    'anjeunna',
    'sanes',
    'beres',
  ])
  const indonesianHits = countKeywordHits(sourceText, [
    'tolong',
    'mohon',
    'bantu',
    'cek',
    'cari',
    'temukan',
    'lihat',
    'buka',
    'saya',
    'maksud',
    'berapa',
    'belum',
    'lunas',
    'tagihan',
    'pembayaran',
  ])

  if (sundaneseHits > indonesianHits && sundaneseHits > 0) {
    return 'su'
  }

  if (indonesianHits > sundaneseHits && indonesianHits > 0) {
    return 'id'
  }

  return previousLanguage
}

function isFollowUpLikeText(text) {
  return hasAnyKeyword(text, followUpSignals)
}

function hasAssistantTopicHint(text) {
  return hasAnyKeyword(text, [...assistantTopicSignals, ...payrollScopeKeywords])
}

function detectClarificationCode(text, session = null) {
  const normalizedText = normalizeText(text, '').toLowerCase()
  const hasContextMemory =
    Boolean(normalizeText(session?.pending_payload?.context_summary, '')) ||
    Boolean(normalizeText(session?.pending_payload?.last_turn?.user_text, ''))

  if (isFollowUpLikeText(normalizedText) && hasContextMemory) {
    return 'followup_context'
  }

  return 'specific_filter'
}

function buildTurnSummary({ text, plan, language, workspaceName }) {
  const analyticsPlan = plan?.analytics ?? {}
  const summaryParts = [
    `user=${truncateText(text, 120)}`,
    `intent=${normalizeText(plan?.intent, 'clarify')}`,
    `lang=${getLocaleTemplate(language)}`,
    workspaceName ? `workspace=${truncateText(workspaceName, 60)}` : null,
    normalizeText(plan?.search?.query, '') ? `query=${truncateText(plan.search.query, 80)}` : null,
    normalizeText(plan?.targetPath, '') ? `path=${normalizeText(plan.targetPath, '')}` : null,
    normalizeText(analyticsPlan?.metricKey, '') ? `metric=${normalizeText(analyticsPlan.metricKey, '')}` : null,
    normalizeText(analyticsPlan?.entityType, '') ? `entity=${normalizeText(analyticsPlan.entityType, '')}` : null,
    normalizeText(analyticsPlan?.entityQuery, '') ? `entity_query=${truncateText(analyticsPlan.entityQuery, 80)}` : null,
    normalizeText(analyticsPlan?.windowKey, '') ? `window=${normalizeText(analyticsPlan.windowKey, '')}` : null,
  ].filter(Boolean)

  return summaryParts.join(' | ')
}

function buildAssistantTurnData({ text, plan = {}, language, workspaceName = null }) {
  const normalizedLanguage = getLocaleTemplate(language)
  const normalizedPlan = plan ?? {}
  const normalizedWorkspaceName = normalizeText(workspaceName, null)
  const analyticsPlan = normalizedPlan?.analytics ?? {}
  const analyticsWindowKey = normalizeText(analyticsPlan?.windowKey, 'none')
  const analyticsMetricKey = normalizeText(analyticsPlan?.metricKey, 'clarify')
  const entityHints = [
    ...(Array.isArray(analyticsPlan?.entityHints) ? analyticsPlan.entityHints : []),
    ...detectEntityTypeHints(
      [text, normalizedPlan?.search?.query, analyticsPlan?.entityQuery].filter(Boolean).join(' ')
    ),
  ]
    .map((value) => normalizeText(value, ''))
    .filter(Boolean)
  const dedupedEntityHints = [...new Set(entityHints)].slice(0, maxAssistantEntityHints)

  return {
    userText: truncateText(text, 180),
    intent: normalizeText(normalizedPlan?.intent, 'clarify'),
    language: normalizedLanguage,
    workspaceName: normalizedWorkspaceName,
    targetPath: normalizeAssistantRoutePath(normalizedPlan?.targetPath),
    query: normalizeText(normalizedPlan?.search?.query, null),
    metricKey: analyticsMetricKey,
    entityType: normalizeText(analyticsPlan?.entityType, null),
    entityQuery: normalizeText(analyticsPlan?.entityQuery, null),
    entityHints: dedupedEntityHints,
    windowKey: analyticsWindowKey,
    summary: buildTurnSummary({
      text,
      plan: normalizedPlan,
      language: normalizedLanguage,
      workspaceName: normalizedWorkspaceName,
    }),
  }
}

function getEnv(name, fallback = '') {
  return String(globalThis.process?.env?.[name] ?? fallback).trim()
}

function normalizeText(value, fallback = '') {
  const normalizedValue = String(value ?? '').trim()

  return normalizedValue.length > 0 ? normalizedValue : fallback
}

function normalizeNullableText(value) {
  const normalizedValue = normalizeText(value, '')

  if (!normalizedValue) {
    return null
  }

  if (normalizedValue.toLowerCase() === 'null') {
    return null
  }

  return normalizedValue
}

function createHttpError(status, message) {
  const error = new Error(message)

  error.statusCode = status

  return error
}

async function parseRequestBody(req) {
  if (typeof req.body === 'string' && req.body.trim().length > 0) {
    return JSON.parse(req.body)
  }

  if (req.body && typeof req.body === 'object') {
    return req.body
  }

  const chunks = []

  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? chunk : chunk.toString())
  }

  const rawBody = chunks.join('').trim()

  return rawBody ? JSON.parse(rawBody) : {}
}

function createAdminClient(url, serviceRoleKey) {
  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  })
}

function normalizeTelegramId(value) {
  return normalizeText(value, '')
}

function normalizeTelegramMessageId(value) {
  const normalizedValue = Number(value)

  return Number.isInteger(normalizedValue) && normalizedValue > 0 ? normalizedValue : null
}

function normalizeTelegramMessageIdList(values = []) {
  const normalizedValues = Array.isArray(values) ? values : [values]
  const seenMessageIds = new Set()
  const messageIds = []

  for (const value of normalizedValues) {
    const messageId = normalizeTelegramMessageId(value)

    if (!messageId || seenMessageIds.has(messageId)) {
      continue
    }

    seenMessageIds.add(messageId)
    messageIds.push(messageId)
  }

  return messageIds
}

function getAssistantSummaryMessageState(sessionPayload = {}) {
  const normalizedPayload =
    sessionPayload && typeof sessionPayload === 'object' && !Array.isArray(sessionPayload)
      ? sessionPayload
      : {}

  return {
    summaryMessageId: normalizeTelegramMessageId(
      normalizedPayload.summary_message_id ?? normalizedPayload.last_summary_message_id
    ),
    transientMessageIds: normalizeTelegramMessageIdList(
      normalizedPayload.transient_message_ids ?? normalizedPayload.summary_transient_message_ids ?? []
    ),
  }
}

function buildAssistantSummaryMessageState(sessionPayload = {}, summaryMessageId = null) {
  const normalizedSummaryMessageId = normalizeTelegramMessageId(summaryMessageId)
  const currentState = getAssistantSummaryMessageState(sessionPayload)

  if (!normalizedSummaryMessageId) {
    return stripAssistantSummaryMessageState(sessionPayload)
  }

  const transientMessageIds = currentState.transientMessageIds.filter(
    (messageId) => messageId !== normalizedSummaryMessageId
  )

  if (
    currentState.summaryMessageId &&
    currentState.summaryMessageId !== normalizedSummaryMessageId
  ) {
    transientMessageIds.push(currentState.summaryMessageId)
  }

  return {
    ...sessionPayload,
    summary_message_id: normalizedSummaryMessageId,
    transient_message_ids: normalizeTelegramMessageIdList(transientMessageIds),
  }
}

function stripAssistantSummaryMessageState(sessionPayload = {}) {
  const normalizedPayload =
    sessionPayload && typeof sessionPayload === 'object' && !Array.isArray(sessionPayload)
      ? sessionPayload
      : {}
  const {
    summary_message_id: _summary_message_id,
    last_summary_message_id: _last_summary_message_id,
    transient_message_ids: _transient_message_ids,
    summary_transient_message_ids: _summary_transient_message_ids,
    ...rest
  } = normalizedPayload

  return rest
}

function getTelegramMessageIdFromResponse(messageResponse) {
  return normalizeTelegramMessageId(
    messageResponse?.result?.message_id ?? messageResponse?.message_id ?? null
  )
}

async function cleanupAssistantSummaryMessages({
  botToken,
  chatId,
  sessionPayload = {},
}) {
  const summaryState = getAssistantSummaryMessageState(sessionPayload)
  const messageIds = normalizeTelegramMessageIdList([
    summaryState.summaryMessageId,
    ...summaryState.transientMessageIds,
  ])

  for (const messageId of messageIds) {
    try {
      await deleteTelegramMessage({
        botToken,
        chatId,
        messageId,
      })
    } catch (error) {
      console.warn('[api/telegram-assistant] summary cleanup skipped', {
        chatId,
        messageId,
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return messageIds
}

async function sendAssistantHybridSummaryReply({
  adminClient,
  botToken,
  chatId,
  replyToMessageId,
  telegramUserId,
  session,
  sessionPayload,
  selectedMembership,
  plan,
  reply,
  turnData,
}) {
  const language = getLocaleTemplate(reply?.language ?? plan?.language ?? 'id')
  const locale = getLocaleText(language)
  const replyParseMode = normalizeText(reply?.parseMode, '').toLowerCase() === 'html'
    ? 'HTML'
    : null
  const replyText = replyParseMode
    ? reply.text
    : await rewriteAssistantReply({
        plan,
        reply,
        workspaceName: selectedMembership.team_name,
        session,
      })
  const textToSend = replyText || reply.text
  const replyMarkup = buildReplyMarkup(getTelegramBotUsername(), reply, plan)
  const currentSummaryState = getAssistantSummaryMessageState(sessionPayload)
  const currentSummaryMessageId = currentSummaryState.summaryMessageId
  await sendTelegramChatAction({
    botToken,
    chatId,
    action: 'typing',
  })
  const loadingMessage = await sendTelegramMessage({
    botToken,
    chatId,
    text: locale.summaryLoading,
    replyToMessageId,
  })
  const loadingMessageId = getTelegramMessageIdFromResponse(loadingMessage)

  if (!loadingMessageId) {
    throw createHttpError(500, 'Gagal menyiapkan pesan loading ringkasan.')
  }

  const sentMessage = await editTelegramMessageText({
    botToken,
    chatId,
    messageId: loadingMessageId,
    text: textToSend,
    replyMarkup,
    parseMode: replyParseMode,
  })
  const nextSummaryMessageId = getTelegramMessageIdFromResponse(sentMessage) ?? loadingMessageId
  const nextPendingPayload = buildAssistantSummaryMessageState(
    buildAssistantMemoryPayload(sessionPayload, turnData),
    nextSummaryMessageId
  )

  await saveAssistantSession(adminClient, {
    chatId,
    telegramUserId,
    teamId: selectedMembership.team_id,
    state: 'idle',
    pendingIntent: null,
    pendingPayload: nextPendingPayload,
  })

  const staleSummaryMessageIds = normalizeTelegramMessageIdList([
    ...currentSummaryState.transientMessageIds,
    currentSummaryMessageId && currentSummaryMessageId !== nextSummaryMessageId
      ? currentSummaryMessageId
      : null,
  ])

  for (const messageId of staleSummaryMessageIds) {
    try {
      await deleteTelegramMessage({
        botToken,
        chatId,
        messageId,
      })
    } catch (error) {
      console.warn('[api/telegram-assistant] summary cleanup skipped', {
        chatId,
        messageId,
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return {
    processed: true,
    messageId: nextSummaryMessageId,
  }
}

async function sendAssistantAnalyticsReply({
  adminClient,
  botToken,
  chatId,
  replyToMessageId,
  telegramUserId,
  session,
  sessionPayload,
  selectedMembership,
  plan,
  sourceText,
}) {
  const language = getLocaleTemplate(plan?.language)
  const locale = getLocaleText(language)
  const analyticsPlan = {
    ...plan,
    language,
  }

  await sendTelegramChatAction({
    botToken,
    chatId,
    action: 'typing',
  })

  const loadingMessage = await sendTelegramMessage({
    botToken,
    chatId,
    text: locale.analyticsLoading,
    replyToMessageId,
  })
  const loadingMessageId = getTelegramMessageIdFromResponse(loadingMessage)

  if (!loadingMessageId) {
    throw createHttpError(500, 'Gagal menyiapkan pesan loading analytics.')
  }

  let analyticsReply

  try {
    analyticsReply = await buildAnalyticsReply(adminClient, selectedMembership.team_id, analyticsPlan)
  } catch (error) {
    try {
      await editTelegramMessageText({
        botToken,
        chatId,
        messageId: loadingMessageId,
        text: locale.analyticsLoadingFailed,
      })
    } catch (editError) {
      console.warn('[api/telegram-assistant] analytics failure fallback edit skipped', {
        chatId,
        messageId: loadingMessageId,
        message: editError instanceof Error ? editError.message : String(editError),
      })
    }

    throw error
  }

  const replyParseMode = normalizeText(analyticsReply?.parseMode, '').toLowerCase() === 'html'
    ? 'HTML'
    : null
  const replyText = replyParseMode
    ? analyticsReply.text
    : await rewriteAssistantReply({
        plan: analyticsPlan,
        reply: analyticsReply,
        workspaceName: selectedMembership.team_name,
        session,
      })
  const textToSend = replyText || analyticsReply.text
  const replyMarkup = buildReplyMarkup(getTelegramBotUsername(), analyticsReply, analyticsPlan)
  const currentSummaryState = getAssistantSummaryMessageState(sessionPayload)
  const currentSummaryMessageId = currentSummaryState.summaryMessageId
  const sentMessage = await editTelegramMessageText({
    botToken,
    chatId,
    messageId: loadingMessageId,
    text: textToSend,
    replyMarkup,
    parseMode: replyParseMode,
  })
  const nextSummaryMessageId = getTelegramMessageIdFromResponse(sentMessage) ?? loadingMessageId
  const turnData = buildAssistantTurnData({
    text: sourceText,
    plan: analyticsPlan,
    language,
    workspaceName: selectedMembership.team_name,
  })
  const basePendingPayload = analyticsReply.needsClarification
    ? buildPendingSessionPayload(sourceText, analyticsPlan, sessionPayload, turnData)
    : buildAssistantMemoryPayload(sessionPayload, turnData)
  const nextPendingPayload = buildAssistantSummaryMessageState(
    basePendingPayload,
    nextSummaryMessageId
  )

  await saveAssistantSession(adminClient, {
    chatId,
    telegramUserId,
    teamId: selectedMembership.team_id,
    state: analyticsReply.needsClarification ? 'awaiting_clarification' : 'idle',
    pendingIntent: analyticsReply.needsClarification ? 'analytics' : null,
    pendingPayload: nextPendingPayload,
  })

  const staleSummaryMessageIds = normalizeTelegramMessageIdList([
    ...currentSummaryState.transientMessageIds,
    currentSummaryMessageId && currentSummaryMessageId !== nextSummaryMessageId
      ? currentSummaryMessageId
      : null,
  ])

  for (const messageId of staleSummaryMessageIds) {
    try {
      await deleteTelegramMessage({
        botToken,
        chatId,
        messageId,
      })
    } catch (error) {
      console.warn('[api/telegram-assistant] analytics cleanup skipped', {
        chatId,
        messageId,
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return {
    processed: true,
    messageId: nextSummaryMessageId,
  }
}

function getTelegramBotUsername() {
  return normalizeText(
    getEnv('TELEGRAM_BOT_USERNAME', getEnv('VITE_TELEGRAM_BOT_USERNAME')),
    ''
  )
}

function escapeRegExp(value) {
  return String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function getTelegramChatType(message) {
  return normalizeText(message?.chat?.type, '').toLowerCase()
}

function getTelegramMessageText(message) {
  return normalizeText(message?.text ?? message?.caption, '')
}

function isTelegramAssistantMention(messageText, botUsername) {
  const normalizedBotUsername = normalizeText(botUsername, '').replace(/^@/, '').toLowerCase()

  if (!normalizedBotUsername) {
    return false
  }

  const normalizedText = normalizeText(messageText, '').toLowerCase()

  return new RegExp(`(^|\\s)@${escapeRegExp(normalizedBotUsername)}(?:\\b|$)`).test(
    normalizedText
  )
}

function isTelegramAssistantReply(message, botUsername) {
  const normalizedBotUsername = normalizeText(botUsername, '').replace(/^@/, '').toLowerCase()
  const repliedFromUsername = normalizeText(message?.reply_to_message?.from?.username, '')
    .replace(/^@/, '')
    .toLowerCase()

  if (!normalizedBotUsername || !repliedFromUsername) {
    return false
  }

  return repliedFromUsername === normalizedBotUsername
}

function shouldProcessTelegramMessage({
  message,
  session,
  botUsername,
  messageText,
  menuLabels = null,
}) {
  const chatType = getTelegramChatType(message)
  const normalizedText = normalizeText(messageText, '')
  const command = extractAssistantCommand(normalizedText, botUsername)
  const intent = determineIntentFromText(normalizedText)
  const hasClarifyHint = hasAssistantTopicHint(normalizedText) || isFollowUpLikeText(normalizedText)
  const mainMenuCommand = resolveAssistantMenuCommandFromText(normalizedText, menuLabels ?? {})

  if (command?.command === 'start' && chatType !== 'private') {
    return false
  }

  if (chatType === 'private') {
    if (session?.state === 'awaiting_workspace_choice' || session?.state === 'awaiting_clarification') {
      return true
    }

    if (!normalizedText) {
      return false
    }

    if (command) {
      return true
    }

    if (intent !== 'clarify') {
      return true
    }

    return hasClarifyHint
  }

  if (chatType === 'group' || chatType === 'supergroup') {
    if (command) {
      return true
    }

    if (mainMenuCommand) {
      return true
    }

    return (
      isTelegramAssistantReply(message, botUsername) ||
      isTelegramAssistantMention(normalizedText, botUsername)
    )
  }

  return false
}

function isWebhookSecretEnabled() {
  return Boolean(
    getEnv('TELEGRAM_ASSISTANT_WEBHOOK_SECRET', getEnv('TELEGRAM_WEBHOOK_SECRET'))
  )
}

function assertWebhookSecret(req) {
  const expectedSecret = getEnv(
    'TELEGRAM_ASSISTANT_WEBHOOK_SECRET',
    getEnv('TELEGRAM_WEBHOOK_SECRET')
  )

  if (!expectedSecret) {
    return
  }

  const receivedSecret = normalizeText(
    req?.headers?.['x-telegram-bot-api-secret-token'],
    ''
  )

  if (receivedSecret !== expectedSecret) {
    throw createHttpError(403, 'Secret token webhook Telegram tidak cocok.')
  }
}

function normalizeMembership(member) {
  const team = Array.isArray(member?.teams)
    ? member.teams[0] ?? null
    : member?.teams ?? null

  return {
    id: normalizeText(member?.id, null),
    team_id: normalizeText(member?.team_id, null),
    telegram_user_id: normalizeText(member?.telegram_user_id, null),
    role: normalizeRole(member?.role),
    is_default: Boolean(member?.is_default),
    status: normalizeText(member?.status, 'active'),
    approved_at: normalizeText(member?.approved_at, null),
    created_at: normalizeText(member?.created_at, null),
    team_name: normalizeText(team?.name, null),
    team_slug: normalizeText(team?.slug, null),
    team_is_active: team?.is_active !== false,
  }
}

async function loadActiveMemberships(adminClient, telegramUserId) {
  const normalizedTelegramUserId = normalizeTelegramId(telegramUserId)

  if (!normalizedTelegramUserId) {
    return []
  }

  const { data, error } = await adminClient
    .from('team_members')
    .select(
      'id, team_id, telegram_user_id, role, is_default, status, approved_at, created_at, teams:team_id ( id, name, slug, is_active )'
    )
    .eq('telegram_user_id', normalizedTelegramUserId)
    .eq('status', 'active')
    .order('is_default', { ascending: false })
    .order('approved_at', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) {
    throw error
  }

  return (data ?? []).map(normalizeMembership).filter((membership) => membership.team_is_active)
}

function isSessionState(value) {
  return sessionStates.has(normalizeText(value, ''))
}

function normalizeSessionRow(row) {
  const state = isSessionState(row?.state) ? normalizeText(row?.state, 'idle') : 'idle'

  return {
    chat_id: normalizeText(row?.chat_id, null),
    telegram_user_id: normalizeText(row?.telegram_user_id, null),
    team_id: normalizeText(row?.team_id, null),
    state,
    pending_intent: normalizeText(row?.pending_intent, null),
    pending_payload: normalizeAssistantPendingPayload(row?.pending_payload),
    expires_at: normalizeText(row?.expires_at, null),
    created_at: normalizeText(row?.created_at, null),
    updated_at: normalizeText(row?.updated_at, null),
  }
}

async function loadAssistantSession(adminClient, chatId) {
  const normalizedChatId = normalizeTelegramId(chatId)

  if (!normalizedChatId) {
    return null
  }

  const { data, error } = await adminClient
    .from('telegram_assistant_sessions')
    .select(
      'chat_id, telegram_user_id, team_id, state, pending_intent, pending_payload, expires_at, created_at, updated_at'
    )
    .eq('chat_id', normalizedChatId)
    .maybeSingle()

  if (error) {
    throw error
  }

  const session = data ? normalizeSessionRow(data) : null

  if (!session?.expires_at) {
    return session
  }

  const expiresAtMs = new Date(session.expires_at).getTime()

  if (Number.isFinite(expiresAtMs) && expiresAtMs < Date.now()) {
    await clearAssistantSession(adminClient, normalizedChatId)

    return null
  }

  return session
}

async function saveAssistantSession(
  adminClient,
  {
    chatId,
    telegramUserId,
    teamId = null,
    state = 'idle',
    pendingIntent = null,
    pendingPayload = {},
    expiresAt = null,
  } = {}
) {
  const normalizedChatId = normalizeTelegramId(chatId)
  const normalizedTelegramUserId = normalizeTelegramId(telegramUserId)
  const normalizedTeamId = normalizeTelegramId(teamId)
  const normalizedState = isSessionState(state) ? normalizeText(state, 'idle') : 'idle'
  const normalizedPendingIntent = normalizeText(pendingIntent, null)
  const normalizedPayload = normalizeAssistantPendingPayload(pendingPayload)
  const normalizedExpiresAt = normalizeText(
    expiresAt,
    new Date(Date.now() + 30 * 60 * 1000).toISOString()
  )

  if (!normalizedChatId || !normalizedTelegramUserId) {
    throw createHttpError(400, 'Session Telegram assistant tidak lengkap.')
  }

  const payload = {
    chat_id: normalizedChatId,
    telegram_user_id: normalizedTelegramUserId,
    team_id: normalizedTeamId || null,
    state: normalizedState,
    pending_intent: normalizedPendingIntent,
    pending_payload: normalizedPayload,
    expires_at: normalizedExpiresAt,
    updated_at: new Date().toISOString(),
  }

  const { error } = await adminClient
    .from('telegram_assistant_sessions')
    .upsert(payload, { onConflict: 'chat_id' })

  if (error) {
    throw error
  }

  return payload
}

async function clearAssistantSession(adminClient, chatId) {
  const normalizedChatId = normalizeTelegramId(chatId)

  if (!normalizedChatId) {
    return
  }

  const { error } = await adminClient
    .from('telegram_assistant_sessions')
    .delete()
    .eq('chat_id', normalizedChatId)

  if (error) {
    throw error
  }
}

function buildWorkspaceChoiceMessage(memberships, language = 'id') {
  const locale = getLocaleText(language)
  const lines = [locale.workspaceChoiceIntro]

  memberships.forEach((membership, index) => {
    const roleLabel = membership.role ? ` - ${membership.role}` : ''
    const defaultLabel = membership.is_default ? ' (default)' : ''

    lines.push(`${index + 1}. ${membership.team_name ?? 'Workspace'}${roleLabel}${defaultLabel}`)
  })

  lines.push(locale.workspaceChoiceHint)

  return lines.join('\n')
}

function buildWorkspaceChoiceMarkup(memberships) {
  const rows = memberships.map((membership) => [
    {
      text: membership.team_name ?? 'Workspace',
      callback_data: `ws:${membership.team_id}`,
    },
  ])

  return rows.length > 0 ? { inline_keyboard: rows } : null
}

function getAllowedBotProviderConfigs() {
  const geminiApiKey = normalizeText(
    getEnv('TELEGRAM_ASSISTANT_GEMINI_API_KEY', getEnv('GEMINI_API_KEY')),
    ''
  )
  const geminiModel = normalizeText(
    getEnv('TELEGRAM_ASSISTANT_GEMINI_MODEL', getEnv('GEMINI_MODEL')),
    ''
  )
  const xaiApiKey = normalizeText(
    getEnv('TELEGRAM_ASSISTANT_XAI_API_KEY', getEnv('XAI_API_KEY')),
    ''
  )
  const xaiModel = normalizeText(
    getEnv('TELEGRAM_ASSISTANT_XAI_MODEL', getEnv('XAI_MODEL')),
    ''
  )
  const providerConfigs = []

  if (geminiApiKey && geminiModel) {
    providerConfigs.push({
      provider: 'gemini',
      apiKey: geminiApiKey,
      model: geminiModel,
    })
  }

  if (xaiApiKey && xaiModel) {
    providerConfigs.push({
      provider: 'xai',
      apiKey: xaiApiKey,
      model: xaiModel,
    })
  }

  return providerConfigs
}

async function postAssistantModelPrompt(
  providerConfig,
  { promptText, systemMessage, temperature = 0, maxOutputTokens = 512 }
) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 15000)

  try {
    if (providerConfig.provider === 'xai') {
      const response = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${providerConfig.apiKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          model: providerConfig.model,
          temperature,
          max_tokens: maxOutputTokens,
          messages: [
            {
              role: 'system',
              content: systemMessage,
            },
            {
              role: 'user',
              content: promptText,
            },
          ],
        }),
      })

      const responseText = (await response.text()).trim()

      if (!response.ok) {
        throw createHttpError(response.status, responseText || 'xAI classifier gagal.')
      }

      const responseJson = responseText ? JSON.parse(responseText) : {}
      return normalizeText(responseJson?.choices?.[0]?.message?.content, '')
    }

    if (providerConfig.provider === 'gemini') {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(providerConfig.model)}:generateContent`,
        {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'x-goog-api-key': providerConfig.apiKey,
          },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [{ text: `${systemMessage}\n\n${promptText}` }],
              },
            ],
            generationConfig: {
              temperature,
              maxOutputTokens,
            },
          }),
        }
      )

      const responseText = (await response.text()).trim()

      if (!response.ok) {
        throw createHttpError(response.status, responseText || 'Gemini classifier gagal.')
      }

      const responseJson = responseText ? JSON.parse(responseText) : {}
      const candidate = responseJson?.candidates?.[0]?.content?.parts ?? []

      return normalizeText(
        candidate
          .map((part) => normalizeText(part?.text, ''))
          .filter(Boolean)
          .join('\n'),
        ''
      )
    }

    return ''
  } finally {
    clearTimeout(timeoutId)
  }
}

async function postAssistantClassifierPrompt(providerConfig, promptText) {
  return postAssistantModelPrompt(providerConfig, {
    promptText,
    systemMessage: 'Kamu adalah classifier JSON untuk Telegram assistant finance core yang read-only.',
    temperature: 0,
    maxOutputTokens: 512,
  })
}

async function postAssistantWriterPrompt(providerConfig, promptText) {
  return postAssistantModelPrompt(providerConfig, {
    promptText,
    systemMessage:
      'Kamu adalah penulis jawaban Telegram untuk assistant finance core yang read-only. Ubah fakta terstruktur menjadi balasan natural language yang singkat, jelas, dan tidak mengarang data baru. Jangan menambah angka, nama, tanggal, atau aksi yang tidak ada di fact packet. Jika data kurang, ajukan satu klarifikasi singkat. Kembalikan JSON valid dengan shape {"text":"...","language":"id|su"}.',
    temperature: 0.2,
    maxOutputTokens: 256,
  })
}

function extractJsonObject(text) {
  const normalizedText = normalizeText(text, '')

  if (!normalizedText) {
    return null
  }

  const cleanedText = normalizedText.replace(/```json|```/gi, '').trim()
  const firstBrace = cleanedText.indexOf('{')
  const lastBrace = cleanedText.lastIndexOf('}')

  if (firstBrace < 0 || lastBrace <= firstBrace) {
    return null
  }

  const candidateText = cleanedText.slice(firstBrace, lastBrace + 1)

  try {
    return JSON.parse(candidateText)
  } catch {
    return null
  }
}

function extractNumericTokens(text) {
  return [...normalizeText(text, '').matchAll(/\b\d[\d.,]*\b/g)].map((match) => match[0])
}

function extractAssistantWordTokens(text) {
  return [...normalizeText(text, '').toLowerCase().matchAll(/\p{L}+/gu)].map((match) => match[0])
}

function collectAssistantStringValues(value, collected = []) {
  if (typeof value === 'string') {
    const normalizedValue = normalizeText(value, '')

    if (normalizedValue) {
      collected.push(normalizedValue)
    }

    return collected
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectAssistantStringValues(item, collected)
    }

    return collected
  }

  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) {
      collectAssistantStringValues(item, collected)
    }
  }

  return collected
}

function buildAssistantResponseWordAllowlist(factPacket) {
  const tokens = new Set(assistantSafetyBaseVocabulary)

  collectAssistantStringValues(factPacket).forEach((value) => {
    for (const token of extractAssistantWordTokens(value)) {
      tokens.add(token)
    }
  })

  return tokens
}

function buildAssistantResponseFactPacket({
  plan,
  reply,
  workspaceName = null,
  session = null,
}) {
  const fallbackText = normalizeText(reply?.text, '')
  const sessionPayload = normalizeAssistantPendingPayload(session?.pending_payload)
  const replyFacts = reply?.facts && typeof reply.facts === 'object' ? reply.facts : {}
  const rawButtons = Array.isArray(reply?.buttonRows) && reply.buttonRows.length > 0
    ? reply.buttonRows.flat()
    : Array.isArray(reply?.buttons)
      ? reply.buttons
      : []
  const buttons = rawButtons.map((button) => ({
        text: normalizeText(button?.text, ''),
        path: normalizeText(button?.path, ''),
        callbackData: normalizeText(button?.callbackData, ''),
      }))

  return {
    intent: normalizeText(plan?.intent, 'clarify'),
    language: normalizeText(plan?.language, 'id'),
    workspaceName: normalizeText(workspaceName, ''),
    clarificationCode: normalizeText(plan?.clarificationCode, ''),
    replyType: reply?.needsClarification ? 'clarify' : normalizeText(plan?.intent, 'clarify'),
    fallbackText,
    buttons,
    facts: replyFacts,
    context: {
      summary: normalizeText(sessionPayload.summary, ''),
      lastTurn: normalizeText(sessionPayload.last_turn?.user_text, ''),
      lastIntent: normalizeText(sessionPayload.last_intent, ''),
      lastRoute: normalizeText(sessionPayload.last_route, ''),
      entityHints: sessionPayload.entity_hints ?? [],
      transcript: sessionPayload.transcript ?? [],
      lastAnalytics: sessionPayload.last_turn?.analytics ?? null,
      sessionState: normalizeText(session?.state, 'idle'),
    },
  }
}

function buildAssistantResponsePrompt(factPacket) {
  const presentation = normalizeText(factPacket?.facts?.presentation, '')
  const styleHint =
    presentation === 'hybrid_summary'
      ? 'Jika fact packet.presentation = hybrid_summary, susun jawaban dengan gaya santai operasional: headline singkat, baris Inti, bullet Sorotan, lalu CTA singkat seperti Menu atau pilih bucket berikutnya. Jangan menambah fakta baru.'
      : ''

  return [
    'Ubah fact packet Telegram assistant ini menjadi jawaban natural language yang singkat, jelas, dan tetap read-only.',
    'Aturan wajib:',
    '- Jangan menambah angka, nama, tanggal, entity, route, atau aksi yang tidak ada di fact packet.',
    '- Pertahankan semua angka sebagai digit yang sama persis jika disebut ulang.',
    '- Jika fact packet meminta klarifikasi, ajukan satu pertanyaan singkat dan spesifik.',
    '- Jika fact packet berisi jawaban final, jawab langsung tanpa menjelaskan proses internal.',
    '- Bahasa jawaban harus mengikuti field language.',
    styleHint || null,
    '- Kembalikan JSON valid dengan shape {"text":"...","language":"id|su"}.',
    `Fact packet:\n${JSON.stringify(factPacket, null, 2)}`,
  ].filter(Boolean).join('\n')
}

function isAssistantResponseSafe(candidateText, factPacket) {
  const normalizedText = normalizeText(candidateText, '')

  if (!normalizedText) {
    return false
  }

  if (normalizedText.length > 700) {
    return false
  }

  const candidateWords = extractAssistantWordTokens(normalizedText)

  if (candidateWords.length === 0) {
    return false
  }

  const allowedNumbers = new Set(
    [
      ...extractNumericTokens(JSON.stringify(factPacket ?? {})),
      ...extractNumericTokens(normalizeText(factPacket?.fallbackText, '')),
    ].filter(Boolean)
  )
  const candidateNumbers = extractNumericTokens(normalizedText)
  const allowedWords = buildAssistantResponseWordAllowlist(factPacket)

  if (!candidateNumbers.every((numberToken) => allowedNumbers.has(numberToken))) {
    return false
  }

  return candidateWords.every((wordToken) => allowedWords.has(wordToken))
}

async function rewriteAssistantReply({
  plan,
  reply,
  workspaceName = null,
  session = null,
  providerConfigs = getAllowedBotProviderConfigs(),
}) {
  const fallbackText = normalizeText(reply?.text, '')

  if (!fallbackText || providerConfigs.length === 0) {
    return fallbackText
  }

  const factPacket = buildAssistantResponseFactPacket({
    plan,
    reply,
    workspaceName,
    session,
  })
  const prompt = buildAssistantResponsePrompt(factPacket)

  for (const providerConfig of providerConfigs) {
    try {
      const responseText = await postAssistantWriterPrompt(providerConfig, prompt)
      const parsedResponse = extractJsonObject(responseText)
      const candidateText = normalizeText(parsedResponse?.text, '')

      if (candidateText && isAssistantResponseSafe(candidateText, factPacket)) {
        return candidateText
      }
    } catch (error) {
      console.error('[api/telegram-assistant] writer failed', {
        message: error instanceof Error ? error.message : String(error),
        provider: providerConfig.provider,
      })
    }
  }

  return fallbackText
}

function normalizeMoneyText(value) {
  const normalizedValue = normalizeText(value, '')

  if (!normalizedValue) {
    return ''
  }

  return normalizedValue
    .replace(/[^\d.,]/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
}

function parseFlexibleAmount(text) {
  const normalizedText = normalizeText(text, '').toLowerCase()

  const jutaMatch = normalizedText.match(/(\d+(?:[.,]\d+)?)\s*(jt|juta)\b/)

  if (jutaMatch) {
    const amount = Number(normalizeMoneyText(jutaMatch[1]))

    return Number.isFinite(amount) ? amount * 1000000 : null
  }

  const ribuMatch = normalizedText.match(/(\d+(?:[.,]\d+)?)\s*(rb|ribu)\b/)

  if (ribuMatch) {
    const amount = Number(normalizeMoneyText(ribuMatch[1]))

    return Number.isFinite(amount) ? amount * 1000 : null
  }

  const rupiahMatch = normalizedText.match(/(?:rp|rupiah)\s*([\d.,]+)/)

  if (rupiahMatch) {
    const amount = Number(normalizeMoneyText(rupiahMatch[1]))

    return Number.isFinite(amount) ? amount : null
  }

  const bareNumberMatch = normalizedText.match(/\b(\d[\d.,]{2,})\b/)

  if (bareNumberMatch) {
    const amount = Number(normalizeMoneyText(bareNumberMatch[1]))

    return Number.isFinite(amount) ? amount : null
  }

  return null
}

function extractExactDateRange(text) {
  const normalizedText = normalizeText(text, '').toLowerCase()
  const dateMatches = [...normalizedText.matchAll(/\b(\d{4}-\d{2}-\d{2})\b/g)].map(
    (match) => match[1]
  )

  if (dateMatches.length >= 2) {
    return {
      dateFrom: dateMatches[0],
      dateTo: dateMatches[1],
    }
  }

  if (dateMatches.length === 1) {
    return {
      dateFrom: dateMatches[0],
      dateTo: dateMatches[0],
    }
  }

  return null
}

function getMonthRange(dateKey, offsetMonths = 0) {
  const parsedDate = new Date(`${dateKey}T12:00:00Z`)

  if (Number.isNaN(parsedDate.getTime())) {
    return null
  }

  const startDate = new Date(
    Date.UTC(
      parsedDate.getUTCFullYear(),
      parsedDate.getUTCMonth() + offsetMonths,
      1,
      12,
      0,
      0
    )
  )
  const endDate = new Date(
    Date.UTC(
      parsedDate.getUTCFullYear(),
      parsedDate.getUTCMonth() + offsetMonths + 1,
      0,
      12,
      0,
      0
    )
  )

  return {
    dateFrom: getAppTodayKey(startDate),
    dateTo: getAppTodayKey(endDate),
  }
}

function getCalendarWeekRange(dateKey, offsetWeeks = 0) {
  const parsedDate = new Date(`${String(dateKey ?? '').trim()}T12:00:00Z`)

  if (Number.isNaN(parsedDate.getTime())) {
    return null
  }

  const dayOffset = (parsedDate.getUTCDay() + 6) % 7
  const startDate = new Date(parsedDate)
  startDate.setUTCDate(parsedDate.getUTCDate() - dayOffset + offsetWeeks * 7)
  const endDate = new Date(startDate)
  endDate.setUTCDate(startDate.getUTCDate() + 6)

  return {
    dateFrom: getAppTodayKey(startDate),
    dateTo: getAppTodayKey(endDate),
  }
}

function extractTimeWindowRange(text) {
  const normalizedText = normalizeText(text, '').toLowerCase()
  const todayKey = getAppTodayKey()

  if (normalizedText.includes('hari ini')) {
    return {
      windowKey: 'today',
      dateFrom: todayKey,
      dateTo: todayKey,
    }
  }

  if (normalizedText.includes('kemarin')) {
    const yesterdayKey = shiftAppDateKey(todayKey, -1)

    return {
      windowKey: 'yesterday',
      dateFrom: yesterdayKey,
      dateTo: yesterdayKey,
    }
  }

  if (normalizedText.includes('minggu ini')) {
    const weekRange = getCalendarWeekRange(todayKey, 0)

    return weekRange
      ? {
          windowKey: 'week_current',
          dateFrom: weekRange.dateFrom,
          dateTo: weekRange.dateTo,
        }
      : null
  }

  if (normalizedText.includes('minggu lalu')) {
    const weekRange = getCalendarWeekRange(todayKey, -1)

    return weekRange
      ? {
          windowKey: 'week_previous',
          dateFrom: weekRange.dateFrom,
          dateTo: weekRange.dateTo,
        }
      : null
  }

  if (normalizedText.includes('bulan ini')) {
    const monthRange = getMonthRange(todayKey, 0)

    return monthRange
      ? {
          windowKey: 'month_current',
          dateFrom: monthRange.dateFrom,
          dateTo: monthRange.dateTo,
        }
      : null
  }

  if (normalizedText.includes('bulan lalu')) {
    const monthRange = getMonthRange(todayKey, -1)

    return monthRange
      ? {
          windowKey: 'month_previous',
          dateFrom: monthRange.dateFrom,
          dateTo: monthRange.dateTo,
        }
      : null
  }

  return null
}

function extractRelativeDateRange(text) {
  const windowRange = extractTimeWindowRange(text)

  if (!windowRange) {
    return null
  }

  return {
    dateFrom: windowRange.dateFrom,
    dateTo: windowRange.dateTo,
  }
}

function extractStatusFilter(text) {
  const normalizedText = normalizeText(text, '').toLowerCase()

  if (/\b(belum lunas|unpaid|outstanding|sisa|tersisa)\b/.test(normalizedText)) {
    return 'unpaid'
  }

  if (/\b(partial|sebagian|cicil|bertahap)\b/.test(normalizedText)) {
    return 'partial'
  }

  if (/\b(lunas|paid|terbayar|selesai|tuntas)\b/.test(normalizedText)) {
    return 'paid'
  }

  return 'any'
}

function extractKindFilter(text) {
  const normalizedText = normalizeText(text, '').toLowerCase()

  if (/\b(pinjaman|loan)\b/.test(normalizedText)) {
    return 'loan'
  }

  if (/\b(tagihan|invoice)\b/.test(normalizedText)) {
    return 'bill'
  }

  if (/\b(pembayaran|payment)\b/.test(normalizedText)) {
    return 'transaction'
  }

  return 'all'
}

function extractRouteKeyword(text) {
  const normalizedText = normalizeText(text, '').toLowerCase()

  for (const routeDefinition of routeKeywordMap) {
    if (routeDefinition.pattern.test(normalizedText)) {
      return routeDefinition
    }
  }

  return null
}

function buildSearchQueryText(text) {
  let normalizedText = normalizeText(text, '').toLowerCase()

  for (const pattern of stopWordPatterns) {
    normalizedText = normalizedText.replace(pattern, ' ')
  }

  normalizedText = normalizedText.replace(/\s+/g, ' ').trim()

  return normalizedText
}

function extractUuid(text) {
  const normalizedText = normalizeText(text, '')
  const match = normalizedText.match(
    /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i
  )

  return match ? match[0].toLowerCase() : null
}

function detectEntityTypeHints(text) {
  const normalizedText = normalizeText(text, '').toLowerCase()
  const hints = []

  if (
    /\b(worker|pekerja|karyawan|absensi|attendance|gaji|upah|salary|payroll)\b/.test(
      normalizedText
    )
  ) {
    hints.push('worker')
  }

  if (/\b(supplier|toko|vendor|material|barang|faktur|invoice)\b/.test(normalizedText)) {
    hints.push('supplier')
  }

  if (/\b(creditor|kreditur|hutang|utang|pinjaman|loan|nginjeum)\b/.test(normalizedText)) {
    hints.push('creditor')
  }

  return [...new Set(hints)]
}

function extractEntityTypeFromText(text, metricKey = null) {
  const normalizedText = normalizeText(text, '').toLowerCase()
  const hints = detectEntityTypeHints(normalizedText)

  if (hints.length === 1) {
    return {
      entityType: hints[0],
      entityConfidence: 0.95,
      entityHints: hints,
    }
  }

  if (hints.length > 1) {
    return {
      entityType: null,
      entityConfidence: 0.25,
      entityHints: hints,
    }
  }

  if (metricKey === 'attendance_present') {
    return {
      entityType: 'worker',
      entityConfidence: 0.9,
      entityHints: ['worker'],
    }
  }

  if (metricKey === 'obligation_ranking' && /\b(hutang|utang|pinjaman|loan)\b/.test(normalizedText)) {
    return {
      entityType: 'creditor',
      entityConfidence: 0.8,
      entityHints: ['creditor'],
    }
  }

  if (metricKey === 'bill_summary' && /\b(creditor|kreditur|hutang|utang|pinjaman|loan)\b/.test(normalizedText)) {
    return {
      entityType: 'creditor',
      entityConfidence: 0.8,
      entityHints: ['creditor'],
    }
  }

  if (metricKey === 'bill_summary' && /\b(gaji|upah|worker|pekerja|absensi|attendance)\b/.test(normalizedText)) {
    return {
      entityType: 'worker',
      entityConfidence: 0.8,
      entityHints: ['worker'],
    }
  }

  if (metricKey === 'bill_summary' && /\b(supplier|toko|vendor|material|barang|invoice|faktur)\b/.test(normalizedText)) {
    return {
      entityType: 'supplier',
      entityConfidence: 0.8,
      entityHints: ['supplier'],
    }
  }

  return {
    entityType: null,
    entityConfidence: metricKey === 'cash_outflow' ? 1 : 0.5,
    entityHints: [],
  }
}

function extractAnalyticsMetricCandidates(text) {
  const normalizedText = normalizeText(text, '').toLowerCase()
  const candidates = []

  if (
    /(\b(cek|lihat|tampilkan|tinjau|ringkas|rekap|data|total|nominal|sisa|saldo|jumlah|berapa)\b.*\b(tagihan|hutang|utang)\b)|(\b(tagihan|hutang|utang)\b.*\b(cek|lihat|tampilkan|tinjau|ringkas|rekap|data|total|nominal|sisa|saldo|jumlah|berapa)\b)/.test(
      normalizedText
    )
  ) {
    candidates.push('bill_summary')
  }

  if (/\b(pengeluaran|outflow|biaya keluar|keluar)\b/.test(normalizedText)) {
    candidates.push('cash_outflow')
  }

  if (
    /(\b(jumlah|berapa|total|cek|lihat|tampilkan)\b.*\b(pekerja|worker|karyawan|hadir|absensi|attendance|kehadiran)\b)|(\b(hadir|absen|absensi|kehadiran)\b.*\b(hari ini|kemarin|minggu ini|minggu lalu|bulan ini|bulan lalu)\b)/.test(
      normalizedText
    )
  ) {
    candidates.push('attendance_present')
  }

  if (
    /(\b(siapa|mana|yang)\b.*\b(terbesar|paling besar|tertinggi|terbanyak|terbanyak|terluas)\b)|(\b(terbesar|paling besar|tertinggi|terbanyak)\b.*\b(hutang|utang|pinjaman|tagihan)\b)/.test(
      normalizedText
    )
  ) {
    candidates.push('obligation_ranking')
  }

  return [...new Set(candidates)]
}

function buildAnalyticsWindowLabel(windowKey, dateFrom = null, dateTo = null) {
  const normalizedWindowKey = normalizeText(windowKey, 'none').toLowerCase()

  if (normalizedWindowKey === 'today') {
    return 'hari ini'
  }

  if (normalizedWindowKey === 'yesterday') {
    return 'kemarin'
  }

  if (normalizedWindowKey === 'week_current') {
    return 'minggu ini'
  }

  if (normalizedWindowKey === 'week_previous') {
    return 'minggu lalu'
  }

  if (normalizedWindowKey === 'month_current') {
    return 'bulan ini'
  }

  if (normalizedWindowKey === 'month_previous') {
    return 'bulan lalu'
  }

  if (dateFrom && dateTo) {
    if (dateFrom === dateTo) {
      return formatDateLabel(dateFrom)
    }

    return `${formatDateLabel(dateFrom)} - ${formatDateLabel(dateTo)}`
  }

  return 'periode ini'
}

function analyticsRequiresWindow(metricKey) {
  return ['cash_outflow', 'attendance_present'].includes(normalizeText(metricKey, '').toLowerCase())
}

function analyticsRequiresEntity(metricKey) {
  return normalizeText(metricKey, '').toLowerCase() === 'obligation_ranking'
}

function normalizeAnalyticsEntityQuery(text) {
  const query = buildSearchQueryText(text)

  return query ? query : null
}

function buildAnalyticsPlan(text, context = {}) {
  const normalizedText = normalizeText(text, '')
  const lowerText = normalizedText.toLowerCase()
  const metricCandidates = extractAnalyticsMetricCandidates(lowerText)
  const metricKey = metricCandidates[0] ?? null
  const windowRange = extractTimeWindowRange(lowerText)
  const entityProfile = extractEntityTypeFromText(normalizedText, metricKey)
  const entityQuery = normalizeAnalyticsEntityQuery(normalizedText)
  const metricConfidence = metricCandidates.length === 1 ? 1 : metricCandidates.length > 1 ? 0.55 : 0.25
  const entityConfidence = entityProfile.entityConfidence ?? 0.5
  const windowKey = normalizeText(windowRange?.windowKey, 'none').toLowerCase()
  const requiresWindow = analyticsRequiresWindow(metricKey)
  const requiresEntity = analyticsRequiresEntity(metricKey)
  let clarificationCode = detectClarificationCode(normalizedText, context.session ?? null)

  if (metricCandidates.length > 1) {
    clarificationCode = 'analytics_metric'
  } else if (metricKey && requiresEntity && !entityProfile.entityType) {
    clarificationCode = 'analytics_entity'
  } else if (metricKey && requiresWindow && windowKey === 'none') {
    clarificationCode = 'analytics_window'
  }

  return {
    metricCandidates,
    metricKey,
    windowKey,
    dateFrom: normalizeNullableText(windowRange?.dateFrom),
    dateTo: normalizeNullableText(windowRange?.dateTo),
    entityType: entityProfile.entityType,
    entityConfidence,
    entityHints: entityProfile.entityHints ?? [],
    entityQuery,
    metricConfidence,
    requiresWindow,
    requiresEntity,
    clarificationCode,
    needsClarification:
      metricCandidates.length > 1 ||
      (metricKey && requiresEntity && !entityProfile.entityType) ||
      (metricKey && requiresWindow && windowKey === 'none'),
  }
}

function determineIntentFromText(text) {
  const normalizedText = normalizeText(text, '').toLowerCase()
  const hasMutation = mutationKeywords.some((keyword) => normalizedText.includes(keyword))
  const analyticsPlan = buildAnalyticsPlan(normalizedText)
  const routeKeyword = extractRouteKeyword(normalizedText)
  const exactId = extractUuid(normalizedText)
  const hasSearchSignal = Boolean(
    exactId ||
      hasAnyKeyword(normalizedText, [
        'cari',
        'search',
        'temukan',
        'neangan',
        'milarian',
        'nominal',
        'jumlah',
        'tanggal',
        'id',
        'kode',
        'nama',
        'sabaraha',
        'berapa',
        'sisa',
        'lunas',
        'partial',
        'detil',
        'detail',
        'rincian',
      ])
  )
  const hasStatusSignal = Boolean(
    hasAnyKeyword(normalizedText, [
      'status',
      'cek',
      'parios',
      'belum lunas',
      'unpaid',
      'paid',
      'partial',
      'outstanding',
      'tersisa',
      'acan lunas',
      'can lunas',
      'acan dibayar',
      'can dibayar',
      'tagihan',
      'pembayaran',
      'pinjaman',
      'hutang',
      'utang',
    ])
  )
  const hasNavigateSignal = Boolean(
    hasAnyKeyword(normalizedText, ['buka', 'lihat', 'tingali', 'muka', 'menu', 'masuk', 'ke']) &&
      routeKeyword
  )

  if (hasMutation) {
    return 'refuse'
  }

  if (analyticsPlan.metricKey) {
    return 'analytics'
  }

  if (hasNavigateSignal) {
    return 'navigate'
  }

  if (hasSearchSignal) {
    return 'search'
  }

  if (hasStatusSignal) {
    return 'status'
  }

  if (routeKeyword) {
    return 'navigate'
  }

  return 'clarify'
}

function buildDeterministicPlan(text, context = {}) {
  const normalizedText = normalizeText(text, '')
  const lowerText = normalizedText.toLowerCase()
  const routeKeyword = extractRouteKeyword(lowerText)
  const exactId = extractUuid(lowerText)
  const searchQuery = buildSearchQueryText(normalizedText)
  const relativeDateRange = extractRelativeDateRange(lowerText)
  const exactDateRange = extractExactDateRange(lowerText)
  const dateRange = exactDateRange ?? relativeDateRange
  const status = extractStatusFilter(lowerText)
  const kind = extractKindFilter(lowerText)
  const amount = parseFlexibleAmount(lowerText)
  const analytics = buildAnalyticsPlan(normalizedText, context)
  const intent = analytics.metricKey ? 'analytics' : determineIntentFromText(lowerText)
  const language = getAssistantLanguageFromText(normalizedText, context.session ?? null)
  const clarificationCode = analytics.metricKey
    ? analytics.clarificationCode
    : detectClarificationCode(normalizedText, context.session ?? null)

  let targetPath = null

  if (routeKeyword) {
    targetPath = routeKeyword.path
  }

  if (exactId) {
    if (kind === 'loan' || /\b(pinjaman|loan)\b/.test(lowerText)) {
      targetPath = `/loan-payment/${exactId}`
    } else if (
      kind === 'bill' ||
      /\b(tagihan|invoice|bayar|pembayaran|lunas|partial|sisa)\b/.test(lowerText)
    ) {
      targetPath = `/payment/${exactId}`
    } else {
      targetPath = `/transactions/${exactId}`
    }
  }

  const search = {
    query: searchQuery,
    exactId,
    status,
    kind,
    amount,
    dateFrom: normalizeNullableText(dateRange?.dateFrom),
    dateTo: normalizeNullableText(dateRange?.dateTo),
  }

  if (intent === 'clarify' && !search.query && !search.exactId) {
    return {
      intent: 'clarify',
      targetPath: null,
      search,
      language,
      clarificationCode,
      analytics,
    }
  }

  return {
    intent,
    targetPath: normalizeAssistantRoutePath(targetPath),
    search,
    analytics,
    language,
    clarificationCode,
  }
}

function normalizePlannerObject(rawObject, fallbackText, context = {}) {
  if (!rawObject || typeof rawObject !== 'object') {
    return buildDeterministicPlan(fallbackText, context)
  }

  const normalizedIntent = normalizeText(rawObject.intent, '').toLowerCase()
  const intent = allowedIntents.has(normalizedIntent)
    ? normalizedIntent
    : buildDeterministicPlan(fallbackText, context).intent
  const targetPath = normalizeAssistantRoutePath(rawObject.targetPath)
  const rawSearch = rawObject.search && typeof rawObject.search === 'object' ? rawObject.search : {}
  const exactId = extractUuid(rawSearch.exactId ?? rawSearch.id ?? rawObject.exactId ?? '')
  const status = allowedStatuses.has(
    normalizeText(rawSearch.status ?? rawObject.status, 'any').toLowerCase()
  )
    ? normalizeText(rawSearch.status ?? rawObject.status, 'any').toLowerCase()
    : 'any'
  const kind = allowedKinds.has(
    normalizeText(rawSearch.kind ?? rawObject.kind, 'all').toLowerCase()
  )
    ? normalizeText(rawSearch.kind ?? rawObject.kind, 'all').toLowerCase()
    : 'all'
  const amount = parseFlexibleAmount(
    normalizeText(rawSearch.amount ?? rawObject.amount, '')
  )
  const dateFrom = normalizeNullableText(
    rawSearch.dateFrom ?? rawObject.dateFrom ?? rawSearch.from ?? rawObject.from
  )
  const dateTo = normalizeNullableText(
    rawSearch.dateTo ?? rawObject.dateTo ?? rawSearch.to ?? rawObject.to
  )
  const language = allowedLanguages.has(
    normalizeText(rawObject.language ?? rawObject.languageHint, '').toLowerCase()
  )
    ? normalizeText(rawObject.language ?? rawObject.languageHint, '').toLowerCase()
    : buildDeterministicPlan(fallbackText, context).language
  const clarificationCode = ['specific_filter', 'followup_context'].includes(
    normalizeText(rawObject.clarificationCode ?? rawObject.clarification_type, '').toLowerCase()
  )
    ? normalizeText(rawObject.clarificationCode ?? rawObject.clarification_type, '').toLowerCase()
    : buildDeterministicPlan(fallbackText, context).clarificationCode
  const query = buildSearchQueryText(
    normalizeText(
      rawSearch.query ?? rawSearch.text ?? rawObject.query ?? rawObject.text ?? fallbackText,
      fallbackText
    )
  )

  return {
    intent,
    targetPath,
    search: {
      query,
      exactId,
      status,
      kind,
      amount,
      dateFrom,
      dateTo,
    },
    language,
    clarificationCode,
  }
}

function normalizePlannerObjectV2(rawObject, fallbackText, context = {}) {
  const fallbackPlan = normalizePlannerObject(rawObject, fallbackText, context)

  if (!rawObject || typeof rawObject !== 'object') {
    return fallbackPlan
  }

  const normalizedIntent = normalizeText(rawObject.intent, '').toLowerCase()
  const intent = allowedIntents.has(normalizedIntent) ? normalizedIntent : fallbackPlan.intent
  const fallbackAnalytics = fallbackPlan.analytics ?? {}
  const targetPath = normalizeAssistantRoutePath(rawObject.targetPath) ?? fallbackPlan.targetPath
  const rawSearch = rawObject.search && typeof rawObject.search === 'object' ? rawObject.search : {}
  const rawAnalytics =
    rawObject.analytics && typeof rawObject.analytics === 'object' ? rawObject.analytics : {}
  const exactId = extractUuid(rawSearch.exactId ?? rawSearch.id ?? rawObject.exactId ?? '')
  const status = allowedStatuses.has(
    normalizeText(rawSearch.status ?? rawObject.status, 'any').toLowerCase()
  )
    ? normalizeText(rawSearch.status ?? rawObject.status, 'any').toLowerCase()
    : fallbackPlan.search?.status ?? 'any'
  const kind = allowedKinds.has(
    normalizeText(rawSearch.kind ?? rawObject.kind, 'all').toLowerCase()
  )
    ? normalizeText(rawSearch.kind ?? rawObject.kind, 'all').toLowerCase()
    : fallbackPlan.search?.kind ?? 'all'
  const amount = parseFlexibleAmount(normalizeText(rawSearch.amount ?? rawObject.amount, ''))
  const dateFrom = normalizeNullableText(
    rawSearch.dateFrom ?? rawObject.dateFrom ?? rawSearch.from ?? fallbackPlan.search?.dateFrom
  )
  const dateTo = normalizeNullableText(
    rawSearch.dateTo ?? rawObject.dateTo ?? rawSearch.to ?? fallbackPlan.search?.dateTo
  )
  const language = allowedLanguages.has(
    normalizeText(rawObject.language ?? rawObject.languageHint, '').toLowerCase()
  )
    ? normalizeText(rawObject.language ?? rawObject.languageHint, '').toLowerCase()
    : fallbackPlan.language
  const clarificationCode = allowedClarificationCodes.has(
    normalizeText(rawObject.clarificationCode ?? rawObject.clarification_type, '').toLowerCase()
  )
    ? normalizeText(rawObject.clarificationCode ?? rawObject.clarification_type, '').toLowerCase()
    : fallbackPlan.clarificationCode
  const query = buildSearchQueryText(
    normalizeText(
      rawSearch.query ?? rawSearch.text ?? rawObject.query ?? rawObject.text ?? fallbackText,
      fallbackText
    )
  )
  const analyticsMetricKey = allowedAnalyticsMetricKeys.has(
    normalizeText(
      rawAnalytics.metricKey ?? rawObject.metricKey ?? fallbackAnalytics.metricKey,
      ''
    ).toLowerCase()
  )
    ? normalizeText(
        rawAnalytics.metricKey ?? rawObject.metricKey ?? fallbackAnalytics.metricKey,
        ''
      ).toLowerCase()
    : fallbackAnalytics.metricKey ?? null
  const analyticsEntityType = allowedAnalyticsEntityTypes.has(
    normalizeText(
      rawAnalytics.entityType ?? rawObject.entityType ?? fallbackAnalytics.entityType,
      ''
    ).toLowerCase()
  )
    ? normalizeText(
        rawAnalytics.entityType ?? rawObject.entityType ?? fallbackAnalytics.entityType,
        ''
      ).toLowerCase()
    : fallbackAnalytics.entityType ?? null
  const analyticsWindowKey = allowedAnalyticsWindows.has(
    normalizeText(
      rawAnalytics.windowKey ?? rawObject.windowKey ?? fallbackAnalytics.windowKey,
      'none'
    ).toLowerCase()
  )
    ? normalizeText(
        rawAnalytics.windowKey ?? rawObject.windowKey ?? fallbackAnalytics.windowKey,
        'none'
      ).toLowerCase()
    : fallbackAnalytics.windowKey ?? 'none'
  const analyticsDateFrom = normalizeNullableText(
    rawAnalytics.dateFrom ??
      rawObject.analyticsDateFrom ??
      rawObject.from ??
      fallbackAnalytics.dateFrom ??
      dateFrom
  )
  const analyticsDateTo = normalizeNullableText(
    rawAnalytics.dateTo ??
      rawObject.analyticsDateTo ??
      rawObject.to ??
      fallbackAnalytics.dateTo ??
      dateTo
  )
  const analyticsEntityQuery = normalizeAnalyticsEntityQuery(
    rawAnalytics.entityQuery ??
      rawAnalytics.query ??
      rawObject.entityQuery ??
      rawObject.entityName ??
      query ??
      fallbackAnalytics.entityQuery ??
      ''
  )
  const analyticsEntityConfidence = Number(
    rawAnalytics.entityConfidence ?? rawObject.entityConfidence ?? fallbackAnalytics.entityConfidence
  )
  const analyticsMetricConfidence = Number(
    rawAnalytics.metricConfidence ?? rawObject.metricConfidence ?? fallbackAnalytics.metricConfidence
  )
  const analyticsEntityHints = Array.isArray(rawAnalytics.entityHints)
    ? rawAnalytics.entityHints
    : Array.isArray(rawObject.entityHints)
      ? rawObject.entityHints
      : fallbackAnalytics.entityHints ?? []
  const analyticsMetricCandidates = Array.isArray(rawAnalytics.metricCandidates)
    ? rawAnalytics.metricCandidates
    : Array.isArray(rawObject.metricCandidates)
      ? rawObject.metricCandidates
      : fallbackAnalytics.metricCandidates ?? []
  const analyticsNeedsClarification =
    Boolean(rawAnalytics.needsClarification ?? rawObject.needsClarification) ||
    Boolean(fallbackAnalytics.needsClarification)

  return {
    intent,
    targetPath,
    search: {
      query,
      exactId,
      status,
      kind,
      amount,
      dateFrom,
      dateTo,
    },
    analytics: {
      metricKey: analyticsMetricKey,
      entityType: analyticsEntityType,
      entityQuery: analyticsEntityQuery,
      entityConfidence: Number.isFinite(analyticsEntityConfidence)
        ? analyticsEntityConfidence
        : fallbackAnalytics.entityConfidence ?? 0,
      metricConfidence: Number.isFinite(analyticsMetricConfidence)
        ? analyticsMetricConfidence
        : fallbackAnalytics.metricConfidence ?? 0,
      windowKey: analyticsWindowKey,
      dateFrom: analyticsDateFrom,
      dateTo: analyticsDateTo,
      entityHints: analyticsEntityHints,
      metricCandidates: analyticsMetricCandidates,
      requiresWindow: analyticsRequiresWindow(analyticsMetricKey),
      requiresEntity: analyticsRequiresEntity(analyticsMetricKey),
      needsClarification:
        analyticsNeedsClarification ||
        (analyticsMetricKey && analyticsRequiresEntity(analyticsMetricKey) && !analyticsEntityType) ||
        (analyticsMetricKey && analyticsRequiresWindow(analyticsMetricKey) && analyticsWindowKey === 'none'),
    },
    language,
    clarificationCode,
  }
}

function buildClassificationPromptV2({
  text,
  workspaceName,
  role,
  membershipsCount,
  languageHint = 'id',
  contextSummary = '',
  lastTurn = null,
  lastTurnAnalytics = null,
  transcript = [],
  entityHints = [],
}) {
  void buildClassificationPrompt({
    text,
    workspaceName,
    role,
    membershipsCount,
    languageHint,
    contextSummary,
    lastTurn,
  })

  return [
    'Kamu adalah classifier JSON untuk Telegram assistant finance core yang read-only.',
    'Aturan:',
    '- Intent hanya status, search, navigate, analytics, clarify, refuse.',
    '- Analytics dipakai untuk ringkasan, hitung, pengeluaran, kehadiran, dan ranking read-only.',
    '- Finance core only: jurnal, tagihan, pembayaran, pinjaman.',
    '- Jangan pernah menyarankan create/edit/delete/pay/approve/restore.',
    '- Jika user meminta payroll/gaji/upah/absensi/hrd/master/stok/tim untuk mutasi atau admin, intent harus refuse.',
    '- Jika pesan ambigu, intent clarify.',
    '- Jika metric analytics jelas tapi entity, kategori, atau window ambigu, isi slot analytics lalu pakai clarificationCode yang sesuai.',
    '- Bahasa input bisa Indonesia, Sunda, atau campuran; gunakan konteks ringkas untuk memahami rujukan seperti "itu", "anu tadi", atau "yang tadi".',
    '- Jangan menulis pertanyaan bebas; output hanya JSON valid tanpa markdown, tanpa penjelasan tambahan, dan tanpa teks final ke user.',
    'Skema JSON:',
    '{',
    '  "intent": "status|search|navigate|analytics|clarify|refuse",',
    '  "targetPath": "/transactions|/transactions?tab=tagihan|/transactions/:id|/payment/:id|/loan-payment/:id|/pembayaran|/payroll|/payroll?tab=worker|/payroll?tab=daily|null",',
    '  "search": {',
    '    "query": "string",',
    '    "exactId": "uuid or null",',
    '    "status": "any|paid|partial|unpaid",',
    '    "kind": "all|transaction|bill|loan",',
    '    "amount": 0,',
    '    "dateFrom": "YYYY-MM-DD or null",',
    '    "dateTo": "YYYY-MM-DD or null"',
    '  },',
    '  "analytics": {',
    '    "metricKey": "bill_summary|cash_outflow|attendance_present|obligation_ranking|null",',
    '    "entityType": "supplier|worker|creditor|null",',
    '    "entityQuery": "string or null",',
    '    "entityConfidence": 0,',
    '    "metricConfidence": 0,',
    '    "windowKey": "none|today|yesterday|week_current|week_previous|month_current|month_previous|custom",',
    '    "dateFrom": "YYYY-MM-DD or null",',
    '    "dateTo": "YYYY-MM-DD or null"',
    '  },',
    '  "language": "id|su",',
    '  "clarificationCode": "specific_filter|followup_context|analytics_metric|analytics_entity|analytics_window"',
    '}',
    `Bahasa dominan terdeteksi: ${languageHint ?? 'id'}`,
    `Workspace aktif: ${workspaceName ?? '-'} | Role: ${role ?? '-'} | Membership aktif: ${membershipsCount ?? 0}`,
    `Ringkasan konteks: ${normalizeText(contextSummary, '-')}`,
    `Turn terakhir: ${normalizeText(lastTurn, '-')}`,
    `Turn terakhir analytics: ${normalizeText(JSON.stringify(lastTurnAnalytics ?? {}), '-')}`,
    `Entity hints: ${normalizeText(JSON.stringify(entityHints ?? []), '[]')}`,
    `Transcript pendek: ${normalizeText(JSON.stringify(transcript ?? []), '[]')}`,
    `Pesan user: ${text}`,
  ].join('\n')
}

function buildClassificationPrompt({
  text,
  workspaceName,
  role,
  membershipsCount,
  languageHint = 'id',
  contextSummary = '',
  lastTurn = null,
}) {
  return [
    'Kamu adalah classifier JSON untuk Telegram assistant read-only finance core.',
    'Aturan:',
    '- Intent hanya status, search, navigate, clarify, refuse.',
    '- Finance core only: jurnal, tagihan, pembayaran, pinjaman.',
    '- Jangan pernah menyarankan create/edit/delete/pay/approve/restore.',
    '- Jika user meminta payroll/gaji/upah/absensi/hrd/master/stok/tim, intent harus refuse.',
    '- Jika pesan ambigu, intent clarify.',
    '- Bahasa input bisa Indonesia, Sunda, atau campuran; gunakan konteks ringkas untuk memahami rujukan seperti "itu", "anu tadi", atau "yang tadi".',
    '- Jangan menulis pertanyaan bebas; output hanya JSON valid tanpa markdown, tanpa penjelasan tambahan, dan tanpa teks final ke user.',
    'Skema JSON:',
    '{',
    '  "intent": "status|search|navigate|clarify|refuse",',
    '  "targetPath": "/transactions|/transactions?tab=tagihan|/transactions/:id|/payment/:id|/loan-payment/:id|/pembayaran|null",',
    '  "search": {',
    '    "query": "string",',
    '    "exactId": "uuid or null",',
    '    "status": "any|paid|partial|unpaid",',
    '    "kind": "all|transaction|bill|loan",',
    '    "amount": 0,',
    '    "dateFrom": "YYYY-MM-DD or null",',
    '    "dateTo": "YYYY-MM-DD or null"',
    '  },',
    '  "language": "id|su"',
    '}',
    `Bahasa dominan terdeteksi: ${languageHint ?? 'id'}`,
    `Workspace aktif: ${workspaceName ?? '-'} | Role: ${role ?? '-'} | Membership aktif: ${membershipsCount ?? 0}`,
    `Ringkasan konteks: ${normalizeText(contextSummary, '-')}`,
    `Turn terakhir: ${normalizeText(lastTurn, '-')}`,
  `Pesan user: ${text}`,
  ].join('\n')
}

function shouldUseClassifierForPlan(plan = {}) {
  const analytics = plan?.analytics ?? {}

  if (plan?.intent === 'clarify') {
    return true
  }

  if (plan?.intent !== 'analytics') {
    return false
  }

  if (!analytics.metricKey) {
    return true
  }

  if (Array.isArray(analytics.metricCandidates) && analytics.metricCandidates.length > 1) {
    return true
  }

  if (analytics.requiresEntity && !analytics.entityType) {
    return true
  }

  if (analytics.requiresWindow && normalizeText(analytics.windowKey, 'none') === 'none') {
    return true
  }

  if (analytics.entityQuery && (!analytics.entityType || Number(analytics.entityConfidence) < 0.85)) {
    return true
  }

  if (analytics.metricConfidence !== undefined && Number(analytics.metricConfidence) < 0.9) {
    return true
  }

  return false
}

async function classifyAssistantMessage({
  text,
  workspaceName = null,
  role = null,
  membershipsCount = 0,
  languageHint = 'id',
  contextSummary = '',
  lastTurn = null,
  session = null,
}) {
  const fallbackPlan = buildDeterministicPlan(text, { session })
  const providerConfigs = getAllowedBotProviderConfigs()

  if (providerConfigs.length === 0 || !shouldUseClassifierForPlan(fallbackPlan)) {
    return fallbackPlan
  }

  const prompt = buildClassificationPromptV2({
    text,
    workspaceName,
    role,
    membershipsCount,
    languageHint,
    contextSummary,
    lastTurn,
    lastTurnAnalytics: session?.pending_payload?.last_turn?.analytics ?? null,
    entityHints: session?.pending_payload?.entity_hints ?? [],
    transcript: session?.pending_payload?.transcript ?? [],
  })

  for (const providerConfig of providerConfigs) {
    try {
      const responseText = await postAssistantClassifierPrompt(providerConfig, prompt)
      const parsedResponse = extractJsonObject(responseText)

      return normalizePlannerObjectV2(parsedResponse, text, { session })
    } catch (error) {
      console.error('[api/telegram-assistant] classifier failed', {
        message: error instanceof Error ? error.message : String(error),
        provider: providerConfig.provider,
      })
    }
  }

  return fallbackPlan
}

function normalizeRecordDateValue(row) {
  const values = [
    row?.sort_at,
    row?.transaction_date,
    row?.expense_date,
    row?.due_date,
    row?.created_at,
    row?.updated_at,
  ]

  for (const value of values) {
    const dateKey = toAppDateKey(value)

    if (dateKey) {
      return dateKey
    }
  }

  return ''
}

function normalizeAmountValue(value) {
  const amount = Number(value)

  return Number.isFinite(amount) ? amount : 0
}

function formatCurrency(value) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(normalizeAmountValue(value))
}

function formatDateLabel(value) {
  const parsedDate = new Date(String(value ?? ''))

  if (Number.isNaN(parsedDate.getTime())) {
    return '-'
  }

  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeZone: APP_TIME_ZONE,
  }).format(parsedDate)
}

function formatStatusLabel(status, remainingAmount = 0) {
  const normalizedStatus = normalizeText(status, 'any').toLowerCase()
  const normalizedRemainingAmount = normalizeAmountValue(remainingAmount)

  if (normalizedRemainingAmount <= 0 || normalizedStatus === 'paid') {
    return 'Lunas'
  }

  if (normalizedStatus === 'partial') {
    return `Partial • Sisa ${formatCurrency(normalizedRemainingAmount)}`
  }

  if (normalizedStatus === 'unpaid') {
    return `Belum lunas • Sisa ${formatCurrency(normalizedRemainingAmount)}`
  }

  if (normalizedStatus === 'overdue') {
    return `Jatuh tempo • Sisa ${formatCurrency(normalizedRemainingAmount)}`
  }

  return `Sisa ${formatCurrency(normalizedRemainingAmount)}`
}

function escapeTelegramHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function formatSummaryMoney(value) {
  return escapeTelegramHtml(formatCurrency(value))
}

function getSettlementLoanTermsSnapshot(row) {
  const existingSnapshot = row?.loan_terms_snapshot

  if (existingSnapshot && typeof existingSnapshot === 'object' && !Array.isArray(existingSnapshot)) {
    return existingSnapshot
  }

  const sourceType = normalizeText(row?.source_type, '').toLowerCase()

  if (sourceType !== 'loan-disbursement' && sourceType !== 'loan') {
    return null
  }

  const principalAmount = normalizeAmountValue(row?.principal_amount ?? row?.amount)
  const repaymentAmount = normalizeAmountValue(row?.repayment_amount ?? row?.bill_amount)

  return {
    principal_amount: principalAmount,
    repayment_amount: repaymentAmount,
    base_repayment_amount: repaymentAmount > 0 ? repaymentAmount : principalAmount,
  }
}

function getSettlementItemGrossAmount(row) {
  const sourceType = normalizeText(row?.source_type, '').toLowerCase()
  const loanTermsSnapshot = getSettlementLoanTermsSnapshot(row)
  const candidates =
    sourceType === 'loan-disbursement' || sourceType === 'loan'
      ? [
          row?.bill_amount,
          row?.repayment_amount,
          loanTermsSnapshot?.repayment_amount,
          row?.principal_amount,
          loanTermsSnapshot?.base_repayment_amount,
          row?.amount,
        ]
      : [
          row?.bill_amount,
          row?.amount,
          row?.repayment_amount,
          row?.principal_amount,
          loanTermsSnapshot?.repayment_amount,
          loanTermsSnapshot?.base_repayment_amount,
        ]

  for (const candidate of candidates) {
    const normalizedAmount = normalizeAmountValue(candidate)

    if (normalizedAmount > 0) {
      return normalizedAmount
    }
  }

  return 0
}

function getSettlementItemPaidAmount(row, grossAmount = getSettlementItemGrossAmount(row)) {
  const normalizedPaidAmount = normalizeAmountValue(row?.bill_paid_amount ?? row?.paid_amount)

  if (normalizedPaidAmount > 0) {
    return normalizedPaidAmount
  }

  const normalizedRemainingAmount = normalizeAmountValue(
    row?.bill_remaining_amount ?? row?.remaining_amount
  )

  if (grossAmount > 0 && normalizedRemainingAmount > 0) {
    return Math.max(grossAmount - normalizedRemainingAmount, 0)
  }

  if (grossAmount > 0) {
    return grossAmount
  }

  return 0
}

function getSettlementItemRemainingAmount(
  row,
  grossAmount = getSettlementItemGrossAmount(row),
  paidAmount = getSettlementItemPaidAmount(row, grossAmount)
) {
  const normalizedRemainingAmount = normalizeAmountValue(
    row?.bill_remaining_amount ?? row?.remaining_amount
  )

  if (normalizedRemainingAmount > 0) {
    return normalizedRemainingAmount
  }

  if (grossAmount > 0) {
    return Math.max(grossAmount - paidAmount, 0)
  }

  return 0
}

function getSettlementItemStatusValue(row) {
  return normalizeText(row?.bill_status ?? row?.status, '').toLowerCase()
}

function getSettlementItemDueDateKey(row) {
  return toAppDateKey(row?.bill_due_date ?? row?.due_date ?? null)
}

function getSettlementItemDueDateLabel(row) {
  return formatDateLabel(
    row?.bill_due_date ??
      row?.due_date ??
      row?.sort_at ??
      row?.transaction_date ??
      row?.expense_date ??
      row?.created_at
  )
}

function getSettlementItemSortMs(row) {
  const candidates = [
    row?.bill_due_date,
    row?.due_date,
    row?.sort_at,
    row?.transaction_date,
    row?.expense_date,
    row?.created_at,
    row?.updated_at,
  ]

  for (const candidate of candidates) {
    const parsedTime = new Date(String(candidate ?? '')).getTime()

    if (Number.isFinite(parsedTime)) {
      return parsedTime
    }
  }

  return 0
}

function getSettlementItemStatusMeta(row, fallbackMeta = null) {
  const grossAmount = getSettlementItemGrossAmount(row)
  const remainingAmount = getSettlementItemRemainingAmount(row, grossAmount)
  const paidAmount = getSettlementItemPaidAmount(row, grossAmount)
  const normalizedStatus = getSettlementItemStatusValue(row)

  if (remainingAmount <= 0 || normalizedStatus === 'paid') {
    return {
      key: 'paid',
      label: 'Lunas',
      emoji: '✅',
    }
  }

  if (normalizedStatus === 'partial' || (paidAmount > 0 && remainingAmount > 0)) {
    return {
      key: 'partial',
      label: 'Dicicil',
      emoji: '🟡',
    }
  }

  if (normalizedStatus === 'overdue') {
    return {
      key: 'overdue',
      label: 'Jatuh tempo',
      emoji: '⚠️',
    }
  }

  return (
    fallbackMeta ?? {
      key: 'unpaid',
      label: 'Hutang aktif',
      emoji: '⚠️',
    }
  )
}

function getSettlementBucketStatusKey(row) {
  const statusKey = getSettlementItemStatusMeta(row).key

  return statusKey === 'overdue' ? 'unpaid' : statusKey
}

function getSettlementSourceEmoji(row) {
  const sourceType = normalizeText(row?.source_type, '').toLowerCase()

  if (sourceType === 'project-income') {
    return '💸'
  }

  if (sourceType === 'expense') {
    return '🧾'
  }

  if (sourceType === 'loan-disbursement') {
    return '🏦'
  }

  if (sourceType === 'bill') {
    return isPayrollRow(row) ? '👷' : '📄'
  }

  return '📄'
}

function getSettlementDisplayStatusMeta(row, fallbackMeta = null) {
  const baseMeta = getSettlementItemStatusMeta(row, fallbackMeta)
  const emojiByKey = {
    paid: '✅',
    partial: '🟡',
    overdue: '⚠️',
    unpaid: '⚠️',
  }

  return {
    ...baseMeta,
    emoji: emojiByKey[baseMeta.key] ?? baseMeta.emoji,
  }
}

function buildSummaryQuoteHeader(title, subtitle) {
  const normalizedSubtitle = normalizeText(subtitle, '')
  const lines = [`<b>${escapeTelegramHtml(title)}</b>`]

  if (normalizedSubtitle) {
    lines.push(escapeTelegramHtml(normalizedSubtitle))
  }

  return `<blockquote>${lines.join('\n')}</blockquote>`
}

function buildSummarySectionHeading(title, emoji = '') {
  const headingText = emoji ? `${emoji} ${title}` : title

  return `<b>${escapeTelegramHtml(headingText)}</b>`
}

function buildSummarySection(title, lines = [], emoji = '') {
  const normalizedLines = Array.isArray(lines) ? lines.filter(Boolean) : []

  if (normalizedLines.length === 0) {
    return ''
  }

  return [buildSummarySectionHeading(title, emoji), ...normalizedLines].join('\n')
}

function buildSummaryFooter(text) {
  const normalizedText = normalizeText(text, '')

  return normalizedText ? `<i>${escapeTelegramHtml(normalizedText)}</i>` : ''
}

function buildSummaryBullet(label, value) {
  return `• ${escapeTelegramHtml(label)}: <b>${escapeTelegramHtml(value)}</b>`
}

function buildSettlementItemSummaryHtml(row, index, statusMeta) {
  const sourceLabel = `${getSettlementSourceEmoji(row)} ${escapeTelegramHtml(getRowSourceLabel(row))}`
  const primaryLabel = escapeTelegramHtml(getRowPrimaryLabel(row))
  const secondaryLabel = normalizeText(getRowSecondaryLabel(row), '')
  const amountLabel = formatSummaryMoney(getSettlementItemGrossAmount(row))
  const dateLabel = escapeTelegramHtml(getSettlementItemDueDateLabel(row))
  const resolvedStatusMeta = statusMeta ?? getSettlementDisplayStatusMeta(row)
  const lines = [
    `${index}) <b>${sourceLabel} — ${primaryLabel}</b>`,
  ]

  if (secondaryLabel) {
    lines.push(`   ${escapeTelegramHtml(secondaryLabel)}`)
  }

  lines.push(
    `   <b>${amountLabel}</b> • ${resolvedStatusMeta.emoji} ${escapeTelegramHtml(
      resolvedStatusMeta.label
    )} • ${dateLabel}`
  )

  return lines.join('\n')
}

function buildSettlementBucketState(rows = [], bucketStatus = 'paid') {
  const normalizedRows = Array.isArray(rows) ? rows.filter(Boolean) : []
  const normalizedBucketStatus = normalizeText(bucketStatus, '').toLowerCase()
  const todayKey = getAppTodayKey()
  const weekEndKey = shiftAppDateKey(todayKey, 7)
  const items = normalizedRows.map((row) => {
    const grossAmount = getSettlementItemGrossAmount(row)
    const paidAmount = getSettlementItemPaidAmount(row, grossAmount)
    const remainingAmount = getSettlementItemRemainingAmount(row, grossAmount, paidAmount)
    const dueKey = getSettlementItemDueDateKey(row)

    return {
      row,
      sourceType: normalizeText(row?.source_type, '').toLowerCase(),
      grossAmount,
      paidAmount,
      remainingAmount,
      dueKey,
      sortMs: getSettlementItemSortMs(row),
    }
  })

  const billItems = items.filter((item) => item.sourceType === 'bill')
  const loanItems = items.filter((item) => item.sourceType === 'loan-disbursement')
  const overdueItems = items.filter(
    (item) => item.remainingAmount > 0 && item.dueKey && item.dueKey < todayKey
  )
  const dueThisWeekItems = items.filter(
    (item) =>
      item.remainingAmount > 0 &&
      item.dueKey &&
      item.dueKey >= todayKey &&
      item.dueKey <= weekEndKey
  )
  const nearestDueItem =
    [...items]
      .filter((item) => item.remainingAmount > 0 && item.dueKey)
      .sort((left, right) => {
        const dueComparison = left.dueKey.localeCompare(right.dueKey)

        if (dueComparison !== 0) {
          return dueComparison
        }

        const remainingComparison = right.remainingAmount - left.remainingAmount

        if (remainingComparison !== 0) {
          return remainingComparison
        }

        return right.sortMs - left.sortMs
      })[0] ?? null

  const bucketMode =
    normalizedBucketStatus === 'unpaid' && (overdueItems.length > 0 || dueThisWeekItems.length > 0)
      ? 'overdue'
      : normalizedBucketStatus

  const statusMeta =
    bucketMode === 'paid'
      ? {
          key: 'paid',
          label: 'Lunas',
          emoji: '✅',
          subtitle: 'Semua item pada bucket ini sudah selesai dibayar.',
        }
      : bucketMode === 'partial'
        ? {
            key: 'partial',
            label: 'Dicicil',
            emoji: '🟡',
            subtitle: 'Item berikut masih berjalan dalam skema cicilan.',
          }
        : bucketMode === 'overdue'
          ? {
              key: 'overdue',
              label: 'Jatuh tempo',
              emoji: '⚠️',
              subtitle: 'Prioritaskan item yang sudah dekat atau lewat jatuh tempo.',
            }
          : {
              key: 'unpaid',
              label: 'Hutang aktif',
              emoji: '⚠️',
              subtitle: 'Masih ada kewajiban yang perlu diselesaikan.',
            }

  const sortedItems = [...items].sort((left, right) => {
    if (statusMeta.key === 'paid') {
      return right.sortMs - left.sortMs
    }

    if (statusMeta.key === 'partial') {
      const leftDueKey = left.dueKey ?? '9999-12-31'
      const rightDueKey = right.dueKey ?? '9999-12-31'
      const dueComparison = leftDueKey.localeCompare(rightDueKey)

      if (dueComparison !== 0) {
        return dueComparison
      }

      const remainingComparison = right.remainingAmount - left.remainingAmount

      if (remainingComparison !== 0) {
        return remainingComparison
      }

      return right.sortMs - left.sortMs
    }

    const leftPriority = left.remainingAmount > 0 && left.dueKey && left.dueKey < todayKey ? 0 : 1
    const rightPriority = right.remainingAmount > 0 && right.dueKey && right.dueKey < todayKey ? 0 : 1

    if (leftPriority !== rightPriority) {
      return leftPriority - rightPriority
    }

    const leftDueKey = left.dueKey ?? '9999-12-31'
    const rightDueKey = right.dueKey ?? '9999-12-31'
    const dueComparison = leftDueKey.localeCompare(rightDueKey)

    if (dueComparison !== 0) {
      return dueComparison
    }

    const remainingComparison = right.remainingAmount - left.remainingAmount

    if (remainingComparison !== 0) {
      return remainingComparison
    }

    return right.sortMs - left.sortMs
  })

  const totalItem = items.length
  const totalGrossAmount = items.reduce((sum, item) => sum + item.grossAmount, 0)
  const totalPaidAmount = items.reduce((sum, item) => sum + item.paidAmount, 0)
  const totalRemainingAmount = items.reduce((sum, item) => sum + item.remainingAmount, 0)
  const billGrossAmount = billItems.reduce((sum, item) => sum + item.grossAmount, 0)
  const billPaidAmount = billItems.reduce((sum, item) => sum + item.paidAmount, 0)
  const billRemainingAmount = billItems.reduce((sum, item) => sum + item.remainingAmount, 0)
  const loanGrossAmount = loanItems.reduce((sum, item) => sum + item.grossAmount, 0)
  const loanPaidAmount = loanItems.reduce((sum, item) => sum + item.paidAmount, 0)
  const loanRemainingAmount = loanItems.reduce((sum, item) => sum + item.remainingAmount, 0)

  return {
    bucketMode: statusMeta.key,
    statusMeta,
    items,
    sortedItems,
    totalItem,
    totalGrossAmount,
    totalPaidAmount,
    totalRemainingAmount,
    billItems,
    billGrossAmount,
    billPaidAmount,
    billRemainingAmount,
    loanItems,
    loanGrossAmount,
    loanPaidAmount,
    loanRemainingAmount,
    overdueItems,
    dueThisWeekItems,
    nearestDueItem,
  }
}

function buildSettlementSummaryHighlights(sortedItems = [], limit = 3) {
  const normalizedLimit = Number.isFinite(Number(limit)) ? Math.max(Math.trunc(Number(limit)), 0) : 3
  const highlightItems = Array.isArray(sortedItems) ? sortedItems.slice(0, normalizedLimit) : []

  return {
    lines: highlightItems.map((item, index) =>
      buildSettlementItemSummaryHtml(item.row, index + 1)
    ),
    extraCount: Math.max(0, (Array.isArray(sortedItems) ? sortedItems.length : 0) - normalizedLimit),
  }
}

function buildSettlementSummaryHtmlReply({
  headerTitle,
  headerSubtitle,
  sections = [],
  footerText = '',
  extraFooterText = '',
  emptyStateText = '',
}) {
  const normalizedSections = Array.isArray(sections) ? sections.filter(Boolean) : []
  const parts = [
    buildSummaryQuoteHeader(headerTitle, headerSubtitle),
    ...(normalizedSections.length > 0
      ? normalizedSections
      : emptyStateText
        ? [buildSummaryFooter(emptyStateText)]
        : []),
  ]

  if (extraFooterText) {
    parts.push(buildSummaryFooter(extraFooterText))
  }

  if (footerText) {
    parts.push(buildSummaryFooter(footerText))
  }

  return parts.filter(Boolean).join('\n\n')
}

function getRowSourceLabel(row) {
  const sourceType = normalizeText(row?.source_type, '').toLowerCase()

  if (sourceType === 'project-income') {
    return 'Pemasukan Proyek'
  }

  if (sourceType === 'expense') {
    return 'Pengeluaran'
  }

  if (sourceType === 'loan-disbursement') {
    return 'Pinjaman'
  }

  if (sourceType === 'bill') {
    return isPayrollRow(row) ? 'Tagihan Upah' : 'Tagihan'
  }

  return 'Transaksi'
}

function getRowPrimaryLabel(row) {
  const sourceType = normalizeText(row?.source_type, '').toLowerCase()

  if (sourceType === 'project-income') {
    return (
      normalizeText(row?.project_name_snapshot, null) ??
      normalizeText(row?.description, null) ??
      'Pemasukan proyek'
    )
  }

  if (sourceType === 'expense') {
    return (
      normalizeText(row?.supplier_name_snapshot, null) ??
      normalizeText(row?.description, null) ??
      'Pengeluaran'
    )
  }

  if (sourceType === 'loan-disbursement') {
    return (
      normalizeText(row?.creditor_name_snapshot, null) ??
      normalizeText(row?.description, null) ??
      'Pinjaman'
    )
  }

  if (sourceType === 'bill') {
    return (
      normalizeText(row?.worker_name_snapshot, null) ??
      normalizeText(row?.supplier_name_snapshot, null) ??
      normalizeText(row?.bill_description, null) ??
      normalizeText(row?.description, null) ??
      'Tagihan'
    )
  }

  return normalizeText(row?.description, null) ?? 'Transaksi'
}

function getRowSecondaryLabel(row) {
  const sourceType = normalizeText(row?.source_type, '').toLowerCase()

  if (sourceType === 'project-income') {
    return normalizeText(row?.description, null) ?? normalizeText(row?.bill_description, null)
  }

  if (sourceType === 'expense') {
    return normalizeText(row?.description, null) ?? normalizeText(row?.bill_description, null)
  }

  if (sourceType === 'loan-disbursement') {
    return normalizeText(row?.description, null)
  }

  if (sourceType === 'bill') {
    const parts = [
      normalizeText(row?.bill_type, null),
      formatStatusLabel(row?.bill_status ?? row?.status, row?.bill_remaining_amount ?? row?.remaining_amount),
    ].filter(Boolean)

    return parts.length > 0 ? parts.join(' • ') : normalizeText(row?.bill_description, null)
  }

  return normalizeText(row?.description, null)
}

function isPayrollRow(row) {
  return normalizeText(row?.bill_type, '').toLowerCase() === 'gaji'
}

function isFinanceCoreRow(row) {
  const sourceType = normalizeText(row?.source_type, '').toLowerCase()

  return financeCoreScopes.has(sourceType)
}

function filterRowsByPlan(rows, plan) {
  const normalizedPlan = plan ?? {}
  const exactId = normalizeText(normalizedPlan.search?.exactId, null)
  const searchQuery = normalizeText(normalizedPlan.search?.query, '').toLowerCase()
  const status = normalizeText(normalizedPlan.search?.status, 'any').toLowerCase()
  const kind = normalizeText(normalizedPlan.search?.kind, 'all').toLowerCase()
  const amount = normalizeAmountValue(normalizedPlan.search?.amount)
  const dateFrom = normalizeText(normalizedPlan.search?.dateFrom, null)
  const dateTo = normalizeText(normalizedPlan.search?.dateTo, null)

  let filteredRows = [...(rows ?? [])]
    .filter((row) => row && isFinanceCoreRow(row))

  if (kind === 'loan') {
    filteredRows = filteredRows.filter(
      (row) => normalizeText(row?.source_type, '').toLowerCase() === 'loan-disbursement'
    )
  } else if (kind === 'bill') {
    filteredRows = filteredRows.filter((row) => normalizeText(row?.bill_id, null))
  } else if (kind === 'transaction') {
    filteredRows = filteredRows.filter((row) =>
      ['project-income', 'expense', 'loan-disbursement'].includes(
        normalizeText(row?.source_type, '').toLowerCase()
      )
    )
  }

  if (status !== 'any') {
    filteredRows = filteredRows.filter((row) => getSettlementBucketStatusKey(row) === status)
  }

  if (amount > 0) {
    filteredRows = filteredRows.filter((row) => {
      const candidates = [
        normalizeAmountValue(row?.amount),
        normalizeAmountValue(row?.bill_amount),
        normalizeAmountValue(row?.bill_remaining_amount),
      ]

      return candidates.some((candidate) => Math.abs(candidate - amount) < 0.01)
    })
  }

  if (dateFrom || dateTo) {
    filteredRows = filteredRows.filter((row) => {
      const dateKey = normalizeRecordDateValue(row)

      if (!dateKey) {
        return false
      }

      if (dateFrom && dateKey < dateFrom) {
        return false
      }

      if (dateTo && dateKey > dateTo) {
        return false
      }

      return true
    })
  }

  if (exactId) {
    filteredRows = filteredRows.filter((row) => {
      const rowId = normalizeText(row?.id, '').toLowerCase()
      const billId = normalizeText(row?.bill_id, '').toLowerCase()

      return rowId === exactId || billId === exactId
    })
  }

  if (searchQuery) {
    const queryTerms = searchQuery
      .split(/\s+/)
      .map((term) => normalizeText(term, '').toLowerCase())
      .filter(Boolean)

    filteredRows = filteredRows.filter((row) => {
      const haystack = normalizeText(row?.search_text, '').toLowerCase()

      return queryTerms.every((term) => haystack.includes(term))
    })
  }

  return filteredRows
}

async function loadWorkspaceRows(adminClient, teamId, plan, { limit = 12, outstandingOnly = false } = {}) {
  const normalizedTeamId = normalizeTelegramId(teamId)
  const searchQuery = normalizeText(plan?.search?.query, '').toLowerCase()
  const exactId = normalizeText(plan?.search?.exactId, null)
  const normalizedLimit = Number.isFinite(Number(limit))
    ? Math.min(Math.max(Number(limit), 1), 100)
    : 12

  let query = adminClient
    .from('vw_workspace_transactions')
    .select(assistantSelectColumns)
    .eq('team_id', normalizedTeamId)

  if (outstandingOnly) {
    query = query.gt('bill_remaining_amount', 0)
  }

  if (exactId) {
    query = query.or(`id.eq.${exactId},bill_id.eq.${exactId}`)
  } else if (searchQuery) {
    query = query.ilike('search_text', `%${searchQuery}%`)
  }

  query = query.order('sort_at', { ascending: false }).limit(normalizedLimit)

  const { data, error } = await query

  if (error) {
    throw error
  }

  return filterRowsByPlan(data ?? [], plan)
}

function scoreAnalyticsEntityMatch(candidateName, searchQuery) {
  const normalizedCandidate = normalizeText(candidateName, '').toLowerCase()
  const normalizedQuery = normalizeText(searchQuery, '').toLowerCase()

  if (!normalizedCandidate || !normalizedQuery) {
    return 0
  }

  if (normalizedCandidate === normalizedQuery) {
    return 100
  }

  if (normalizedCandidate.startsWith(normalizedQuery)) {
    return 90
  }

  if (normalizedCandidate.includes(normalizedQuery)) {
    return 80
  }

  if (normalizedQuery.includes(normalizedCandidate)) {
    return 70
  }

  const candidateTokens = normalizedCandidate.split(/\s+/).filter(Boolean)
  const queryTokens = normalizedQuery.split(/\s+/).filter(Boolean)
  const overlapCount = candidateTokens.filter((token) => queryTokens.includes(token)).length

  return overlapCount > 0 ? 60 + overlapCount : 0
}

function getAnalyticsEntityLabel(entityType, language = 'id') {
  const normalizedEntityType = normalizeText(entityType, '').toLowerCase()
  const locale = getLocaleTemplate(language)
  const labelMap = {
    id: {
      supplier: 'supplier',
      worker: 'worker',
      creditor: 'kreditur',
    },
    su: {
      supplier: 'supplier',
      worker: 'worker',
      creditor: 'kreditur',
    },
  }

  return labelMap[locale]?.[normalizedEntityType] ?? normalizedEntityType
}

async function loadAnalyticsEntityCandidates(adminClient, teamId, entityQuery) {
  const normalizedTeamId = normalizeTelegramId(teamId)
  const normalizedQuery = normalizeText(entityQuery, '').toLowerCase()

  if (!normalizedQuery) {
    return {
      workers: [],
      suppliers: [],
      creditors: [],
    }
  }

  const [workersResult, suppliersResult, creditorsResult] = await Promise.all([
    adminClient
      .from('workers')
      .select('id, name, worker_name, team_id, deleted_at, is_active')
      .eq('team_id', normalizedTeamId)
      .eq('is_active', true)
      .is('deleted_at', null)
      .ilike('name', `%${normalizedQuery}%`)
      .limit(10),
    adminClient
      .from('suppliers')
      .select('id, name, supplier_name, team_id, deleted_at, is_active')
      .eq('team_id', normalizedTeamId)
      .eq('is_active', true)
      .is('deleted_at', null)
      .ilike('name', `%${normalizedQuery}%`)
      .limit(10),
    adminClient
      .from('funding_creditors')
      .select('id, name, creditor_name, team_id, deleted_at, is_active')
      .eq('team_id', normalizedTeamId)
      .eq('is_active', true)
      .is('deleted_at', null)
      .ilike('name', `%${normalizedQuery}%`)
      .limit(10),
  ])

  if (workersResult.error) {
    throw workersResult.error
  }

  if (suppliersResult.error) {
    throw suppliersResult.error
  }

  if (creditorsResult.error) {
    throw creditorsResult.error
  }

  const workers = (workersResult.data ?? []).map((row) => ({
    ...row,
    entityType: 'worker',
    entityName: normalizeText(row?.worker_name ?? row?.name, null),
    score: scoreAnalyticsEntityMatch(row?.worker_name ?? row?.name, normalizedQuery),
  }))
  const suppliers = (suppliersResult.data ?? []).map((row) => ({
    ...row,
    entityType: 'supplier',
    entityName: normalizeText(row?.supplier_name ?? row?.name, null),
    score: scoreAnalyticsEntityMatch(row?.supplier_name ?? row?.name, normalizedQuery),
  }))
  const creditors = (creditorsResult.data ?? []).map((row) => ({
    ...row,
    entityType: 'creditor',
    entityName: normalizeText(row?.creditor_name ?? row?.name, null),
    score: scoreAnalyticsEntityMatch(row?.creditor_name ?? row?.name, normalizedQuery),
  }))

  return {
    workers,
    suppliers,
    creditors,
  }
}

function chooseAnalyticsEntitySelection({
  explicitEntityType = null,
  entityQuery = null,
  candidateRows = {},
} = {}) {
  const normalizedExplicitType = normalizeText(explicitEntityType, '').toLowerCase()
  const normalizedQuery = normalizeText(entityQuery, '').toLowerCase()
  const typeEntries = [
    ['worker', candidateRows.workers ?? []],
    ['supplier', candidateRows.suppliers ?? []],
    ['creditor', candidateRows.creditors ?? []],
  ]

  const bestPerType = typeEntries
    .map(([entityType, rows]) => {
      const bestRow = [...rows].sort((left, right) => Number(right.score ?? 0) - Number(left.score ?? 0))[0] ?? null

      return {
        entityType,
        row: bestRow,
        score: Number(bestRow?.score ?? 0),
      }
    })
    .filter((candidate) => candidate.row || candidate.score > 0)

  if (normalizedExplicitType) {
    const explicitCandidate = bestPerType.find((candidate) => candidate.entityType === normalizedExplicitType)

    if (explicitCandidate?.row) {
      return {
        entityType: normalizedExplicitType,
        entityName: explicitCandidate.row.entityName,
        entityId: explicitCandidate.row.id,
        entityConfidence: Math.max(0.8, Math.min(0.99, explicitCandidate.score / 100)),
        candidateTypes: [normalizedExplicitType],
        needsClarification: false,
      }
    }

    return {
      entityType: normalizedExplicitType,
      entityName: normalizedQuery || null,
      entityId: null,
      entityConfidence: 0.7,
      candidateTypes: [normalizedExplicitType],
      needsClarification: false,
    }
  }

  if (bestPerType.length === 0) {
    return {
      entityType: null,
      entityName: normalizedQuery || null,
      entityId: null,
      entityConfidence: 0,
      candidateTypes: [],
      needsClarification: Boolean(normalizedQuery),
      clarificationCode: normalizedQuery ? 'analytics_entity' : null,
    }
  }

  const sortedCandidates = [...bestPerType].sort((left, right) => right.score - left.score)
  const topCandidate = sortedCandidates[0] ?? null
  const secondCandidate = sortedCandidates[1] ?? null

  if (
    topCandidate &&
    secondCandidate &&
    topCandidate.score === secondCandidate.score &&
    topCandidate.score > 0
  ) {
    return {
      entityType: null,
      entityName: normalizedQuery || null,
      entityId: null,
      entityConfidence: 0.4,
      candidateTypes: sortedCandidates
        .filter((candidate) => candidate.score === topCandidate.score)
        .map((candidate) => candidate.entityType),
      needsClarification: true,
      clarificationCode: 'analytics_entity',
    }
  }

  return {
    entityType: topCandidate?.entityType ?? null,
    entityName: topCandidate?.row?.entityName ?? (normalizedQuery || null),
    entityId: topCandidate?.row?.id ?? null,
    entityConfidence: topCandidate ? Math.max(0.5, Math.min(0.99, topCandidate.score / 100)) : 0,
    candidateTypes: [topCandidate?.entityType].filter(Boolean),
    needsClarification: false,
  }
}

function groupRowsByAnalyticsEntity(rows = [], entityType = null) {
  const normalizedEntityType = normalizeText(entityType, '').toLowerCase()

  return rows.reduce((groups, row) => {
    const rawName =
      normalizedEntityType === 'creditor'
        ? row?.creditor_name_snapshot
        : normalizedEntityType === 'worker'
          ? row?.worker_name_snapshot
          : row?.supplier_name_snapshot ?? row?.worker_name_snapshot ?? row?.creditor_name_snapshot
    const entityName = normalizeText(rawName, null) ?? normalizeText(row?.description, null) ?? 'Tanpa Nama'
    const groupKey = entityName.toLowerCase()
    const nextGroup =
      groups.get(groupKey) ?? {
        entityName,
        rows: [],
        totalAmount: 0,
      }

    nextGroup.rows.push(row)
    nextGroup.totalAmount += normalizeAmountValue(row?.bill_remaining_amount)
    groups.set(groupKey, nextGroup)

    return groups
  }, new Map())
}

function filterAnalyticsRowsByEntityType(rows = [], entityType = null) {
  const normalizedEntityType = normalizeText(entityType, '').toLowerCase()

  if (normalizedEntityType === 'worker') {
    return rows.filter((row) => Boolean(normalizeText(row?.worker_name_snapshot, null)))
  }

  if (normalizedEntityType === 'supplier') {
    return rows.filter((row) => Boolean(normalizeText(row?.supplier_name_snapshot, null)))
  }

  if (normalizedEntityType === 'creditor') {
    return rows.filter((row) => Boolean(normalizeText(row?.creditor_name_snapshot, null)))
  }

  return rows
}

function formatAnalyticsAttendanceBreakdown(locale, counts = {}) {
  const fullDay = Number(counts.full_day ?? 0)
  const halfDay = Number(counts.half_day ?? 0)
  const overtime = Number(counts.overtime ?? 0)

  const labels = {
    id: {
      full_day: 'Penuh',
      half_day: '½ Hari',
      overtime: 'Lembur',
    },
    su: {
      full_day: 'Penuh',
      half_day: 'Satengah',
      overtime: 'Lembur',
    },
  }

  const localizedLabels = labels[getLocaleTemplate(locale)] ?? labels.id

  return [
    `${localizedLabels.full_day} ${fullDay}`,
    `${localizedLabels.half_day} ${halfDay}`,
    `${localizedLabels.overtime} ${overtime}`,
  ].join(', ')
}

async function buildAnalyticsReply(adminClient, teamId, plan) {
  const locale = getLocaleText(plan?.language)
  const analyticsPlan = plan?.analytics ?? {}
  const metricKey = normalizeText(analyticsPlan?.metricKey, '').toLowerCase()
  const factsBase = {
    metricKey,
    language: normalizeText(plan?.language, 'id'),
    windowKey: normalizeText(analyticsPlan?.windowKey, 'none'),
    entityType: normalizeText(analyticsPlan?.entityType, ''),
    entityQuery: normalizeText(analyticsPlan?.entityQuery, ''),
  }

  if (!metricKey) {
    return {
      text: locale.clarifyAnalyticsMetric,
      buttons: [],
      needsClarification: true,
      facts: {
        ...factsBase,
        needsClarification: true,
        clarificationCode: 'analytics_metric',
      },
    }
  }

  if (analyticsPlan.requiresWindow && normalizeText(analyticsPlan.windowKey, 'none') === 'none') {
    return {
      text: locale.clarifyAnalyticsWindow,
      buttons: [],
      needsClarification: true,
      facts: {
        ...factsBase,
        needsClarification: true,
        clarificationCode: 'analytics_window',
      },
    }
  }

  if (
    analyticsPlan.requiresWindow &&
    (!normalizeText(analyticsPlan.dateFrom, null) || !normalizeText(analyticsPlan.dateTo, null))
  ) {
    return {
      text: locale.clarifyAnalyticsWindow,
      buttons: [],
      needsClarification: true,
      facts: {
        ...factsBase,
        needsClarification: true,
        clarificationCode: 'analytics_window',
      },
    }
  }

  const entityResolution = await chooseAnalyticsEntitySelection({
    explicitEntityType: analyticsPlan.entityType,
    entityQuery: analyticsPlan.entityQuery,
    candidateRows:
      analyticsPlan.entityQuery
        ? await loadAnalyticsEntityCandidates(adminClient, teamId, analyticsPlan.entityQuery)
        : {},
  })

  if (
    (metricKey === 'bill_summary' || metricKey === 'obligation_ranking') &&
    entityResolution.needsClarification &&
    Array.isArray(entityResolution.candidateTypes) &&
    entityResolution.candidateTypes.length > 0
  ) {
    return {
      text: locale.clarifyAnalyticsEntity,
      buttons: [],
      needsClarification: true,
      facts: {
        ...factsBase,
        needsClarification: true,
        clarificationCode: 'analytics_entity',
        candidateTypes: entityResolution.candidateTypes,
      },
    }
  }

  if (
    analyticsRequiresEntity(metricKey) &&
    (entityResolution.needsClarification || !entityResolution.entityType)
  ) {
    return {
      text: locale.clarifyAnalyticsEntity,
      buttons: [],
      needsClarification: true,
      facts: {
        ...factsBase,
        needsClarification: true,
        clarificationCode: 'analytics_entity',
        candidateTypes: entityResolution.candidateTypes ?? [],
      },
    }
  }

  const queryPlan = {
    ...plan,
    search: {
      ...plan.search,
      query: entityResolution.entityName ?? analyticsPlan.entityQuery ?? plan?.search?.query ?? '',
      kind:
        entityResolution.entityType === 'creditor'
          ? 'loan'
          : entityResolution.entityType
            ? 'bill'
            : plan?.search?.kind ?? 'all',
      dateFrom: analyticsPlan.dateFrom ?? plan?.search?.dateFrom ?? null,
      dateTo: analyticsPlan.dateTo ?? plan?.search?.dateTo ?? null,
    },
  }

  if (metricKey === 'cash_outflow') {
    const windowLabel = buildAnalyticsWindowLabel(
      analyticsPlan.windowKey,
      analyticsPlan.dateFrom,
      analyticsPlan.dateTo
    )
    const { data, error } = await adminClient
      .from('vw_cash_mutation')
      .select('transaction_date, type, amount, description, source_table, team_id')
      .eq('team_id', normalizeTelegramId(teamId))
      .eq('type', 'out')
      .gte('transaction_date', analyticsPlan.dateFrom)
      .lte('transaction_date', analyticsPlan.dateTo)
      .order('transaction_date', { ascending: false })

    if (error) {
      throw error
    }

    const totalAmount = (data ?? []).reduce((sum, row) => sum + normalizeAmountValue(row?.amount), 0)

    return {
      text: [
        locale.analyticsIntro(buildAnalyticsWindowLabel(analyticsPlan.windowKey, analyticsPlan.dateFrom, analyticsPlan.dateTo)),
        `• Inti: ${data?.length ?? 0} transaksi`,
        locale.analyticsCashOutflow(windowLabel, formatCurrency(totalAmount)),
        `• Pilih metric lain atau ${locale.quickMenu}.`,
      ].join('\n'),
      buttonRows: buildAnalyticsFollowUpRows(plan?.language, metricKey),
      buttons: [],
      needsClarification: false,
      appendQuickActions: false,
      facts: {
        ...factsBase,
        metricKey,
        windowLabel,
        dateFrom: analyticsPlan.dateFrom,
        dateTo: analyticsPlan.dateTo,
        totalAmount,
        rowCount: (data ?? []).length,
        presentation: 'hybrid_summary',
        tone: 'santai_operasional',
      },
    }
  }

  if (metricKey === 'attendance_present') {
    const windowLabel = buildAnalyticsWindowLabel(
      analyticsPlan.windowKey,
      analyticsPlan.dateFrom,
      analyticsPlan.dateTo
    )
    const { data, error } = await adminClient
      .from('attendance_records')
      .select('attendance_status, attendance_date, team_id')
      .eq('team_id', normalizeTelegramId(teamId))
      .gte('attendance_date', analyticsPlan.dateFrom)
      .lte('attendance_date', analyticsPlan.dateTo)

    if (error) {
      throw error
    }

    const counts = {
      full_day: 0,
      half_day: 0,
      overtime: 0,
      absent: 0,
    }

    for (const row of data ?? []) {
      const attendanceStatus = normalizeText(row?.attendance_status, '').toLowerCase()

      if (Object.hasOwn(counts, attendanceStatus)) {
        counts[attendanceStatus] += 1
      }
    }

    const totalPresent = counts.full_day + counts.half_day + counts.overtime
    const breakdownLabel = formatAnalyticsAttendanceBreakdown(plan?.language, counts)

    return {
      text: [
        locale.analyticsIntro(windowLabel),
        `• Inti: ${totalPresent} pekerja`,
        locale.analyticsAttendance(windowLabel, `${totalPresent} pekerja`, breakdownLabel),
        `• Pilih metric lain atau ${locale.quickMenu}.`,
      ].join('\n'),
      buttonRows: buildAnalyticsFollowUpRows(plan?.language, metricKey),
      buttons: [],
      needsClarification: false,
      appendQuickActions: false,
      facts: {
        ...factsBase,
        metricKey,
        windowLabel,
        dateFrom: analyticsPlan.dateFrom,
        dateTo: analyticsPlan.dateTo,
        totalPresent,
        counts,
        rowCount: (data ?? []).length,
        presentation: 'hybrid_summary',
        tone: 'santai_operasional',
      },
    }
  }

  if (metricKey === 'obligation_ranking') {
    const rowKind =
      entityResolution.entityType === 'creditor'
        ? 'loan'
        : entityResolution.entityType === 'worker' || entityResolution.entityType === 'supplier'
          ? 'bill'
          : null

    const rows = await loadWorkspaceRows(adminClient, teamId, {
      ...queryPlan,
      search: {
        ...queryPlan.search,
        kind: rowKind ?? queryPlan.search.kind ?? 'all',
      },
    }, {
      limit: 50,
      outstandingOnly: true,
    })

    const analyticsRows = filterAnalyticsRowsByEntityType(rows, entityResolution.entityType)
    const groupedRows = groupRowsByAnalyticsEntity(analyticsRows, entityResolution.entityType)
    const rankedRows = [...groupedRows.values()]
      .sort((left, right) => Number(right.totalAmount ?? 0) - Number(left.totalAmount ?? 0))
      .slice(0, 3)

    if (rankedRows.length === 0) {
      const entityLabel = getAnalyticsEntityLabel(
        entityResolution.entityType ?? analyticsPlan.entityType,
        plan?.language
      )

      return {
        text: locale.analyticsRankingEmpty(entityLabel),
        buttonRows: buildAssistantMenuBackRow(plan?.language),
        buttons: [],
        needsClarification: false,
        appendQuickActions: false,
        facts: {
          ...factsBase,
          metricKey,
          entityType: entityResolution.entityType ?? analyticsPlan.entityType ?? null,
          entityLabel,
          rowCount: 0,
          rankedRows: [],
          presentation: 'hybrid_summary',
          tone: 'santai_operasional',
        },
      }
    }

    const entityLabel = getAnalyticsEntityLabel(
      entityResolution.entityType ?? analyticsPlan.entityType,
      plan?.language
    )
    const lines = [
      locale.analyticsIntro(entityLabel),
      `• Inti: ${rankedRows.length} peringkat teratas`,
      locale.analyticsRankingIntro(entityLabel),
      ...rankedRows.map((group, index) =>
        locale.analyticsRankingItem(
          String(index + 1),
          group.entityName,
          formatCurrency(group.totalAmount)
        )
      ),
    ]

    if (groupedRows.size > rankedRows.length) {
      lines.push(locale.analyticsMoreRanking(groupedRows.size - rankedRows.length))
    }

    lines.push(`• Pilih metric lain atau ${locale.quickMenu}.`)

    return {
      text: lines.join('\n'),
      buttonRows: buildAnalyticsFollowUpRows(plan?.language, metricKey),
      buttons: [],
      needsClarification: false,
      appendQuickActions: false,
      facts: {
        ...factsBase,
        metricKey,
        entityType: entityResolution.entityType ?? analyticsPlan.entityType ?? null,
        entityLabel,
        rowCount: analyticsRows.length,
        rankedRows: rankedRows.map((group, index) => ({
          rank: index + 1,
          entityName: group.entityName,
          totalAmount: group.totalAmount,
        })),
        presentation: 'hybrid_summary',
        tone: 'santai_operasional',
      },
    }
  }

  const resolvedEntityType = entityResolution.entityType ?? analyticsPlan.entityType ?? null
  const kind =
    resolvedEntityType === 'creditor'
      ? 'loan'
      : resolvedEntityType === 'worker' || resolvedEntityType === 'supplier'
        ? 'bill'
        : 'all'
  const rows = await loadWorkspaceRows(adminClient, teamId, {
    ...queryPlan,
    search: {
      ...queryPlan.search,
      kind,
      query: entityResolution.entityName ?? analyticsPlan.entityQuery ?? queryPlan.search.query ?? '',
      dateFrom: analyticsPlan.dateFrom ?? queryPlan.search.dateFrom ?? null,
      dateTo: analyticsPlan.dateTo ?? queryPlan.search.dateTo ?? null,
    },
  }, {
    limit: 50,
    outstandingOnly: true,
  })
  const analyticsRows = filterAnalyticsRowsByEntityType(rows, resolvedEntityType)
  const groupedRows = groupOutstandingRows(analyticsRows)
  const totalBillRemaining = groupedRows.bills.reduce(
    (sum, row) => sum + normalizeAmountValue(row?.bill_remaining_amount),
    0
  )
  const totalLoanRemaining = groupedRows.loans.reduce(
    (sum, row) => sum + normalizeAmountValue(row?.bill_remaining_amount),
    0
  )
  const introLabel =
    entityResolution.entityName ?? 
    analyticsPlan.entityQuery ?? 
    getAnalyticsEntityLabel(resolvedEntityType, plan?.language) ??
    null
  const lines = [locale.analyticsIntro(introLabel)]
  lines.push(`• Inti: ${analyticsRows.length} item`)

  if (groupedRows.bills.length > 0) {
    lines.push(
      locale.analyticsTotalBills(groupedRows.bills.length, formatCurrency(totalBillRemaining))
    )
  }

  if (groupedRows.loans.length > 0) {
    lines.push(
      locale.analyticsTotalLoans(groupedRows.loans.length, formatCurrency(totalLoanRemaining))
    )
  }

  if (groupedRows.bills.length === 0 && groupedRows.loans.length === 0) {
    return {
      text: locale.analyticsNoData(introLabel ?? 'data tagihan'),
      buttonRows: buildAssistantMenuBackRow(plan?.language),
      buttons: [],
      needsClarification: false,
      appendQuickActions: false,
      facts: {
        ...factsBase,
        metricKey,
        entityType: resolvedEntityType,
        entityLabel: introLabel,
        rowCount: 0,
        groupedRows: {
          bills: 0,
          loans: 0,
        },
        presentation: 'hybrid_summary',
        tone: 'santai_operasional',
      },
    }
  }

  lines.push(`• Pilih metric lain atau ${locale.quickMenu}.`)

  return {
    text: lines.join('\n'),
    buttonRows: buildAnalyticsFollowUpRows(plan?.language, metricKey),
    buttons: [],
    needsClarification: false,
    appendQuickActions: false,
    facts: {
      ...factsBase,
      metricKey,
      entityType: resolvedEntityType,
      entityLabel: introLabel,
      rowCount: analyticsRows.length,
      groupedRows: {
        bills: groupedRows.bills.length,
        loans: groupedRows.loans.length,
      },
      totals: {
        billRemainingAmount: totalBillRemaining,
        loanRemainingAmount: totalLoanRemaining,
      },
      presentation: 'hybrid_summary',
      tone: 'santai_operasional',
    },
  }
}

function buildRouteForRow(row, plan = {}) {
  const explicitTarget = normalizeAssistantRoutePath(plan?.targetPath)

  if (explicitTarget) {
    return explicitTarget
  }

  const sourceType = normalizeText(row?.source_type, '').toLowerCase()
  const queryText = normalizeText(plan?.search?.query, '').toLowerCase()
  const wantsPaymentSurface = /\b(tagihan|pembayaran|payment|bayar|lunas|partial|sisa)\b/.test(
    queryText
  )

  if (sourceType === 'loan-disbursement') {
    return `/loan-payment/${row.id}`
  }

  if (normalizeText(row?.bill_id, null) && normalizeAmountValue(row?.bill_remaining_amount) > 0) {
    if (wantsPaymentSurface || normalizeText(plan?.intent, '') === 'status') {
      return `/payment/${row.bill_id}`
    }
  }

  return `/transactions/${row.id}`
}

function buildRowFactItem(row, plan, index = 0) {
  const routePath = buildRouteForRow(row, plan)
  const grossAmount = getSettlementItemGrossAmount(row)
  const remainingAmount = getSettlementItemRemainingAmount(row, grossAmount)

  return {
    index: index + 1,
    sourceLabel: getRowSourceLabel(row),
    primaryLabel: getRowPrimaryLabel(row),
    secondaryLabel: getRowSecondaryLabel(row),
    amountLabel: formatCurrency(grossAmount),
    remainingLabel: formatStatusLabel(getSettlementItemStatusValue(row), remainingAmount),
    routePath,
    routeLabel:
      routePath.startsWith('/payment') || routePath.startsWith('/loan-payment')
        ? 'payment'
        : routePath.startsWith('/payroll')
          ? 'payroll'
          : 'detail',
  }
}

function buildRowSummary(row) {
  const sourceLabel = getRowSourceLabel(row)
  const primaryLabel = getRowPrimaryLabel(row)
  const secondaryLabel = getRowSecondaryLabel(row)
  const grossAmount = getSettlementItemGrossAmount(row)
  const remainingAmount = getSettlementItemRemainingAmount(row, grossAmount)
  const amountLabel = formatCurrency(grossAmount)
  const remainingLabel = formatStatusLabel(getSettlementItemStatusValue(row), remainingAmount)
  const dateLabel = formatDateLabel(row?.sort_at ?? row?.transaction_date ?? row?.expense_date ?? row?.due_date ?? row?.created_at)

  const lines = [
    `${sourceLabel} — ${primaryLabel}`,
    secondaryLabel ? `• ${secondaryLabel}` : null,
    `• ${amountLabel}`,
    `• ${remainingLabel}`,
    `• ${dateLabel}`,
  ].filter(Boolean)

  return lines.join('\n')
}

function buildSearchReply(rows, plan) {
  const locale = getLocaleText(plan?.language)
  const routeButtons = []
  const lines = []
  const queryLabel = normalizeText(plan?.search?.query, '')
  const facts = {
    queryLabel,
    rowCount: rows.length,
    items: rows.slice(0, 3).map((row, index) => buildRowFactItem(row, plan, index)),
    extraCount: Math.max(0, rows.length - 3),
  }

  if (rows.length === 0) {
    return {
      text: locale.noResultSearch(queryLabel),
      buttons: [],
      needsClarification: true,
      facts: {
        ...facts,
        empty: true,
      },
    }
  }

  lines.push(locale.searchIntro(queryLabel, rows.length))

  rows.slice(0, 3).forEach((row, index) => {
    const path = buildRouteForRow(row, plan)
    const buttonLabel =
      path.startsWith('/payment') || path.startsWith('/loan-payment')
        ? locale.actionPayment
        : locale.actionDetail

    routeButtons.push({
      text: buttonLabel,
      path,
    })

    lines.push(`${index + 1}. ${buildRowSummary(row).replaceAll('\n', ' ')}`)
  })

  if (rows.length > 3) {
    lines.push(locale.searchMore(rows.length - 3))
  }

  return {
    text: lines.join('\n'),
    buttons: routeButtons,
    needsClarification: false,
    facts,
  }
}

function groupOutstandingRows(rows) {
  return rows.reduce(
    (groups, row) => {
      const sourceType = normalizeText(row?.source_type, '').toLowerCase()

      if (sourceType === 'loan-disbursement') {
        groups.loans.push(row)
      } else {
        groups.bills.push(row)
      }

      return groups
    },
    {
      bills: [],
      loans: [],
    }
  )
}

function buildStatusReply(rows, plan) {
  const locale = getLocaleText(plan?.language)
  const queryLabel = normalizeText(plan?.search?.query, '')
  const normalizedStatus = normalizeText(plan?.search?.status, 'any').toLowerCase()
  const groupedRows = groupOutstandingRows(rows)
  const state = buildSettlementBucketState(
    rows,
    normalizedStatus === 'any' ? 'paid' : normalizedStatus
  )
  const summaryRows = buildSettlementBucketSummaryRows(rows)
  const highlights = buildSettlementSummaryHighlights(state.sortedItems, 3)
  const facts = {
    queryLabel,
    status: normalizedStatus,
    rowCount: rows.length,
    billCount: groupedRows.bills.length,
    loanCount: groupedRows.loans.length,
    billRemainingAmount: state.billRemainingAmount,
    loanRemainingAmount: state.loanRemainingAmount,
    summaryItems: highlights.lines.map((line) => line.replaceAll('\n', ' ')),
    presentation: 'html_summary',
    tone: 'santai_operasional',
  }

  if (groupedRows.bills.length === 0 && groupedRows.loans.length === 0) {
    return {
      text: buildSettlementSummaryHtmlReply({
        headerTitle: '📚 SUMMARY SEMUA DATA',
        headerSubtitle: queryLabel
          ? `Tidak ada tagihan atau pinjaman outstanding yang cocok untuk "${queryLabel}".`
          : 'Belum ada tagihan atau pinjaman outstanding yang bisa dirangkum.',
        emptyStateText: 'Buka Jurnal untuk melihat riwayat lengkap.',
        footerText: `Pilih bucket lain atau ${locale.quickMenu}.`,
      }),
      buttonRows: buildAssistantMenuBackRow(plan?.language),
      buttons: [],
      needsClarification: false,
      appendQuickActions: false,
      parseMode: 'HTML',
      facts: {
        ...facts,
        empty: true,
      },
    }
  }

  if (normalizedStatus !== 'any') {
    return buildSettlementBucketDetailReply(plan?.language, rows, 'status', normalizedStatus)
  }

  const ringkasanLines = [
    buildSummaryBullet('Total item', String(state.totalItem)),
    buildSummaryBullet('Total nilai', formatSummaryMoney(state.totalGrossAmount)),
    buildSummaryBullet('Total lunas', formatSummaryMoney(state.totalPaidAmount)),
    buildSummaryBullet('Sisa hutang', formatSummaryMoney(state.totalRemainingAmount)),
  ]

  if (state.billItems.length > 0) {
    ringkasanLines.push(buildSummaryBullet('Tagihan', `${state.billItems.length} item`))
  }

  if (state.loanItems.length > 0) {
    ringkasanLines.push(buildSummaryBullet('Pinjaman', `${state.loanItems.length} item`))
  }

  const statusLines = summaryRows
    .filter((bucket) => bucket.totalCount > 0)
    .map((bucket) => buildSummaryBullet(bucket.label, `${bucket.totalCount} item`))

  const sections = [
    buildSummarySection('Ringkasan', ringkasanLines, '📌'),
    buildSummarySection('Status', statusLines, '🧾'),
    highlights.lines.length > 0 ? buildSummarySection('Sorotan', highlights.lines, '⭐') : '',
  ].filter(Boolean)

  const extraFooterText =
    highlights.extraCount > 0 ? `+${highlights.extraCount} item lainnya tidak ditampilkan.` : ''

  return {
    text: buildSettlementSummaryHtmlReply({
      headerTitle: '📚 SUMMARY SEMUA DATA',
      headerSubtitle: queryLabel
        ? `Ringkasan untuk "${queryLabel}".`
        : 'Ringkasan semua data tagihan dan pinjaman pada workspace ini.',
      sections,
      extraFooterText,
      footerText: `Pilih bucket lain atau ${locale.quickMenu}.`,
    }),
    buttonRows: buildAssistantMenuBackRow(plan?.language),
    buttons: [],
    needsClarification: false,
    appendQuickActions: false,
    parseMode: 'HTML',
    facts,
  }
}

function buildNavigateReply(plan) {
  const locale = getLocaleText(plan?.language)
  const path = normalizeAssistantRoutePath(plan?.targetPath) ?? assistantRouteTargets.ledger
  const routeLabel = getAssistantRouteLabel(path)

  return {
    text: locale.navigateIntro(routeLabel),
    buttons: [
      {
        text: locale.openRoute(routeLabel),
        path,
      },
    ],
    needsClarification: false,
    facts: {
      path,
      routeLabel,
    },
  }
}

function buildAssistantDmHandoffReply(
  language = 'id',
  botUsername = getTelegramBotUsername(),
  handoffToken = null
) {
  const locale = getLocaleText(language)
  const dmLink = buildTelegramAssistantChatLink(botUsername, handoffToken)
  const buttonRows = []

  if (dmLink) {
    buttonRows.push([
      {
        text: locale.groupFallbackDmButton,
        url: dmLink,
      },
    ])
  }

  buttonRows.push(...buildAssistantRouteRows(language))

  return {
    text: [locale.groupFallbackIntro, locale.groupFallbackHint].join('\n'),
    buttonRows,
    buttons: [],
    needsClarification: false,
    appendQuickActions: false,
    facts: {
      surface: 'group_dm_handoff',
    },
  }
}

async function sendAssistantDmHandoff({
  adminClient,
  botToken,
  chatId,
  replyToMessageId,
  telegramUserId,
  sessionPayload,
  turnData,
  language,
  teamId = null,
}) {
  const handoffToken = createTelegramAssistantHandoffToken()
  const handoffExpiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString()
  const nextSessionPayload = buildAssistantMemoryPayload(sessionPayload, turnData)
  const dmReply = buildAssistantDmHandoffReply(
    language,
    getTelegramBotUsername(),
    handoffToken
  )

  await saveTelegramAssistantHandoff(adminClient, {
    token: handoffToken,
    sourceChatId: chatId,
    sourceMessageId: replyToMessageId,
    telegramUserId,
    teamId,
    sessionPayload: nextSessionPayload,
    originalText: turnData?.userText,
    language,
    expiresAt: handoffExpiresAt,
  })

  try {
    await saveAssistantSession(adminClient, {
      chatId,
      telegramUserId,
      teamId,
      state: 'idle',
      pendingIntent: null,
      pendingPayload: nextSessionPayload,
      expiresAt: handoffExpiresAt,
    })
  } catch (error) {
    console.warn('[api/telegram-assistant] failed to persist DM handoff session', {
      message: error instanceof Error ? error.message : String(error),
    })
  }

  await sendTelegramMessage({
    botToken,
    chatId,
    text: dmReply.text,
    replyMarkup: buildReplyMarkup(getTelegramBotUsername(), dmReply, {
      language,
    }),
    replyToMessageId,
  })

  return { processed: true }
}

async function sendSettlementBucketSummaryReply({
  adminClient,
  botToken,
  chatId,
  replyToMessageId,
  telegramUserId,
  chatType,
  session,
  selectedMembership,
  sessionPayload,
  language,
  surface,
  bucketStatus,
}) {
  const rows = await loadWorkspaceRows(
    adminClient,
    selectedMembership.team_id,
    { search: {} },
    { limit: 100, outstandingOnly: false }
  )
  const reply = buildSettlementBucketDetailReply(language, rows, surface, bucketStatus)
  const turnData = buildAssistantTurnData({
    text: `${surface} ${bucketStatus}`,
    plan: {
      intent: 'status',
      search: {
        status: bucketStatus,
      },
    },
    language,
    workspaceName: selectedMembership.team_name,
  })
  return sendAssistantHybridSummaryReply({
    adminClient,
    botToken,
    chatId,
    replyToMessageId,
    telegramUserId,
    chatType,
    session,
    sessionPayload,
    selectedMembership,
    plan: {
      intent: 'status',
      language,
      search: {
        status: bucketStatus,
      },
    },
    reply,
    turnData,
  })
}

async function processAssistantStartCommand({
  adminClient,
  botToken,
  chatId,
  replyToMessageId,
  telegramUserId,
  chatType,
  rawText,
  command,
  session,
  memberships,
  forcedMembership = null,
}) {
  if (chatType !== 'private') {
    return { processed: false }
  }

  const fallbackLanguage = getLocaleTemplate(
    session?.pending_payload?.last_language ??
      getAssistantLanguageFromText(command?.args || rawText, session)
  )
  const startToken = normalizeTelegramAssistantHandoffToken(command?.args)

  if (!startToken) {
    return processAssistantCommand({
      adminClient,
      botToken,
      chatId,
      replyToMessageId,
      telegramUserId,
      chatType,
      rawText,
      command: {
        command: 'menu',
        args: '',
      },
      session,
      memberships,
      forcedMembership,
    })
  }

  const handoff = await redeemTelegramAssistantHandoff(adminClient, {
    token: startToken,
    telegramUserId,
    consumedChatId: chatId,
  })

  if (!handoff) {
    await sendTelegramMessage({
      botToken,
      chatId,
      text: getLocaleText(fallbackLanguage).handoffInvalid,
      replyToMessageId,
    })

    return { processed: true }
  }

  const resumedMembership = handoff.team_id
    ? memberships.find((membership) => membership.team_id === handoff.team_id) ?? null
    : forcedMembership ??
      memberships.find((membership) => membership.is_default) ??
      memberships[0] ??
      null

  if (!resumedMembership) {
    await sendTelegramMessage({
      botToken,
      chatId,
      text: getLocaleText(handoff.language).membershipMissing,
      replyToMessageId,
    })

    return { processed: true }
  }

  const resumedSession = {
    chat_id: chatId,
    telegram_user_id: telegramUserId,
    team_id: handoff.team_id ?? resumedMembership.team_id ?? null,
    state: 'idle',
    pending_payload: handoff.session_payload ?? {},
    expires_at: handoff.expires_at ?? null,
  }
  const originalText = normalizeText(handoff.original_text, '')

  if (!originalText) {
    await sendTelegramMessage({
      botToken,
      chatId,
      text: getLocaleText(handoff.language).handoffInvalid,
      replyToMessageId,
    })

    return { processed: true }
  }

  return processTelegramMessage({
    adminClient,
    botToken,
    chatId,
    replyToMessageId,
    telegramUserId,
    chatType: 'private',
    messageText: originalText,
    session: resumedSession,
    memberships,
    forcedMembership: resumedMembership,
    forcedOriginalText: originalText,
  })
}

function buildRefusalReply(language = 'id') {
  const locale = getLocaleText(language)

  return {
    text: locale.refusal,
    buttons: [],
    needsClarification: false,
    facts: {
      reason: locale.refusal,
    },
  }
}

function buildClarifyReply(plan) {
  const locale = getLocaleText(plan?.language)
  const normalizedClarificationCode = normalizeText(plan?.clarificationCode, '')
  const clarificationCode = normalizedClarificationCode === 'followup_context'
    ? 'clarifyFollowUp'
    : normalizedClarificationCode === 'analytics_metric'
      ? 'clarifyAnalyticsMetric'
      : normalizedClarificationCode === 'analytics_entity'
        ? 'clarifyAnalyticsEntity'
        : normalizedClarificationCode === 'analytics_window'
          ? 'clarifyAnalyticsWindow'
          : 'clarifySpecific'

  return {
    text: locale[clarificationCode] ?? locale.clarifySpecific,
    buttons: [],
    needsClarification: true,
    facts: {
      clarificationCode: normalizedClarificationCode || 'specific_filter',
      question: locale[clarificationCode] ?? locale.clarifySpecific,
    },
  }
}

function buildAssistantCallbackData(prefix, value) {
  const normalizedPrefix = normalizeText(prefix, '')
  const normalizedValue = normalizeText(value, '')

  return normalizedPrefix && normalizedValue ? `${normalizedPrefix}${normalizedValue}` : ''
}

function buildAssistantQuickActionRows(language = 'id') {
  const locale = getLocaleText(language)

  return [
    [
      {
        text: locale.quickStatus,
        callbackData: buildAssistantCallbackData(assistantCallbackPrefixes.command, 'status'),
      },
    ],
    [
      {
        text: locale.quickMenu,
        callbackData: buildAssistantCallbackData(assistantCallbackPrefixes.command, 'menu'),
      },
    ],
  ]
}

function buildAssistantMenuBackRow(language = 'id') {
  const locale = getLocaleText(language)

  return [
    [
      {
        text: locale.quickMenu,
        callbackData: buildAssistantCallbackData(assistantCallbackPrefixes.command, 'menu'),
      },
    ],
  ]
}

function buildAssistantMainMenuKeyboardRows(language = 'id') {
  const locale = getLocaleText(language)

  return [
    [
      {
        text: locale.quickAdd,
      },
      {
        text: locale.quickOpen,
      },
    ],
    [
      {
        text: locale.quickStatus,
      },
      {
        text: locale.quickMenu,
      },
    ],
  ]
}

function buildAssistantMainMenuReplyMarkup(language = 'id') {
  const locale = getLocaleText(language)

  return {
    keyboard: buildAssistantMainMenuKeyboardRows(language),
    resize_keyboard: true,
    is_persistent: true,
    input_field_placeholder: locale.menuIntro,
  }
}

function buildAssistantTopLevelActionRows(language = 'id') {
  const locale = getLocaleText(language)

  return [
    [
      {
        text: locale.quickAdd,
        callbackData: buildAssistantCallbackData(assistantCallbackPrefixes.command, 'tambah'),
      },
      {
        text: locale.quickOpen,
        callbackData: buildAssistantCallbackData(assistantCallbackPrefixes.command, 'buka'),
      },
    ],
    [
      {
        text: locale.quickStatus,
        callbackData: buildAssistantCallbackData(assistantCallbackPrefixes.command, 'status'),
      },
      {
        text: locale.quickMenu,
        callbackData: buildAssistantCallbackData(assistantCallbackPrefixes.command, 'menu'),
      },
    ],
  ]
}

function buildAssistantRouteRows(language = 'id') {
  const locale = getLocaleText(language)

  return [
    [
      {
        text: locale.openRoute(getAssistantRouteLabel(assistantRouteTargets.dashboard)),
        path: assistantRouteTargets.dashboard,
      },
      {
        text: locale.openRoute(getAssistantRouteLabel(assistantRouteTargets.ledger)),
        path: assistantRouteTargets.ledger,
      },
    ],
    [
      {
        text: locale.openRoute(getAssistantRouteLabel(assistantRouteTargets.billLedger)),
        path: assistantRouteTargets.billLedger,
      },
      {
        text: locale.openRoute(getAssistantRouteLabel(assistantRouteTargets.payment)),
        path: assistantRouteTargets.payment,
      },
    ],
    [
      {
        text: locale.openRoute(getAssistantRouteLabel(assistantRouteTargets.attendance)),
        path: assistantRouteTargets.attendance,
      },
    ],
    ...buildAssistantMenuBackRow(language),
  ]
}

function buildAssistantCreateRouteRows(language = 'id') {
  const locale = getLocaleText(language)

  return [
    [
      {
        text: locale.addRoute(getAssistantRouteLabel(assistantRouteTargets.incomeCreate)),
        path: assistantRouteTargets.incomeCreate,
      },
      {
        text: locale.addRoute(getAssistantRouteLabel(assistantRouteTargets.expenseCreate)),
        path: assistantRouteTargets.expenseCreate,
      },
    ],
    [
      {
        text: locale.addRoute(getAssistantRouteLabel(assistantRouteTargets.loanCreate)),
        path: assistantRouteTargets.loanCreate,
      },
      {
        text: locale.addRoute(getAssistantRouteLabel(assistantRouteTargets.invoiceCreate)),
        path: assistantRouteTargets.invoiceCreate,
      },
    ],
    [
      {
        text: locale.addRoute(getAssistantRouteLabel(assistantRouteTargets.attendanceCreate)),
        path: assistantRouteTargets.attendanceCreate,
      },
    ],
    ...buildAssistantMenuBackRow(language),
  ]
}

function buildSettlementBucketSummaryRows(rows = []) {
  return assistantStatusBucketRoutes.map((bucket) => {
    const bucketRows = rows.filter((row) => getSettlementBucketStatusKey(row) === bucket.status)
    const financeCount = bucketRows.filter((row) => !isPayrollRow(row)).length
    const payrollCount = bucketRows.filter((row) => isPayrollRow(row)).length

    return {
      ...bucket,
      totalCount: bucketRows.length,
      financeCount,
      payrollCount,
    }
  })
}

function buildSettlementBucketButtonRows(language = 'id', rows = [], surface = 'status') {
  const summaries = buildSettlementBucketSummaryRows(rows)

  return [
    ...summaries.map((bucket) => [
      {
        text: `${bucket.label}${bucket.totalCount > 0 ? ` (${bucket.totalCount})` : ''}`,
        callbackData: buildAssistantCallbackData(
          assistantCallbackPrefixes.settlement,
          `${surface}:${bucket.status}`
        ),
      },
    ]),
    ...buildAssistantMenuBackRow(language),
  ]
}

function buildSettlementBucketReply(language = 'id', rows = [], surface = 'status') {
  const locale = getLocaleText(language)
  const summaries = buildSettlementBucketSummaryRows(rows)
  if (Array.isArray(rows)) {
    const state = buildSettlementBucketState(rows, 'paid')
    const title = surface === 'history' ? '🕘 SUMMARY RIWAYAT' : '📚 SUMMARY SEMUA DATA'
    const subtitle =
      surface === 'history'
        ? 'Pilih bucket untuk melihat ringkasan riwayat yang lebih rinci.'
        : 'Pilih bucket untuk melihat ringkasan status yang lebih rinci.'
    const ringkasanLines = [
      buildSummaryBullet('Total item', String(state.totalItem)),
      buildSummaryBullet('Total nilai', formatSummaryMoney(state.totalGrossAmount)),
      buildSummaryBullet('Total lunas', formatSummaryMoney(state.totalPaidAmount)),
      buildSummaryBullet('Sisa hutang', formatSummaryMoney(state.totalRemainingAmount)),
    ]
    const statusLines = summaries
      .filter((bucket) => bucket.totalCount > 0)
      .map((bucket) => buildSummaryBullet(bucket.label, `${bucket.totalCount} item`))
    const highlights = buildSettlementSummaryHighlights(state.sortedItems, 3)
    const sections = [
      buildSummarySection('Ringkasan', ringkasanLines, '📌'),
      buildSummarySection('Status', statusLines, '🧾'),
      highlights.lines.length > 0 ? buildSummarySection('Sorotan', highlights.lines, '⭐') : '',
    ].filter(Boolean)
    const extraFooterText =
      highlights.extraCount > 0 ? `+${highlights.extraCount} item lainnya tidak ditampilkan.` : ''

    return {
      text: buildSettlementSummaryHtmlReply({
        headerTitle: title,
        headerSubtitle: subtitle,
        sections,
        extraFooterText,
        footerText: `Pilih bucket lain atau ${locale.quickMenu}.`,
      }),
      buttonRows: buildSettlementBucketButtonRows(language, rows, surface),
      buttons: [],
      needsClarification: false,
      appendQuickActions: false,
      parseMode: 'HTML',
      facts: {
        surface,
        rowCount: rows.length,
        buckets: summaries.map((bucket) => ({
          status: bucket.status,
          label: bucket.label,
          totalCount: bucket.totalCount,
          financeCount: bucket.financeCount,
          payrollCount: bucket.payrollCount,
        })),
        presentation: 'html_summary',
        tone: 'santai_operasional',
      },
    }
  }
  const prompt = locale.statusRoutePrompt
  const totalCount = summaries.reduce((sum, bucket) => sum + bucket.totalCount, 0)

  return {
    text: [
      prompt,
      `â€¢ Inti: ${totalCount} item`,
      ...summaries.map((bucket) => {
        const detailParts = [
          `Finance ${bucket.financeCount}`,
          `Payroll ${bucket.payrollCount}`,
        ].filter((item) => !item.endsWith(' 0'))

        return `• ${bucket.label}: ${bucket.totalCount} item${detailParts.length > 0 ? ` (${detailParts.join(', ')})` : ''}`
      }),
      `â€¢ Pilih bucket lain atau ${locale.quickMenu}.`,
    ].join('\n'),
    buttonRows: buildSettlementBucketButtonRows(language, rows, surface),
    buttons: [],
    needsClarification: false,
    appendQuickActions: false,
    facts: {
      surface,
      rowCount: rows.length,
      buckets: summaries.map((bucket) => ({
        status: bucket.status,
        label: bucket.label,
        totalCount: bucket.totalCount,
        financeCount: bucket.financeCount,
        payrollCount: bucket.payrollCount,
      })),
      presentation: 'hybrid_summary',
      tone: 'santai_operasional',
    },
  }
}

function buildSettlementBucketDetailReply(
  language = 'id',
  rows = [],
  surface = 'status',
  bucketStatus = 'paid'
) {
  const normalizedBucketStatus = normalizeText(bucketStatus, '').toLowerCase()
  const bucketConfig =
    assistantStatusBucketRoutes.find((bucket) => bucket.status === normalizedBucketStatus) ??
    assistantStatusBucketRoutes[0]
  const bucketRows = rows.filter((row) => getSettlementBucketStatusKey(row) === bucketConfig.status)
  if (Array.isArray(bucketRows)) {
    const state = buildSettlementBucketState(bucketRows, bucketConfig.status)
    const bucketMode = state.bucketMode
    const titleEmojiByMode = {
      paid: '✅',
      partial: '🟡',
      overdue: '⚠️',
      unpaid: '⚠️',
    }
    const title = `${titleEmojiByMode[bucketMode] ?? '📚'} SUMMARY ${state.statusMeta.label.toUpperCase()}`
    const subtitle = state.statusMeta.subtitle
    const highlights = buildSettlementSummaryHighlights(state.sortedItems, 3)
    const highlightTitle =
      bucketMode === 'paid'
        ? 'Sorotan'
        : bucketMode === 'partial'
          ? 'Cicilan Berjalan'
          : bucketMode === 'overdue'
            ? 'Prioritas Pembayaran'
            : 'Jatuh Tempo Terdekat'
    const ringkasanLines =
      bucketMode === 'paid'
        ? [
            buildSummaryBullet('Total item', String(state.totalItem)),
            buildSummaryBullet('Total nilai lunas', formatSummaryMoney(state.totalPaidAmount)),
            buildSummaryBullet('Tagihan lunas', `${state.billItems.length} item`),
            buildSummaryBullet('Pinjaman lunas', `${state.loanItems.length} item`),
          ]
        : bucketMode === 'partial'
          ? [
              buildSummaryBullet('Total item', String(state.totalItem)),
              buildSummaryBullet('Total nilai', formatSummaryMoney(state.totalGrossAmount)),
              buildSummaryBullet('Sudah dibayar', formatSummaryMoney(state.totalPaidAmount)),
              buildSummaryBullet('Sisa cicilan', formatSummaryMoney(state.totalRemainingAmount)),
            ]
          : [
              buildSummaryBullet('Total item', String(state.totalItem)),
              buildSummaryBullet('Total tagihan', formatSummaryMoney(state.totalGrossAmount)),
              buildSummaryBullet('Sudah dibayar', formatSummaryMoney(state.totalPaidAmount)),
              buildSummaryBullet('Sisa hutang', formatSummaryMoney(state.totalRemainingAmount)),
            ]

    if (bucketMode === 'partial') {
      if (state.billItems.length > 0) {
        ringkasanLines.push(
          buildSummaryBullet('Tagihan dicicil', `${state.billItems.length} item`)
        )
      }

      if (state.loanItems.length > 0) {
        ringkasanLines.push(
          buildSummaryBullet('Pinjaman dicicil', `${state.loanItems.length} item`)
        )
      }
    } else if (bucketMode === 'paid') {
      ringkasanLines.push(
        buildSummaryBullet('Sisa tagihan', formatSummaryMoney(state.billRemainingAmount))
      )
      ringkasanLines.push(
        buildSummaryBullet('Sisa pinjaman', formatSummaryMoney(state.loanRemainingAmount))
      )
    } else {
      if (state.overdueItems.length > 0) {
        ringkasanLines.push(
          buildSummaryBullet('Lewat tempo', `${state.overdueItems.length} item`)
        )
      }

      if (state.dueThisWeekItems.length > 0) {
        ringkasanLines.push(
          buildSummaryBullet('Jatuh tempo minggu ini', `${state.dueThisWeekItems.length} item`)
        )
      }

      if (state.nearestDueItem) {
        ringkasanLines.push(
          buildSummaryBullet(
            'Jatuh tempo terdekat',
            `${getRowPrimaryLabel(state.nearestDueItem.row)} • ${getSettlementItemDueDateLabel(state.nearestDueItem.row)} • ${formatSummaryMoney(state.nearestDueItem.remainingAmount)}`
          )
        )
      }

      ringkasanLines.push(
        buildSummaryBullet('Prioritas pembayaran', 'Lunasi item yang lewat tempo lebih dulu.')
      )
    }

    const statusLines =
      bucketMode === 'paid'
        ? [
            buildSummaryBullet('Sisa tagihan', formatSummaryMoney(state.billRemainingAmount)),
            buildSummaryBullet('Sisa pinjaman', formatSummaryMoney(state.loanRemainingAmount)),
          ]
        : bucketMode === 'partial'
          ? [
              buildSummaryBullet('Tagihan cicil', `${state.billItems.length} item`),
              buildSummaryBullet('Pinjaman cicil', `${state.loanItems.length} item`),
            ]
          : [
              state.overdueItems.length > 0
                ? buildSummaryBullet('Lewat tempo', `${state.overdueItems.length} item`)
                : null,
              state.dueThisWeekItems.length > 0
                ? buildSummaryBullet(
                    'Jatuh tempo minggu ini',
                    `${state.dueThisWeekItems.length} item`
                  )
                : null,
              state.nearestDueItem
                ? buildSummaryBullet(
                    'Jatuh tempo terdekat',
                    `${getRowPrimaryLabel(state.nearestDueItem.row)} • ${getSettlementItemDueDateLabel(state.nearestDueItem.row)} • ${formatSummaryMoney(state.nearestDueItem.remainingAmount)}`
                  )
                : null,
              buildSummaryBullet('Prioritas pembayaran', 'Lunasi item yang lewat tempo lebih dulu.'),
            ].filter(Boolean)

    const sections = [
      buildSummarySection('Ringkasan', ringkasanLines, '📌'),
      buildSummarySection('Status', statusLines, '🧾'),
      highlights.lines.length > 0 ? buildSummarySection(highlightTitle, highlights.lines, '⭐') : '',
    ].filter(Boolean)

    const extraFooterText =
      highlights.extraCount > 0 ? `+${highlights.extraCount} item lainnya tidak ditampilkan.` : ''

    return {
      text: buildSettlementSummaryHtmlReply({
        headerTitle: title,
        headerSubtitle: subtitle,
        sections,
        extraFooterText,
        emptyStateText: 'Belum ada data pada bucket ini.',
        footerText: `Pilih bucket lain atau ${getLocaleText(language).quickMenu}.`,
      }),
      buttonRows: buildSettlementBucketButtonRows(language, rows, surface),
      buttons: [],
      needsClarification: false,
      appendQuickActions: false,
      parseMode: 'HTML',
      facts: {
        surface,
        bucketStatus: bucketConfig.status,
        bucketLabel: bucketConfig.label,
        rowCount: bucketRows.length,
        financeCount: state.billItems.length,
        payrollCount: state.loanItems.length,
        totals: {
          billRemainingAmount: state.billRemainingAmount,
          loanRemainingAmount: state.loanRemainingAmount,
        },
        summaryItems: highlights.lines,
        presentation: 'html_summary',
        tone: 'santai_operasional',
      },
    }
  }
  const groupedRows = groupOutstandingRows(bucketRows)
  const totalBillRemaining = groupedRows.bills.reduce(
    (sum, row) => sum + normalizeAmountValue(row?.bill_remaining_amount),
    0
  )
  const totalLoanRemaining = groupedRows.loans.reduce(
    (sum, row) => sum + normalizeAmountValue(row?.bill_remaining_amount),
    0
  )
  const introLabel = surface === 'history' ? 'Riwayat' : 'Status'
  const summaryItems = bucketRows.slice(0, 3).map((row, index) => {
    const summaryText = buildRowSummary(row).replaceAll('\n', ' ')

    return `${index + 1}. ${summaryText}`
  })
  const lines = [
    `${introLabel} ${bucketConfig.label}:`,
    `• Inti: ${bucketRows.length} item`,
    `• Total item: ${bucketRows.length}`,
  ]

  if (groupedRows.bills.length > 0) {
    lines.push(
      `• Tagihan aktif: ${groupedRows.bills.length} item, sisa ${formatCurrency(totalBillRemaining)}`
    )
  }

  if (groupedRows.loans.length > 0) {
    lines.push(
      `• Pinjaman aktif: ${groupedRows.loans.length} item, sisa ${formatCurrency(totalLoanRemaining)}`
    )
  }

  if (summaryItems.length > 0) {
    lines.push('• Sorotan:')
    lines.push(...summaryItems.map((item) => `  ${item}`))
  } else {
    lines.push('• Tidak ada data pada bucket ini.')
  }

  lines.push(`• Pilih bucket lain atau ${getLocaleText(language).quickMenu}.`)

  return {
    text: lines.join('\n'),
    buttonRows: buildSettlementBucketButtonRows(language, rows, surface),
    buttons: [],
    needsClarification: false,
    appendQuickActions: false,
    facts: {
      surface,
      bucketStatus: bucketConfig.status,
      bucketLabel: bucketConfig.label,
      rowCount: bucketRows.length,
      financeCount: groupedRows.bills.length,
      payrollCount: groupedRows.loans.length,
      totals: {
        billRemainingAmount: totalBillRemaining,
        loanRemainingAmount: totalLoanRemaining,
      },
      summaryItems,
      presentation: 'hybrid_summary',
      tone: 'santai_operasional',
    },
  }
}

function buildDirectRouteReply(language = 'id', path, action = 'open') {
  const locale = getLocaleText(language)
  const routeLabel = getAssistantRouteLabel(path)
  const buttonText =
    action === 'add'
      ? locale.addRoute(routeLabel)
      : action === 'search'
        ? locale.searchRoute(routeLabel)
        : locale.openRoute(routeLabel)

  return {
    text: buttonText,
    buttonRows: [
      [
        {
          text: buttonText,
          path,
        },
      ],
      ...buildAssistantMenuBackRow(language),
    ],
    buttons: [],
    needsClarification: false,
    appendQuickActions: false,
    facts: {
      surface: `${action}_route_direct`,
      path,
      routeLabel,
      action,
    },
  }
}

function buildAssistantClarificationRows(clarificationCode, language = 'id', facts = {}) {
  const locale = getLocaleText(language)
  const normalizedClarificationCode = normalizeText(clarificationCode, '')

  if (normalizedClarificationCode === 'analytics_metric') {
    return [
      [
        {
          text: locale.analyticsMetricBillSummary,
          callbackData: buildAssistantCallbackData(
            assistantCallbackPrefixes.metric,
            'bill_summary'
          ),
        },
        {
          text: locale.analyticsMetricCashOutflow,
          callbackData: buildAssistantCallbackData(
            assistantCallbackPrefixes.metric,
            'cash_outflow'
          ),
        },
      ],
      [
        {
          text: locale.analyticsMetricAttendance,
          callbackData: buildAssistantCallbackData(
            assistantCallbackPrefixes.metric,
            'attendance_present'
          ),
        },
        {
          text: locale.analyticsMetricRanking,
          callbackData: buildAssistantCallbackData(
            assistantCallbackPrefixes.metric,
            'obligation_ranking'
          ),
        },
      ],
    ]
  }

  if (normalizedClarificationCode === 'analytics_entity') {
    const candidateTypes = Array.isArray(facts?.candidateTypes) && facts.candidateTypes.length > 0
      ? facts.candidateTypes
      : ['supplier', 'worker', 'creditor']
    const entityLabels = {
      supplier: locale.analyticsEntitySupplier,
      worker: locale.analyticsEntityWorker,
      creditor: locale.analyticsEntityCreditor,
    }

    return [
      candidateTypes
        .filter((candidateType) => allowedAnalyticsEntityTypes.has(candidateType))
        .map((candidateType) => ({
          text: entityLabels[candidateType] ?? candidateType,
          callbackData: buildAssistantCallbackData(
            assistantCallbackPrefixes.entity,
            candidateType
          ),
        })),
    ].filter((row) => row.length > 0)
  }

  if (normalizedClarificationCode === 'analytics_window') {
    return [
      [
        {
          text: locale.analyticsWindowToday,
          callbackData: buildAssistantCallbackData(assistantCallbackPrefixes.window, 'today'),
        },
        {
          text: locale.analyticsWindowYesterday,
          callbackData: buildAssistantCallbackData(assistantCallbackPrefixes.window, 'yesterday'),
        },
      ],
      [
        {
          text: locale.analyticsWindowWeekCurrent,
          callbackData: buildAssistantCallbackData(
            assistantCallbackPrefixes.window,
            'week_current'
          ),
        },
        {
          text: locale.analyticsWindowMonthCurrent,
          callbackData: buildAssistantCallbackData(
            assistantCallbackPrefixes.window,
            'month_current'
          ),
        },
      ],
    ]
  }

  return []
}

function buildAnalyticsFollowUpRows(language = 'id', metricKey = '') {
  const normalizedMetricKey = normalizeText(metricKey, '').toLowerCase()

  if (normalizedMetricKey === 'cash_outflow' || normalizedMetricKey === 'attendance_present') {
    return [
      ...buildAssistantClarificationRows('analytics_window', language),
      ...buildAssistantClarificationRows('analytics_metric', language),
      ...buildAssistantMenuBackRow(language),
    ]
  }

  return [
    ...buildAssistantClarificationRows('analytics_metric', language),
    ...buildAssistantClarificationRows('analytics_entity', language),
    ...buildAssistantMenuBackRow(language),
  ]
}

function buildCommandMenuReply(language = 'id', chatType = 'private') {
  const locale = getLocaleText(language)

  if (normalizeText(chatType, '').toLowerCase() === 'private') {
    return {
      text: [locale.menuIntro, locale.menuHint].join('\n'),
      replyMarkup: buildAssistantMainMenuReplyMarkup(language),
      buttons: [],
      needsClarification: false,
      appendQuickActions: false,
      facts: {
        surface: 'command_menu',
      },
    }
  }

  return {
    text: [locale.menuIntro, locale.menuHint].join('\n'),
    buttonRows: buildAssistantTopLevelActionRows(language),
    buttons: [],
    needsClarification: false,
    appendQuickActions: false,
    facts: {
      surface: 'command_menu',
    },
  }
}

function buildOpenRouteReply(language = 'id') {
  const locale = getLocaleText(language)

  return {
    text: locale.openRoutePrompt,
    buttonRows: buildAssistantRouteRows(language),
    buttons: [],
    needsClarification: false,
    appendQuickActions: false,
    facts: {
      surface: 'route_picker',
    },
  }
}

function buildTambahReply(language = 'id') {
  const locale = getLocaleText(language)

  return {
    text: locale.addRoutePrompt,
    buttonRows: buildAssistantCreateRouteRows(language),
    buttons: [],
    needsClarification: false,
    appendQuickActions: false,
    facts: {
      surface: 'create_route_picker',
    },
  }
}

function buildStatusSummaryReply(language = 'id', rows = []) {
  return buildSettlementBucketReply(language, rows, 'status')
}

function buildInlineKeyboardButton(botUsername, button) {
  const buttonText = normalizeText(button?.text, '')

  if (!buttonText) {
    return null
  }

  const callbackData = normalizeText(button?.callbackData, '')

  if (callbackData) {
    return {
      text: buttonText,
      callback_data: callbackData,
    }
  }

  const buttonUrl = normalizeText(button?.url, '')

  if (buttonUrl) {
    return {
      text: buttonText,
      url: buttonUrl,
    }
  }

  const path = normalizeAssistantRoutePath(button?.path)
  const link = buildTelegramAssistantLink(botUsername, path)

  if (!link) {
    return null
  }

  return {
    text: buttonText,
    url: link,
  }
}

function buildReplyMarkup(botUsername, reply, plan = null) {
  if (reply?.replyMarkup) {
    return reply.replyMarkup
  }

  const replyRows = Array.isArray(reply?.buttonRows) && reply.buttonRows.length > 0
    ? reply.buttonRows
    : Array.isArray(reply?.buttons)
      ? reply.buttons.map((button) => [button])
      : []
  const clarificationRows = reply?.needsClarification
    ? buildAssistantClarificationRows(
        reply?.facts?.clarificationCode ?? plan?.clarificationCode,
        plan?.language,
        reply?.facts
      )
    : []
  const quickActionRows = reply?.appendQuickActions === false
    ? []
    : buildAssistantQuickActionRows(plan?.language)
  const rows = [...replyRows, ...clarificationRows, ...quickActionRows]
    .map((row) => row.map((button) => buildInlineKeyboardButton(botUsername, button)).filter(Boolean))
    .filter((row) => row.length > 0)

  return rows.length > 0 ? { inline_keyboard: rows } : null
}

function buildRouteChoiceFromText(text, memberships) {
  const normalizedText = normalizeText(text, '').toLowerCase()

  if (/^\d+$/.test(normalizedText)) {
    const index = Number(normalizedText) - 1

    return memberships[index] ?? null
  }

  return (
    memberships.find((membership) => {
      const values = [
        membership.team_name,
        membership.team_slug,
        membership.role,
      ]
        .map((value) => normalizeText(value, '').toLowerCase())
        .filter(Boolean)

      return values.some((value) => normalizedText.includes(value))
    }) ?? null
  )
}

function isCancelText(text) {
  const normalizedText = normalizeText(text, '').toLowerCase()

  return ['batal', 'cancel', 'keluar', 'stop'].some((keyword) =>
    normalizedText.includes(keyword)
  )
}

async function processAssistantCommand({
  adminClient,
  botToken,
  chatId,
  replyToMessageId,
  telegramUserId,
  chatType,
  rawText,
  command,
  session,
  memberships,
  forcedMembership = null,
}) {
  const sessionPayload = session?.pending_payload ?? {}
  const responseLanguage = getLocaleTemplate(
    getAssistantLanguageFromText(command?.args || rawText, session)
  )
  const selectedMembership =
    forcedMembership ??
    memberships.find((membership) => membership.team_id === session?.team_id) ??
    memberships.find((membership) => membership.is_default) ??
    memberships[0] ??
    null
  const workspaceName =
    selectedMembership?.team_name ?? normalizeText(sessionPayload.last_workspace_name, null)
  const commandArgs = normalizeText(command?.args, '')
  const commandInput = buildAssistantCommandInput(command?.command, command?.args)
  const directCreateRoutePath = resolveAssistantCreateRoutePath(commandArgs)
  const directCoreRoutePath = resolveAssistantCoreRoutePath(commandArgs)

  if (command?.command === 'menu') {
    const cleanedSessionPayload = stripAssistantSummaryMessageState(sessionPayload)

    await cleanupAssistantSummaryMessages({
      botToken,
      chatId,
      sessionPayload,
    })

    if (chatId && telegramUserId) {
      await saveAssistantSession(adminClient, {
        chatId,
        telegramUserId,
        teamId: selectedMembership?.team_id ?? session?.team_id ?? null,
        state: 'idle',
        pendingIntent: null,
        pendingPayload: cleanedSessionPayload,
      })
    }

    const menuReply = buildCommandMenuReply(responseLanguage, chatType)

    await sendTelegramMessage({
      botToken,
      chatId,
      text: menuReply.text,
      replyMarkup: buildReplyMarkup(getTelegramBotUsername(), menuReply, {
        language: responseLanguage,
      }),
      replyToMessageId,
    })

    return { processed: true }
  }

  if (command?.command === 'tambah') {
    const addReply = directCreateRoutePath
      ? buildDirectRouteReply(responseLanguage, directCreateRoutePath, 'add')
      : buildTambahReply(responseLanguage)

    await sendTelegramMessage({
      botToken,
      chatId,
      text: addReply.text,
      replyMarkup: buildReplyMarkup(getTelegramBotUsername(), addReply, {
        language: responseLanguage,
      }),
      replyToMessageId,
    })

    return { processed: true }
  }

  if (command?.command === 'buka' && directCoreRoutePath) {
    const openReply = buildDirectRouteReply(responseLanguage, directCoreRoutePath, 'open')

    await sendTelegramMessage({
      botToken,
      chatId,
      text: openReply.text,
      replyMarkup: buildReplyMarkup(getTelegramBotUsername(), openReply, {
        language: responseLanguage,
      }),
      replyToMessageId,
    })

    return { processed: true }
  }

  if (command?.command === 'buka' && !commandArgs) {
    const openReply = buildOpenRouteReply(responseLanguage)

    await sendTelegramMessage({
      botToken,
      chatId,
      text: openReply.text,
      replyMarkup: buildReplyMarkup(getTelegramBotUsername(), openReply, {
        language: responseLanguage,
      }),
      replyToMessageId,
    })

    return { processed: true }
  }

  if (command?.command === 'status' && !commandArgs) {
    const statusRows = await loadWorkspaceRows(
      adminClient,
      selectedMembership?.team_id,
      { search: {} },
      { limit: 100, outstandingOnly: false }
    )
    const statusReply = buildStatusSummaryReply(responseLanguage, statusRows)

    const turnData = buildAssistantTurnData({
      text: rawText,
      plan: {
        intent: 'status',
        search: {},
      },
      language: responseLanguage,
      workspaceName,
    })

    return sendAssistantHybridSummaryReply({
      adminClient,
      botToken,
      chatId,
      replyToMessageId,
      telegramUserId,
      chatType,
      session,
      sessionPayload,
      selectedMembership,
      plan: {
        intent: 'status',
        language: responseLanguage,
        search: {},
      },
      reply: statusReply,
      turnData,
    })
  }

  const settlementBucketStatus = extractStatusFilter(commandArgs)

  if (command?.command === 'status' && settlementBucketStatus !== 'any') {
    return sendSettlementBucketSummaryReply({
      adminClient,
      botToken,
      chatId,
      replyToMessageId,
      telegramUserId,
      chatType,
      session,
      selectedMembership,
      sessionPayload,
      language: responseLanguage,
      surface: 'status',
      bucketStatus: settlementBucketStatus,
    })
  }

  if (command?.command === 'start') {
    return processAssistantStartCommand({
      adminClient,
      botToken,
      chatId,
      replyToMessageId,
      telegramUserId,
      chatType,
      rawText,
      command,
      session,
      memberships,
      forcedMembership,
    })
  }

  if (commandInput) {
    return processTelegramMessage({
      adminClient,
      botToken,
      chatId,
      replyToMessageId,
      telegramUserId,
      chatType,
      messageText: commandInput,
      session: session
        ? {
            ...session,
            state: 'idle',
          }
        : null,
      memberships,
      forcedMembership,
      forcedOriginalText: commandInput,
      skipCommandParsing: true,
    })
  }

  if (!chatId || !telegramUserId) {
    return { processed: true }
  }

  const clarificationCode = 'specific_filter'
  const commandPlan = {
    intent: 'clarify',
    targetPath: null,
    search: {},
    language: responseLanguage,
    clarificationCode,
  }
  const commandReply =
    command?.command === 'buka'
      ? buildOpenRouteReply(responseLanguage)
      : buildClarifyReply(commandPlan)
  const turnData = buildAssistantTurnData({
    text: rawText,
    plan: commandPlan,
    language: responseLanguage,
    workspaceName,
  })
  const shouldFallbackToDm = shouldUseAssistantDmFallback({
    chatType,
    sessionState: session?.state,
    needsClarification: commandReply.needsClarification,
  })

  if (shouldFallbackToDm) {
    return sendAssistantDmHandoff({
      adminClient,
      botToken,
      chatId,
      replyToMessageId,
      telegramUserId,
      sessionPayload,
      turnData,
      language: responseLanguage,
      teamId: selectedMembership?.team_id ?? session?.team_id ?? null,
    })
  }

  const writtenText =
    command?.command === 'buka'
      ? commandReply.text
      : await rewriteAssistantReply({
          plan: commandPlan,
          reply: commandReply,
          workspaceName,
          session,
        })

  await saveAssistantSession(adminClient, {
    chatId,
    telegramUserId,
    teamId: selectedMembership?.team_id ?? session?.team_id ?? null,
    state: 'awaiting_clarification',
    pendingIntent: commandPlan.intent,
    pendingPayload: buildPendingSessionPayload(rawText, commandPlan, sessionPayload, turnData),
  })

  await sendTelegramMessage({
    botToken,
    chatId,
    text: writtenText || commandReply.text,
    replyMarkup: buildReplyMarkup(getTelegramBotUsername(), commandReply, commandPlan),
    replyToMessageId,
  })

  return { processed: true }
}

async function handleWorkspaceChoice({
  adminClient,
  botToken,
  chatId,
  replyToMessageId,
  chatType,
  session,
  memberships,
  incomingText,
  callbackQueryId = null,
}) {
  const replyLanguage = getLocaleTemplate(
    session?.pending_payload?.last_language ?? getAssistantLanguageFromText(incomingText, session)
  )

  if (callbackQueryId) {
    await answerTelegramCallback({
      botToken,
      callbackQueryId,
      text: getLocaleText(replyLanguage).workspaceSelected,
    })
  }

  if (isCancelText(incomingText)) {
    await clearAssistantSession(adminClient, chatId)

    await sendTelegramMessage({
      botToken,
      chatId,
      text: getLocaleText(replyLanguage).workspaceChoiceCancelled,
      replyToMessageId,
    })

    return { processed: true }
  }

  const selectedMembership = buildRouteChoiceFromText(incomingText, memberships)

  if (!selectedMembership) {
    const choiceMessage = buildWorkspaceChoiceMessage(memberships, replyLanguage)
    const choiceMarkup = buildWorkspaceChoiceMarkup(memberships)

    await sendTelegramMessage({
      botToken,
      chatId,
      text: choiceMessage,
      replyMarkup: choiceMarkup,
      replyToMessageId,
    })

    return { processed: true }
  }

  const pendingPayload = session?.pending_payload ?? {}
  const originalText = normalizeText(pendingPayload.original_text, '')
  const choiceTurnData = buildAssistantTurnData({
    text: incomingText,
    plan: { intent: 'clarify', search: {}, targetPath: null },
    language: replyLanguage,
    workspaceName: selectedMembership.team_name,
  })
  const updatedPendingPayload = buildAssistantMemoryPayload(pendingPayload, choiceTurnData)

  await saveAssistantSession(adminClient, {
    chatId,
    telegramUserId: session.telegram_user_id,
    teamId: selectedMembership.team_id,
    state: 'idle',
    pendingIntent: null,
    pendingPayload: updatedPendingPayload,
  })

  if (!originalText) {
    return { processed: true }
  }

  return processTelegramMessage({
    adminClient,
    botToken,
    chatId,
    replyToMessageId,
    telegramUserId: session.telegram_user_id,
    chatType,
    messageText: originalText,
    session: {
      ...session,
      team_id: selectedMembership.team_id,
      state: 'idle',
      pending_payload: updatedPendingPayload,
    },
    memberships,
    forcedMembership: selectedMembership,
    forcedOriginalText: originalText,
  })
}

async function processTelegramMessage({
  adminClient,
  botToken,
  chatId,
  replyToMessageId,
  telegramUserId,
  chatType,
  messageText,
  session,
  memberships,
  forcedMembership = null,
  forcedOriginalText = null,
  skipCommandParsing = false,
}) {
  const effectiveText = normalizeText(forcedOriginalText ?? messageText, '')
  const sessionPayload = session?.pending_payload ?? {}
  const responseLanguage = getLocaleTemplate(
    getAssistantLanguageFromText(effectiveText, session)
  )
  const responseLocale = getLocaleText(responseLanguage)
  const explicitCommand = skipCommandParsing
    ? null
    : extractAssistantCommand(effectiveText, getTelegramBotUsername())

  if (!effectiveText) {
    return {
      processed: true,
    }
  }

  if (explicitCommand) {
    return processAssistantCommand({
      adminClient,
      botToken,
      chatId,
      replyToMessageId,
      telegramUserId,
      chatType,
      rawText: effectiveText,
      command: explicitCommand,
      session,
      memberships,
      forcedMembership,
    })
  }

  const mainMenuCommand = resolveAssistantMenuCommandFromText(
    effectiveText,
    buildAssistantMenuCommandLabels(responseLanguage)
  )

  if (mainMenuCommand) {
    return processAssistantCommand({
      adminClient,
      botToken,
      chatId,
      replyToMessageId,
      telegramUserId,
      chatType,
      rawText: effectiveText,
      command: {
        command: mainMenuCommand,
        args: '',
      },
      session,
      memberships,
      forcedMembership,
    })
  }

  if (session?.state === 'awaiting_clarification' && !forcedMembership) {
    if (
      shouldUseAssistantDmFallback({
        chatType,
        sessionState: session?.state,
        needsClarification: true,
      })
    ) {
      return sendAssistantDmHandoff({
        adminClient,
        botToken,
        chatId,
        replyToMessageId,
        telegramUserId,
        sessionPayload,
        turnData: {
          userText: effectiveText,
          intent: 'clarify',
          language: responseLanguage,
          workspaceName: session?.pending_payload?.last_workspace_name ?? null,
        },
        language: responseLanguage,
        teamId: session.team_id ?? null,
      })
    }

    const pendingPayload = sessionPayload
    const combinedText = [
      normalizeText(pendingPayload.original_text, ''),
      effectiveText,
    ]
      .filter(Boolean)
      .join(' ')
      .trim()

    await saveAssistantSession(adminClient, {
      chatId,
      telegramUserId,
      teamId: session.team_id ?? null,
      state: 'idle',
      pendingIntent: null,
      pendingPayload: {},
    })

    return processTelegramMessage({
      adminClient,
      botToken,
      chatId,
      replyToMessageId,
      telegramUserId,
      chatType,
      messageText: combinedText,
      session: {
        ...session,
        state: 'idle',
        pending_payload: pendingPayload,
      },
      memberships,
      forcedMembership: memberships.find((membership) => membership.team_id === session.team_id) ?? null,
      forcedOriginalText: combinedText,
    })
  }

  const workspaceMembership =
    forcedMembership ??
    memberships.find((membership) => membership.team_id === session?.team_id) ??
    memberships[0] ??
    null

  if (!workspaceMembership) {
    await sendTelegramMessage({
      botToken,
      chatId,
      text: responseLocale.workspaceMissing,
      replyToMessageId,
    })

    return { processed: true }
  }

  const activeMemberships = memberships.filter((membership) => membership.team_is_active)
  const multipleMemberships = activeMemberships.length > 1
  const selectedMembership =
    workspaceMembership ??
    activeMemberships.find((membership) => membership.is_default) ??
    activeMemberships[0] ??
    null

  if (!selectedMembership) {
    await sendTelegramMessage({
      botToken,
      chatId,
      text: responseLocale.membershipMissing,
      replyToMessageId,
    })

    return { processed: true }
  }

  const needsWorkspaceChoice =
    !forcedMembership &&
    multipleMemberships &&
    !session?.team_id &&
    !selectedMembership.is_default &&
    session?.state !== 'awaiting_workspace_choice'

  if (
    shouldUseAssistantDmFallback({
      chatType,
      sessionState: session?.state,
      needsWorkspaceChoice,
    })
  ) {
    return sendAssistantDmHandoff({
      adminClient,
      botToken,
      chatId,
      replyToMessageId,
      telegramUserId,
      sessionPayload,
      turnData: {
        userText: effectiveText,
        intent: 'clarify',
        language: responseLanguage,
        workspaceName: session?.team_id ? selectedMembership.team_name : null,
      },
      language: responseLanguage,
      teamId: session?.team_id ?? null,
    })
  }

  if (needsWorkspaceChoice) {
    const choiceTurnData = buildAssistantTurnData({
      text: effectiveText,
      plan: { intent: 'clarify', search: {}, targetPath: null },
      language: responseLanguage,
      workspaceName: selectedMembership.team_name,
    })

    await saveAssistantSession(adminClient, {
      chatId,
      telegramUserId,
      teamId: null,
      state: 'awaiting_workspace_choice',
      pendingIntent: null,
      pendingPayload: buildPendingSessionPayload(
        effectiveText,
        null,
        sessionPayload,
        choiceTurnData
      ),
    })

    const choiceMarkup = buildWorkspaceChoiceMarkup(activeMemberships)

    await sendTelegramMessage({
      botToken,
      chatId,
      text: buildWorkspaceChoiceMessage(activeMemberships, responseLanguage),
      replyMarkup: choiceMarkup,
      replyToMessageId,
    })

    return { processed: true }
  }

  const normalizedPlan = await classifyAssistantMessage({
    text: effectiveText,
    workspaceName: selectedMembership.team_name,
    role: selectedMembership.role,
    membershipsCount: activeMemberships.length,
    languageHint: responseLanguage,
    contextSummary: normalizeText(sessionPayload.context_summary, ''),
    lastTurn: normalizeText(sessionPayload.last_turn?.user_text, ''),
    session,
  })
  const turnData = buildAssistantTurnData({
    text: effectiveText,
    plan: normalizedPlan,
    language: normalizedPlan.language ?? responseLanguage,
    workspaceName: selectedMembership.team_name,
  })

  if (normalizedPlan.intent === 'refuse') {
    const refusalReply = buildRefusalReply(normalizedPlan.language ?? responseLanguage)
    const writtenText = await rewriteAssistantReply({
      plan: normalizedPlan,
      reply: refusalReply,
      workspaceName: selectedMembership.team_name,
      session,
    })

    await saveAssistantSession(adminClient, {
      chatId,
      telegramUserId,
      teamId: selectedMembership.team_id,
      state: 'idle',
      pendingIntent: null,
      pendingPayload: buildAssistantMemoryPayload(sessionPayload, turnData),
    })

    await sendTelegramMessage({
      botToken,
      chatId,
      text: writtenText || refusalReply.text,
      replyMarkup: buildReplyMarkup(getTelegramBotUsername(), refusalReply, normalizedPlan),
      replyToMessageId,
    })

    return { processed: true }
  }

  if (normalizedPlan.intent === 'navigate') {
    const navigateReply = buildNavigateReply(normalizedPlan)
    const writtenText = await rewriteAssistantReply({
      plan: normalizedPlan,
      reply: navigateReply,
      workspaceName: selectedMembership.team_name,
      session,
    })

    await saveAssistantSession(adminClient, {
      chatId,
      telegramUserId,
      teamId: selectedMembership.team_id,
      state: 'idle',
      pendingIntent: null,
      pendingPayload: buildAssistantMemoryPayload(sessionPayload, turnData),
    })

    await sendTelegramMessage({
      botToken,
      chatId,
      text: writtenText || navigateReply.text,
      replyMarkup: buildReplyMarkup(getTelegramBotUsername(), navigateReply, normalizedPlan),
      replyToMessageId,
    })

    return { processed: true }
  }

  if (normalizedPlan.intent === 'clarify') {
    const clarifyReply = buildClarifyReply(normalizedPlan)
    const shouldFallbackToDm = shouldUseAssistantDmFallback({
      chatType,
      sessionState: session?.state,
      needsClarification: true,
    })
    const writtenText = shouldFallbackToDm
      ? clarifyReply.text
      : await rewriteAssistantReply({
          plan: normalizedPlan,
          reply: clarifyReply,
          workspaceName: selectedMembership.team_name,
          session,
        })

    if (shouldFallbackToDm) {
      return sendAssistantDmHandoff({
        adminClient,
        botToken,
        chatId,
        replyToMessageId,
        telegramUserId,
        sessionPayload,
        turnData,
        language: normalizedPlan.language ?? responseLanguage,
        teamId: selectedMembership.team_id,
      })
    }

    await saveAssistantSession(adminClient, {
      chatId,
      telegramUserId,
      teamId: selectedMembership.team_id,
      state: 'awaiting_clarification',
      pendingIntent: normalizedPlan.intent,
      pendingPayload: buildPendingSessionPayload(
        effectiveText,
        normalizedPlan,
        sessionPayload,
        turnData
      ),
    })

    await sendTelegramMessage({
      botToken,
      chatId,
      text: writtenText || clarifyReply.text,
      replyMarkup: buildReplyMarkup(getTelegramBotUsername(), clarifyReply, normalizedPlan),
      replyToMessageId,
    })

    return { processed: true }
  }

  if (normalizedPlan.intent === 'analytics') {
    return sendAssistantAnalyticsReply({
      adminClient,
      botToken,
      chatId,
      replyToMessageId,
      telegramUserId,
      session,
      sessionPayload,
      selectedMembership,
      plan: normalizedPlan,
      sourceText: effectiveText,
    })
  }

  const outstandingOnly =
    normalizedPlan.intent === 'status' &&
    !normalizeText(normalizedPlan.search?.exactId, null)
  const rows = await loadWorkspaceRows(adminClient, selectedMembership.team_id, normalizedPlan, {
    limit: 12,
    outstandingOnly,
  })

  const reply =
    normalizedPlan.intent === 'status'
      ? buildStatusReply(rows, normalizedPlan)
      : buildSearchReply(rows, normalizedPlan)
  const shouldFallbackToDm = shouldUseAssistantDmFallback({
    chatType,
    sessionState: session?.state,
    needsClarification: reply.needsClarification,
  })

  if (shouldFallbackToDm) {
    return sendAssistantDmHandoff({
      adminClient,
      botToken,
      chatId,
      replyToMessageId,
      telegramUserId,
      sessionPayload,
      turnData,
      language: normalizedPlan.language ?? responseLanguage,
      teamId: selectedMembership.team_id,
    })
  }

  if (normalizedPlan.intent === 'status') {
    return sendAssistantHybridSummaryReply({
      adminClient,
      botToken,
      chatId,
      replyToMessageId,
      telegramUserId,
      chatType,
      session,
      sessionPayload,
      selectedMembership,
      plan: normalizedPlan,
      reply,
      turnData,
    })
  }

  const writtenText = await rewriteAssistantReply({
    plan: normalizedPlan,
    reply,
    workspaceName: selectedMembership.team_name,
    session,
  })

  if (reply.needsClarification) {
    await saveAssistantSession(adminClient, {
      chatId,
      telegramUserId,
      teamId: selectedMembership.team_id,
      state: 'awaiting_clarification',
      pendingIntent: normalizedPlan.intent,
      pendingPayload: buildPendingSessionPayload(
        effectiveText,
        normalizedPlan,
        sessionPayload,
        turnData
      ),
    })
  } else {
    await saveAssistantSession(adminClient, {
      chatId,
      telegramUserId,
      teamId: selectedMembership.team_id,
      state: 'idle',
      pendingIntent: null,
      pendingPayload: buildAssistantMemoryPayload(sessionPayload, turnData),
    })
  }

  await sendTelegramMessage({
    botToken,
    chatId,
    text: writtenText || reply.text,
    replyMarkup: buildReplyMarkup(getTelegramBotUsername(), reply, normalizedPlan),
    replyToMessageId,
  })

  return { processed: true }
}

async function handleCallbackQuery({
  adminClient,
  botToken,
  callbackQuery,
}) {
  const callbackData = normalizeText(callbackQuery?.data, '')
  const callbackAction = resolveAssistantCallbackAction(callbackData)

  if (!callbackAction) {
    return { processed: false }
  }

  const chatId = normalizeTelegramId(callbackQuery?.message?.chat?.id)
  const telegramUserId = normalizeTelegramId(callbackQuery?.from?.id)
  const chatType = getTelegramChatType(callbackQuery?.message)
  const session = await loadAssistantSession(adminClient, chatId)
  const callbackLanguage = getLocaleTemplate(
    session?.pending_payload?.last_language ??
      getAssistantLanguageFromText(callbackQuery?.message?.text ?? '', session)
  )

  if (callbackAction.requiresSession && !session) {
    await answerTelegramCallback({
      botToken,
      callbackQueryId: callbackQuery.id,
      text: getLocaleText(callbackLanguage).callbackSessionExpired,
      showAlert: true,
    })

    return { processed: true }
  }

  const memberships = await loadActiveMemberships(adminClient, telegramUserId)
  const activeMemberships = memberships.filter((membership) => membership.team_is_active)

  if (activeMemberships.length === 0) {
    await clearAssistantSession(adminClient, chatId)

    await answerTelegramCallback({
      botToken,
      callbackQueryId: callbackQuery.id,
      text: getLocaleText(callbackLanguage).noActiveMembership,
      showAlert: true,
    })

    return { processed: true }
  }

  if (callbackAction.type === 'settlement_summary') {
    const selectedMembership =
      activeMemberships.find((membership) => membership.team_id === session?.team_id) ??
      activeMemberships.find((membership) => membership.is_default) ??
      activeMemberships[0] ??
      null

    if (!selectedMembership) {
      await answerTelegramCallback({
        botToken,
        callbackQueryId: callbackQuery.id,
        text: getLocaleText(callbackLanguage).noActiveMembership,
        showAlert: true,
      })

      return { processed: true }
    }

    await answerTelegramCallback({
      botToken,
      callbackQueryId: callbackQuery.id,
    })

    return sendSettlementBucketSummaryReply({
      adminClient,
      botToken,
      chatId,
      replyToMessageId: callbackQuery?.message?.message_id ?? null,
      telegramUserId,
      chatType,
      session,
      selectedMembership,
      sessionPayload: session?.pending_payload ?? {},
      language: callbackLanguage,
      surface: callbackAction.surface,
      bucketStatus: callbackAction.status,
    })
  }

  if (callbackAction.type === 'workspace') {
    const selectedMembership =
      activeMemberships.find((membership) => membership.team_id === callbackAction.teamId) ?? null

    if (!selectedMembership) {
      await answerTelegramCallback({
        botToken,
        callbackQueryId: callbackQuery.id,
        text: getLocaleText(session?.pending_payload?.last_language).callbackWorkspaceNotFound,
        showAlert: true,
      })

      return { processed: true }
    }

    const pendingPayload = session.pending_payload ?? {}
    const originalText = normalizeText(pendingPayload.original_text, '')
    const callbackTurnData = {
      userText: originalText,
      intent: 'clarify',
      language: callbackLanguage,
      workspaceName: selectedMembership.team_name,
      targetPath: null,
      query: null,
      summary: buildTurnSummary({
        text: originalText,
        plan: { intent: 'clarify', search: {}, targetPath: null },
        language: callbackLanguage,
        workspaceName: selectedMembership.team_name,
      }),
    }
    const updatedPendingPayload = buildAssistantMemoryPayload(pendingPayload, callbackTurnData)

    await saveAssistantSession(adminClient, {
      chatId,
      telegramUserId,
      teamId: selectedMembership.team_id,
      state: 'idle',
      pendingIntent: null,
      pendingPayload: updatedPendingPayload,
    })

    await answerTelegramCallback({
      botToken,
      callbackQueryId: callbackQuery.id,
      text: getLocaleText(callbackLanguage).workspacePicked(selectedMembership.team_name),
    })

    if (!originalText) {
      return { processed: true }
    }

    return processTelegramMessage({
      adminClient,
      botToken,
      chatId,
      replyToMessageId: callbackQuery?.message?.message_id ?? null,
      telegramUserId,
      chatType,
      messageText: originalText,
      session: {
        ...session,
        team_id: selectedMembership.team_id,
        state: 'idle',
        pending_payload: updatedPendingPayload,
      },
      memberships: activeMemberships,
      forcedMembership: selectedMembership,
      forcedOriginalText: originalText,
    })
  }

  await answerTelegramCallback({
    botToken,
    callbackQueryId: callbackQuery.id,
  })

  return processTelegramMessage({
    adminClient,
    botToken,
    chatId,
    replyToMessageId: callbackQuery?.message?.message_id ?? null,
    telegramUserId,
    chatType,
    messageText: callbackAction.messageText,
    session,
    memberships: activeMemberships,
    forcedOriginalText: callbackAction.messageText,
  })
}

async function processTelegramUpdate(adminClient, botToken, update) {
  if (update?.callback_query) {
    return handleCallbackQuery({
      adminClient,
      botToken,
      callbackQuery: update.callback_query,
    })
  }

  const message = update?.message ?? update?.edited_message ?? null

  if (!message) {
    return { processed: false }
  }

  const chatId = normalizeTelegramId(message?.chat?.id)
  const telegramUserId = normalizeTelegramId(message?.from?.id)
  const messageText = getTelegramMessageText(message)
  const chatType = getTelegramChatType(message)
  const botUsername = getTelegramBotUsername()

  if (!chatId || !telegramUserId) {
    return { processed: false }
  }

  const session = await loadAssistantSession(adminClient, chatId)
  const updateLanguage = getLocaleTemplate(getAssistantLanguageFromText(messageText, session))
  const updateLocale = getLocaleText(updateLanguage)

  if (
    !shouldProcessTelegramMessage({
      message,
      session,
      botUsername,
      messageText,
      menuLabels: buildAssistantMenuCommandLabels(updateLanguage),
    })
  ) {
    return { processed: false }
  }

  const memberships = await loadActiveMemberships(adminClient, telegramUserId)
  const activeMemberships = memberships.filter((membership) => membership.team_is_active)

  if (activeMemberships.length === 0) {
    await clearAssistantSession(adminClient, chatId)

    await sendTelegramMessage({
      botToken,
      chatId,
      text: updateLocale.noActiveMembership,
      replyToMessageId: message?.message_id ?? null,
    })

    return { processed: true }
  }

  if (session?.state === 'awaiting_workspace_choice') {
    return handleWorkspaceChoice({
      adminClient,
      botToken,
      chatId,
      replyToMessageId: message?.message_id ?? null,
      chatType,
      session,
      memberships: activeMemberships,
      incomingText: messageText,
    })
  }

  return processTelegramMessage({
    adminClient,
    botToken,
    chatId,
    replyToMessageId: message?.message_id ?? null,
    telegramUserId,
    chatType,
    messageText,
    session,
    memberships: activeMemberships,
  })
}

function getSupabaseConfig() {
  const supabaseUrl = getEnv('SUPABASE_URL', getEnv('VITE_SUPABASE_URL'))
  const publishableKey = getEnv(
    'VITE_SUPABASE_PUBLISHABLE_KEY',
    getEnv('VITE_SUPABASE_ANON_KEY')
  )
  const serviceRoleKey = getEnv('SUPABASE_SERVICE_ROLE_KEY', publishableKey)

  return {
    supabaseUrl,
    serviceRoleKey,
  }
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({
        ok: false,
        error: 'Method tidak diizinkan.',
      })
    }

    assertWebhookSecret(req)

    const botToken = getEnv('TELEGRAM_BOT_TOKEN')

    if (!botToken) {
      throw createHttpError(500, 'TELEGRAM_BOT_TOKEN belum dikonfigurasi.')
    }

    const { supabaseUrl, serviceRoleKey } = getSupabaseConfig()

    if (!supabaseUrl || !serviceRoleKey) {
      throw createHttpError(500, 'Konfigurasi Supabase assistant belum lengkap.')
    }

    const adminClient = createAdminClient(supabaseUrl, serviceRoleKey)
    const update = await parseRequestBody(req)
    const result = await processTelegramUpdate(adminClient, botToken, update)

    return res.status(200).json({
      ok: true,
      processed: Boolean(result?.processed),
    })
  } catch (error) {
    console.error('[api/telegram-assistant] failed', {
      message: error instanceof Error ? error.message : String(error),
      statusCode: typeof error?.statusCode === 'number' ? error.statusCode : 500,
      webhookSecretConfigured: isWebhookSecretEnabled(),
    })

    return res.status(200).json({
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : 'Terjadi kesalahan saat memproses assistant Telegram.',
    })
  }
}

export {
  answerTelegramCallback,
  buildAssistantCommandInput,
  buildAssistantCommandRawText,
  buildAssistantMemoryPayload,
  buildAssistantSummaryMessageState,
  buildAssistantResponseFactPacket,
  buildAssistantResponsePrompt,
  buildAssistantMainMenuReplyMarkup,
  buildPendingSessionPayload,
  extractAssistantCommand,
  isAssistantResponseSafe,
  getAssistantSummaryMessageState,
  getTelegramMessageIdFromResponse,
  normalizeAssistantPendingPayload,
  stripAssistantSummaryMessageState,
  buildAnalyticsFollowUpRows,
  postAssistantModelPrompt,
  postAssistantWriterPrompt,
  processAssistantCommand,
  sendAssistantHybridSummaryReply,
  resolveAssistantCallbackAction,
  rewriteAssistantReply,
  shouldProcessTelegramMessage,
  buildStatusReply,
  buildSettlementBucketReply,
  buildSettlementBucketDetailReply,
}
