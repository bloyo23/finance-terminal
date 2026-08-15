import { create } from 'zustand'
import { db, seedDefaultCategoriesIfEmpty } from '../db/db'
import { getExchangeRate, setManualExchangeRate } from '../services/exchangeRateService'
import type {
  Account,
  Transaction,
  Debt,
  Category,
  FixedExpense,
  Budget,
} from '../types/finance'

interface FinanceState {
  accounts: Account[]
  transactions: Transaction[]
  debts: Debt[]
  categories: Category[]
  fixedExpenses: FixedExpense[]
  budgets: Budget[]

  usdtToArsRate: number
  rateSource: 'API' | 'MANUAL' | 'CACHE'
  rateFetchedAt: number | null
  loading: boolean

  init: () => Promise<void>
  refreshRate: () => Promise<void>
  setManualRate: (value: number) => Promise<void>

  addAccount: (acc: Omit<Account, 'id' | 'updatedAt'>) => Promise<void>
  updateAccountBalance: (id: number, newBalance: number) => Promise<void>
  archiveAccount: (id: number) => Promise<void>

  addTransaction: (tx: Omit<Transaction, 'id'>) => Promise<void>
  deleteTransaction: (id: number) => Promise<void>

  addDebt: (debt: Omit<Debt, 'id' | 'createdAt' | 'remainingAmountNominal'>) => Promise<void>
  payDebt: (
    debtId: number,
    amountNominal: number,
    accountId: number,
    currency: Account['currency'],
    paymentMethod: Transaction['paymentMethod']
  ) => Promise<void>

  addFixedExpense: (fe: Omit<FixedExpense, 'id'>) => Promise<void>

  reloadAll: () => Promise<void>
}

