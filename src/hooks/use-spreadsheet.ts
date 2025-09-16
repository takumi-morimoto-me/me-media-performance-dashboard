'use client';

import { useState, useCallback, useRef } from 'react';

export interface SpreadsheetCell {
  row: number;
  col: number;
  value: string;
}

export interface SpreadsheetData {
  [key: string]: { [key: string]: string | number };
}

export interface UseSpreadsheetProps {
  data: SpreadsheetData;
  rowCount: number;
  onDataChange?: (data: SpreadsheetData) => void;
  onCellChange?: (row: number, col: number, value: string) => void;
  onBatchCellChange?: (changes: Array<{row: number, col: number, value: string}>) => void;
  isEditingDisabled?: boolean; // 編集無効フラグ
  getCellValue?: (row: number, col: number) => string; // セル値取得関数
}

export const useSpreadsheet = ({ 
  rowCount,
  onCellChange,
  onBatchCellChange,
  isEditingDisabled = false, // デフォルトは編集可能
  getCellValue,
}: UseSpreadsheetProps) => {
  const [selectedCell, setSelectedCell] = useState<SpreadsheetCell | null>(null);
  const [editingCell, setEditingCell] = useState<SpreadsheetCell | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const tableRef = useRef<HTMLTableElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // セルの選択
  const selectCell = useCallback((row: number, col: number, value: string) => {
    setSelectedCell({ row, col, value });
    setEditingCell(null);
  }, []);

  // セルの編集開始
  const startEditing = useCallback((row: number, col: number, value: string) => {
    if (isEditingDisabled) return; // 編集無効なら何もしない

    setEditingCell({ row, col, value });
    setEditValue(String(value));
    setSelectedCell({ row, col, value });
    
    setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);
  }, [isEditingDisabled]);

  // セルの編集終了
  const finishEditing = useCallback((save: boolean = true) => {
    if (!editingCell) return;
    
    if (save && editValue !== editingCell.value) {
      onCellChange?.(editingCell.row, editingCell.col, editValue);
    }
    
    setEditingCell(null);
    setEditValue('');
  }, [editingCell, editValue, onCellChange]);

  // セル移動
  const moveCell = useCallback((newRow: number, newCol: number) => {
    const tableElement = tableRef.current;
    if (!tableElement) return;

    const rows = tableElement.querySelectorAll('tbody tr');
    const maxRow = rows.length - 1;
    
    if (maxRow < 0) return;
    
    const cells = rows[0]?.querySelectorAll('td, th');
    const maxCol = cells ? cells.length - 1 : 0;

    const targetRow = Math.max(0, Math.min(newRow, maxRow));
    const targetCol = Math.max(0, Math.min(newCol, maxCol));
    
    // getCellValue関数が提供されている場合はそれを使用、そうでなければDOMから取得
    const cellValue = getCellValue ? getCellValue(targetRow, targetCol) : 
                     (tableElement.querySelectorAll('tbody tr')[targetRow]?.children[targetCol]?.textContent || '');
    
    selectCell(targetRow, targetCol, cellValue);
  }, [selectCell, getCellValue]);

  // キーボードナビゲーション
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!selectedCell) return;

    const { row, col } = selectedCell;
    
    if (editingCell) {
      switch (e.key) {
        case 'Enter':
          e.preventDefault();
          finishEditing(true);
          const nextRow = row + 1;
          if (nextRow < rowCount) {
            const cellValue = getCellValue ? getCellValue(nextRow, col) : '';
            startEditing(nextRow, col, cellValue);
          } else {
            setSelectedCell(null);
          }
          break;
        case 'Tab':
          e.preventDefault();
          finishEditing(true);
          moveCell(row, col + 1);
          break;
        case 'Escape':
          e.preventDefault();
          finishEditing(false);
          break;
      }
      return;
    }

    // 編集が無効な場合は、移動のみ許可
    if (isEditingDisabled) {
        switch (e.key) {
            case 'ArrowUp': 
              e.preventDefault(); 
              e.stopPropagation(); 
              moveCell(row - 1, col); 
              break;
            case 'ArrowDown': 
              e.preventDefault(); 
              e.stopPropagation(); 
              moveCell(row + 1, col); 
              break;
            case 'ArrowLeft': 
              e.preventDefault(); 
              e.stopPropagation(); 
              moveCell(row, col - 1); 
              break;
            case 'ArrowRight': 
              e.preventDefault(); 
              e.stopPropagation(); 
              moveCell(row, col + 1); 
              break;
        }
        return;
    }

    // 編集中でない場合 (編集可能)
    switch (e.key) {
      case 'ArrowUp': 
        e.preventDefault(); 
        e.stopPropagation(); 
        moveCell(row - 1, col); 
        break;
      case 'ArrowDown': 
        e.preventDefault(); 
        e.stopPropagation(); 
        moveCell(row + 1, col); 
        break;
      case 'ArrowLeft': 
        e.preventDefault(); 
        e.stopPropagation(); 
        moveCell(row, col - 1); 
        break;
      case 'ArrowRight': 
        e.preventDefault(); 
        e.stopPropagation(); 
        moveCell(row, col + 1); 
        break;
      case 'Enter':
      case 'F2':
        e.preventDefault();
        e.stopPropagation();
        startEditing(row, col, selectedCell.value);
        break;
      case 'Delete':
      case 'Backspace':
        e.preventDefault();
        e.stopPropagation();
        onCellChange?.(row, col, '');
        break;
      default:
        // 文字入力による即座の編集開始を無効化
        // 編集はEnter、F2、またはダブルクリックのみで開始
        break;
    }
  }, [selectedCell, editingCell, finishEditing, startEditing, onCellChange, moveCell, isEditingDisabled, rowCount, getCellValue, setSelectedCell]);

  // ペースト処理
  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    if (isEditingDisabled) return; // 編集無効なら何もしない
    e.preventDefault();
    if (!selectedCell) return;
    
    try {
      const text = e.clipboardData.getData('text/plain');
      
      const lines = text.split('\n');
      if (lines[lines.length - 1] === '') {
        lines.pop();
      }
      
      // 行と列の両方に対応したペースト処理
      const startRow = selectedCell.row;
      const startCol = selectedCell.col;
      
      const tableElement = tableRef.current;
      if (!tableElement) return;
      
      const rows = tableElement.querySelectorAll('tbody tr');
      const maxRows = rows.length;
      const totalCols = rows[0]?.querySelectorAll('td').length || 0;
      const dataCols = totalCols - 1;
      
      // ペースト処理のための変更リストを作成
      const cellChanges: Array<{row: number, col: number, value: string}> = [];
      
      // 各行を処理して変更リストを作成
      lines.forEach((line, rowOffset) => {
        if (!line.trim()) return; // 空行はスキップ
        
        // タブ区切りがある場合（横方向のペースト）、ない場合（縦方向のペースト）の両方に対応
        const cellValues = line.includes('\t') ? line.split('\t') : [line];
        
        cellValues.forEach((cellValue, colOffset) => {
          const targetRow = startRow + rowOffset;
          const targetCol = startCol + colOffset;
          
          if (targetRow >= 0 && targetRow < maxRows && targetCol >= 0 && targetCol < dataCols) {
            let processedValue = cellValue.trim();
            if (processedValue === '') {
              processedValue = '0';
            }
            cellChanges.push({row: targetRow, col: targetCol, value: processedValue});
          }
        });
      });
      
      // バッチ更新があればそれを使用、そうでなければ個別更新
      if (onBatchCellChange && cellChanges.length > 1) {
        onBatchCellChange(cellChanges);
      } else {
        // 個別更新
        cellChanges.forEach(({row, col, value}) => {
          onCellChange?.(row, col, value);
        });
      }
    } catch (error) {
      console.error('Paste error:', error);
    }
  }, [selectedCell, onCellChange, onBatchCellChange, tableRef, isEditingDisabled]);

  return {
    selectedCell,
    editingCell,
    editValue,
    setEditValue,
    selectCell,
    startEditing,
    finishEditing,
    handleKeyDown,
    handlePaste,
    tableRef,
    inputRef,
  };
};
