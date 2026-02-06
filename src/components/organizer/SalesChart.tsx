import { useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { salesLast7Days, salesLast24h } from "@/data/mockOrganizerData";

type Period = "7d" | "24h";

export function SalesChart() {
  const [period, setPeriod] = useState<Period>("7d");

  const data = period === "7d" ? salesLast7Days : salesLast24h;

  return (
    <div className="bg-card rounded-2xl shadow-card p-5 md:p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold text-foreground">Performance de Vendas</h2>
        <div className="flex gap-1 bg-secondary rounded-lg p-1">
          <button
            onClick={() => setPeriod("24h")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              period === "24h"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            24h
          </button>
          <button
            onClick={() => setPeriod("7d")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              period === "7d"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            7 dias
          </button>
        </div>
      </div>

      <div className="h-64 md:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="hsl(var(--border))"
            />
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "12px",
                boxShadow: "var(--shadow-elevated)",
                padding: "12px 16px",
              }}
              labelStyle={{
                color: "hsl(var(--foreground))",
                fontWeight: 600,
                marginBottom: 4,
              }}
              itemStyle={{
                color: "hsl(var(--muted-foreground))",
                fontSize: 13,
              }}
              formatter={(value: number, name: string) => {
                if (name === "receita") {
                  return [
                    new Intl.NumberFormat("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    }).format(value),
                    "Receita",
                  ];
                }
                return [value, "Vendas"];
              }}
            />
            <Line
              type="monotone"
              dataKey="vendas"
              stroke="hsl(var(--primary))"
              strokeWidth={2.5}
              dot={{ r: 4, fill: "hsl(var(--primary))", strokeWidth: 0 }}
              activeDot={{ r: 6, fill: "hsl(var(--primary))", strokeWidth: 2, stroke: "hsl(var(--card))" }}
            />
            <Line
              type="monotone"
              dataKey="receita"
              stroke="hsl(var(--success))"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center gap-6 mt-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-0.5 rounded-full bg-primary" />
          <span className="text-muted-foreground">Ingressos vendidos</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-0.5 rounded-full bg-success border-dashed" />
          <span className="text-muted-foreground">Receita</span>
        </div>
      </div>
    </div>
  );
}
