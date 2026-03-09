import { useState, useEffect } from 'react'

const PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID

let cachedRate: number | null = null
let cachedAt: Date | null = null

export function useUsdRate() {
  const [usdRate, setUsdRate] = useState<number>(cachedRate ?? 5.0)

  useEffect(() => {
    if (cachedRate !== null) {
      setUsdRate(cachedRate)
      return
    }
    const url = `https://${PROJECT_ID}.supabase.co/functions/v1/get-usd-rate`
    fetch(url)
      .then(r => r.json())
      .then(({ rate }) => {
        cachedRate = rate
        cachedAt = new Date()
        setUsdRate(rate)
      })
      .catch(() => {
        cachedRate = 5.0
        setUsdRate(5.0)
      })
  }, [])

  return usdRate
}

export function useUsdRateInfo() {
  const [rate, setRate] = useState<number>(cachedRate ?? 5.0)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(cachedAt)
  const [isEstimate, setIsEstimate] = useState<boolean>(cachedRate === null)

  useEffect(() => {
    if (cachedRate !== null) {
      setRate(cachedRate)
      setUpdatedAt(cachedAt)
      setIsEstimate(false)
      return
    }
    const url = `https://${PROJECT_ID}.supabase.co/functions/v1/get-usd-rate`
    fetch(url)
      .then(r => r.json())
      .then(({ rate: fetchedRate }) => {
        cachedRate = fetchedRate
        cachedAt = new Date()
        setRate(fetchedRate)
        setUpdatedAt(cachedAt)
        setIsEstimate(false)
      })
      .catch(() => {
        cachedRate = 5.0
        setRate(5.0)
        setIsEstimate(true)
      })
  }, [])

  return { rate, updatedAt, isEstimate }
}

export function mrrBRL(mrr: number, currency: string | undefined, usdRate: number): number {
  return currency === 'USD' ? mrr * usdRate : mrr
}
