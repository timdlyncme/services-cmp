import { UserWidget } from '@/services/dashboard-service';

export interface GridItem {
  id: string;
  widget: UserWidget;
  gridPosition: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

/**
 * Convert widgets to a sortable array based on grid position
 */
export function widgetsToSortableArray(widgets: UserWidget[]): GridItem[] {
  return widgets
    .map(widget => ({
      id: widget.user_widget_id,
      widget,
      gridPosition: {
        x: widget.position_x,
        y: widget.position_y,
        width: widget.width,
        height: widget.height
      }
    }))
    .sort((a, b) => {
      // Sort by row first, then by column
      if (a.gridPosition.y !== b.gridPosition.y) {
        return a.gridPosition.y - b.gridPosition.y;
      }
      return a.gridPosition.x - b.gridPosition.x;
    });
}

/**
 * Convert sortable array back to widgets with updated positions
 */
export function sortableArrayToWidgets(items: GridItem[], gridWidth: number = 4): UserWidget[] {
  const grid: boolean[][] = [];
  const result: UserWidget[] = [];

  // Initialize grid
  for (let y = 0; y < 20; y++) {
    grid[y] = new Array(gridWidth).fill(false);
  }

  // Place widgets in grid order
  for (const item of items) {
    const position = findNextAvailablePosition(item.gridPosition.width, item.gridPosition.height, grid, gridWidth);
    
    // Mark cells as occupied
    for (let y = position.y; y < position.y + item.gridPosition.height; y++) {
      for (let x = position.x; x < position.x + item.gridPosition.width; x++) {
        if (y < grid.length && x < gridWidth) {
          grid[y][x] = true;
        }
      }
    }

    result.push({
      ...item.widget,
      position_x: position.x,
      position_y: position.y
    });
  }

  return result;
}

/**
 * Find next available position for a widget
 */
function findNextAvailablePosition(
  width: number,
  height: number,
  grid: boolean[][],
  gridWidth: number
): { x: number; y: number } {
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x <= gridWidth - width; x++) {
      if (canPlaceAt(x, y, width, height, grid, gridWidth)) {
        return { x, y };
      }
    }
  }
  
  // If no space found, place at end
  return { x: 0, y: grid.length };
}

/**
 * Check if widget can be placed at position
 */
function canPlaceAt(
  x: number,
  y: number,
  width: number,
  height: number,
  grid: boolean[][],
  gridWidth: number
): boolean {
  if (x + width > gridWidth) return false;
  
  for (let row = y; row < y + height; row++) {
    if (row >= grid.length) return true; // Can expand grid
    for (let col = x; col < x + width; col++) {
      if (grid[row][col]) return false;
    }
  }
  
  return true;
}

/**
 * Get the insertion index for a dragged item
 */
export function getInsertionIndex(
  draggedItem: GridItem,
  overItem: GridItem | null,
  items: GridItem[]
): number {
  if (!overItem) {
    return items.length;
  }

  const overIndex = items.findIndex(item => item.id === overItem.id);
  const draggedIndex = items.findIndex(item => item.id === draggedItem.id);

  if (draggedIndex < overIndex) {
    return overIndex;
  } else {
    return overIndex + 1;
  }
}

/**
 * Reorder array for sortable operations
 */
export function arrayMove<T>(array: T[], from: number, to: number): T[] {
  const newArray = array.slice();
  const item = newArray.splice(from, 1)[0];
  newArray.splice(to, 0, item);
  return newArray;
}

