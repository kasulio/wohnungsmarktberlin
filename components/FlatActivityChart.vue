<script setup lang="ts">
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Tooltip,
  Filler,
  type ChartData,
  type ChartOptions,
} from "chart.js";
import { Bar, Line } from "vue-chartjs";

import type { FontSpec } from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Tooltip,
  Filler,
);

type ActivityStats = {
  byDayOfWeek: { day: number; count: number }[];
  byHourOfDay: { hour: number; count: number }[];
  byWeek: { week: string; count: number }[];
};

const props = defineProps<{ stats: ActivityStats }>();

const DAY_NAMES = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

// Design-system palette
const PRIMARY = "#513668";
const ACCENT = "#A555A2";
const SECONDARY = "#ECDAEB";
const GRID_COLOR = "rgba(16,16,30,0.07)";
const TICK_COLOR = "#10101E";
const FONT: FontSpec = {
  family: "Poppins",
  size: 12,
  style: "normal",
  weight: "normal",
  lineHeight: 1,
};
const FONT_SM: FontSpec = {
  family: "Poppins",
  size: 11,
  style: "normal",
  weight: "normal",
  lineHeight: 1,
};

// Day of week
const dayData = computed<ChartData<"bar">>(() => {
  const counts = Array<number>(7).fill(0);
  for (const d of props.stats.byDayOfWeek) counts[d.day] = d.count;
  const max = Math.max(...counts, 1);
  return {
    labels: DAY_NAMES,
    datasets: [
      {
        label: "Neue Wohnungen",
        data: counts,
        backgroundColor: counts.map((c) => {
          const alpha = (0.25 + 0.75 * (c / max)).toFixed(2);
          return `rgba(165,85,162,${alpha})`;
        }),
        borderColor: ACCENT,
        borderWidth: 1,
        borderRadius: 6,
      },
    ],
  };
});

// Hour of day
const hourData = computed<ChartData<"bar">>(() => {
  const counts = Array<number>(24).fill(0);
  for (const h of props.stats.byHourOfDay) counts[h.hour] = h.count;
  const max = Math.max(...counts, 1);
  return {
    labels: Array.from(
      { length: 24 },
      (_, i) => `${String(i).padStart(2, "0")}:00`,
    ),
    datasets: [
      {
        label: "Neue Wohnungen",
        data: counts,
        backgroundColor: counts.map((c) => {
          const alpha = (0.2 + 0.8 * (c / max)).toFixed(2);
          return `rgba(81,54,104,${alpha})`;
        }),
        borderColor: PRIMARY,
        borderWidth: 1,
        borderRadius: 4,
      },
    ],
  };
});

// Weekly trend (last 26 weeks)
const weeklyData = computed<ChartData<"line">>(() => {
  const sorted = [...props.stats.byWeek].sort((a, b) =>
    a.week.localeCompare(b.week),
  );
  const recent = sorted.slice(-26);
  return {
    labels: recent.map((w) => {
      const [year, week] = w.week.split("-");
      return `KW\u00a0${week}/${year?.slice(2)}`;
    }),
    datasets: [
      {
        label: "Neue Wohnungen",
        data: recent.map((w) => w.count),
        borderColor: ACCENT,
        borderWidth: 2,
        backgroundColor: SECONDARY + "99",
        pointBackgroundColor: PRIMARY,
        pointBorderColor: "#fff",
        pointBorderWidth: 1.5,
        pointRadius: 3,
        pointHoverRadius: 5,
        fill: true,
        tension: 0.35,
      },
    ],
  };
});

// Shared options
const sharedScales = {
  x: {
    grid: { color: GRID_COLOR },
    ticks: { color: TICK_COLOR, font: FONT },
    border: { display: false },
  },
  y: {
    grid: { color: GRID_COLOR },
    ticks: { color: TICK_COLOR, font: FONT },
    border: { display: false },
    beginAtZero: true,
  },
} satisfies ChartOptions<"bar">["scales"];

const barOptions: ChartOptions<"bar"> = {
  responsive: true,
  maintainAspectRatio: true,
  animation: { duration: 400 },
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: { label: (ctx) => ` ${ctx.parsed.y} Wohnungen` },
    },
  },
  scales: sharedScales,
};

const lineOptions: ChartOptions<"line"> = {
  responsive: true,
  maintainAspectRatio: true,
  animation: { duration: 400 },
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: { label: (ctx) => ` ${ctx.parsed.y} Wohnungen` },
    },
  },
  scales: {
    ...sharedScales,
    x: {
      ...sharedScales.x,
      ticks: {
        ...sharedScales.x.ticks,
        font: FONT_SM,
        maxRotation: 45,
        autoSkip: true,
        maxTicksLimit: 13,
      },
    },
  },
};
</script>

<template>
  <ClientOnly>
    <div class="flex flex-col gap-6 pt-2">
      <!-- Weekly trend -->
      <div class="rounded-md border border-dashed border-black p-4">
        <h3 class="text-m font-semibold">Neue Wohnungen pro Woche</h3>
        <p class="mb-4 mt-1 text-s text-gray-500">Letzte 26 Wochen</p>
        <Line
          :data="weeklyData"
          :options="lineOptions"
        />
      </div>

      <!-- Day + Hour row -->
      <div class="flex flex-wrap gap-6">
        <div
          class="min-w-52 flex-1 rounded-md border border-dashed border-black p-4"
        >
          <h3 class="text-m font-semibold">Nach Wochentag</h3>
          <p class="mb-4 mt-1 text-s text-gray-500">
            An welchen Tagen werden Wohnungen eingestellt?
          </p>
          <Bar
            :data="dayData"
            :options="barOptions"
          />
        </div>

        <div
          class="min-w-52 flex-1 rounded-md border border-dashed border-black p-4"
        >
          <h3 class="text-m font-semibold">Nach Uhrzeit</h3>
          <p class="mb-4 mt-1 text-s text-gray-500">
            Zu welcher Uhrzeit werden Wohnungen eingestellt?
          </p>
          <Bar
            :data="hourData"
            :options="barOptions"
          />
        </div>
      </div>
    </div>

    <template #fallback>
      <div class="flex flex-col gap-6 pt-2">
        <div
          v-for="i in 3"
          :key="i"
          class="h-48 animate-pulse rounded-md border border-dashed border-black bg-secondary/30"
        />
      </div>
    </template>
  </ClientOnly>
</template>
