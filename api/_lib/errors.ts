export function humanizeDbError(error: { code?: string; message?: string } | null | undefined): {
  code: string;
  message: string;
} {
  if (!error) return { code: 'unknown', message: 'Erro desconhecido.' };
  const c = error.code || '';
  const msg = (error.message || '').toLowerCase();
  if (c === '23505' || msg.includes('duplicate key')) {
    if (msg.includes('slug')) return { code: 'slug_taken', message: 'Este slug já está em uso. Escolha outro.' };
    if (msg.includes('email')) return { code: 'email_taken', message: 'Este email já está cadastrado.' };
    return { code: 'duplicate', message: 'Já existe um registro com esses dados.' };
  }
  if (c === '23503') return { code: 'fk_violation', message: 'Referência inválida — verifique os dados.' };
  if (c === '23502') return { code: 'missing_required', message: 'Campo obrigatório faltando.' };
  if (c === '23514') return { code: 'constraint_failed', message: 'Os dados não atendem aos requisitos.' };
  if (c === '42501') return { code: 'permission_denied', message: 'Sem permissão pra essa ação.' };
  return { code: 'internal', message: 'Não foi possível concluir a operação. Tente de novo.' };
}

export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
