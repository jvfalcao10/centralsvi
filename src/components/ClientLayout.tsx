import { SidebarProvider } from '@/components/ui/sidebar'
import { ClientSidebar } from '@/components/ClientSidebar'
import { AppHeader } from '@/components/AppHeader'

interface ClientLayoutProps {
  children: React.ReactNode
}

export function ClientLayout({ children }: ClientLayoutProps) {
  return (
    <SidebarProvider defaultOpen={true}>
      <div className="min-h-svh flex w-full min-w-0 bg-background">
        <ClientSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <AppHeader />
          <main className="flex-1 min-w-0 p-3 sm:p-6 pb-[max(1rem,env(safe-area-inset-bottom))] animate-fade-in">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  )
}
