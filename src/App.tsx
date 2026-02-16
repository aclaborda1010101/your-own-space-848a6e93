import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { UserSettingsProvider } from "@/hooks/useUserSettings";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import OAuthMessageBridge from "@/components/auth/OAuthMessageBridge";
import { AppLayout } from "@/components/layout/AppLayout";
import Login from "./pages/Login";
import OAuthGoogle from "./pages/OAuthGoogle";
import OAuthGoogleCallback from "./pages/OAuthGoogleCallback";
import Dashboard from "./pages/Dashboard";
import Chat from "./pages/Chat";
import Communications from "./pages/Communications";
import Health from "./pages/Health";
import Sports from "./pages/Sports";
import Settings from "./pages/Settings";
import Tasks from "./pages/Tasks";
import Logs from "./pages/Logs";
import CalendarPage from "./pages/Calendar";
import Analytics from "./pages/Analytics";
import Content from "./pages/Content";
import Challenges from "./pages/Challenges";
import StartDay from "./pages/StartDay";
import AINews from "./pages/AINews";
import Nutrition from "./pages/Nutrition";
import Finances from "./pages/Finances";
import Bosco from "./pages/Bosco";
import AICourse from "./pages/AICourse";
import Coach from "./pages/Coach";
import English from "./pages/English";
import Install from "./pages/Install";
import InboxPage from "./pages/Inbox";
import Projects from "./pages/Projects";
import Contacts from "./pages/Contacts";
import ContactProfile from "./pages/ContactProfile";
import BrainDashboard from "./pages/BrainDashboard";
import NotFound from "./pages/NotFound";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient();

// Smart redirect: authenticated → dashboard, unauthenticated → login
const SmartRedirect = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return <Navigate to={user ? "/dashboard" : "/login"} replace />;
};

// Wrapper that includes AppLayout for authenticated pages
const ProtectedPage = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute>
    <AppLayout>{children}</AppLayout>
  </ProtectedRoute>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <UserSettingsProvider>
              <OAuthMessageBridge />
              <Routes>
                {/* Smart home redirect */}
                <Route path="/" element={<SmartRedirect />} />
                
                {/* Auth routes (public) */}
                <Route path="/login" element={<Login />} />
                <Route path="/oauth/google" element={<OAuthGoogle />} />
                <Route path="/oauth/google/callback" element={<OAuthGoogleCallback />} />
                
                {/* Main Navigation with AppLayout */}
                <Route path="/dashboard" element={<ProtectedPage><Dashboard /></ProtectedPage>} />
                <Route path="/chat" element={<ProtectedPage><Chat /></ProtectedPage>} />
                <Route path="/jarvis" element={<Navigate to="/chat" replace />} />
                <Route path="/communications" element={<ProtectedPage><Communications /></ProtectedPage>} />
                <Route path="/health" element={<ProtectedPage><Health /></ProtectedPage>} />
                <Route path="/sports" element={<ProtectedPage><Sports /></ProtectedPage>} />
                <Route path="/settings" element={<ProtectedPage><Settings /></ProtectedPage>} />
                
                {/* Other routes with AppLayout */}
                <Route path="/start-day" element={<ProtectedPage><StartDay /></ProtectedPage>} />
                <Route path="/tasks" element={<ProtectedPage><Tasks /></ProtectedPage>} />
                <Route path="/logs" element={<ProtectedPage><Logs /></ProtectedPage>} />
                <Route path="/calendar" element={<ProtectedPage><CalendarPage /></ProtectedPage>} />
                <Route path="/analytics" element={<ProtectedPage><Analytics /></ProtectedPage>} />
                <Route path="/challenges" element={<ProtectedPage><Challenges /></ProtectedPage>} />
                <Route path="/ai-course" element={<ProtectedPage><AICourse /></ProtectedPage>} />
                <Route path="/coach" element={<ProtectedPage><Coach /></ProtectedPage>} />
                <Route path="/english" element={<ProtectedPage><English /></ProtectedPage>} />
                <Route path="/ai-news" element={<ProtectedPage><AINews /></ProtectedPage>} />
                <Route path="/nutrition" element={<ProtectedPage><Nutrition /></ProtectedPage>} />
                <Route path="/finances" element={<ProtectedPage><Finances /></ProtectedPage>} />
                <Route path="/bosco" element={<ProtectedPage><Bosco /></ProtectedPage>} />
                <Route path="/content" element={<ProtectedPage><Content /></ProtectedPage>} />
                
                {/* Inbox inteligente */}
                <Route path="/inbox" element={<ProtectedPage><InboxPage /></ProtectedPage>} />
                
                {/* Proyectos e Ideas */}
                <Route path="/projects" element={<ProtectedPage><Projects /></ProtectedPage>} />
                
                {/* Brain Dashboards */}
                <Route path="/brain/:brainType" element={<ProtectedPage><BrainDashboard /></ProtectedPage>} />
                
                {/* Contactos CRM */}
                <Route path="/contacts" element={<ProtectedPage><Contacts /></ProtectedPage>} />
                <Route path="/contacts/:id" element={<ProtectedPage><ContactProfile /></ProtectedPage>} />
                
                {/* PWA Install */}
                <Route path="/install" element={<Install />} />
                
                {/* 404 */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </UserSettingsProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
