"use client";

import { useTheme } from "@/contexts/ThemeContext";
import { Card, CardHeader, CardTitle, CardContent } from "@/design/components";
import { Sun, Moon } from "lucide-react";
import { clsx } from "clsx";

export function ThemeSection() {
  const { theme, setTheme } = useTheme();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Aparência</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-4 text-sm text-neutral-600 dark:text-neutral-400">
          Escolha o tema de exibição. A preferência fica salva até você alterar.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setTheme("light")}
            className={clsx(
              "flex flex-1 items-center justify-center gap-2 rounded-sm border px-4 py-3 text-sm font-medium transition-colors duration-normal",
              theme === "light"
                ? "border-primary-500 bg-primary-50 text-primary-700 dark:border-primary-500 dark:bg-primary-950/50 dark:text-primary-400"
                : "border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800/50 dark:text-neutral-400 dark:hover:border-neutral-600 dark:hover:bg-neutral-800"
            )}
          >
            <Sun className="h-4 w-4" />
            Claro
          </button>
          <button
            type="button"
            onClick={() => setTheme("dark")}
            className={clsx(
              "flex flex-1 items-center justify-center gap-2 rounded-sm border px-4 py-3 text-sm font-medium transition-colors duration-normal",
              theme === "dark"
                ? "border-primary-500 bg-primary-50 text-primary-700 dark:border-primary-500 dark:bg-primary-950/50 dark:text-primary-400"
                : "border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800/50 dark:text-neutral-400 dark:hover:border-neutral-600 dark:hover:bg-neutral-800"
            )}
          >
            <Moon className="h-4 w-4" />
            Escuro
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
