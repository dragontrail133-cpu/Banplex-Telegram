import {
  Boxes,
  Briefcase,
  ClipboardList,
  Landmark,
  Wallet,
  Truck,
  Users,
} from 'lucide-react'

function normalizeText(value, fallback = '') {
  const normalizedValue = String(value ?? '').trim()
  return normalizedValue.length > 0 ? normalizedValue : fallback
}

function formatCurrency(value) {
  const currencyFormatter = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  })

  return currencyFormatter.format(Number.isFinite(Number(value)) ? Number(value) : 0)
}

function formatCategoryGroup(value) {
  if (value === 'operational') return 'Operasional'
  if (value === 'material') return 'Material'
  if (value === 'other') return 'Lainnya'
  return normalizeText(value, 'Tanpa grup')
}

function formatStaffPaymentType(value) {
  if (value === 'monthly') return 'Bulanan'
  if (value === 'per_termin') return 'Persentase Termin'
  if (value === 'fixed_per_termin') return 'Nominal per Termin'
  return normalizeText(value, 'Belum diatur')
}

export const masterTabs = [
  {
    key: 'projects',
    routeKey: 'project',
    label: 'Proyek',
    icon: Briefcase,
    stateKey: 'projects',
    fetchAction: 'fetchProjects',
    createAction: 'addProject',
    updateAction: 'updateProject',
    deleteAction: 'deleteProject',
    createLabel: 'Tambah Proyek',
    emptyTitle: 'Belum ada proyek aktif.',
    fields: [
      {
        name: 'project_name',
        label: 'Nama Proyek',
        type: 'text',
        required: true,
        placeholder: 'Contoh: Pembangunan Gudang',
      },
      {
        name: 'project_type',
        label: 'Tipe Proyek',
        type: 'text',
        placeholder: 'Contoh: Konstruksi',
      },
      {
        name: 'budget',
        label: 'Budget',
        type: 'number',
        inputMode: 'decimal',
        min: '0',
        step: '0.01',
      },
      {
        name: 'status',
        label: 'Status',
        type: 'select',
        defaultValue: 'active',
        options: [
          { value: 'active', label: 'Aktif' },
          { value: 'on_hold', label: 'On Hold' },
          { value: 'completed', label: 'Selesai' },
        ],
      },
      {
        name: 'is_wage_assignable',
        label: 'Boleh dipakai untuk upah pekerja',
        type: 'checkbox',
        defaultValue: false,
      },
      {
        name: 'notes',
        label: 'Catatan',
        type: 'textarea',
        placeholder: 'Catatan proyek jika diperlukan.',
        fullWidth: true,
      },
    ],
    getBadges: (record) => [
      record.project_type || 'Tipe belum diisi',
      record.status || 'Status belum diisi',
      record.is_wage_assignable ? 'Upah aktif' : 'Tanpa upah',
    ],
    getDescription: (record) =>
      record.notes || `Budget ${formatCurrency(record.budget ?? 0)}`,
  },
  {
    key: 'workers',
    routeKey: 'worker',
    label: 'Pekerja',
    icon: Users,
    stateKey: 'workers',
    fetchAction: 'fetchWorkers',
    createAction: 'addWorker',
    updateAction: 'updateWorker',
    deleteAction: 'deleteWorker',
    createLabel: 'Tambah Pekerja',
    emptyTitle: 'Belum ada pekerja aktif.',
    customForm: 'worker',
  },
  {
    key: 'suppliers',
    routeKey: 'supplier',
    label: 'Supplier',
    icon: Truck,
    stateKey: 'suppliers',
    fetchAction: 'fetchSuppliers',
    createAction: 'addSupplier',
    updateAction: 'updateSupplier',
    deleteAction: 'deleteSupplier',
    createLabel: 'Tambah Supplier',
    emptyTitle: 'Belum ada supplier aktif.',
    fields: [
      {
        name: 'supplier_name',
        label: 'Nama Supplier',
        type: 'text',
        required: true,
        placeholder: 'Contoh: CV Sumber Baja',
      },
      {
        name: 'supplier_type',
        label: 'Tipe Supplier',
        type: 'select',
        defaultValue: 'Material',
        options: [
          { value: 'Material', label: 'Material' },
          { value: 'Operasional', label: 'Operasional' },
          { value: 'Lainnya', label: 'Lainnya' },
        ],
      },
      {
        name: 'notes',
        label: 'Catatan',
        type: 'textarea',
        placeholder: 'Catatan supplier jika diperlukan.',
        fullWidth: true,
      },
    ],
    getBadges: (record) => [record.supplier_type || 'Tipe belum diisi'],
    getDescription: (record) => record.notes || 'Siap dipakai pada expense dan bill.',
  },
  {
    key: 'expense_categories',
    routeKey: 'category',
    label: 'Kategori',
    icon: ClipboardList,
    stateKey: 'categories',
    fetchAction: 'fetchExpenseCategories',
    createAction: 'addExpenseCategory',
    updateAction: 'updateExpenseCategory',
    deleteAction: 'deleteExpenseCategory',
    createLabel: 'Tambah Kategori',
    emptyTitle: 'Belum ada kategori biaya aktif.',
    fields: [
      {
        name: 'name',
        label: 'Nama Kategori',
        type: 'text',
        required: true,
        placeholder: 'Contoh: Transportasi Proyek',
      },
      {
        name: 'category_group',
        label: 'Grup Kategori',
        type: 'select',
        defaultValue: 'operational',
        options: [
          { value: 'operational', label: 'Operasional' },
          { value: 'material', label: 'Material' },
          { value: 'other', label: 'Lainnya' },
        ],
      },
      {
        name: 'notes',
        label: 'Catatan',
        type: 'textarea',
        placeholder: 'Catatan kategori jika diperlukan.',
        fullWidth: true,
      },
    ],
    getBadges: (record) => [formatCategoryGroup(record.category_group)],
    getDescription: (record) => record.notes || 'Dipakai untuk form transaksi pengeluaran.',
  },
  {
    key: 'funding_creditors',
    routeKey: 'creditor',
    label: 'Kreditur',
    icon: Landmark,
    stateKey: 'fundingCreditors',
    fetchAction: 'fetchFundingCreditors',
    createAction: 'addFundingCreditor',
    updateAction: 'updateFundingCreditor',
    deleteAction: 'deleteFundingCreditor',
    createLabel: 'Tambah Kreditur',
    emptyTitle: 'Belum ada kreditur aktif.',
    fields: [
      {
        name: 'creditor_name',
        label: 'Nama Kreditur',
        type: 'text',
        required: true,
        placeholder: 'Contoh: Pak Hendra',
      },
      {
        name: 'notes',
        label: 'Catatan',
        type: 'textarea',
        placeholder: 'Catatan kreditur jika diperlukan.',
        fullWidth: true,
      },
    ],
    getBadges: () => ['Pendanaan'],
    getDescription: (record) => record.notes || 'Dipakai untuk input pinjaman dan pembayaran loan.',
  },
  {
    key: 'professions',
    routeKey: 'profession',
    label: 'Profesi',
    icon: Wallet,
    stateKey: 'professions',
    fetchAction: 'fetchProfessions',
    createAction: 'addProfession',
    updateAction: 'updateProfession',
    deleteAction: 'deleteProfession',
    createLabel: 'Tambah Profesi',
    emptyTitle: 'Belum ada profesi aktif.',
    fields: [
      {
        name: 'profession_name',
        label: 'Nama Profesi',
        type: 'text',
        required: true,
        placeholder: 'Contoh: Tukang Besi',
      },
      {
        name: 'notes',
        label: 'Catatan',
        type: 'textarea',
        placeholder: 'Catatan profesi jika diperlukan.',
        fullWidth: true,
      },
    ],
    getBadges: () => ['Profesi'],
    getDescription: (record) => record.notes || 'Dipakai pada master pekerja.',
  },
  {
    key: 'staff',
    routeKey: 'staff',
    label: 'Staf',
    icon: Boxes,
    stateKey: 'staffMembers',
    fetchAction: 'fetchStaff',
    createAction: 'addStaff',
    updateAction: 'updateStaff',
    deleteAction: 'deleteStaff',
    createLabel: 'Tambah Staf',
    emptyTitle: 'Belum ada staf aktif.',
    fields: [
      {
        name: 'staff_name',
        label: 'Nama Staf',
        type: 'text',
        required: true,
        placeholder: 'Contoh: Admin Proyek',
      },
      {
        name: 'payment_type',
        label: 'Tipe Pembayaran',
        type: 'select',
        defaultValue: 'monthly',
        options: [
          { value: 'monthly', label: 'Bulanan' },
          { value: 'per_termin', label: 'Persentase Termin' },
          { value: 'fixed_per_termin', label: 'Nominal per Termin' },
        ],
      },
      {
        name: 'salary',
        label: 'Gaji Bulanan',
        type: 'number',
        inputMode: 'decimal',
        min: '0',
        step: '0.01',
      },
      {
        name: 'fee_percentage',
        label: 'Persentase Fee',
        type: 'number',
        inputMode: 'decimal',
        min: '0',
        step: '0.01',
      },
      {
        name: 'fee_amount',
        label: 'Fee Tetap',
        type: 'number',
        inputMode: 'decimal',
        min: '0',
        step: '0.01',
      },
      {
        name: 'notes',
        label: 'Catatan',
        type: 'textarea',
        placeholder: 'Catatan staf jika diperlukan.',
        fullWidth: true,
      },
    ],
    getBadges: (record) => [formatStaffPaymentType(record.payment_type)],
    getDescription: (record) =>
      [
        `Gaji ${formatCurrency(record.salary ?? 0)}`,
        `Fee ${Number(record.fee_percentage ?? 0)}%`,
        `Tetap ${formatCurrency(record.fee_amount ?? 0)}`,
      ].join(' | '),
  },
]
