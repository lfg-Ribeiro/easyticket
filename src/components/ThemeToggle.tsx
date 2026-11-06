import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem("theme");
    if (saved) return saved === "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      root.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [isDark]);

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setIsDark(!isDark)}
      aria-label="Alternar entre modo claro e escuro"
      className="rounded-full w-10 h-10 transition-transform duration-200 hover:scale-105"
    >
      {isDark ? (
        <Sun className="h-5 w-5 text-yellow-400 transition-all rotate-0 scale-100" />
      ) : (
        <Moon className="h-5 w-5 text-slate-700 transition-all rotate-0 scale-100" />
      )}
    </Button>
  );
}