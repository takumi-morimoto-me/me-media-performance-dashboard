'use client';

import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';

interface EditableRowHeaderProps {
  value: string;
  onValueChange: (newValue: string) => void;
  onDelete?: () => void;
  className?: string;
}

export function EditableRowHeader({
  value,
  onValueChange,
  onDelete,
  className
}: EditableRowHeaderProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  const startEditing = () => {
    setIsEditing(true);
    setEditValue(value);
    setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);
  };

  const finishEditing = (save: boolean = true) => {
    if (save && editValue.trim() && editValue !== value) {
      onValueChange(editValue.trim());
    }
    setIsEditing(false);
    setEditValue(value);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'Enter':
        e.preventDefault();
        finishEditing(true);
        break;
      case 'Escape':
        e.preventDefault();
        finishEditing(false);
        break;
    }
  };

  useEffect(() => {
    setEditValue(value);
  }, [value]);

  if (isEditing) {
    return (
      <td className={cn('px-3 py-2 sticky left-0 z-10 bg-background border-r', className)}>
        <div className="flex items-center gap-1">
          <Input
            ref={inputRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={() => finishEditing(true)}
            className="h-7 text-sm font-medium"
          />
        </div>
      </td>
    );
  }

  return (
    <td className={cn(
      'px-3 py-2 sticky left-0 z-10 bg-background border-r font-medium group cursor-pointer',
      'hover:bg-gray-50',
      className
    )}>
      <div className="flex items-center justify-between">
        <span 
          onDoubleClick={startEditing}
          className="flex-1 select-none"
        >
          {value}
        </span>
        {onDelete && (
          <Button
            variant="ghost"
            size="sm"
            className="opacity-0 group-hover:opacity-100 h-6 w-6 p-0 ml-2"
            onClick={onDelete}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
      </div>
    </td>
  );
}