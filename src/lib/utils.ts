import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// 数値フォーマット関数
export function formatNumber(value: number, options?: {
  decimals?: number;
  isDailyView?: boolean;
}): string {
  const { decimals, isDailyView = false } = options || {};

  // 日次ビューの場合は小数点第2位まで、月次ビューの場合は整数
  const decimalPlaces = isDailyView ? (decimals ?? 2) : (decimals ?? 0);

  // 数値をフォーマット（カンマ区切り + 小数点）
  return new Intl.NumberFormat('ja-JP', {
    minimumFractionDigits: decimalPlaces,
    maximumFractionDigits: decimalPlaces,
  }).format(value);
}

// 表示用の数値フォーマット（編集時は使わない）
export function formatCellValue(value: string | number, isDailyView: boolean = false): string {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(numValue)) return '0';

  return formatNumber(numValue, { isDailyView });
}

// 編集用の数値パース（カンマを除去）
export function parseNumberInput(value: string): number {
  const cleaned = value.replace(/[,\s]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}
