import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Download, 
  FileJson, 
  FileSpreadsheet, 
  Loader2,
  CheckSquare,
  BookOpen,
  Timer,
  Activity
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { format } from "date-fns";

type ExportFormat = "json" | "csv";

interface DataCounts {
  tasks: number;
  dailyLogs: number;
  checkIns: number;
  pomodoroSessions: number;
}

interface ExportData {
  tasks: any[];
  dailyLogs: any[];
  checkIns: any[];
  pomodoroSessions: any[];
  exportDate: string;
  userEmail: string;
}

export const DataExportCard = () => {
  const { user } = useAuth();
  const [exporting, setExporting] = useState(false);
  const [exportingFormat, setExportingFormat] = useState<ExportFormat | null>(null);
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState<DataCounts>({
    tasks: 0,
    dailyLogs: 0,
    checkIns: 0,
    pomodoroSessions: 0,
  });

  useEffect(() => {
    if (user) {
      fetchCounts();
    }
  }, [user]);

  const fetchCounts = async () => {
    if (!user) return;

    try {
      const [tasksRes, logsRes, checkInsRes, pomodorosRes] = await Promise.all([
        supabase.from("tasks").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("daily_logs").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("check_ins").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("pomodoro_sessions").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      ]);

      setCounts({
        tasks: tasksRes.count || 0,
        dailyLogs: logsRes.count || 0,
        checkIns: checkInsRes.count || 0,
        pomodoroSessions: pomodorosRes.count || 0,
      });
    } catch (error) {
      console.error("Error fetching counts:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllData = async (): Promise<ExportData | null> => {
    if (!user) return null;

    try {
      const [tasksRes, logsRes, checkInsRes, pomodorosRes] = await Promise.all([
        supabase.from("tasks").select("*").eq("user_id", user.id),
        supabase.from("daily_logs").select("*").eq("user_id", user.id),
        supabase.from("check_ins").select("*").eq("user_id", user.id),
        supabase.from("pomodoro_sessions").select("*").eq("user_id", user.id),
      ]);

      if (tasksRes.error) throw tasksRes.error;
      if (logsRes.error) throw logsRes.error;
      if (checkInsRes.error) throw checkInsRes.error;
      if (pomodorosRes.error) throw pomodorosRes.error;

      return {
        tasks: tasksRes.data || [],
        dailyLogs: logsRes.data || [],
        checkIns: checkInsRes.data || [],
        pomodoroSessions: pomodorosRes.data || [],
        exportDate: new Date().toISOString(),
        userEmail: user.email || "unknown",
      };
    } catch (error) {
      console.error("Error fetching data:", error);
      throw error;
    }
  };

  const downloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const convertToCSV = (data: any[], tableName: string): string => {
    if (data.length === 0) return "";
    
    const headers = Object.keys(data[0]);
    const rows = data.map(item => 
      headers.map(header => {
        const value = item[header];
        if (value === null || value === undefined) return "";
        if (typeof value === "string" && value.includes(",")) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return String(value);
      }).join(",")
    );
    
    return `# ${tableName}\n${headers.join(",")}\n${rows.join("\n")}`;
  };

  const handleExportJSON = async () => {
    setExporting(true);
    setExportingFormat("json");
    
    try {
      const data = await fetchAllData();
      if (!data) throw new Error("No data to export");

      const jsonContent = JSON.stringify(data, null, 2);
      const filename = `jarvis-export-${format(new Date(), "yyyy-MM-dd-HHmmss")}.json`;
      
      downloadFile(jsonContent, filename, "application/json");
      toast.success("Datos exportados correctamente");
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Error al exportar los datos");
    } finally {
      setExporting(false);
      setExportingFormat(null);
    }
  };

  const handleExportCSV = async () => {
    setExporting(true);
    setExportingFormat("csv");
    
    try {
      const data = await fetchAllData();
      if (!data) throw new Error("No data to export");

      const sections = [
        convertToCSV(data.tasks, "TAREAS"),
        convertToCSV(data.dailyLogs, "LOGS DIARIOS"),
        convertToCSV(data.checkIns, "CHECK-INS"),
        convertToCSV(data.pomodoroSessions, "SESIONES POMODORO"),
      ].filter(Boolean);

      const csvContent = `# Exportación JARVIS - ${format(new Date(), "dd/MM/yyyy HH:mm")}\n# Usuario: ${data.userEmail}\n\n${sections.join("\n\n")}`;
      const filename = `jarvis-export-${format(new Date(), "yyyy-MM-dd-HHmmss")}.csv`;
      
      downloadFile(csvContent, filename, "text/csv");
      toast.success("Datos exportados correctamente");
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Error al exportar los datos");
    } finally {
      setExporting(false);
      setExportingFormat(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="h-5 w-5 text-primary" />
          Exportar datos
        </CardTitle>
        <CardDescription>
          Descarga una copia de todos tus datos
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          <div className="p-3 rounded-lg bg-muted/50 space-y-1">
            <CheckSquare className="h-5 w-5 mx-auto text-primary" />
            <p className="text-2xl font-bold text-foreground">
              {loading ? <Loader2 className="h-4 w-4 mx-auto animate-spin" /> : counts.tasks}
            </p>
            <p className="text-xs text-muted-foreground">Tareas</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50 space-y-1">
            <BookOpen className="h-5 w-5 mx-auto text-success" />
            <p className="text-2xl font-bold text-foreground">
              {loading ? <Loader2 className="h-4 w-4 mx-auto animate-spin" /> : counts.dailyLogs}
            </p>
            <p className="text-xs text-muted-foreground">Logs</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50 space-y-1">
            <Timer className="h-5 w-5 mx-auto text-warning" />
            <p className="text-2xl font-bold text-foreground">
              {loading ? <Loader2 className="h-4 w-4 mx-auto animate-spin" /> : counts.pomodoroSessions}
            </p>
            <p className="text-xs text-muted-foreground">Pomodoros</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50 space-y-1">
            <Activity className="h-5 w-5 mx-auto text-info" />
            <p className="text-2xl font-bold text-foreground">
              {loading ? <Loader2 className="h-4 w-4 mx-auto animate-spin" /> : counts.checkIns}
            </p>
            <p className="text-xs text-muted-foreground">Check-ins</p>
          </div>
        </div>

        <p className="text-sm text-muted-foreground text-center">
          Total: <span className="font-medium text-foreground">{counts.tasks + counts.dailyLogs + counts.checkIns + counts.pomodoroSessions}</span> registros
        </p>

        <div className="flex flex-col sm:flex-row gap-3">
          <Button 
            variant="outline" 
            className="flex-1"
            onClick={handleExportJSON}
            disabled={exporting}
          >
            {exportingFormat === "json" ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <FileJson className="h-4 w-4 mr-2" />
            )}
            Exportar JSON
          </Button>
          <Button 
            variant="outline" 
            className="flex-1"
            onClick={handleExportCSV}
            disabled={exporting}
          >
            {exportingFormat === "csv" ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <FileSpreadsheet className="h-4 w-4 mr-2" />
            )}
            Exportar CSV
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          La exportación incluye todas tus tareas, logs diarios, check-ins y sesiones de Pomodoro.
        </p>
      </CardContent>
    </Card>
  );
};