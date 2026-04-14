import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";
import Login from "@/pages/Login";
import ResetPassword from "@/pages/ResetPassword";
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
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <ThemeProvider>
        <AuthProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/login" element={<Login />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/dashboard" element={
                <ProtectedRoute requiredRole="manager">
                  <AppLayout><Dashboard /></AppLayout>
                </ProtectedRoute>
              } />
              <Route path="/pipeline" element={
                <ProtectedRoute requiredRole="seller">
                  <AppLayout><Pipeline /></AppLayout>
                </ProtectedRoute>
              } />
              <Route path="/clients" element={
                <ProtectedRoute requiredRole="executor">
                  <AppLayout><Clients /></AppLayout>
                </ProtectedRoute>
              } />
              <Route path="/deliveries" element={
                <ProtectedRoute requiredRole="executor">
                  <AppLayout><Deliveries /></AppLayout>
                </ProtectedRoute>
              } />
              <Route path="/financial" element={
                <ProtectedRoute requiredRole="manager">
                  <AppLayout><Financial /></AppLayout>
                </ProtectedRoute>
              } />
              <Route path="/prospecting" element={
                <ProtectedRoute requiredRole="seller">
                  <AppLayout><Prospecting /></AppLayout>
                </ProtectedRoute>
              } />
              <Route path="/scripts" element={
                <ProtectedRoute requiredRole="executor">
                  <AppLayout><Scripts /></AppLayout>
                </ProtectedRoute>
              } />
              <Route path="/onboarding" element={
                <ProtectedRoute requiredRole="manager">
                  <AppLayout><Onboarding /></AppLayout>
                </ProtectedRoute>
              } />
              <Route path="/activity" element={
                <ProtectedRoute requiredRole="executor">
                  <AppLayout><ActivityLog /></AppLayout>
                </ProtectedRoute>
              } />
              <Route path="/team" element={
                <ProtectedRoute requiredRole="admin">
                  <AppLayout><Team /></AppLayout>
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