export const useFinanceStore = create<FinanceState>((set, get) => ({
  accounts: [],
  transactions: [],
  debts: [],
  categories: [],
  fixedExpenses: [],
  budgets: [],

  usdtToArsRate: 0,
  rateSource: 'MANUAL',
  rateFetchedAt: null,
  loading: true,

  init: async () => {
    await seedDefaultCategoriesIfEmpty()
    await get().reloadAll()
    await get().refreshRate()
    set({ loading: false })
  },

  refreshRate: async () => {
    const { value, source, fetchedAt } = await getExchangeRate()
    set({ usdtToArsRate: value, rateSource: source, rateFetchedAt: fetchedAt })
  },

  setManualRate: async (value: number) => {
    await setManualExchangeRate(value)
    set({ usdtToArsRate: value, rateSource: 'MANUAL', rateFetchedAt: Date.now() })
  },

  addAccount: async (acc) => {
    await db.accounts.add({ ...acc, updatedAt: Date.now() })
    await get().reloadAll()
  },

  updateAccountBalance: async (id, newBalance) => {
    await db.accounts.update(id, { balanceNominal: newBalance, updatedAt: Date.now() })
    await get().reloadAll()
  },

  archiveAccount: async (id) => {
    await db.accounts.update(id, { archived: true })
    await get().reloadAll()
  },

  addTransaction: async (tx) => {
    await db.transaction('rw', db.transactions, db.accounts, async () => {
      await db.transactions.add(tx)

      const account = await db.accounts.get(tx.accountId)
      if (!account) return

      if (tx.type === 'INCOME') {
        await db.accounts.update(tx.accountId, {
          balanceNominal: account.balanceNominal + tx.amountNominal,
          updatedAt: Date.now(),
        })
      } else if (tx.type === 'EXPENSE' || tx.type === 'DEBT_PAYMENT') {
        await db.accounts.update(tx.accountId, {
          balanceNominal: account.balanceNominal - tx.amountNominal,
          updatedAt: Date.now(),
        })
      } else if (tx.type === 'SELF_TRANSFER' && tx.toAccountId) {
        const toAccount = await db.accounts.get(tx.toAccountId)
        await db.accounts.update(tx.accountId, {
          balanceNominal: account.balanceNominal - tx.amountNominal,
          updatedAt: Date.now(),
        })
        if (toAccount) {
          await db.accounts.update(tx.toAccountId, {
            balanceNominal: toAccount.balanceNominal + tx.amountNominal,
            updatedAt: Date.now(),
          })
        }
      }
    })

    await get().reloadAll()
  },

  deleteTransaction: async (id) => {
    const tx = await db.transactions.get(id)
    if (!tx) return

    await db.transaction('rw', db.transactions, db.accounts, async () => {
      const account = await db.accounts.get(tx.accountId)
      if (account) {
        // Revertir el efecto en el saldo
        if (tx.type === 'INCOME') {
          await db.accounts.update(tx.accountId, {
            balanceNominal: account.balanceNominal - tx.amountNominal,
          })
        } else if (tx.type === 'EXPENSE' || tx.type === 'DEBT_PAYMENT') {
          await db.accounts.update(tx.accountId, {
            balanceNominal: account.balanceNominal + tx.amountNominal,
          })
        } else if (tx.type === 'SELF_TRANSFER' && tx.toAccountId) {
          const toAccount = await db.accounts.get(tx.toAccountId)
          await db.accounts.update(tx.accountId, {
            balanceNominal: account.balanceNominal + tx.amountNominal,
          })
          if (toAccount) {
            await db.accounts.update(tx.toAccountId, {
              balanceNominal: toAccount.balanceNominal - tx.amountNominal,
            })
          }
        }
      }
      await db.transactions.delete(id)
    })

    await get().reloadAll()
  },

  addDebt: async (debt) => {
    await db.debts.add({
      ...debt,
      remainingAmountNominal: debt.originalAmountNominal,
      createdAt: Date.now(),
    })
    await get().reloadAll()
  },

  payDebt: async (debtId, amountNominal, accountId, currency, paymentMethod) => {
    const debt = await db.debts.get(debtId)
    if (!debt) return

    const newRemaining = Math.max(0, debt.remainingAmountNominal - amountNominal)

    await db.transaction('rw', db.debts, db.transactions, db.accounts, async () => {
      await db.debts.update(debtId, {
        remainingAmountNominal: newRemaining,
        settled: newRemaining === 0,
      })

      // Si la deuda es PASSIVE (yo debo), pagarla es un egreso de mi cuenta.
      // Si es ACTIVE (me deben), cobrar es un ingreso a mi cuenta.
      const account = await db.accounts.get(accountId)
      if (!account) return

      const txType = debt.type === 'PASSIVE' ? 'DEBT_PAYMENT' : 'INCOME'
      await db.transactions.add({
        timestamp: Date.now(),
        type: txType,
        amountNominal,
        currency,
        exchangeRateToBase: get().usdtToArsRate,
        paymentMethod,
        accountId,
        debtId,
        notes: debt.type === 'PASSIVE' ? `Pago de deuda a ${debt.counterparty}` : `Cobro de deuda de ${debt.counterparty}`,
      })

      if (debt.type === 'PASSIVE') {
        await db.accounts.update(accountId, {
          balanceNominal: account.balanceNominal - amountNominal,
          updatedAt: Date.now(),
        })
      } else {
        await db.accounts.update(accountId, {
          balanceNominal: account.balanceNominal + amountNominal,
          updatedAt: Date.now(),
        })
      }
    })

    await get().reloadAll()
  },

  addFixedExpense: async (fe) => {
    await db.fixedExpenses.add(fe)
    await get().reloadAll()
  },

  reloadAll: async () => {
    const [accounts, transactions, debts, categories, fixedExpenses, budgets] =
      await Promise.all([
        db.accounts.toArray(),
        db.transactions.orderBy('timestamp').reverse().toArray(),
        db.debts.toArray(),
        db.categories.toArray(),
        db.fixedExpenses.toArray(),
        db.budgets.toArray(),
      ])
    set({ accounts, transactions, debts, categories, fixedExpenses, budgets })
  },
}))
