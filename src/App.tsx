import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedOrganizerRoute } from "@/components/organizer/ProtectedOrganizerRoute";
import { FloatingWhatsApp } from "@/components/FloatingWhatsApp";
import Index from "./pages/Index";
import EventDetail from "./pages/EventDetail";
import MyTickets from "./pages/MyTickets";
import PurchaseSuccess from "./pages/PurchaseSuccess";
import Profile from "./pages/Profile";
import OrganizerDashboard from "./pages/OrganizerDashboard";
import OrganizerScan from "./pages/OrganizerScan";
import Auth from "./pages/Auth";
import UpdatePassword from "./pages/UpdatePassword";
import SaibaMais from "./pages/SaibaMais";
import Validator from "./pages/Validator";
import AdminUsers from "./pages/AdminUsers";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const AppContent = () => {
  const location = useLocation();
  const isValidatorPage = location.pathname === "/validador";

  return (
    <>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/event/:id" element={<EventDetail />} />
        <Route path="/tickets" element={<MyTickets />} />
        <Route path="/meus-ingressos" element={<Navigate to="/tickets" replace />} />
        <Route path="/purchase-success" element={<PurchaseSuccess />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/update-password" element={<UpdatePassword />} />
        <Route path="/saiba-mais" element={<SaibaMais />} />
        <Route
          path="/organizer"
          element={
            <ProtectedOrganizerRoute>
              <OrganizerDashboard />
            </ProtectedOrganizerRoute>
          }
        />
        <Route
          path="/organizer/scan"
          element={
            <ProtectedOrganizerRoute requireManage>
              <OrganizerScan />
            </ProtectedOrganizerRoute>
          }
        />
        <Route path="/validador" element={<Validator />} />
        <Route path="/admin/usuarios" element={<AdminUsers />} />
        <Route path="*" element={<NotFound />} />
      </Routes>

      {!isValidatorPage && <FloatingWhatsApp />}
    </>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppContent />
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;