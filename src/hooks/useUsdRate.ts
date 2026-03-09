import { useState, useEffect } from 'react'

const PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID

let cachedRate: number | null = null

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
        setUsdRate(rate)
      })
      .catch(() => {
        cachedRate = 5.0
        setUsdRate(5.0)
      })
  }, [])

  return usdRate
}

export function mrrBRL(mrr: number, currency: string | undefined, usdRate: number): number {
  return currency === 'USD' ? mrr * usdRate : mrr
}
