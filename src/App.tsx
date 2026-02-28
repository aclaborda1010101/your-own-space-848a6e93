import React from "react";
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
import { WebSocketInitializer } from "@/components/WebSocketInitializer";
import Login from "./pages/Login";
import Onboarding from "./pages/Onboarding";
import OAuthGoogle from "./pages/OAuthGoogle";
import OAuthGoogleCallback from "./pages/OAuthGoogleCallback";
import Dashboard from "./pages/Dashboard";
import Chat from "./pages/Chat";
import ChatSimple from "./pages/ChatSimple";
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
import BoscoAnalysis from "./pages/BoscoAnalysis";
import AgustinState from "./pages/AgustinState";
import AICourse from "./pages/AICourse";
import Coach from "./pages/Coach";
import English from "./pages/English";
import StrategicNetwork from "./pages/StrategicNetwork";
import BrainsDashboard from "./pages/BrainsDashboard";
import DataImport from "./pages/DataImport";
import Projects from "./pages/Projects";
import PatternDetectorPage from "./pages/PatternDetectorPage";
import RagArchitect from "./pages/RagArchitect";
import RagEmbed from "./pages/RagEmbed";
import ProjectWizardPage from "./pages/ProjectWizard";
import Install from "./pages/Install";
import NotFound from "./pages/NotFound";
import { Loader2 } from "lucide-react";

// --- Error Boundary ---
class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: "100vh", display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          background: "#141b2d", color: "#fff", fontFamily: "sans-serif",
          padding: "2rem", textAlign: "center", gap: "1rem",
        }}>
          <h1 style={{ fontSize: "1.5rem" }}>Algo salió mal</h1>
          <p style={{ opacity: 0.7, maxWidth: 400 }}>
            {this.state.error?.message || "Error inesperado"}
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: "1rem", padding: "0.75rem 2rem",
              background: "#3b82f6", color: "#fff", border: "none",
              borderRadius: "0.5rem", cursor: "pointer", fontSize: "1rem",
            }}
          >
            Recargar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const queryClient = new QueryClient();

const SmartRedirect = () => {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to="/dashboard" replace />;
};

const ProtectedPage = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute>
    <AppLayout>{children}</AppLayout>
  </ProtectedRoute>
);

// ... keep existing code (SmartRedirect and ProtectedPage components)

const App = () => (
  <AppErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AuthProvider>
              <WebSocketInitializer>
                <UserSettingsProvider>
                  <OAuthMessageBridge />
                <Routes>
                  {/* Smart home redirect */}
                  <Route path="/" element={<SmartRedirect />} />
                  
                  {/* Auth routes (public) */}
                  <Route path="/login" element={<Login />} />
                  <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
                  <Route path="/oauth/google" element={<OAuthGoogle />} />
                  <Route path="/oauth/google/callback" element={<OAuthGoogleCallback />} />
                  
                  {/* Main Navigation with AppLayout */}
                  <Route path="/dashboard" element={<ProtectedPage><Dashboard /></ProtectedPage>} />
                  <Route path="/chat" element={<ProtectedPage><Chat /></ProtectedPage>} />
                  <Route path="/chat-simple" element={<ProtectedPage><ChatSimple /></ProtectedPage>} />
                  <Route path="/jarvis" element={<Navigate to="/chat" replace />} />
                  <Route path="/communications" element={<ProtectedPage><Communications /></ProtectedPage>} />
                  <Route path="/strategic-network" element={<ProtectedPage><StrategicNetwork /></ProtectedPage>} />
                  <Route path="/brains-dashboard" element={<ProtectedPage><BrainsDashboard /></ProtectedPage>} />
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
                  <Route path="/bosco/analysis" element={<ProtectedPage><BoscoAnalysis /></ProtectedPage>} />
                  <Route path="/agustin/state" element={<ProtectedPage><AgustinState /></ProtectedPage>} />
                  <Route path="/content" element={<ProtectedPage><Content /></ProtectedPage>} />
                  <Route path="/projects" element={<ProtectedPage><Projects /></ProtectedPage>} />
                  <Route path="/projects/detector" element={<ProtectedPage><PatternDetectorPage /></ProtectedPage>} />
                  <Route path="/projects/wizard/:id" element={<ProtectedPage><ProjectWizardPage /></ProtectedPage>} />
                  <Route path="/rag-architect" element={<ProtectedPage><RagArchitect /></ProtectedPage>} />
                  <Route path="/rag/:ragId/embed" element={<RagEmbed />} />
                  <Route path="/data-import" element={<ProtectedPage><DataImport /></ProtectedPage>} />
                  <Route path="/contacts" element={<Navigate to="/strategic-network" replace />} />
                  
                  {/* PWA Install */}
                  <Route path="/install" element={<Install />} />
                  
                  {/* 404 */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
                </UserSettingsProvider>
              </WebSocketInitializer>
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </AppErrorBoundary>
);

export default App;
