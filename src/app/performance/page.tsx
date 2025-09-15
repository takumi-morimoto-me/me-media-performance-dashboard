'use client';

import { useState } from "react";
import { PageFilters } from "@/components/shared/page-filters";

export default function PerformancePage() {
  // State for filters
  const [selectedMedia, setSelectedMedia] = useState<string>("all");
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [isDailyView, setIsDailyView] = useState<boolean>(false);

  return (
    <div className="flex flex-1 flex-col gap-4 lg:gap-6">
      <PageFilters
        selectedMedia={selectedMedia}
        setSelectedMedia={setSelectedMedia}
        selectedYear={selectedYear}
        setSelectedYear={setSelectedYear}
        selectedMonth={selectedMonth}
        setSelectedMonth={setSelectedMonth}
        isDailyView={isDailyView}
        setIsDailyView={setIsDailyView}
      />
      <div className="flex-1 rounded-lg border border-dashed shadow-sm">
        {/* Placeholder for Performance Data */}
      </div>
    </div>
  );
}
