"use client";

import { clsx } from "clsx";
import {
  Users,
  UserPlus,
  Clock,
  Trophy,
  TrendingUp,
  Target,
  DollarSign,
  BarChart3,
  type LucideIcon,
} from "lucide-react";

const ICON_MAP: Record<string, LucideIcon> = {
  users: Users,
  "user-plus": UserPlus,
  clock: Clock,
  trophy: Trophy,
  "trending-up": TrendingUp,
  target: Target,
  "dollar-sign": DollarSign,
  "bar-chart": BarChart3,
};

interface KpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  variant?: "default" | "primary" | "success" | "warning" | "accent";
  className?: string;
}

const variantStyles = {
  default: {
    iconBg: "bg-neutral-100 dark:bg-neutral-800",
    iconColor: "text-neutral-500 dark:text-neutral-400",
    accentColor: "text-neutral-900 dark:text-neutral-100",
  },
  primary: {
    iconBg: "bg-primary-500/10 dark:bg-primary-500/15",
    iconColor: "text-primary-500",
    accentColor: "text-primary-600 dark:text-primary-400",
  },
  success: {
    iconBg: "bg-success-500/10 dark:bg-success-500/15",
    iconColor: "text-success-500",
    accentColor: "text-success-600 dark:text-success-400",
  },
  warning: {
    iconBg: "bg-warning-500/10 dark:bg-warning-500/15",
    iconColor: "text-warning-500",
    accentColor: "text-warning-600 dark:text-warning-400",
  },
  accent: {
    iconBg: "bg-accent-500/10 dark:bg-accent-500/15",
    iconColor: "text-accent-500",
    accentColor: "text-accent-600 dark:text-accent-400",
  },
};

export function KpiCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  variant = "default",
  className,
}: KpiCardProps) {
  const styles = variantStyles[variant];
  const Icon = ICON_MAP[icon] || Users;

  return (
    <div
      className={clsx(
        "relative overflow-hidden rounded-xl p-4",
        "bg-white dark:bg-neutral-900",
        "border border-neutral-200/60 dark:border-neutral-800",
        "shadow-card",
        "transition-all duration-fast hover:shadow-md",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-footnote font-medium text-neutral-500 dark:text-neutral-400">
            {title}
          </p>
          <p className={clsx("text-title-1 font-bold tracking-tight", styles.accentColor)}>
            {value}
          </p>
          {subtitle && (
            <p className="text-caption-1 text-neutral-400 dark:text-neutral-500">
              {subtitle}
            </p>
          )}
          {trend && (
            <div className="flex items-center gap-1.5 pt-0.5">
              <span
                className={clsx(
                  "text-caption-1 font-medium",
                  trend.isPositive ? "text-success-500" : "text-error-500"
                )}
              >
                {trend.isPositive ? "+" : ""}
                {trend.value}%
              </span>
              <span className="text-caption-2 text-neutral-400">vs anterior</span>
            </div>
          )}
        </div>
        <div
          className={clsx(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
            styles.iconBg
          )}
        >
          <Icon className={clsx("h-5 w-5", styles.iconColor)} strokeWidth={1.75} />
        </div>
      </div>
    </div>
  );
}
