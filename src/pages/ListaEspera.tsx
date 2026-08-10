import { useCallback, useEffect, useState } from 'react'
import { Users, RefreshCw, Mail, MessageCircle, ExternalLink } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { formatDate } from '@/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

/**
 * Lista de espera do centralparaagencias.svicompany.com.br.
 *
 * A página pública grava direto em `agencia_waitlist` com a chave anon, que só
 * tem permissão de INSERT: ninguém de fora consegue ler quem já se cadastrou.
 * A leitura acontece aqui, com o usuário logado na Central.
 */

type Inscrito = {
  id: string
  nome: string
  agencia: string
  email: string
  whatsapp: string | null
  qtd_clientes: string | null
  usa_hoje: string | null
  created_at: string
}

const soDigitos = (s: string) => s.replace(/\D/g, '')

export default function ListaEspera() {
  const [linhas, setLinhas] = useState<Inscrito[]>([])
  const [loading, setLoading] = useState(true)

  const buscar = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('agencia_waitlist')
      .select('*')
      .order('created_at', { ascending: false })
    setLinhas((data || []) as Inscrito[])
    setLoading(false)
  }, [])

  useEffect(() => { buscar() }, [buscar])

  const hoje = new Date().toISOString().slice(0, 10)
  const deHoje = linhas.filter(l => l.created_at.slice(0, 10) === hoje).length
  const daSemana = linhas.filter(l => l.created_at.slice(0, 10) >= new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10)).length
  // Agência maior tende a pagar mais e a sofrer mais com planilha, então priorizar.
  const grandes = linhas.filter(l => l.qtd_clientes === '16 a 30' || l.qtd_clientes === 'mais de 30').length

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>
  )

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" /> Lista de Espera
          </h1>
          <p className="text-sm text-muted-foreground">
            Agências que pediram a Central em{' '}
            <a href="https://centralparaagencias.svicompany.com.br" target="_blank" rel="noreferrer"
               className="text-primary hover:underline inline-flex items-center gap-1">
              centralparaagencias<ExternalLink className="h-3 w-3" />
            </a>
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={buscar}>
          <RefreshCw className="h-3.5 w-3.5" /> Atualizar
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { l: 'Total na lista', v: linhas.length, c: 'text-primary' },
          { l: 'Hoje', v: deHoje, c: 'text-success' },
          { l: 'Últimos 7 dias', v: daSemana, c: 'text-info' },
          { l: 'Com 16+ clientes', v: grandes, c: 'text-warning' },
        ].map(k => (
          <Card key={k.l} className="border-border bg-card"><CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{k.l}</p>
            <p className={`text-2xl font-bold ${k.c}`}>{k.v}</p>
          </CardContent></Card>
        ))}
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead>Agência</TableHead>
                <TableHead>Quem pediu</TableHead>
                <TableHead>Clientes</TableHead>
                <TableHead>Usa hoje</TableHead>
                <TableHead>Entrou</TableHead>
                <TableHead className="text-right">Falar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {linhas.map(l => (
                <TableRow key={l.id} className="border-border hover:bg-muted/20">
                  <TableCell className="text-sm font-medium">{l.agencia}</TableCell>
                  <TableCell className="text-sm">
                    {l.nome}
                    <span className="block text-xs text-muted-foreground">{l.email}</span>
                  </TableCell>
                  <TableCell>
                    {l.qtd_clientes
                      ? <Badge variant="outline" className={`text-xs ${
                          l.qtd_clientes === 'mais de 30' || l.qtd_clientes === '16 a 30'
                            ? 'bg-warning/15 text-warning border-warning/30' : ''}`}>{l.qtd_clientes}</Badge>
                      : <span className="text-xs text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{l.usa_hoje || '—'}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatDate(l.created_at.slice(0, 10))}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      {l.whatsapp && (
                        <Button asChild variant="ghost" size="sm" className="h-7 px-2">
                          <a href={`https://wa.me/55${soDigitos(l.whatsapp)}`} target="_blank" rel="noreferrer" title="WhatsApp">
                            <MessageCircle className="h-3.5 w-3.5" />
                          </a>
                        </Button>
                      )}
                      <Button asChild variant="ghost" size="sm" className="h-7 px-2">
                        <a href={`mailto:${l.email}`} title="E-mail"><Mail className="h-3.5 w-3.5" /></a>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {linhas.length === 0 && (
                <TableRow className="border-border hover:bg-transparent">
                  <TableCell colSpan={6} className="text-center py-12 text-sm text-muted-foreground">
                    Ninguém na lista ainda. Assim que uma agência se cadastrar, ela aparece aqui.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}
