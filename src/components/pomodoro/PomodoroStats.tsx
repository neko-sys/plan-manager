import { BarChart3, Calendar, Clock, TrendingUp } from "lucide-react";
import { motion } from "motion/react";
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { dateKey } from "@/domain/pomodoro";
import { cn } from "@/lib/utils";
import { usePomodoroStore } from "@/store/pomodoroStore";

type StatsView = "today" | "week" | "month";

type PomodoroStatsProps = {
  labels: {
    title: string;
    today: string;
    week: string;
    month: string;
    completed: string;
    focusTime: string;
    breakTime: string;
    pomodoros: string;
    minutes: string;
  };
};

const DAYS_OF_WEEK = ["日", "一", "二", "三", "四", "五", "六"];

export function PomodoroStats({ labels }: PomodoroStatsProps) {
  const [view, setView] = useState<StatsView>("today");
  const sessions = usePomodoroStore((s) => s.sessions);
  const getTodayStats = usePomodoroStore((s) => s.getTodayStats);
  const getWeekStats = usePomodoroStore((s) => s.getWeekStats);
  const getMonthStats = usePomodoroStore((s) => s.getMonthStats);

  const stats = useMemo(() => {
    switch (view) {
      case "today":
        return getTodayStats();
      case "week":
        return getWeekStats();
      case "month":
        return getMonthStats();
    }
  }, [view, getTodayStats, getWeekStats, getMonthStats]);

  const weekData = useMemo(() => {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const weekStart = new Date(now);
    weekStart.setDate(diff);

    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + i);
      const dateStr = dateKey(date);
      const daySessions = sessions.filter(
        (s) => s.isCompleted && s.startedAt.slice(0, 10) === dateStr && s.phase === "work",
      );
      return {
        date: dateStr,
        dayIndex: i,
        count: daySessions.length,
        minutes: daySessions.reduce((acc, s) => acc + s.durationMinutes, 0),
        isToday: dateStr === dateKey(now),
      };
    });
  }, [sessions]);

  const maxCount = Math.max(...weekData.map((d) => d.count), 1);

  const viewButtons: { key: StatsView; label: string }[] = [
    { key: "today", label: labels.today },
    { key: "week", label: labels.week },
    { key: "month", label: labels.month },
  ];

  return (
    <Card className="border-muted/20 bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex shrink-0 items-center gap-2 text-base whitespace-nowrap">
            <BarChart3 className="h-4 w-4 shrink-0" />
            {labels.title}
          </CardTitle>
          <div className="flex shrink-0 rounded-full bg-muted/30 p-0.5">
            {viewButtons.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setView(key)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium transition-all duration-200",
                  view === key
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
          <motion.div
            key={`completed-${view}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center rounded-xl bg-gradient-to-br from-rose-500/10 to-orange-500/10 p-2.5"
          >
            <TrendingUp className="h-4 w-4 text-rose-500" />
            <span className="mt-1 text-lg font-semibold">{stats.completed}</span>
            <span className="whitespace-nowrap text-[11px] text-muted-foreground">
              {labels.pomodoros}
            </span>
          </motion.div>

          <motion.div
            key={`focus-${view}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="flex flex-col items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 p-2.5"
          >
            <Clock className="h-4 w-4 text-emerald-500" />
            <span className="mt-1 text-lg font-semibold">{stats.focusMinutes}</span>
            <span className="whitespace-nowrap text-[11px] text-muted-foreground">
              {labels.minutes}
            </span>
          </motion.div>

          <motion.div
            key={`break-${view}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex flex-col items-center justify-center rounded-xl bg-gradient-to-br from-sky-500/10 to-blue-500/10 p-2.5"
          >
            <Calendar className="h-4 w-4 text-sky-500" />
            <span className="mt-1 text-lg font-semibold">{stats.breakMinutes}</span>
            <span className="whitespace-nowrap text-[11px] text-muted-foreground">
              {labels.minutes}
            </span>
          </motion.div>
        </div>

        {view === "week" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4">
            <div className="flex items-end justify-between gap-1">
              {weekData.map((day, i) => (
                <div key={day.date} className="flex flex-1 flex-col items-center gap-1">
                  <div className="relative h-20 w-full">
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${(day.count / maxCount) * 100}%` }}
                      transition={{ delay: i * 0.05, duration: 0.3 }}
                      className={cn(
                        "absolute bottom-0 left-1/2 w-3 -translate-x-1/2 rounded-t-sm",
                        day.isToday
                          ? "bg-gradient-to-t from-rose-500 to-orange-400"
                          : "bg-gradient-to-t from-muted-foreground/30 to-muted-foreground/50",
                      )}
                    />
                  </div>
                  <span
                    className={cn(
                      "text-[10px] font-medium",
                      day.isToday ? "text-rose-500" : "text-muted-foreground",
                    )}
                  >
                    {DAYS_OF_WEEK[day.dayIndex]}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}
