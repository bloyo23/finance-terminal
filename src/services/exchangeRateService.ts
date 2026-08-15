import { db } from '../db/db'

// NOTA IMPORTANTE:
// DolarHoy.com no expone una API pública con CORS habilitado para
// consultarse directo desde el navegador (bloquea fetch cross-origin).
// Por eso usamos dolarapi.com: es gratuita, sin API key, con CORS
// abierto, y trae los mismos valores (oficial / blue / cripto) que
// se ven en DolarHoy y similares. Si en algún momento no responde,
// la app cae automáticamente al valor manual que vos cargues.

const PAIR = 'USDT_ARS'
const CACHE_MS = 30 * 60 * 1000 // 30 minutos
const FETCH_TIMEOUT_MS = 8000
const API_URL = 'https://dolarapi.com/v1/dolares/blue'

interface DolarApiResponse {
  compra: number
  venta: number
  fechaActualizacion: string
}

async function fetchWithTimeout(url: string, ms: number): Promise<Response> {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), ms)
  try {
    const res = await fetch(url, { signal: controller.signal })
    return res
  } finally {
    clearTimeout(id)
  }
}

/**
 * Devuelve el valor actual de USDT/USD -> ARS.
 * 1) Si hay un valor en caché de menos de 30 minutos, lo usa.
 * 2) Si no, intenta pedirlo a la API (timeout 8s).
 * 3) Si falla, usa el último valor MANUAL guardado (o 0 si no hay ninguno).
 */
export async function getExchangeRate(): Promise<{
  value: number
  source: 'API' | 'MANUAL' | 'CACHE'
  fetchedAt: number
}> {
  const cached = await db.exchangeRates
    .where('pair')
    .equals(PAIR)
    .last()

  const now = Date.now()

  if (cached && now - cached.fetchedAt < CACHE_MS) {
    return {
      value: cached.value,
      source: cached.source === 'API' ? 'CACHE' : 'MANUAL',
      fetchedAt: cached.fetchedAt,
    }
  }

  try {
    const res = await fetchWithTimeout(API_URL, FETCH_TIMEOUT_MS)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data: DolarApiResponse = await res.json()
    const value = data.venta

    await db.exchangeRates.add({
      pair: PAIR,
      value,
      source: 'API',
      fetchedAt: now,
    })

    return { value, source: 'API', fetchedAt: now }
  } catch (err) {
    // Falla la red (sin internet, timeout, CORS, etc) -> usar manual
    const lastManual = await db.exchangeRates
      .where('pair')
      .equals(PAIR)
      .filter((r) => r.source === 'MANUAL')
      .last()

    if (lastManual) {
      return {
        value: lastManual.value,
        source: 'MANUAL',
        fetchedAt: lastManual.fetchedAt,
      }
    }

    if (cached) {
      return { value: cached.value, source: 'MANUAL', fetchedAt: cached.fetchedAt }
    }

    return { value: 0, source: 'MANUAL', fetchedAt: now }
  }
}

export async function setManualExchangeRate(value: number): Promise<void> {
  await db.exchangeRates.add({
    pair: PAIR,
    value,
    source: 'MANUAL',
    fetchedAt: Date.now(),
  })
}
