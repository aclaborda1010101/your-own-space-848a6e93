import { useState } from "react";
import { CheckInCard } from "@/components/dashboard/CheckInCard";
import { AgendaCard } from "@/components/dashboard/AgendaCard";
import { PrioritiesCard } from "@/components/dashboard/PrioritiesCard";
import { AlertsCard } from "@/components/dashboard/AlertsCard";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";

export interface CheckInData {
  energy: number;
  mood: number;
  focus: number;
  availableTime: number;
  interruptionRisk: "low" | "medium" | "high";
  dayMode: "balanced" | "push" | "survival";
}

const Dashboard = () => {
  const [checkInData, setCheckInData] = useState<CheckInData>({
    energy: 3,
    mood: 3,
    focus: 3,
    availableTime: 8,
    interruptionRisk: "low",
    dayMode: "balanced",
  });

  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <div className="lg:pl-64">
        <TopBar onMenuClick={() => setSidebarOpen(true)} />
        
        <main className="p-4 lg:p-6 space-y-6">
          {/* Quick Actions Bar */}
          <QuickActions />

          {/* Main Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Check-in & Agenda */}
            <div className="lg:col-span-2 space-y-6">
              <CheckInCard 
                data={checkInData} 
                onUpdate={setCheckInData} 
              />
              <AgendaCard />
            </div>

            {/* Right Column - Priorities & Alerts */}
            <div className="space-y-6">
              <PrioritiesCard />
              <AlertsCard />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
