'use client';

import { forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

interface EditableCellProps {
  value: string | number;
  isSelected: boolean;
  isEditing: boolean;
  editValue: string;
  onEditValueChange: (value: string) => void;
  onCellClick: () => void;
  onDoubleClick: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onPaste: (e: React.ClipboardEvent) => void;
  className?: string;
  children?: React.ReactNode;
}

export const EditableCell = forwardRef<HTMLInputElement, EditableCellProps>(
  ({
    value,
    isSelected,
    isEditing,
    editValue,
    onEditValueChange,
    onCellClick,
    onDoubleClick,
    onKeyDown,
    onPaste,
    className,
    children,
  }, ref) => {
    // 編集中の場合はInputを表示
    if (isEditing) {
      return (
        <td className={cn('p-0 relative', className)}>
          <Input
            ref={ref}
            value={editValue}
            onChange={(e) => onEditValueChange(e.target.value)}
            onKeyDown={onKeyDown}
            onPaste={onPaste}
            className="border-2 border-blue-500 rounded-none h-full w-full px-2 py-1 text-sm focus:ring-0 focus:ring-offset-0"
            autoFocus
          />
        </td>
      );
    }

    // 通常のセル表示
    return (
      <td
        className={cn(
          'px-3 py-2 text-sm border-r border-b cursor-cell select-none relative',
          isSelected && 'bg-blue-50 ring-2 ring-blue-500',
          'hover:bg-gray-50',
          'focus:outline-none',
          className
        )}
        onClick={onCellClick}
        onDoubleClick={onDoubleClick}
        onKeyDown={(e) => {
          // セル選択状態でのキーイベントを適切に処理
          if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'Tab', 'Delete', 'Backspace', 'F2'].includes(e.key)) {
            e.preventDefault();
            e.stopPropagation();
          }
          onKeyDown(e);
        }}
        onPaste={onPaste}
        tabIndex={0}
      >
        <div className="min-h-[20px] overflow-hidden text-ellipsis">
          {children || (typeof value === 'number' ? value.toLocaleString() : value)}
        </div>
        {isSelected && (
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-blue-500"></div>
          </div>
        )}
      </td>
    );
  }
);

EditableCell.displayName = 'EditableCell';