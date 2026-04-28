import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";
import { ClientLayout } from "@/components/ClientLayout";

// Public pages
import Login from "@/pages/Login";
import ClientSignup from "@/pages/ClientSignup";
import PendingApproval from "@/pages/PendingApproval";
import ResetPassword from "@/pages/ResetPassword";

// Staff pages
import Dashboard from "@/pages/Dashboard";
import Pipeline from "@/pages/Pipeline";
import Clients from "@/pages/Clients";
import Deliveries from "@/pages/Deliveries";
import Financial from "@/pages/Financial";
import Prospecting from "@/pages/Prospecting";
import Scripts from "@/pages/Scripts";
import Onboarding from "@/pages/Onboarding";
import ActivityLog from "@/pages/ActivityLog";
import Team from "@/pages/Team";
import Approvals from "@/pages/Approvals";
import Comercial from "@/pages/Comercial";

// Client pages
import MinhaArea from "@/pages/MinhaArea";

// Shared content modules (staff + client)
import Posts from "@/pages/content/Posts";
import Pautas from "@/pages/content/Pautas";
import Calendar from "@/pages/content/Calendar";
import Radar from "@/pages/content/Radar";
import Monitor from "@/pages/content/Monitor";
import SviCompany from "@/pages/content/SviCompany";
import SviDoctor from "@/pages/content/SviDoctor";

import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

/** Layout wrapper que escolhe AppLayout (staff) ou ClientLayout (client). */
function AutoLayout({ children }: { children: React.ReactNode }) {
  const { isClient } = useAuth();
  return isClient ? <ClientLayout>{children}</ClientLayout> : <AppLayout>{children}</AppLayout>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <ThemeProvider>
        <AuthProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Navigate to="/login" replace />} />

              {/* Public */}
              <Route path="/login" element={<Login />} />
              <Route path="/client-signup" element={<ClientSignup />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/pending-approval" element={<PendingApproval />} />

              {/* Staff-only */}
              <Route path="/dashboard" element={
                <ProtectedRoute requiredRole="manager"><AppLayout><Dashboard /></AppLayout></ProtectedRoute>
              } />
              <Route path="/pipeline" element={
                <ProtectedRoute requiredRole="seller"><AppLayout><Pipeline /></AppLayout></ProtectedRoute>
              } />
              <Route path="/clients" element={
                <ProtectedRoute requiredRole="executor"><AppLayout><Clients /></AppLayout></ProtectedRoute>
              } />
              <Route path="/deliveries" element={
                <ProtectedRoute requiredRole="executor"><AppLayout><Deliveries /></AppLayout></ProtectedRoute>
              } />
              <Route path="/financial" element={
                <ProtectedRoute requiredRole="manager"><AppLayout><Financial /></AppLayout></ProtectedRoute>
              } />
              <Route path="/prospecting" element={
                <ProtectedRoute requiredRole="seller"><AppLayout><Prospecting /></AppLayout></ProtectedRoute>
              } />
              <Route path="/scripts" element={
                <ProtectedRoute requiredRole="executor"><AppLayout><Scripts /></AppLayout></ProtectedRoute>
              } />
              <Route path="/onboarding" element={
                <ProtectedRoute requiredRole="manager"><AppLayout><Onboarding /></AppLayout></ProtectedRoute>
              } />
              <Route path="/activity" element={
                <ProtectedRoute requiredRole="executor"><AppLayout><ActivityLog /></AppLayout></ProtectedRoute>
              } />
              <Route path="/team" element={
                <ProtectedRoute requiredRole="admin"><AppLayout><Team /></AppLayout></ProtectedRoute>
              } />
              <Route path="/admin/approvals" element={
                <ProtectedRoute requiredRole="manager"><AppLayout><Approvals /></AppLayout></ProtectedRoute>
              } />
              <Route path="/comercial" element={
                <ProtectedRoute requiredRole="seller"><AppLayout><Comercial /></AppLayout></ProtectedRoute>
              } />

              {/* Client-only */}
              <Route path="/minha-area" element={
                <ProtectedRoute clientOnly><ClientLayout><MinhaArea /></ClientLayout></ProtectedRoute>
              } />

              {/* Shared (staff executor+ OR client aprovado) */}
              <Route path="/content/posts" element={
                <ProtectedRoute requiredRole="executor" allowClient>
                  <AutoLayout><Posts /></AutoLayout>
                </ProtectedRoute>
              } />
              <Route path="/content/pautas" element={
                <ProtectedRoute requiredRole="executor" allowClient>
                  <AutoLayout><Pautas /></AutoLayout>
                </ProtectedRoute>
              } />
              <Route path="/content/calendar" element={
                <ProtectedRoute requiredRole="executor" allowClient>
                  <AutoLayout><Calendar /></AutoLayout>
                </ProtectedRoute>
              } />
              <Route path="/content/radar" element={
                <ProtectedRoute requiredRole="executor" allowClient>
                  <AutoLayout><Radar /></AutoLayout>
                </ProtectedRoute>
              } />
              <Route path="/content/monitor" element={
                <ProtectedRoute requiredRole="executor" allowClient>
                  <AutoLayout><Monitor /></AutoLayout>
                </ProtectedRoute>
              } />
              <Route path="/content/svi-company" element={
                <ProtectedRoute requiredRole="executor">
                  <AppLayout><SviCompany /></AppLayout>
                </ProtectedRoute>
              } />
              <Route path="/content/svi-doctor" element={
                <ProtectedRoute requiredRole="executor">
                  <AppLayout><SviDoctor /></AppLayout>
                </ProtectedRoute>
              } />

              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ThemeProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
