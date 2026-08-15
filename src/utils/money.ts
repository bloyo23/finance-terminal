import type { Account, Transaction, Category } from '../types/finance'

// -----------------------------------------------------------
// Formateo
// -----------------------------------------------------------
export function formatARS(value: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatUSD(value: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(value)
}

export function formatNumber(value: number, decimals = 0): string {
  return new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}

// -----------------------------------------------------------
// Conversión a moneda base (ARS)
// -----------------------------------------------------------
export function toBase(
  amountNominal: number,
  currency: 'ARS' | 'USD' | 'USDT',
  usdtToArsRate: number
): number {
  if (currency === 'ARS') return amountNominal
  // Tratamos USD y USDT con el mismo tipo de cambio (aprox. dólar cripto/blue)
  return amountNominal * usdtToArsRate
}

// -----------------------------------------------------------
// Liquidez total (todas las cuentas convertidas a ARS)
// -----------------------------------------------------------
export function calcTotalLiquidity(
  accounts: Account[],
  usdtToArsRate: number
): { totalARS: number; totalUSDT: number } {
  let totalARS = 0
  let totalUSDT = 0

  for (const acc of accounts) {
    if (acc.archived) continue
    totalARS += toBase(acc.balanceNominal, acc.currency, usdtToArsRate)
    if (acc.currency === 'USD' || acc.currency === 'USDT') {
      totalUSDT += acc.balanceNominal
    }
  }

  return { totalARS, totalUSDT }
}

// -----------------------------------------------------------
// Flujo mensual: ingresos - gastos, dentro de un rango de fechas
// -----------------------------------------------------------
export function calcMonthlyFlow(
  transactions: Transaction[],
  usdtToArsRate: number,
  monthStart: number,
  monthEnd: number
): { income: number; expense: number; net: number } {
  let income = 0
  let expense = 0

  for (const tx of transactions) {
    if (tx.timestamp < monthStart || tx.timestamp > monthEnd) continue
    const baseAmount = toBase(tx.amountNominal, tx.currency, usdtToArsRate)
    if (tx.type === 'INCOME') income += baseAmount
    if (tx.type === 'EXPENSE') expense += baseAmount
  }

  return { income, expense, net: income - expense }
}

// -----------------------------------------------------------
// % consumido de un presupuesto
// -----------------------------------------------------------
export function calcBudgetProgress(
  spentNominal: number,
  capNominal: number
): number {
  if (capNominal <= 0) return 0
  return Math.min(100, (spentNominal / capNominal) * 100)
}

// -----------------------------------------------------------
// Análisis Pareto (80/20) de gastos por categoría
// -----------------------------------------------------------
export interface ParetoItem {
  categoryId: number
  categoryName: string
  color: string
  total: number
  cumulativePct: number
  isVital: boolean // dentro del 80% acumulado
}

export function calcParetoAnalysis(
  transactions: Transaction[],
  categories: Category[],
  usdtToArsRate: number
): ParetoItem[] {
  const totalsByCategory = new Map<number, number>()

  for (const tx of transactions) {
    if (tx.type !== 'EXPENSE' || !tx.categoryId) continue
    const baseAmount = toBase(tx.amountNominal, tx.currency, usdtToArsRate)
    totalsByCategory.set(
      tx.categoryId,
      (totalsByCategory.get(tx.categoryId) ?? 0) + baseAmount
    )
  }

  const grandTotal = Array.from(totalsByCategory.values()).reduce(
    (a, b) => a + b,
    0
  )

  const items = Array.from(totalsByCategory.entries())
    .map(([categoryId, total]) => {
      const cat = categories.find((c) => c.id === categoryId)
      return {
        categoryId,
        categoryName: cat?.name ?? 'Sin categoría',
        color: cat?.color ?? '#64748B',
        total,
      }
    })
    .sort((a, b) => b.total - a.total)

  let cumulative = 0
  return items.map((item) => {
    cumulative += item.total
    const cumulativePct = grandTotal > 0 ? (cumulative / grandTotal) * 100 : 0
    return {
      ...item,
      cumulativePct,
      isVital: cumulativePct <= 80,
    }
  })
}

// -----------------------------------------------------------
// Sugerencia de ahorro: 30% del neto mensual
// -----------------------------------------------------------
export function calcSavingsSuggestion(netMonthly: number): number {
  return Math.max(0, netMonthly * 0.3)
}

export function startOfMonth(date = new Date()): number {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0).getTime()
}

export function endOfMonth(date = new Date()): number {
  return new Date(
    date.getFullYear(),
    date.getMonth() + 1,
    0,
    23,
    59,
    59,
    999
  ).getTime()
}

export function startOfWeek(date = new Date()): number {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) // lunes como inicio
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export function endOfWeek(date = new Date()): number {
  return startOfWeek(date) + 7 * 24 * 60 * 60 * 1000 - 1
}
