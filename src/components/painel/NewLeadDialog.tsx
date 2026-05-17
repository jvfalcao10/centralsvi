import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { LEAD_STATUSES, LEAD_STATUS_LABELS, type LeadStatus } from '@/lib/painel/types'

export function NewLeadDialog({
  clientId, open, onClose,
}: { clientId: string; open: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [source, setSource] = useState('')
  const [status, setStatus] = useState<LeadStatus>('new')
  const [estimated, setEstimated] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  function reset() {
    setName(''); setEmail(''); setPhone(''); setSource('')
    setStatus('new'); setEstimated(''); setNotes('')
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    const { error } = await supabase.from('painel_leads').insert({
      client_id: clientId,
      full_name: name.trim(),
      email: email.trim() || null,
      phone: phone.trim() || null,
      source: source.trim() || 'manual',
      status,
      estimated_value_brl: estimated ? Number(estimated) : null,
      notes: notes.trim() || null,
    })
    setSaving(false)
    if (error) { toast.error(error.message || 'Erro ao criar lead'); return }
    toast.success('Lead criado')
    qc.invalidateQueries({ queryKey: ['painel-leads'] })
    qc.invalidateQueries({ queryKey: ['painel-dashboard-v2'] })
    reset()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { reset(); onClose() } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Novo lead</DialogTitle>
          <DialogDescription>Cadastre manualmente. Pra leads automáticos, use o webhook configurado pela SVI.</DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="space-y-3">
          <div>
            <Label htmlFor="lead-name">Nome *</Label>
            <Input id="lead-name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="João Silva" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="lead-email">Email</Label>
              <Input id="lead-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="joao@empresa.com" />
            </div>
            <div>
              <Label htmlFor="lead-phone">Telefone</Label>
              <Input id="lead-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+5594..." />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="lead-source">Origem</Label>
              <Input id="lead-source" value={source} onChange={(e) => setSource(e.target.value)} placeholder="instagram, indicação, ..." />
            </div>
            <div>
              <Label htmlFor="lead-status">Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as LeadStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LEAD_STATUSES.map(s => <SelectItem key={s} value={s}>{LEAD_STATUS_LABELS[s]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="lead-value">Valor estimado (R$)</Label>
            <Input id="lead-value" type="number" min={0} value={estimated} onChange={(e) => setEstimated(e.target.value)} placeholder="5000" />
          </div>
          <div>
            <Label htmlFor="lead-notes">Notas</Label>
            <Textarea id="lead-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Contexto, próximo passo..." />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => { reset(); onClose() }}>Cancelar</Button>
            <Button type="submit" disabled={saving || !name.trim()}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Criar lead
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
