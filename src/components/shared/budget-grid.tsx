'use client';

import { HierarchicalSpreadsheetGrid } from '@/components/shared/hierarchical-spreadsheet-grid';

interface BudgetGridProps {
  selectedMedia: string;
  selectedYear: number;
  selectedMonth: number;
  isDailyView: boolean;
}

export function BudgetGrid(props: BudgetGridProps) {
  return <HierarchicalSpreadsheetGrid {...props} />;
}