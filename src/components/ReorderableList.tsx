import React, { useState, useEffect, useRef } from 'react';

interface ReorderableListProps<T extends { id: string }> {
  items: T[];
  onReorder: (newItems: T[]) => void;
  renderItem: (item: T, index: number) => React.ReactNode;
  itemClassName?: string;
  itemStyle?: React.CSSProperties;
  getItemClassName?: (item: T, index: number, isDragging: boolean) => string;
  getItemStyle?: (item: T, index: number, isDragging: boolean) => React.CSSProperties;
  disabled?: boolean;
}

export function ReorderableList<T extends { id: string }>({
  items,
  onReorder,
  renderItem,
  itemClassName = '',
  itemStyle = {},
  getItemClassName,
  getItemStyle,
  disabled = false
}: ReorderableListProps<T>) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  
  const itemsRef = useRef<T[]>(items);
  const draggedIndexRef = useRef<number | null>(draggedIndex);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    draggedIndexRef.current = draggedIndex;
  }, [draggedIndex]);

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
    draggedIndexRef.current = index;
  };

  const handleDragEnter = (index: number) => {
    const currDragged = draggedIndexRef.current;
    if (currDragged === null || currDragged === index) return;

    const nextItems = [...itemsRef.current];
    const temp = nextItems[currDragged];
    nextItems[currDragged] = nextItems[index];
    nextItems[index] = temp;

    itemsRef.current = nextItems;
    onReorder(nextItems);
    
    draggedIndexRef.current = index;
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    draggedIndexRef.current = null;
  };

  const handleTouchStart = (index: number) => {
    setDraggedIndex(index);
    draggedIndexRef.current = index;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const currDragged = draggedIndexRef.current;
    if (currDragged === null) return;

    const touch = e.touches[0];
    const targetEl = document.elementFromPoint(touch.clientX, touch.clientY);
    if (!targetEl) return;

    const rowEl = targetEl.closest('[data-drag-index]');
    if (!rowEl) return;

    const targetIndex = parseInt(rowEl.getAttribute('data-drag-index') || '', 10);
    if (isNaN(targetIndex) || targetIndex === currDragged) return;

    const nextItems = [...itemsRef.current];
    const temp = nextItems[currDragged];
    nextItems[currDragged] = nextItems[targetIndex];
    nextItems[targetIndex] = temp;

    itemsRef.current = nextItems;
    onReorder(nextItems);

    draggedIndexRef.current = targetIndex;
    setDraggedIndex(targetIndex);
  };

  const handleTouchEnd = () => {
    setDraggedIndex(null);
    draggedIndexRef.current = null;
  };

  return (
    <>
      {items.map((item, index) => {
        const isDragging = index === draggedIndex;
        const customClassName = getItemClassName ? getItemClassName(item, index, isDragging) : '';
        const customStyle = getItemStyle ? getItemStyle(item, index, isDragging) : {};
        return (
          <div
            key={item.id}
            data-drag-index={index}
            draggable={!disabled}
            onDragStart={disabled ? undefined : () => handleDragStart(index)}
            onDragEnter={disabled ? undefined : () => handleDragEnter(index)}
            onDragEnd={disabled ? undefined : handleDragEnd}
            onDragOver={disabled ? undefined : (e) => e.preventDefault()}
            onTouchStart={disabled ? undefined : () => handleTouchStart(index)}
            onTouchMove={disabled ? undefined : handleTouchMove}
            onTouchEnd={disabled ? undefined : handleTouchEnd}
            className={`${itemClassName} ${customClassName} ${isDragging ? 'dragging' : ''}`}
            style={{
              opacity: isDragging ? 0.4 : 1,
              border: isDragging ? '1px dashed var(--color-primary)' : undefined,
              transition: 'opacity 0.2s, border 0.2s',
              userSelect: disabled ? 'text' : 'none',
              ...itemStyle,
              ...customStyle
            }}
          >
            {renderItem(item, index)}
          </div>
        );
      })}
    </>
  );
}
