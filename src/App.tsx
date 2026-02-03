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
import { PotusFloatingButton } from "@/components/voice/PotusFloatingButton";
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

// Global POTUS button - only shows when authenticated
const GlobalPotusButton = () => {
  const { user } = useAuth();
  if (!user) return null;
  return <PotusFloatingButton />;
};

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
              <GlobalPotusButton />
              <Routes>
                {/* Smart home redirect */}
                <Route path="/" element={<SmartRedirect />} />
                
                {/* Auth routes (public) */}
                <Route path="/login" element={<Login />} />
                <Route path="/oauth/google" element={<OAuthGoogle />} />
                <Route path="/oauth/google/callback" element={<OAuthGoogleCallback />} />
                
                {/* Main Navigation (New Sidebar) */}
                <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                <Route path="/chat" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
                <Route path="/communications" element={<ProtectedRoute><Communications /></ProtectedRoute>} />
                <Route path="/health" element={<ProtectedRoute><Health /></ProtectedRoute>} />
                <Route path="/sports" element={<ProtectedRoute><Sports /></ProtectedRoute>} />
                <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
                
                {/* Legacy routes (still accessible but not in new sidebar) */}
                <Route path="/start-day" element={<ProtectedRoute><StartDay /></ProtectedRoute>} />
                <Route path="/tasks" element={<ProtectedRoute><Tasks /></ProtectedRoute>} />
                <Route path="/logs" element={<ProtectedRoute><Logs /></ProtectedRoute>} />
                <Route path="/calendar" element={<ProtectedRoute><CalendarPage /></ProtectedRoute>} />
                <Route path="/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
                <Route path="/challenges" element={<ProtectedRoute><Challenges /></ProtectedRoute>} />
                <Route path="/ai-course" element={<ProtectedRoute><AICourse /></ProtectedRoute>} />
                <Route path="/coach" element={<ProtectedRoute><Coach /></ProtectedRoute>} />
                <Route path="/english" element={<ProtectedRoute><English /></ProtectedRoute>} />
                <Route path="/ai-news" element={<ProtectedRoute><AINews /></ProtectedRoute>} />
                <Route path="/nutrition" element={<ProtectedRoute><Nutrition /></ProtectedRoute>} />
                <Route path="/finances" element={<ProtectedRoute><Finances /></ProtectedRoute>} />
                <Route path="/bosco" element={<ProtectedRoute><Bosco /></ProtectedRoute>} />
                <Route path="/content" element={<ProtectedRoute><Content /></ProtectedRoute>} />
                
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
