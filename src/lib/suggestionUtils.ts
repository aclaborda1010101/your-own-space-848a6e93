/**
 * Infer task type from suggestion content brain/category fields.
 */
export function inferTaskType(content: any): "work" | "life" | "finance" {
  const brain = content?.data?.brain || content?.brain;
  const category = (content?.data?.category || content?.category || "").toLowerCase();

  if (brain === "bosco" || brain === "personal") return "life";
  if (brain === "professional") return "work";

  // Category heuristics
  if (/finanzas|inversión|inversion|ahorro/.test(category)) return "finance";
  if (/familia|personal|bosco|hijo|salud/.test(category)) return "life";

  return "work"; // fallback
}

/**
 * Map priority string from AI to P0-P3 format.
 */
export function mapPriority(content: any): string {
  const raw = (content?.data?.priority || content?.priority || "").toLowerCase();
  if (/p0|urgente|crítica|critica/.test(raw)) return "P0";
  if (/p2|baja|low/.test(raw)) return "P2";
  if (/p3|opcional/.test(raw)) return "P3";
  return "P1"; // default
}
