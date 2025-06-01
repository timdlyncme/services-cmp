import { UserWidget } from '@/services/dashboard-service';

export interface GridPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GridCell {
  x: number;
  y: number;
  occupied: boolean;
  widgetId?: string;
}

export interface GridLayout {
  width: number; // Number of columns
  height: number; // Number of rows (dynamic)
  cells: GridCell[][];
}

/**
 * Create a grid layout from widgets
 */
export function createGridLayout(widgets: UserWidget[], gridWidth: number = 4): GridLayout {
  // Calculate required height
  const maxY = Math.max(0, ...widgets.map(w => w.position_y + w.height));
  const gridHeight = Math.max(4, maxY); // Minimum 4 rows

  // Initialize empty grid
  const cells: GridCell[][] = [];
  for (let y = 0; y < gridHeight; y++) {
    cells[y] = [];
    for (let x = 0; x < gridWidth; x++) {
      cells[y][x] = { x, y, occupied: false };
    }
  }

  // Mark occupied cells
  widgets.forEach(widget => {
    for (let y = widget.position_y; y < widget.position_y + widget.height; y++) {
      for (let x = widget.position_x; x < widget.position_x + widget.width; x++) {
        if (y < gridHeight && x < gridWidth) {
          cells[y][x] = { x, y, occupied: true, widgetId: widget.user_widget_id };
        }
      }
    }
  });

  return { width: gridWidth, height: gridHeight, cells };
}

/**
 * Check if a position is valid for a widget
 */
export function isValidPosition(
  position: GridPosition,
  layout: GridLayout,
  excludeWidgetId?: string
): boolean {
  const { x, y, width, height } = position;

  // Check bounds
  if (x < 0 || y < 0 || x + width > layout.width) {
    return false;
  }

  // Check if all required cells are available
  for (let row = y; row < y + height; row++) {
    for (let col = x; col < x + width; col++) {
      if (row >= layout.height) {
        // Need to expand grid - this is valid
        continue;
      }
      
      const cell = layout.cells[row][col];
      if (cell.occupied && cell.widgetId !== excludeWidgetId) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Find the best position for a widget when dropped
 */
export function findBestDropPosition(
  draggedWidget: UserWidget,
  dropX: number,
  dropY: number,
  layout: GridLayout,
  cellWidth: number = 320,
  cellHeight: number = 240
): GridPosition {
  // Convert pixel coordinates to grid coordinates
  const targetX = Math.round(dropX / cellWidth);
  const targetY = Math.round(dropY / cellHeight);

  const widgetSize = {
    width: draggedWidget.width,
    height: draggedWidget.height
  };

  // Try the exact target position first
  const exactPosition = { x: targetX, y: targetY, ...widgetSize };
  if (isValidPosition(exactPosition, layout, draggedWidget.user_widget_id)) {
    return exactPosition;
  }

  // Search in expanding rings around the target position
  for (let radius = 1; radius <= 10; radius++) {
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue;
        
        const testPosition = {
          x: Math.max(0, targetX + dx),
          y: Math.max(0, targetY + dy),
          ...widgetSize
        };

        if (testPosition.x + testPosition.width <= layout.width &&
            isValidPosition(testPosition, layout, draggedWidget.user_widget_id)) {
          return testPosition;
        }
      }
    }
  }

  // Fallback: find first available position
  return findFirstAvailablePosition(widgetSize, layout, draggedWidget.user_widget_id);
}

/**
 * Find the first available position for a widget
 */
export function findFirstAvailablePosition(
  widgetSize: { width: number; height: number },
  layout: GridLayout,
  excludeWidgetId?: string
): GridPosition {
  for (let y = 0; y < layout.height + 10; y++) { // Allow expanding grid
    for (let x = 0; x <= layout.width - widgetSize.width; x++) {
      const position = { x, y, ...widgetSize };
      if (isValidPosition(position, layout, excludeWidgetId)) {
        return position;
      }
    }
  }

  // Ultimate fallback
  return { x: 0, y: layout.height, ...widgetSize };
}

/**
 * Get widgets that would be displaced by placing a widget at a position
 */
export function getDisplacedWidgets(
  position: GridPosition,
  widgets: UserWidget[],
  excludeWidgetId?: string
): UserWidget[] {
  return widgets.filter(widget => {
    if (excludeWidgetId && widget.user_widget_id === excludeWidgetId) {
      return false;
    }

    // Check if this widget overlaps with the new position
    return !(
      widget.position_x + widget.width <= position.x ||
      position.x + position.width <= widget.position_x ||
      widget.position_y + widget.height <= position.y ||
      position.y + position.height <= widget.position_y
    );
  });
}

/**
 * Reposition displaced widgets
 */
export function repositionDisplacedWidgets(
  displacedWidgets: UserWidget[],
  newLayout: GridLayout
): UserWidget[] {
  const repositioned: UserWidget[] = [];

  for (const widget of displacedWidgets) {
    const newPosition = findFirstAvailablePosition(
      { width: widget.width, height: widget.height },
      newLayout,
      widget.user_widget_id
    );

    const repositionedWidget = {
      ...widget,
      position_x: newPosition.x,
      position_y: newPosition.y
    };

    repositioned.push(repositionedWidget);

    // Update layout to reflect this widget's new position
    newLayout = createGridLayout([...repositioned], newLayout.width);
  }

  return repositioned;
}

/**
 * Convert grid coordinates to pixel coordinates
 */
export function gridToPixels(
  position: GridPosition,
  cellWidth: number = 320,
  cellHeight: number = 240
) {
  return {
    left: position.x * cellWidth,
    top: position.y * cellHeight,
    width: position.width * cellWidth - 16, // Account for gap
    height: position.height * cellHeight - 16 // Account for gap
  };
}

/**
 * Convert pixel coordinates to grid coordinates
 */
export function pixelsToGrid(
  pixelX: number,
  pixelY: number,
  cellWidth: number = 320,
  cellHeight: number = 240
): { x: number; y: number } {
  return {
    x: Math.round(pixelX / cellWidth),
    y: Math.round(pixelY / cellHeight)
  };
}

