import React, { Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import OAuthMessageBridge from "@/components/auth/OAuthMessageBridge";
import Login from "./pages/Login";
import OAuthGoogle from "./pages/OAuthGoogle";
import OAuthGoogleCallback from "./pages/OAuthGoogleCallback";
import NotFound from "./pages/NotFound";
import { Loader2 } from "lucide-react";

// --- Lazy imports for protected pages ---
const AppLayout = React.lazy(() => import("./components/layout/AppLayout").then(m => ({ default: m.AppLayout })));
const WebSocketInitializer = React.lazy(() => import("./components/WebSocketInitializer").then(m => ({ default: m.WebSocketInitializer })));
const UserSettingsProvider = React.lazy(() => import("./hooks/useUserSettings").then(m => ({ default: m.UserSettingsProvider })));

const Dashboard = React.lazy(() => import("./pages/Dashboard"));
const Chat = React.lazy(() => import("./pages/Chat"));
const ChatSimple = React.lazy(() => import("./pages/ChatSimple"));
const Communications = React.lazy(() => import("./pages/Communications"));
const Health = React.lazy(() => import("./pages/Health"));
const Sports = React.lazy(() => import("./pages/Sports"));
const Settings = React.lazy(() => import("./pages/Settings"));
const Tasks = React.lazy(() => import("./pages/Tasks"));
const Logs = React.lazy(() => import("./pages/Logs"));
const CalendarPage = React.lazy(() => import("./pages/Calendar"));
const Analytics = React.lazy(() => import("./pages/Analytics"));
const Content = React.lazy(() => import("./pages/Content"));
const Challenges = React.lazy(() => import("./pages/Challenges"));
const StartDay = React.lazy(() => import("./pages/StartDay"));
const AINews = React.lazy(() => import("./pages/AINews"));
const Nutrition = React.lazy(() => import("./pages/Nutrition"));
const Finances = React.lazy(() => import("./pages/Finances"));
const Bosco = React.lazy(() => import("./pages/Bosco"));
const BoscoAnalysis = React.lazy(() => import("./pages/BoscoAnalysis"));
const AgustinState = React.lazy(() => import("./pages/AgustinState"));
const AICourse = React.lazy(() => import("./pages/AICourse"));
const Coach = React.lazy(() => import("./pages/Coach"));
const English = React.lazy(() => import("./pages/English"));
const StrategicNetwork = React.lazy(() => import("./pages/StrategicNetwork"));
const BrainsDashboard = React.lazy(() => import("./pages/BrainsDashboard"));
const DataImport = React.lazy(() => import("./pages/DataImport"));
const Projects = React.lazy(() => import("./pages/Projects"));
const PatternDetectorPage = React.lazy(() => import("./pages/PatternDetectorPage"));
const RagArchitect = React.lazy(() => import("./pages/RagArchitect"));
const RagEmbed = React.lazy(() => import("./pages/RagEmbed"));
const ProjectWizardPage = React.lazy(() => import("./pages/ProjectWizard"));
const AuditoriaIA = React.lazy(() => import("./pages/AuditoriaIA"));
const PublicQuestionnaire = React.lazy(() => import("./pages/PublicQuestionnaire"));
const Onboarding = React.lazy(() => import("./pages/Onboarding"));
const Install = React.lazy(() => import("./pages/Install"));

// --- Loading fallback ---
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

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
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to="/dashboard" replace />;
};

const ProtectedPage = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute>
    <Suspense fallback={<PageLoader />}>
      <WebSocketInitializer>
        <UserSettingsProvider>
          <AppLayout>{children}</AppLayout>
        </UserSettingsProvider>
      </WebSocketInitializer>
    </Suspense>
  </ProtectedRoute>
);

const App = () => (
  <AppErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AuthProvider>
              <OAuthMessageBridge />
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  {/* Smart home redirect */}
                  <Route path="/" element={<SmartRedirect />} />
                  
                  {/* Auth routes (public - eager loaded) */}
                  <Route path="/login" element={<Login />} />
                  <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
                  <Route path="/oauth/google" element={<OAuthGoogle />} />
                  <Route path="/oauth/google/callback" element={<OAuthGoogleCallback />} />
                  
                  {/* Main Navigation with AppLayout - all lazy */}
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
                  <Route path="/auditoria-ia" element={<ProtectedPage><AuditoriaIA /></ProtectedPage>} />
                  <Route path="/rag-architect" element={<ProtectedPage><RagArchitect /></ProtectedPage>} />
                  <Route path="/rag/:ragId/embed" element={<RagEmbed />} />
                  <Route path="/audit/:auditId/questionnaire" element={<Suspense fallback={<PageLoader />}><PublicQuestionnaire /></Suspense>} />
                  <Route path="/data-import" element={<ProtectedPage><DataImport /></ProtectedPage>} />
                  <Route path="/contacts" element={<Navigate to="/strategic-network" replace />} />
                  
                  {/* PWA Install */}
                  <Route path="/install" element={<Install />} />
                  
                  {/* 404 */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </AppErrorBoundary>
);

export default App;
