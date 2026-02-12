interface Props {
  currentStep: number | null;
  status: string | null;
}

export default function PipelineMiniIndicator({ currentStep, status }: Props) {
  const colors = ["bg-violet-400", "bg-emerald-400", "bg-blue-400", "bg-amber-400"];

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4].map(step => {
        const isDone = (currentStep || 0) >= step && status !== "error";
        const isActive = (currentStep || 0) === step && status === "in_progress";
        return (
          <div
            key={step}
            className={`w-2 h-2 rounded-full transition-all ${
              isDone ? colors[step - 1] : isActive ? `${colors[step - 1]} animate-pulse` : "bg-muted-foreground/30"
            }`}
          />
        );
      })}
    </div>
  );
}
