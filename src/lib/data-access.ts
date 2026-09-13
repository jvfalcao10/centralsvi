type Result<T> = { data: T | null; error: { message: string } | null }

/** Cada página deve ter uma ordenação estável, incluindo a chave primária. */
export async function fetchAllRows<T>(page: (from: number, to: number) => PromiseLike<Result<T[]>>) {
  const rows: T[] = []
  const pageSize = 500
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await page(from, from + pageSize - 1)
    if (error) throw new Error(error.message)
    if (data === null) throw new Error('A consulta não retornou os dados esperados')
    rows.push(...data)
    if (data.length < pageSize) return rows
  }
}

/** Exige representação da linha salva. RLS pode impedir UPDATE sem retornar erro. */
export async function confirmSaved<T>(operation: PromiseLike<Result<T[]>>, expectedRows = 1) {
  const { data, error } = await operation
  if (error) throw new Error(error.message)
  if (!data || data.length !== expectedRows) {
    throw new Error('A alteração não foi confirmada. Atualize os dados e confira seu acesso antes de tentar novamente.')
  }
  return data
}

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Não foi possível concluir a operação. Tente novamente.'
}
