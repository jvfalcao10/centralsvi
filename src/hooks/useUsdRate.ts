import { useState, useEffect } from 'react'

const PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID
const DEFAULT_RATE = 5.0

let cachedRate: number | null = null
let cachedAt: Date | null = null

async function fetchUsdRate(): Promise<number> {
  try {
    if (!PROJECT_ID) return DEFAULT_RATE
    const url = `https://${PROJECT_ID}.supabase.co/functions/v1/get-usd-rate`
    const res = await fetch(url)
    if (!res.ok) return DEFAULT_RATE
    const json = await res.json()
    const rate = Number(json?.rate)
    return Number.isFinite(rate) && rate > 0 ? rate : DEFAULT_RATE
  } catch {
    return DEFAULT_RATE
  }
}

export function useUsdRate() {
  const [usdRate, setUsdRate] = useState<number>(cachedRate ?? DEFAULT_RATE)

  useEffect(() => {
    if (cachedRate !== null) {
      setUsdRate(cachedRate)
      return
    }
    fetchUsdRate().then(rate => {
      cachedRate = rate
      cachedAt = new Date()
      setUsdRate(rate)
    })
  }, [])

  return usdRate
}

export function useUsdRateInfo() {
  const [rate, setRate] = useState<number>(cachedRate ?? DEFAULT_RATE)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(cachedAt)
  const [isEstimate, setIsEstimate] = useState<boolean>(cachedRate === null)

  useEffect(() => {
    if (cachedRate !== null) {
      setRate(cachedRate)
      setUpdatedAt(cachedAt)
      setIsEstimate(false)
      return
    }
    fetchUsdRate().then(fetchedRate => {
      cachedRate = fetchedRate
      cachedAt = new Date()
      setRate(fetchedRate)
      setUpdatedAt(cachedAt)
      setIsEstimate(fetchedRate === DEFAULT_RATE)
    })
  }, [])

  return { rate: rate ?? DEFAULT_RATE, updatedAt, isEstimate }
}

export function mrrBRL(mrr: number, currency: string | undefined, usdRate: number): number {
  const safeRate = Number.isFinite(usdRate) && usdRate > 0 ? usdRate : DEFAULT_RATE
  return currency === 'USD' ? mrr * safeRate : mrr
}
