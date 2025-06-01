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
}

/**
 * Get all grid cells occupied by a widget
 */
export function getOccupiedCells(widget: GridPosition): GridCell[] {
  const cells: GridCell[] = [];
  for (let x = widget.x; x < widget.x + widget.width; x++) {
    for (let y = widget.y; y < widget.y + widget.height; y++) {
      cells.push({ x, y });
    }
  }
  return cells;
}

/**
 * Check if two widgets overlap
 */
export function doWidgetsOverlap(widget1: GridPosition, widget2: GridPosition): boolean {
  return !(
    widget1.x + widget1.width <= widget2.x ||
    widget2.x + widget2.width <= widget1.x ||
    widget1.y + widget1.height <= widget2.y ||
    widget2.y + widget2.height <= widget1.y
  );
}

/**
 * Check if a widget placement would collide with existing widgets
 */
export function checkCollision(
  newWidget: GridPosition,
  existingWidgets: UserWidget[],
  excludeWidgetId?: string
): boolean {
  return existingWidgets.some(widget => {
    if (excludeWidgetId && widget.user_widget_id === excludeWidgetId) {
      return false;
    }
    
    const existingPosition: GridPosition = {
      x: widget.position_x,
      y: widget.position_y,
      width: widget.width,
      height: widget.height
    };
    
    return doWidgetsOverlap(newWidget, existingPosition);
  });
}

/**
 * Find the next available position for a widget
 */
export function findNextAvailablePosition(
  widgetSize: { width: number; height: number },
  existingWidgets: UserWidget[],
  gridWidth: number = 4
): GridPosition {
  for (let y = 0; y < 100; y++) { // Reasonable limit to prevent infinite loop
    for (let x = 0; x <= gridWidth - widgetSize.width; x++) {
      const position: GridPosition = {
        x,
        y,
        width: widgetSize.width,
        height: widgetSize.height
      };
      
      if (!checkCollision(position, existingWidgets)) {
        return position;
      }
    }
  }
  
  // Fallback: place at the bottom
  return {
    x: 0,
    y: Math.max(...existingWidgets.map(w => w.position_y + w.height), 0),
    width: widgetSize.width,
    height: widgetSize.height
  };
}

/**
 * Find the next available position for a widget, with automatic repositioning of overlapped widgets
 */
export function findNextAvailablePositionWithReposition(
  widgetSize: { width: number; height: number },
  targetPosition: { x: number; y: number },
  existingWidgets: UserWidget[],
  excludeWidgetId?: string,
  gridWidth: number = 4
): { position: GridPosition; repositionedWidgets: UserWidget[] } {
  const newPosition: GridPosition = {
    x: targetPosition.x,
    y: targetPosition.y,
    width: widgetSize.width,
    height: widgetSize.height
  };

  // Get widgets that would be overlapped (excluding the widget being moved)
  const overlappedWidgets = existingWidgets.filter(widget => {
    if (excludeWidgetId && widget.user_widget_id === excludeWidgetId) {
      return false;
    }
    
    const existingPosition: GridPosition = {
      x: widget.position_x,
      y: widget.position_y,
      width: widget.width,
      height: widget.height
    };
    
    return doWidgetsOverlap(newPosition, existingPosition);
  });

  if (overlappedWidgets.length === 0) {
    // No overlaps, position is available
    return { position: newPosition, repositionedWidgets: [] };
  }

  // Find new positions for overlapped widgets
  const repositionedWidgets: UserWidget[] = [];
  const allWidgets = existingWidgets.filter(w => !excludeWidgetId || w.user_widget_id !== excludeWidgetId);
  
  for (const overlappedWidget of overlappedWidgets) {
    // Find next available position for this overlapped widget
    const newPos = findNextAvailablePosition(
      { width: overlappedWidget.width, height: overlappedWidget.height },
      [...allWidgets, ...repositionedWidgets].filter(w => w.user_widget_id !== overlappedWidget.user_widget_id),
      gridWidth
    );
    
    repositionedWidgets.push({
      ...overlappedWidget,
      position_x: newPos.x,
      position_y: newPos.y
    });
  }

  return { position: newPosition, repositionedWidgets };
}

/**
 * Compact the grid by moving widgets up to fill gaps
 */
export function compactGrid(widgets: UserWidget[]): UserWidget[] {
  const sortedWidgets = [...widgets].sort((a, b) => {
    if (a.position_y !== b.position_y) {
      return a.position_y - b.position_y;
    }
    return a.position_x - b.position_x;
  });

  const compactedWidgets: UserWidget[] = [];

  for (const widget of sortedWidgets) {
    let bestY = 0;
    
    // Find the highest position where this widget can be placed
    while (true) {
      const testPosition: GridPosition = {
        x: widget.position_x,
        y: bestY,
        width: widget.width,
        height: widget.height
      };
      
      if (!checkCollision(testPosition, compactedWidgets)) {
        break;
      }
      bestY++;
    }
    
    compactedWidgets.push({
      ...widget,
      position_y: bestY
    });
  }

  return compactedWidgets;
}

/**
 * Calculate pixel position from grid coordinates
 */
export function gridToPixels(gridPos: GridPosition, cellWidth: number = 320, cellHeight: number = 240) {
  return {
    left: gridPos.x * cellWidth,
    top: gridPos.y * cellHeight,
    width: gridPos.width * cellWidth - 16, // Account for gap
    height: gridPos.height * cellHeight - 16 // Account for gap
  };
}

/**
 * Calculate grid coordinates from pixel position
 */
export function pixelsToGrid(
  pixelPos: { left: number; top: number },
  cellWidth: number = 320,
  cellHeight: number = 240
): GridCell {
  return {
    x: Math.round(pixelPos.left / cellWidth),
    y: Math.round(pixelPos.top / cellHeight)
  };
}
