import { useEffect, useMemo, useState } from 'react'
import {
  Home,
  List,
  Plus,
  HandCoins,
  PieChart as PieChartIcon,
  X,
  Trash2,
  RefreshCw,
  ArrowRightLeft,
  Settings as SettingsIcon,
  Download,
  Upload,
  ShieldAlert,
} from 'lucide-react'
import {
  exportBackup,
  downloadBackupFile,
  importBackup,
  wipeAllData,
  getAdminPin,
  setAdminPin,
  type BackupData,
} from './services/backupService'
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import { useFinanceStore } from './store/financeStore'
import {
  formatARS,
  formatNumber,
  calcTotalLiquidity,
  calcMonthlyFlow,
  calcParetoAnalysis,
  calcSavingsSuggestion,
  startOfMonth,
  endOfMonth,
} from './utils/money'
import type {
  Account,
  AccountType,
  Currency,
  PaymentMethod,
  Transaction,
  TransactionType,
  Debt,
  DebtType,
} from './types/finance'

type Screen = 'dashboard' | 'movimientos' | 'deudas' | 'analisis'

export default function App() {
  const { init, loading } = useFinanceStore()
  const [screen, setScreen] = useState<Screen>('dashboard')
  const [showAddAccount, setShowAddAccount] = useState(false)
  const [showAddTx, setShowAddTx] = useState(false)

  useEffect(() => {
    init()
  }, [init])

  if (loading) {
    return (
      <div className="app-shell">
        <div className="screen" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span className="mono text-secondary">Cargando terminal...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="app-shell">
      {screen === 'dashboard' && <Dashboard onAddTx={() => setShowAddTx(true)} />}
      {screen === 'movimientos' && <Movimientos onAddTx={() => setShowAddTx(true)} />}
      {screen === 'deudas' && <Deudas />}
      {screen === 'analisis' && <Analisis />}

      <TabBar
        screen={screen}
        setScreen={setScreen}
        onCenterPress={() => setShowAddAccount(true)}
      />

      {showAddAccount && <AddAccountModal onClose={() => setShowAddAccount(false)} />}
      {showAddTx && <AddTransactionModal onClose={() => setShowAddTx(false)} />}
    </div>
  )
}

// ============================================================
// TabBar
// ============================================================
function TabBar({
  screen,
  setScreen,
  onCenterPress,
}: {
  screen: Screen
  setScreen: (s: Screen) => void
  onCenterPress: () => void
}) {
  return (
    <nav className="tabbar">
      <TabButton icon={<Home size={20} />} label="Inicio" active={screen === 'dashboard'} onClick={() => setScreen('dashboard')} />
      <TabButton icon={<List size={20} />} label="Movs" active={screen === 'movimientos'} onClick={() => setScreen('movimientos')} />
      <button className="tab-btn-center" onClick={onCenterPress} aria-label="Agregar cuenta">
        <Plus size={26} />
      </button>
      <TabButton icon={<HandCoins size={20} />} label="Deudas" active={screen === 'deudas'} onClick={() => setScreen('deudas')} />
      <TabButton icon={<PieChartIcon size={20} />} label="Análisis" active={screen === 'analisis'} onClick={() => setScreen('analisis')} />
    </nav>
  )
}

function TabButton({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button className={`tab-btn ${active ? 'active' : ''}`} onClick={onClick}>
      {icon}
      <span>{label}</span>
    </button>
  )
}

// ============================================================
// DASHBOARD
// ============================================================
function Dashboard({ onAddTx }: { onAddTx: () => void }) {
  const { accounts, transactions, debts, usdtToArsRate, rateSource, refreshRate, setManualRate } =
    useFinanceStore()
  const [editingRate, setEditingRate] = useState(false)
  const [rateInput, setRateInput] = useState('')
  const [showSettings, setShowSettings] = useState(false)

  const { totalARS } = calcTotalLiquidity(accounts, usdtToArsRate)
  const monthFlow = calcMonthlyFlow(transactions, usdtToArsRate, startOfMonth(), endOfMonth())
  const savings = calcSavingsSuggestion(monthFlow.net)

  const debtIOwe = debts
    .filter((d) => d.type === 'PASSIVE' && !d.settled)
    .reduce((sum, d) => sum + d.remainingAmountNominal, 0)
  const debtOwedToMe = debts
    .filter((d) => d.type === 'ACTIVE' && !d.settled)
    .reduce((sum, d) => sum + d.remainingAmountNominal, 0)

  return (
    <div className="screen">
      <div className="header row">
        <h1>Finance Terminal</h1>
        <button className="pill" onClick={() => setShowSettings(true)}>
          <SettingsIcon size={13} />
        </button>
      </div>
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}

      <div className="card">
        <p className="card-title">Liquidez total</p>
        <p className="big-number mono text-blue">{formatARS(totalARS)}</p>
        <div className="row" style={{ marginTop: 10 }}>
          {editingRate ? (
            <div style={{ display: 'flex', gap: 8, width: '100%' }}>
              <input
                type="number"
                placeholder="Valor USDT/ARS"
                value={rateInput}
                onChange={(e) => setRateInput(e.target.value)}
                style={{ flex: 1 }}
              />
              <button
                className="btn btn-primary"
                style={{ width: 'auto', padding: '10px 14px' }}
                onClick={() => {
                  const v = parseFloat(rateInput)
                  if (!isNaN(v) && v > 0) {
                    setManualRate(v)
                    setEditingRate(false)
                  }
                }}
              >
                OK
              </button>
            </div>
          ) : (
            <>
              <span className="pill">
                1 USDT = {formatNumber(usdtToArsRate, 2)} ARS · {rateSource}
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="pill" onClick={() => refreshRate()}>
                  <RefreshCw size={12} />
                </button>
                <button className="pill" onClick={() => setEditingRate(true)}>
                  Editar
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="card">
        <p className="card-title">Flujo del mes</p>
        <div className="row">
          <span className="text-secondary">Ingresos</span>
          <span className="mono text-blue">{formatARS(monthFlow.income)}</span>
        </div>
        <div className="row">
          <span className="text-secondary">Gastos</span>
          <span className="mono text-red">{formatARS(monthFlow.expense)}</span>
        </div>
        <div className="row">
          <span className="text-secondary">Neto</span>
          <span className={`mono ${monthFlow.net >= 0 ? 'text-green' : 'text-red'}`}>
            {formatARS(monthFlow.net)}
          </span>
        </div>
        <div className="row">
          <span className="text-secondary">Ahorro sugerido (30%)</span>
          <span className="mono text-green">{formatARS(savings)}</span>
        </div>
      </div>

      <div className="card">
        <div className="row">
          <p className="card-title" style={{ margin: 0 }}>Cuentas</p>
        </div>
        {accounts.filter((a) => !a.archived).length === 0 && (
          <p className="empty-state">No hay cuentas todavía. Tocá el botón + para agregar una.</p>
        )}
        {accounts
          .filter((a) => !a.archived)
          .map((acc) => (
            <div className="list-item" key={acc.id}>
              <div>
                <div>{acc.name}</div>
                <div className="text-secondary" style={{ fontSize: 11 }}>
                  {accountTypeLabel(acc.type)} · {acc.currency}
                </div>
              </div>
              <span className="mono">
                {acc.currency === 'ARS'
                  ? formatARS(acc.balanceNominal)
                  : `${formatNumber(acc.balanceNominal, 2)} ${acc.currency}`}
              </span>
            </div>
          ))}
      </div>

      <div className="card">
        <p className="card-title">Deudas</p>
        <div className="row">
          <span className="text-amber">Debo</span>
          <span className="mono text-amber">{formatARS(debtIOwe)}</span>
        </div>
        <div className="row">
          <span className="text-green">Me deben</span>
          <span className="mono text-green">{formatARS(debtOwedToMe)}</span>
        </div>
      </div>

      <button className="btn btn-primary" onClick={onAddTx}>
        + Registrar movimiento
      </button>
    </div>
  )
}

function accountTypeLabel(type: AccountType): string {
  if (type === 'CASH') return 'Efectivo'
  if (type === 'BANK') return 'Banco'
  return 'Cripto'
}

// ============================================================
// MOVIMIENTOS
// ============================================================
function Movimientos({ onAddTx }: { onAddTx: () => void }) {
  const { transactions, accounts, categories, deleteTransaction } = useFinanceStore()

  return (
    <div className="screen">
      <div className="header row">
        <h1>Movimientos</h1>
        <button className="pill" onClick={onAddTx}>
          <Plus size={12} /> Nuevo
        </button>
      </div>

      <div className="card">
        {transactions.length === 0 && (
          <p className="empty-state">Todavía no registraste ningún movimiento.</p>
        )}
        {transactions.map((tx) => {
          const acc = accounts.find((a) => a.id === tx.accountId)
          const cat = categories.find((c) => c.id === tx.categoryId)
          return (
            <div className="list-item" key={tx.id}>
              <div>
                <div>{cat?.name ?? txTypeLabel(tx.type)}</div>
                <div className="text-secondary" style={{ fontSize: 11 }}>
                  {new Date(tx.timestamp).toLocaleDateString('es-AR')} · {acc?.name ?? '—'}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span
                  className={`mono ${
                    tx.type === 'INCOME'
                      ? 'text-blue'
                      : tx.type === 'EXPENSE' || tx.type === 'DEBT_PAYMENT'
                      ? 'text-red'
                      : 'text-secondary'
                  }`}
                >
                  {tx.type === 'INCOME' ? '+' : '-'}
                  {tx.currency === 'ARS'
                    ? formatARS(tx.amountNominal)
                    : `${formatNumber(tx.amountNominal, 2)} ${tx.currency}`}
                </span>
                <button onClick={() => tx.id && deleteTransaction(tx.id)}>
                  <Trash2 size={14} color="#64748B" />
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function txTypeLabel(type: TransactionType): string {
  if (type === 'INCOME') return 'Ingreso'
  if (type === 'EXPENSE') return 'Gasto'
  if (type === 'SELF_TRANSFER') return 'Transferencia'
  return 'Pago de deuda'
}

// ============================================================
// DEUDAS
// ============================================================
function Deudas() {
  const { debts, accounts, payDebt, addDebt } = useFinanceStore()
  const [showAddDebt, setShowAddDebt] = useState(false)
  const [payingDebt, setPayingDebt] = useState<Debt | null>(null)

  const passive = debts.filter((d) => d.type === 'PASSIVE')
  const active = debts.filter((d) => d.type === 'ACTIVE')

  return (
    <div className="screen">
      <div className="header row">
        <h1>Deudas</h1>
        <button className="pill" onClick={() => setShowAddDebt(true)}>
          <Plus size={12} /> Nueva
        </button>
      </div>

      <div className="card">
        <p className="card-title text-amber">Debo</p>
        {passive.length === 0 && <p className="empty-state">No tenés deudas activas.</p>}
        {passive.map((d) => (
          <DebtRow key={d.id} debt={d} onPay={() => setPayingDebt(d)} />
        ))}
      </div>

      <div className="card">
        <p className="card-title text-green">Me deben</p>
        {active.length === 0 && <p className="empty-state">Nadie te debe plata (por ahora).</p>}
        {active.map((d) => (
          <DebtRow key={d.id} debt={d} onPay={() => setPayingDebt(d)} />
        ))}
      </div>

      {showAddDebt && (
        <AddDebtModal onClose={() => setShowAddDebt(false)} onSubmit={addDebt} />
      )}

      {payingDebt && (
        <PayDebtModal
          debt={payingDebt}
          accounts={accounts}
          onClose={() => setPayingDebt(null)}
          onSubmit={async (amount, accountId, paymentMethod) => {
            const acc = accounts.find((a) => a.id === accountId)
            if (!acc || !payingDebt.id) return
            await payDebt(payingDebt.id, amount, accountId, acc.currency, paymentMethod)
            setPayingDebt(null)
          }}
        />
      )}
    </div>
  )
}

function DebtRow({ debt, onPay }: { debt: Debt; onPay: () => void }) {
  const pct = debt.originalAmountNominal > 0
    ? Math.min(100, ((debt.originalAmountNominal - debt.remainingAmountNominal) / debt.originalAmountNominal) * 100)
    : 0

  return (
    <div style={{ marginBottom: 14 }}>
      <div className="row">
        <div>
          <div>{debt.counterparty}</div>
          <div className="text-secondary" style={{ fontSize: 11 }}>
            {debt.settled ? 'Saldada' : `Vence: ${debt.dueDate ? new Date(debt.dueDate).toLocaleDateString('es-AR') : '—'}`}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="mono">
            {debt.currency === 'ARS'
              ? formatARS(debt.remainingAmountNominal)
              : `${formatNumber(debt.remainingAmountNominal, 2)} ${debt.currency}`}
          </div>
          {!debt.settled && (
            <button className="pill" style={{ marginTop: 4 }} onClick={onPay}>
              Registrar pago
            </button>
          )}
        </div>
      </div>
      <div className="progress-track" style={{ marginTop: 8 }}>
        <div
          className="progress-fill"
          style={{
            width: `${pct}%`,
            background: debt.type === 'PASSIVE' ? '#F59E0B' : '#4ADE80',
          }}
        />
      </div>
    </div>
  )
}

// ============================================================
// ANÁLISIS
// ============================================================
function Analisis() {
  const { transactions, categories, usdtToArsRate } = useFinanceStore()

  const pareto = useMemo(
    () => calcParetoAnalysis(transactions, categories, usdtToArsRate),
    [transactions, categories, usdtToArsRate]
  )

  const totalExpense = pareto.reduce((sum, item) => sum + item.total, 0)

  const pieData = pareto.map((item) => ({
    name: item.categoryName,
    value: item.total,
    color: item.color,
  }))

  return (
    <div className="screen">
      <div className="header">
        <h1>Análisis</h1>
      </div>

      <div className="card">
        <p className="card-title">Gasto total registrado</p>
        <p className="big-number mono text-red">{formatARS(totalExpense)}</p>
      </div>

      {pareto.length === 0 ? (
        <div className="card">
          <p className="empty-state">Registrá gastos para ver el análisis por categoría.</p>
        </div>
      ) : (
        <>
          <div className="card" style={{ height: 240 }}>
            <p className="card-title">Distribución por categoría</p>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80}>
                  {pieData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.color} stroke="#0A0E14" />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: '#111822', border: '1px solid #1E2A3A', borderRadius: 8 }}
                  formatter={(value: number) => formatARS(value)}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="card">
            <p className="card-title">Análisis Pareto (80/20)</p>
            <p className="text-secondary" style={{ fontSize: 12, marginTop: -4, marginBottom: 12 }}>
              Categorías marcadas en verde concentran el 80% de tu gasto.
            </p>
            {pareto.map((item) => (
              <div key={item.categoryId} style={{ marginBottom: 10 }}>
                <div className="row">
                  <span style={{ color: item.isVital ? '#4ADE80' : '#D4E0F0' }}>
                    {item.categoryName}
                  </span>
                  <span className="mono text-secondary">{formatARS(item.total)}</span>
                </div>
                <div className="progress-track">
                  <div
                    className="progress-fill"
                    style={{
                      width: `${totalExpense > 0 ? (item.total / totalExpense) * 100 : 0}%`,
                      background: item.isVital ? '#4ADE80' : '#64748B',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ============================================================
// MODAL: Agregar cuenta (botón central +)
// ============================================================
function AddAccountModal({ onClose }: { onClose: () => void }) {
  const { addAccount } = useFinanceStore()
  const [name, setName] = useState('')
  const [type, setType] = useState<AccountType>('CASH')
  const [currency, setCurrency] = useState<Currency>('ARS')
  const [balance, setBalance] = useState('')

  const submit = async () => {
    if (!name.trim()) return
    await addAccount({
      name: name.trim(),
      type,
      currency,
      balanceNominal: parseFloat(balance) || 0,
    })
    onClose()
  }

  return (
    <ModalShell title="Nueva cuenta" onClose={onClose}>
      <div className="field">
        <label>Nombre</label>
        <input placeholder="Ej: Efectivo ARS, Banco, Binance" value={name} onChange={(e) => setName(e.target.value)} />
      </div>

      <div className="field">
        <label>Tipo</label>
        <div className="segmented">
          {(['CASH', 'BANK', 'CRYPTO'] as AccountType[]).map((t) => (
            <button key={t} className={type === t ? 'active' : ''} onClick={() => setType(t)}>
              {accountTypeLabel(t)}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <label>Moneda</label>
        <div className="segmented">
          {(['ARS', 'USD', 'USDT'] as Currency[]).map((c) => (
            <button key={c} className={currency === c ? 'active' : ''} onClick={() => setCurrency(c)}>
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <label>Saldo inicial</label>
        <input type="number" placeholder="0" value={balance} onChange={(e) => setBalance(e.target.value)} />
      </div>

      <button className="btn btn-primary" onClick={submit}>
        Crear cuenta
      </button>
    </ModalShell>
  )
}

// ============================================================
// MODAL: Agregar transacción (ingreso/gasto/transferencia)
// ============================================================
function AddTransactionModal({ onClose }: { onClose: () => void }) {
  const { accounts, categories, addTransaction, usdtToArsRate } = useFinanceStore()
  const [type, setType] = useState<TransactionType>('EXPENSE')
  const [amount, setAmount] = useState('')
  const [accountId, setAccountId] = useState<number | ''>('')
  const [toAccountId, setToAccountId] = useState<number | ''>('')
  const [categoryId, setCategoryId] = useState<number | ''>('')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('EFECTIVO')
  const [notes, setNotes] = useState('')

  const selectedAccount = accounts.find((a) => a.id === accountId)
  const relevantCategories = categories.filter((c) =>
    type === 'INCOME' ? c.kind === 'INCOME' : c.kind === 'EXPENSE'
  )

  const submit = async () => {
    const amountNum = parseFloat(amount)
    if (!amountNum || amountNum <= 0 || !accountId || !selectedAccount) return
    if (type === 'SELF_TRANSFER' && !toAccountId) return

    const tx: Omit<Transaction, 'id'> = {
      timestamp: Date.now(),
      type,
      amountNominal: amountNum,
      currency: selectedAccount.currency,
      exchangeRateToBase: usdtToArsRate,
      paymentMethod,
      accountId: accountId as number,
      toAccountId: type === 'SELF_TRANSFER' ? (toAccountId as number) : undefined,
      categoryId: type === 'INCOME' || type === 'EXPENSE' ? (categoryId ? (categoryId as number) : undefined) : undefined,
      notes: notes.trim() || undefined,
    }

    await addTransaction(tx)
    onClose()
  }

  if (accounts.length === 0) {
    return (
      <ModalShell title="Nuevo movimiento" onClose={onClose}>
        <p className="empty-state">
          Primero creá una cuenta desde el botón + del centro de la barra inferior.
        </p>
      </ModalShell>
    )
  }

  return (
    <ModalShell title="Nuevo movimiento" onClose={onClose}>
      <div className="field">
        <label>Tipo</label>
        <div className="segmented">
          <button className={type === 'INCOME' ? 'active' : ''} onClick={() => setType('INCOME')}>
            Ingreso
          </button>
          <button className={type === 'EXPENSE' ? 'active' : ''} onClick={() => setType('EXPENSE')}>
            Gasto
          </button>
          <button className={type === 'SELF_TRANSFER' ? 'active' : ''} onClick={() => setType('SELF_TRANSFER')}>
            <ArrowRightLeft size={12} />
          </button>
        </div>
      </div>

      <div className="field">
        <label>Monto</label>
        <input type="number" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </div>

      <div className="field">
        <label>{type === 'SELF_TRANSFER' ? 'Cuenta origen' : 'Cuenta'}</label>
        <select value={accountId} onChange={(e) => setAccountId(Number(e.target.value))}>
          <option value="">Seleccionar...</option>
          {accounts
            .filter((a) => !a.archived)
            .map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.currency})
              </option>
            ))}
        </select>
      </div>

      {type === 'SELF_TRANSFER' && (
        <div className="field">
          <label>Cuenta destino</label>
          <select value={toAccountId} onChange={(e) => setToAccountId(Number(e.target.value))}>
            <option value="">Seleccionar...</option>
            {accounts
              .filter((a) => !a.archived && a.id !== accountId)
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.currency})
                </option>
              ))}
          </select>
        </div>
      )}

      {(type === 'INCOME' || type === 'EXPENSE') && (
        <div className="field">
          <label>Categoría</label>
          <select value={categoryId} onChange={(e) => setCategoryId(Number(e.target.value))}>
            <option value="">Sin categoría</option>
            {relevantCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="field">
        <label>Método de pago</label>
        <div className="segmented">
          <button className={paymentMethod === 'EFECTIVO' ? 'active' : ''} onClick={() => setPaymentMethod('EFECTIVO')}>
            Efectivo
          </button>
          <button className={paymentMethod === 'TRANSFERENCIA' ? 'active' : ''} onClick={() => setPaymentMethod('TRANSFERENCIA')}>
            Transferencia
          </button>
        </div>
      </div>

      <div className="field">
        <label>Notas (opcional)</label>
        <input placeholder="Detalle..." value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      <button className="btn btn-primary" onClick={submit}>
        Guardar movimiento
      </button>
    </ModalShell>
  )
}

// ============================================================
// MODAL: Agregar deuda
// ============================================================
function AddDebtModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void
  onSubmit: (debt: Omit<Debt, 'id' | 'createdAt' | 'remainingAmountNominal'>) => Promise<void>
}) {
  const [type, setType] = useState<DebtType>('PASSIVE')
  const [counterparty, setCounterparty] = useState('')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState<Currency>('ARS')
  const [dueDate, setDueDate] = useState('')

  const submit = async () => {
    const amountNum = parseFloat(amount)
    if (!counterparty.trim() || !amountNum || amountNum <= 0) return

    await onSubmit({
      type,
      counterparty: counterparty.trim(),
      originalAmountNominal: amountNum,
      currency,
      dueDate: dueDate ? new Date(dueDate).getTime() : undefined,
    })
    onClose()
  }

  return (
    <ModalShell title="Nueva deuda" onClose={onClose}>
      <div className="field">
        <label>Tipo</label>
        <div className="segmented">
          <button className={type === 'PASSIVE' ? 'active' : ''} onClick={() => setType('PASSIVE')}>
            Yo debo
          </button>
          <button className={type === 'ACTIVE' ? 'active' : ''} onClick={() => setType('ACTIVE')}>
            Me deben
          </button>
        </div>
      </div>

      <div className="field">
        <label>Contraparte</label>
        <input placeholder="Nombre de la persona" value={counterparty} onChange={(e) => setCounterparty(e.target.value)} />
      </div>

      <div className="field-row">
        <div className="field">
          <label>Monto</label>
          <input type="number" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div className="field">
          <label>Moneda</label>
          <select value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}>
            <option value="ARS">ARS</option>
            <option value="USD">USD</option>
            <option value="USDT">USDT</option>
          </select>
        </div>
      </div>

      <div className="field">
        <label>Vencimiento (opcional)</label>
        <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
      </div>

      <button className="btn btn-primary" onClick={submit}>
        Crear deuda
      </button>
    </ModalShell>
  )
}

// ============================================================
// MODAL: Pagar / cobrar deuda
// ============================================================
function PayDebtModal({
  debt,
  accounts,
  onClose,
  onSubmit,
}: {
  debt: Debt
  accounts: Account[]
  onClose: () => void
  onSubmit: (amount: number, accountId: number, paymentMethod: PaymentMethod) => Promise<void>
}) {
  const [amount, setAmount] = useState(String(debt.remainingAmountNominal))
  const [accountId, setAccountId] = useState<number | ''>('')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('EFECTIVO')

  const submit = async () => {
    const amountNum = parseFloat(amount)
    if (!amountNum || amountNum <= 0 || !accountId) return
    await onSubmit(amountNum, accountId as number, paymentMethod)
  }

  return (
    <ModalShell title={debt.type === 'PASSIVE' ? 'Registrar pago' : 'Registrar cobro'} onClose={onClose}>
      <div className="field">
        <label>Monto</label>
        <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </div>

      <div className="field">
        <label>Cuenta</label>
        <select value={accountId} onChange={(e) => setAccountId(Number(e.target.value))}>
          <option value="">Seleccionar...</option>
          {accounts
            .filter((a) => !a.archived)
            .map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.currency})
              </option>
            ))}
        </select>
      </div>

      <div className="field">
        <label>Método de pago</label>
        <div className="segmented">
          <button className={paymentMethod === 'EFECTIVO' ? 'active' : ''} onClick={() => setPaymentMethod('EFECTIVO')}>
            Efectivo
          </button>
          <button className={paymentMethod === 'TRANSFERENCIA' ? 'active' : ''} onClick={() => setPaymentMethod('TRANSFERENCIA')}>
            Transferencia
          </button>
        </div>
      </div>

      <button className="btn btn-primary" onClick={submit}>
        Confirmar
      </button>
    </ModalShell>
  )
}

// ============================================================
// MODAL: Ajustes — exportar / importar / zona administrador
// ============================================================
function SettingsModal({ onClose }: { onClose: () => void }) {
  const { reloadAll } = useFinanceStore()
  const [msg, setMsg] = useState('')
  const [adminOpen, setAdminOpen] = useState(false)
  const [pinInput, setPinInput] = useState('')
  const [confirmWipe, setConfirmWipe] = useState(false)

  const handleExport = async () => {
    const data = await exportBackup()
    downloadBackupFile(data)
    setMsg('Backup descargado ✅')
  }

  const handleImportFile = async (file: File) => {
    try {
      const text = await file.text()
      const data = JSON.parse(text) as BackupData
      await importBackup(data)
      await reloadAll()
      setMsg('Datos importados ✅ (reemplazaron los anteriores)')
    } catch (e) {
      setMsg('❌ Archivo inválido, no se pudo importar')
    }
  }

  const handleAdminEnter = async () => {
    const savedPin = await getAdminPin()
    if (!savedPin) {
      // Primera vez: el PIN ingresado queda registrado como el nuevo PIN
      if (pinInput.trim().length < 4) {
        setMsg('El PIN debe tener al menos 4 dígitos')
        return
      }
      await setAdminPin(pinInput.trim())
      setAdminOpen(true)
      setMsg('PIN de administrador creado ✅')
    } else if (savedPin === pinInput.trim()) {
      setAdminOpen(true)
      setMsg('')
    } else {
      setMsg('❌ PIN incorrecto')
    }
  }

  const handleWipe = async () => {
    await wipeAllData()
    await reloadAll()
    setConfirmWipe(false)
    setAdminOpen(false)
    setMsg('Todos los datos fueron eliminados ✅')
  }

  return (
    <ModalShell title="Ajustes" onClose={onClose}>
      <div className="field">
        <label>Backup</label>
        <button className="btn btn-ghost" onClick={handleExport} style={{ marginBottom: 8 }}>
          <Download size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
          Exportar datos (.json)
        </button>
        <label className="btn btn-ghost" style={{ display: 'block' }}>
          <Upload size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
          Importar datos (.json)
          <input
            type="file"
            accept="application/json"
            style={{ display: 'none' }}
            onChange={(e) => e.target.files && handleImportFile(e.target.files[0])}
          />
        </label>
        <p className="text-secondary" style={{ fontSize: 11, marginTop: 6 }}>
          Importar reemplaza todos los datos actuales por los del archivo.
        </p>
      </div>

      <div className="field" style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
        <label>
          <ShieldAlert size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
          Zona de administrador
        </label>

        {!adminOpen ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="password"
              placeholder="PIN admin"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
            />
            <button className="btn btn-primary" style={{ width: 'auto', padding: '10px 14px' }} onClick={handleAdminEnter}>
              Entrar
            </button>
          </div>
        ) : !confirmWipe ? (
          <button className="btn btn-danger" onClick={() => setConfirmWipe(true)}>
            <Trash2 size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
            Eliminar todos los datos
          </button>
        ) : (
          <div>
            <p className="text-red" style={{ fontSize: 12, marginBottom: 8 }}>
              Esto borra cuentas, movimientos, deudas y presupuestos. No se puede deshacer.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-ghost" onClick={() => setConfirmWipe(false)}>
                Cancelar
              </button>
              <button className="btn btn-danger" onClick={handleWipe}>
                Confirmar borrado
              </button>
            </div>
          </div>
        )}
      </div>

      {msg && <p className="text-secondary" style={{ fontSize: 12, marginTop: 10 }}>{msg}</p>}
    </ModalShell>
  )
}

// ============================================================
// Modal genérico (bottom sheet)
// ============================================================
function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="row">
          <p className="modal-title">{title}</p>
          <button onClick={onClose}>
            <X size={20} color="#64748B" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
