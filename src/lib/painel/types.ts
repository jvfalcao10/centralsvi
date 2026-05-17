export const LEAD_STATUSES = [
  "new", "contacted", "qualified", "meeting", "proposal", "won", "lost", "nurturing",
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: "Novo", contacted: "Contatado", qualified: "Qualificado", meeting: "Reunião",
  proposal: "Proposta", won: "Ganhou", lost: "Perdeu", nurturing: "Nutrição",
};

export const LEAD_STATUS_COLORS: Record<LeadStatus, string> = {
  new: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  contacted: "bg-gray-500/10 text-gray-700 dark:text-gray-300",
  qualified: "bg-foreground text-background",
  meeting: "bg-purple-500/10 text-purple-700 dark:text-purple-300",
  proposal: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  won: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  lost: "bg-red-500/10 text-red-700 dark:text-red-300",
  nurturing: "bg-gray-500/10 text-gray-700 dark:text-gray-300",
};

export type PainelClient = {
  id: string;
  name: string;
  slug: string;
  company: string;
  brand_color: string;
  painel_active: boolean;
};

export type PainelLead = {
  id: string;
  client_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  status: LeadStatus;
  source: string | null;
  score: number;
  estimated_value_brl: number | null;
  created_at: string;
};

export type PainelInsight = {
  id: string;
  client_id: string;
  kind: string;
  title: string;
  body: string;
  severity: "info" | "low" | "medium" | "high" | "critical";
  status: "unread" | "read" | "acted_on" | "dismissed";
  created_at: string;
};
