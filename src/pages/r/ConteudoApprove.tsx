import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { CheckCircle2, ExternalLink, Loader2, MessageSquareWarning } from 'lucide-react'

/**
 * Página que o cliente abre pra aprovar a peça. Sem login, só o token do link.
 *
 * Ela fala com /api/aprovar-conteudo (service role): a tabela content_posts
 * continua fechada pro anon, então o link dá acesso a uma peça só.
 */

type Post = {
  id: string
  title: string
  format: string
  status: string
  caption: string | null
  hashtags: string | null
  arquivo_url: string | null
  preview_url: string | null
  scheduled_date: string | null
  motivo_ajuste: string | null
  aprovado_em: string | null
  aprovado_por: string | null
  clients?: { name: string; company: string } | null
}

const FORMAT_LABEL: Record<string, string> = {
  carrossel: 'Carrossel',
  reels: 'Reels',
  stories: 'Stories',
  feed: 'Feed',
}

export default function ConteudoApprove() {
  const { token = '' } = useParams()
  const [post, setPost] = useState<Post | null>(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [feito, setFeito] = useState<'aprovar' | 'ajuste' | null>(null)
  const [pedindoAjuste, setPedindoAjuste] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [nome, setNome] = useState('')

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch(`/api/aprovar-conteudo?token=${encodeURIComponent(token)}`)
      const j = await r.json()
      if (!r.ok) {
        setErro(j.error === 'nao_encontrado' ? 'Este link não existe ou expirou.' : 'Não foi possível carregar.')
      } else {
        setPost(j.post)
      }
    } catch {
      setErro('Não foi possível carregar. Verifique sua conexão.')
    }
    setLoading(false)
  }, [token])

  useEffect(() => { carregar() }, [carregar])

  const responder = async (acao: 'aprovar' | 'ajuste') => {
    if (acao === 'ajuste' && motivo.trim().length < 3) return
    setEnviando(true)
    try {
      const r = await fetch('/api/aprovar-conteudo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, acao, nome, motivo }),
      })
      const j = await r.json()
      if (r.ok) {
        setFeito(acao)
      } else if (j.error === 'ja_respondida') {
        setPost(j.post)
        setErro('Esta peça já foi respondida.')
      } else if (j.error === 'motivo_obrigatorio') {
        setErro('Escreva o que precisa mudar.')
      } else {
        setErro('Não foi possível registrar. Tente de novo.')
      }
    } catch {
      setErro('Não foi possível registrar. Verifique sua conexão.')
    }
    setEnviando(false)
  }

  const jaRespondida = post && post.status !== 'aprovacao'

  return (
    <div className="min-h-screen bg-[#0A0608] text-[#F7F2E7] px-5 py-10">
      <div className="mx-auto w-full max-w-xl">
        <p className="text-[11px] uppercase tracking-[0.18em] text-[#D4A82C]">Aprovação de conteúdo</p>

        {loading && (
          <div className="mt-10 flex items-center gap-3 text-sm text-[#A89B82]">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando a peça...
          </div>
        )}

        {!loading && erro && !post && (
          <p className="mt-8 text-sm text-[#E0726A]">{erro}</p>
        )}

        {post && (
          <>
            <h1 className="mt-2 text-2xl font-semibold leading-tight">{post.title}</h1>
            <p className="mt-1 text-sm text-[#A89B82]">
              {post.clients?.name}
              {post.clients?.company ? ` · ${post.clients.company}` : ''}
              {' · '}
              {FORMAT_LABEL[post.format] || post.format}
            </p>

            {post.preview_url && (
              <img
                src={post.preview_url}
                alt="Prévia da peça"
                className="mt-5 w-full rounded-2xl border border-white/10"
              />
            )}

            {post.arquivo_url && (
              <a
                href={post.arquivo_url}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex items-center gap-2 rounded-xl border border-[#D4A82C]/40 bg-[#D4A82C]/10 px-4 py-2.5 text-sm font-medium text-[#FDEBA8] hover:bg-[#D4A82C]/20"
              >
                <ExternalLink className="h-4 w-4" />
                {post.format === 'reels' ? 'Assistir o vídeo em qualidade' : 'Abrir o arquivo'}
              </a>
            )}

            {post.caption && (
              <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="mb-2 text-[11px] uppercase tracking-widest text-[#A89B82]">Legenda</p>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#DCD1B8]">{post.caption}</p>
                {post.hashtags && <p className="mt-3 text-sm text-[#8FA9C8]">{post.hashtags}</p>}
              </div>
            )}

            {/* Resultado */}
            {(feito || jaRespondida) && (
              <div className="mt-7 rounded-2xl border p-4"
                   style={{
                     borderColor: (feito ?? (post.status === 'aprovado' ? 'aprovar' : 'ajuste')) === 'aprovar'
                       ? 'rgba(74,190,124,0.35)' : 'rgba(224,114,106,0.35)',
                     background: (feito ?? (post.status === 'aprovado' ? 'aprovar' : 'ajuste')) === 'aprovar'
                       ? 'rgba(74,190,124,0.08)' : 'rgba(224,114,106,0.08)',
                   }}>
                {(feito ?? (post.status === 'aprovado' ? 'aprovar' : 'ajuste')) === 'aprovar' ? (
                  <p className="flex items-center gap-2 text-sm text-[#7BD6A0]">
                    <CheckCircle2 className="h-4 w-4" /> Aprovado. Obrigado! Já avisamos a equipe.
                  </p>
                ) : (
                  <div className="text-sm text-[#F0A9A3]">
                    <p className="flex items-center gap-2 font-medium">
                      <MessageSquareWarning className="h-4 w-4" /> Ajuste registrado.
                    </p>
                    {post.motivo_ajuste && (
                      <p className="mt-2 whitespace-pre-wrap text-[#DCD1B8]">{post.motivo_ajuste}</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Ações */}
            {!feito && !jaRespondida && (
              <div className="mt-7 space-y-3">
                <input
                  value={nome}
                  onChange={e => setNome(e.target.value)}
                  placeholder="Seu nome (opcional)"
                  maxLength={80}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm outline-none placeholder:text-[#6E634F] focus:border-[#D4A82C]/50"
                />

                {!pedindoAjuste ? (
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <button
                      onClick={() => responder('aprovar')}
                      disabled={enviando}
                      className="flex-1 rounded-xl bg-[#4ABE7C] px-4 py-3.5 text-sm font-semibold text-[#06210f] disabled:opacity-60"
                    >
                      {enviando ? 'Registrando...' : 'Aprovar e publicar'}
                    </button>
                    <button
                      onClick={() => setPedindoAjuste(true)}
                      disabled={enviando}
                      className="flex-1 rounded-xl border border-white/15 px-4 py-3.5 text-sm font-medium text-[#DCD1B8] disabled:opacity-60"
                    >
                      Pedir ajuste
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <textarea
                      value={motivo}
                      onChange={e => setMotivo(e.target.value)}
                      rows={4}
                      maxLength={800}
                      autoFocus
                      placeholder="O que precisa mudar? Quanto mais específico, mais rápido a equipe resolve."
                      className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm outline-none placeholder:text-[#6E634F] focus:border-[#D4A82C]/50"
                    />
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <button
                        onClick={() => responder('ajuste')}
                        disabled={enviando || motivo.trim().length < 3}
                        className="flex-1 rounded-xl bg-[#E89A1C] px-4 py-3.5 text-sm font-semibold text-[#231402] disabled:opacity-50"
                      >
                        {enviando ? 'Enviando...' : 'Enviar ajuste'}
                      </button>
                      <button
                        onClick={() => { setPedindoAjuste(false); setMotivo('') }}
                        disabled={enviando}
                        className="rounded-xl border border-white/15 px-4 py-3.5 text-sm text-[#A89B82]"
                      >
                        Voltar
                      </button>
                    </div>
                  </div>
                )}

                {erro && <p className="text-sm text-[#E0726A]">{erro}</p>}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
