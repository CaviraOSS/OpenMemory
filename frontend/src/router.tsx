import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { Dashboard } from "@/components/dashboard";
import { DashboardPage } from "@/pages/DashboardPage";
import { AuthPage } from "@/pages/AuthPage";
import { AuthProvider } from "@/contexts/AuthContext";

export function Router() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SidebarProvider>
          <Routes>
            {/* Auth Page (Optional) */}
            <Route path="/auth" element={<AuthPage />} />

            {/* Main Dashboard - No Auth Required (Optional) */}
            <Route path="/dashboard" element={<DashboardPage />} />

            {/* OpenMemory Main App */}
            <Route path="/" element={<Dashboard />} />

            {/* Redirect unknown routes to home */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <Toaster />
        </SidebarProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
