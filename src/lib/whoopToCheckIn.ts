import { JarvisWhoopData } from "@/hooks/useJarvisWhoopData";

export interface WhoopCheckInDefaults {
  energy: number;
  mood: number;
  focus: number;
  dayMode: "balanced" | "push" | "survival";
  interruptionRisk: "low" | "medium" | "high";
  availableTime: number;
}

function scoreToScale(score: number | null, fallback = 3): number {
  if (score === null || score === undefined) return fallback;
  if (score <= 20) return 1;
  if (score <= 40) return 2;
  if (score <= 60) return 3;
  if (score <= 80) return 4;
  return 5;
}

function hrvToFocus(hrv: number | null): number {
  if (hrv === null || hrv === undefined) return 3;
  if (hrv < 30) return 2;
  if (hrv < 50) return 3;
  if (hrv < 70) return 4;
  return 5;
}

function recoveryToDayMode(recovery: number | null): "balanced" | "push" | "survival" {
  if (recovery === null || recovery === undefined) return "balanced";
  if (recovery < 33) return "survival";
  if (recovery < 66) return "balanced";
  return "push";
}

function recoveryToInterruptionRisk(recovery: number | null): "low" | "medium" | "high" {
  if (recovery === null || recovery === undefined) return "low";
  if (recovery < 33) return "high";
  if (recovery < 66) return "medium";
  return "low";
}

export function mapWhoopToCheckIn(data: JarvisWhoopData): WhoopCheckInDefaults {
  return {
    energy: scoreToScale(data.recovery_score),
    mood: scoreToScale(data.sleep_performance),
    focus: hrvToFocus(data.hrv),
    dayMode: recoveryToDayMode(data.recovery_score),
    interruptionRisk: recoveryToInterruptionRisk(data.recovery_score),
    availableTime: 8,
  };
}
