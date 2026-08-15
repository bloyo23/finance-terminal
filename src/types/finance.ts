// ============================================================
// Finance Terminal — Tipos del dominio
// ============================================================

export type Currency = 'ARS' | 'USD' | 'USDT'

export type AccountType = 'CASH' | 'BANK' | 'CRYPTO'

export type PaymentMethod = 'EFECTIVO' | 'TRANSFERENCIA'

export type TransactionType =
  | 'INCOME'
  | 'EXPENSE'
  | 'SELF_TRANSFER'
  | 'DEBT_PAYMENT'

export type DebtType = 'PASSIVE' | 'ACTIVE' // PASSIVE = yo debo, ACTIVE = me deben

export type CategoryKind = 'INCOME' | 'EXPENSE'

export interface Account {
  id?: number
  name: string
  type: AccountType
  currency: Currency
  balanceNominal: number
  updatedAt: number
  archived?: boolean
}

export interface Category {
  id?: number
  name: string
  kind: CategoryKind
  color: string
  icon?: string
  isDefault?: boolean
}

export interface Transaction {
  id?: number
  timestamp: number
  type: TransactionType
  amountNominal: number
  currency: Currency
  exchangeRateToBase: number // valor del ARS por unidad de currency en el momento
  paymentMethod: PaymentMethod
  accountId: number
  toAccountId?: number // usado en SELF_TRANSFER
  categoryId?: number
  debtId?: number // usado en DEBT_PAYMENT
  notes?: string
}

export interface Debt {
  id?: number
  type: DebtType
  counterparty: string
  originalAmountNominal: number
  currency: Currency
  remainingAmountNominal: number
  dueDate?: number
  createdAt: number
  settled?: boolean
}

export interface FixedExpense {
  id?: number
  name: string
  amountNominal: number
  currency: Currency
  dueDay: number // 1-31
  categoryId?: number
  accountId?: number
  active?: boolean
}

export interface Budget {
  id?: number
  categoryId: number
  startDate: number
  endDate: number
  capNominal: number
  currency: Currency
}

export interface ExchangeRateRecord {
  id?: number
  pair: string // ej "USDT_ARS"
  value: number
  source: 'API' | 'MANUAL'
  fetchedAt: number
}

export interface Settings {
  id?: number
  key: string
  value: string
}
