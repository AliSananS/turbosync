"use client";

import { useMemo } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, YAxis } from "recharts";
import { useRoom } from "@/lib/room-context";

export function LatencyChart() {
  const { latencyHistory } = useRoom();

  const data = useMemo(() => {
    // Fill with zero to have 40 points if empty
    const padded = [...latencyHistory];
    while (padded.length < 40) {
      padded.unshift(0);
    }
    return padded.map((value, index) => ({
      index,
      latency: value,
    }));
  }, [latencyHistory]);

  return (
    <div className="w-full h-full min-h-[140px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 5, right: 0, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="colorLatency" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <YAxis
            domain={[0, 60]}
            orientation="right"
            tick={{ fontSize: 9, fill: "#6B7280" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(val) => `${val}ms`}
            width={35}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "rgba(10, 10, 10, 0.9)",
              borderColor: "#1F1F23",
              borderRadius: "8px",
            }}
            itemStyle={{ color: "#EDEDED", fontSize: "11px" }}
            labelStyle={{ display: "none" }}
            formatter={(
              value: number | string | Array<number | string> | undefined,
            ) => [`${value}ms`, "Latency"]}
          />
          <Area
            type="monotone"
            dataKey="latency"
            stroke="#3b82f6"
            strokeWidth={1.5}
            fillOpacity={1}
            fill="url(#colorLatency)"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
