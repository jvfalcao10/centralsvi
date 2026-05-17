import { Link } from 'react-router-dom'
import { Bell, AlertCircle, Info, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { usePainelNotifications, type PainelNotification } from '@/hooks/usePainelNotifications'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { cn } from '@/lib/utils'

const ICON_MAP = {
  info: Info,
  warning: AlertTriangle,
  error: AlertCircle,
  success: CheckCircle2,
}

const COLOR_MAP = {
  info: 'text-blue-600 dark:text-blue-400',
  warning: 'text-amber-600 dark:text-amber-400',
  error: 'text-red-600 dark:text-red-400',
  success: 'text-emerald-600 dark:text-emerald-400',
}

export function NotificationsBell({ clientId }: { clientId?: string }) {
  const { notifications, unreadCount, markRead, markAllRead } = usePainelNotifications({ clientId })

  async function onItemClick(n: PainelNotification) {
    if (!n.read) await markRead([n.id])
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Notificações${unreadCount > 0 ? ` (${unreadCount} não lidas)` : ''}`}
          className="relative w-9 h-9 rounded-md hover:bg-accent flex items-center justify-center transition-colors"
        >
          <Bell className="w-4 h-4 text-muted-foreground" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[380px] p-0">
        <div className="p-3 flex items-center justify-between border-b">
          <div className="font-semibold text-sm">Notificações</div>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => markAllRead()}>
              Marcar todas como lidas
            </Button>
          )}
        </div>

        <ScrollArea className="max-h-[400px]">
          {notifications.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              <Bell className="w-6 h-6 mx-auto mb-2 opacity-40" />
              Sem notificações
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((n) => {
                const Icon = ICON_MAP[n.type] || Info
                const color = COLOR_MAP[n.type] || COLOR_MAP.info
                const content = (
                  <div className={cn(
                    'flex items-start gap-3 p-3 hover:bg-accent transition-colors cursor-pointer',
                    !n.read && 'bg-primary/5'
                  )}>
                    <div className={cn('w-6 h-6 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5', color)}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium leading-tight">{n.title}</div>
                      <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</div>
                      <div className="text-[10px] text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: ptBR })}
                      </div>
                    </div>
                    {!n.read && <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-2" />}
                  </div>
                )
                return n.link ? (
                  <Link key={n.id} to={n.link} onClick={() => onItemClick(n)}>{content}</Link>
                ) : (
                  <div key={n.id} onClick={() => onItemClick(n)}>{content}</div>
                )
              })}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}
