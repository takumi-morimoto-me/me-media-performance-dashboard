'use client';

import { SpreadsheetGrid } from '@/components/shared/spreadsheet-grid';

interface BudgetGridProps {
  selectedMedia: string;
  selectedYear: number;
  selectedMonth: number;
  isDailyView: boolean;
}

export function BudgetGrid(props: BudgetGridProps) {
  return <SpreadsheetGrid {...props} />;
}