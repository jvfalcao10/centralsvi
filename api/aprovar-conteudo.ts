import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createAdminClient } from './_lib/supabase.js';

/**
 * Aprovação de conteúdo pelo cliente, sem login.
 *
 * Roda com service role de propósito: a tabela `content_posts` NÃO é aberta pro
 * anon. O cliente só enxerga a peça cujo token ele tem na mão, e só enquanto ela
 * estiver esperando resposta dele. Nenhum outro cliente vaza.
 *
 *   GET  /api/aprovar-conteudo?token=xxx   -> devolve a peça
 *   POST /api/aprovar-conteudo             -> { token, acao: 'aprovar'|'ajuste', nome?, motivo? }
 */

type Acao = 'aprovar' | 'ajuste';

// Só responde peça que está de fato com o cliente. Depois de respondida, o link
// mostra o resultado mas não aceita nova gravação.
const ABERTAS = ['aprovacao'];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');

  const supabase = createAdminClient();

  const token =
    req.method === 'GET'
      ? String(req.query.token || '')
      : String((req.body as { token?: string } | undefined)?.token || '');

  if (!token || token.length < 16) {
    return res.status(400).json({ error: 'token_invalido' });
  }

  const { data: post, error } = await supabase
    .from('content_posts')
    .select('id, title, format, status, caption, hashtags, arquivo_url, preview_url, scheduled_date, motivo_ajuste, aprovado_em, aprovado_por, clients(name, company)')
    .eq('token', token)
    .maybeSingle();

  if (error) return res.status(500).json({ error: 'erro_consulta' });
  if (!post) return res.status(404).json({ error: 'nao_encontrado' });

  if (req.method === 'GET') {
    return res.status(200).json({ post });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'metodo_nao_permitido' });
  }

  if (!ABERTAS.includes(post.status)) {
    // Já respondida. Não sobrescreve: devolve o estado atual pra tela mostrar.
    return res.status(409).json({ error: 'ja_respondida', post });
  }

  const body = (req.body || {}) as { acao?: Acao; nome?: string; motivo?: string };
  const acao = body.acao;
  const nome = (body.nome || '').trim().slice(0, 80);
  const motivo = (body.motivo || '').trim().slice(0, 800);

  if (acao !== 'aprovar' && acao !== 'ajuste') {
    return res.status(400).json({ error: 'acao_invalida' });
  }
  if (acao === 'ajuste' && motivo.length < 3) {
    return res.status(400).json({ error: 'motivo_obrigatorio' });
  }

  const patch =
    acao === 'aprovar'
      ? {
          status: 'aprovado',
          aprovado_em: new Date().toISOString(),
          aprovado_por: nome || 'Cliente',
          motivo_ajuste: null,
        }
      : {
          status: 'ajuste',
          motivo_ajuste: motivo,
          aprovado_em: null,
          aprovado_por: null,
        };

  const { error: upErr } = await supabase
    .from('content_posts')
    .update(patch)
    .eq('id', post.id)
    // trava de corrida: só grava se ainda estiver aguardando o cliente
    .eq('status', 'aprovacao');

  if (upErr) return res.status(500).json({ error: 'erro_gravacao' });

  return res.status(200).json({ ok: true, acao });
}
