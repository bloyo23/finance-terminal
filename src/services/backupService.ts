import { db } from '../db/db'

export interface BackupData {
  version: 1
  exportedAt: number
  accounts: any[]
  transactions: any[]
  debts: any[]
  categories: any[]
  fixedExpenses: any[]
  budgets: any[]
  exchangeRates: any[]
}

export async function exportBackup(): Promise<BackupData> {
  const [accounts, transactions, debts, categories, fixedExpenses, budgets, exchangeRates] =
    await Promise.all([
      db.accounts.toArray(),
      db.transactions.toArray(),
      db.debts.toArray(),
      db.categories.toArray(),
      db.fixedExpenses.toArray(),
      db.budgets.toArray(),
      db.exchangeRates.toArray(),
    ])
  return {
    version: 1,
    exportedAt: Date.now(),
    accounts,
    transactions,
    debts,
    categories,
    fixedExpenses,
    budgets,
    exchangeRates,
  }
}

export function downloadBackupFile(data: BackupData) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const date = new Date().toISOString().slice(0, 10)
  a.href = url
  a.download = `finance-terminal-backup-${date}.json`
  a.click()
  URL.revokeObjectURL(url)
}

// Reemplaza TODOS los datos actuales por los del backup (import destructivo)
export async function importBackup(data: BackupData): Promise<void> {
  if (!data || data.version !== 1) throw new Error('Archivo de backup inválido')

  await db.transaction(
    'rw',
    [db.accounts, db.transactions, db.debts, db.categories, db.fixedExpenses, db.budgets, db.exchangeRates],
    async () => {
      await Promise.all([
        db.accounts.clear(),
        db.transactions.clear(),
        db.debts.clear(),
        db.categories.clear(),
        db.fixedExpenses.clear(),
        db.budgets.clear(),
        db.exchangeRates.clear(),
      ])
      await Promise.all([
        db.accounts.bulkAdd(data.accounts ?? []),
        db.transactions.bulkAdd(data.transactions ?? []),
        db.debts.bulkAdd(data.debts ?? []),
        db.categories.bulkAdd(data.categories ?? []),
        db.fixedExpenses.bulkAdd(data.fixedExpenses ?? []),
        db.budgets.bulkAdd(data.budgets ?? []),
        db.exchangeRates.bulkAdd(data.exchangeRates ?? []),
      ])
    }
  )
}

// Borra todo (usado por el administrador). No toca el PIN guardado en settings.
export async function wipeAllData(): Promise<void> {
  await db.transaction(
    'rw',
    [db.accounts, db.transactions, db.debts, db.fixedExpenses, db.budgets, db.exchangeRates],
    async () => {
      await Promise.all([
        db.accounts.clear(),
        db.transactions.clear(),
        db.debts.clear(),
        db.fixedExpenses.clear(),
        db.budgets.clear(),
        db.exchangeRates.clear(),
      ])
      // Las categorías por defecto se mantienen (no son "datos", son configuración)
    }
  )
}

// ---- PIN de administrador (guardado local, en settings) ----
export async function getAdminPin(): Promise<string | null> {
  const row = await db.settings.where('key').equals('adminPin').first()
  return row?.value ?? null
}

export async function setAdminPin(pin: string): Promise<void> {
  const existing = await db.settings.where('key').equals('adminPin').first()
  if (existing?.id) {
    await db.settings.update(existing.id, { value: pin })
  } else {
    await db.settings.add({ key: 'adminPin', value: pin })
  }
}
