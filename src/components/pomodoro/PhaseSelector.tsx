import { Coffee, Sun, Zap } from "lucide-react";
import { motion } from "motion/react";
import type { TimerPhase } from "@/domain/pomodoro";
import { PHASE_COLORS } from "@/domain/pomodoro";
import { cn } from "@/lib/utils";

type PhaseSelectorProps = {
  currentPhase: TimerPhase;
  onPhaseChange: (phase: TimerPhase) => void;
  disabled?: boolean;
};

const phaseConfig: Record<TimerPhase, { icon: typeof Zap; label: string }> = {
  work: { icon: Zap, label: "专注" },
  shortBreak: { icon: Coffee, label: "短休息" },
  longBreak: { icon: Sun, label: "长休息" },
};

export function PhaseSelector({ currentPhase, onPhaseChange, disabled }: PhaseSelectorProps) {
  return (
    <div className="flex items-center justify-center gap-2">
      {(Object.keys(phaseConfig) as TimerPhase[]).map((phase) => {
        const config = phaseConfig[phase];
        const Icon = config.icon;
        const isActive = currentPhase === phase;
        const colors = PHASE_COLORS[phase];

        return (
          <motion.button
            key={phase}
            onClick={() => onPhaseChange(phase)}
            disabled={disabled}
            whileHover={{ scale: disabled ? 1 : 1.05 }}
            whileTap={{ scale: disabled ? 1 : 0.95 }}
            className={cn(
              "relative flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all duration-200",
              isActive ? "text-white shadow-md" : "text-muted-foreground hover:bg-muted/50",
              disabled && "cursor-not-allowed opacity-50",
            )}
            style={
              isActive
                ? {
                    background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 100%)`,
                    boxShadow: `0 4px 14px ${colors.primary}40`,
                  }
                : undefined
            }
          >
            <span className="relative z-10 flex items-center gap-2">
              <Icon className="h-4 w-4" />
              <span>{config.label}</span>
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}
