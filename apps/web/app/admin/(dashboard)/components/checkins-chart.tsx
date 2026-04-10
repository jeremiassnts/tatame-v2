"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useState, useEffect } from "react";

type CheckinDataPoint = {
  date: string;
  count: number;
};

export function CheckinsChart({ data }: { data: CheckinDataPoint[] }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const formatted = data.map((d) => ({
    ...d,
    label: new Date(d.date + "T00:00:00Z").toLocaleDateString("pt-BR", {
      weekday: "short",
      day: "2-digit",
    }),
  }));

  return (
    <div className="rounded-[14px] border border-border bg-surface p-5">
      <h3 className="mb-4 text-[13px] font-medium text-text-secondary">
        Check-ins diários (últimos 7 dias)
      </h3>
      <div className="h-[200px] w-full">
        {mounted && (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={formatted}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" />
              <XAxis
                dataKey="label"
                tick={{ fill: "#ABABAB", fontSize: 12 }}
                axisLine={{ stroke: "#2A2A2A" }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "#ABABAB", fontSize: 12 }}
                axisLine={{ stroke: "#2A2A2A" }}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1A1A1A",
                  border: "1px solid #2A2A2A",
                  borderRadius: 8,
                  color: "#FFFFFF",
                }}
              />
              <Line
                type="monotone"
                dataKey="count"
                stroke="#A078E8"
                strokeWidth={2}
                dot={{ fill: "#A078E8", r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
