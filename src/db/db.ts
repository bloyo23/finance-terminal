import Dexie, { type Table } from 'dexie'
import type {
  Account,
  Transaction,
  Debt,
  FixedExpense,
  Budget,
  Category,
  ExchangeRateRecord,
  Settings,
} from '../types/finance'

export class FinanceDB extends Dexie {
  accounts!: Table<Account, number>
  transactions!: Table<Transaction, number>
  budgets!: Table<Budget, number>
  fixedExpenses!: Table<FixedExpense, number>
  debts!: Table<Debt, number>
  categories!: Table<Category, number>
  exchangeRates!: Table<ExchangeRateRecord, number>
  settings!: Table<Settings, number>

  constructor() {
    super('finance-terminal-db')

    this.version(1).stores({
      accounts: '++id, name, type, currency, archived',
      transactions: '++id, timestamp, type, currency, accountId, categoryId, debtId',
      budgets: '++id, categoryId, startDate, endDate',
      fixedExpenses: '++id, name, dueDay, active',
      debts: '++id, type, counterparty, settled',
      categories: '++id, name, kind',
      exchangeRates: '++id, pair, fetchedAt',
      settings: '++id, &key',
    })
  }
}

export const db = new FinanceDB()

// -----------------------------------------------------------
// Categorías por defecto — solo son un PUNTO DE PARTIDA basado
// en el perfil de gastos, no hay cuentas/transacciones precargadas.
// La app siempre arranca sin saldos ni movimientos.
// -----------------------------------------------------------
const DEFAULT_CATEGORIES: Omit<Category, 'id'>[] = [
  { name: 'Sueldo', kind: 'INCOME', color: '#38BDF8', isDefault: true },
  { name: 'Ventas / Bonus', kind: 'INCOME', color: '#38BDF8', isDefault: true },
  { name: 'Venta de flores', kind: 'INCOME', color: '#4ADE80', isDefault: true },
  { name: 'Otros ingresos', kind: 'INCOME', color: '#38BDF8', isDefault: true },

  { name: 'Alquiler', kind: 'EXPENSE', color: '#EF4444', isDefault: true },
  { name: 'Expensas', kind: 'EXPENSE', color: '#EF4444', isDefault: true },
  { name: 'Servicios (ABL/luz/internet)', kind: 'EXPENSE', color: '#EF4444', isDefault: true },
  { name: 'Comida perros', kind: 'EXPENSE', color: '#F59E0B', isDefault: true },
  { name: 'Compra de flores', kind: 'EXPENSE', color: '#F59E0B', isDefault: true },
  { name: 'Comida / Supermercado', kind: 'EXPENSE', color: '#EF4444', isDefault: true },
  { name: 'Transporte', kind: 'EXPENSE', color: '#EF4444', isDefault: true },
  { name: 'Salidas / Ocio', kind: 'EXPENSE', color: '#EF4444', isDefault: true },
  { name: 'Salud', kind: 'EXPENSE', color: '#EF4444', isDefault: true },
  { name: 'Otros gastos', kind: 'EXPENSE', color: '#EF4444', isDefault: true },
]

export async function seedDefaultCategoriesIfEmpty() {
  const count = await db.categories.count()
  if (count === 0) {
    await db.categories.bulkAdd(DEFAULT_CATEGORIES)
  }
}
