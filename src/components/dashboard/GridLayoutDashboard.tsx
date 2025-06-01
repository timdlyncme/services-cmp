import React, { useState, useEffect, useMemo } from 'react';
import { Responsive, WidthProvider, Layout } from 'react-grid-layout';
import { UserWidget } from '@/types/dashboard';
import BaseWidget from './BaseWidget';
import { dashboardService } from '@/services/dashboardService';
import { toast } from 'sonner';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

const ResponsiveGridLayout = WidthProvider(Responsive);

interface GridLayoutDashboardProps {
  widgets: UserWidget[];
  isEditing: boolean;
  onConfigureWidget: (widget: UserWidget) => void;
  onDeleteWidget: (widgetId: string) => void;
  onUpdateWidgets: (widgets: UserWidget[]) => void;
}

// Grid configuration
const GRID_CONFIG = {
  cols: { lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 },
  breakpoints: { lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 },
  rowHeight: 100,
  margin: [16, 16],
  containerPadding: [16, 16],
};

export default function GridLayoutDashboard({
  widgets,
  isEditing,
  onConfigureWidget,
  onDeleteWidget,
  onUpdateWidgets,
}: GridLayoutDashboardProps) {
  const [layouts, setLayouts] = useState<{ [key: string]: Layout[] }>({});
  const [mounted, setMounted] = useState(false);

  // Convert widgets to grid layout format
  const gridItems = useMemo(() => {
    return widgets
      .filter(widget => widget.is_visible)
      .map(widget => ({
        widget,
        layout: {
          i: widget.user_widget_id,
          x: widget.position_x,
          y: widget.position_y,
          w: widget.width,
          h: widget.height,
          minW: 1,
          minH: 1,
          maxW: 12,
          maxH: 6,
        }
      }));
  }, [widgets]);

  // Initialize layouts for all breakpoints
  useEffect(() => {
    const initialLayouts: { [key: string]: Layout[] } = {};
    
    Object.keys(GRID_CONFIG.cols).forEach(breakpoint => {
      initialLayouts[breakpoint] = gridItems.map(item => ({ ...item.layout }));
    });
    
    setLayouts(initialLayouts);
    setMounted(true);
  }, [gridItems]);

  // Handle layout changes (drag, resize, etc.)
  const handleLayoutChange = async (currentLayout: Layout[], allLayouts: { [key: string]: Layout[] }) => {
    if (!mounted) return;

    setLayouts(allLayouts);

    // Update widget positions in database
    try {
      const updatedWidgets = widgets.map(widget => {
        const layoutItem = currentLayout.find(item => item.i === widget.user_widget_id);
        if (layoutItem) {
          return {
            ...widget,
            position_x: layoutItem.x,
            position_y: layoutItem.y,
            width: layoutItem.w,
            height: layoutItem.h,
          };
        }
        return widget;
      });

      // Update widgets in parent component
      onUpdateWidgets(updatedWidgets);

      // Persist to database
      for (const widget of updatedWidgets) {
        const layoutItem = currentLayout.find(item => item.i === widget.user_widget_id);
        if (layoutItem) {
          await dashboardService.updateUserWidget(widget.user_widget_id, {
            position_x: layoutItem.x,
            position_y: layoutItem.y,
            width: layoutItem.w,
            height: layoutItem.h,
          });
        }
      }

      if (isEditing) {
        toast.success('Layout saved!');
      }
    } catch (error) {
      console.error('Error saving layout:', error);
      toast.error('Failed to save layout');
    }
  };

  if (!mounted) {
    return <div>Loading...</div>;
  }

  return (
    <div className="w-full">
      <ResponsiveGridLayout
        className="layout"
        layouts={layouts}
        onLayoutChange={handleLayoutChange}
        breakpoints={GRID_CONFIG.breakpoints}
        cols={GRID_CONFIG.cols}
        rowHeight={GRID_CONFIG.rowHeight}
        margin={GRID_CONFIG.margin}
        containerPadding={GRID_CONFIG.containerPadding}
        isDraggable={isEditing}
        isResizable={isEditing}
        compactType="vertical"
        preventCollision={false}
        useCSSTransforms={true}
        transformScale={1}
        droppingItem={{ i: 'drop', w: 2, h: 2 }}
      >
        {gridItems.map(({ widget }) => (
          <div
            key={widget.user_widget_id}
            className={`
              bg-white rounded-lg shadow-sm border
              ${isEditing ? 'border-dashed border-primary/30' : 'border-gray-200'}
              transition-all duration-200
              hover:shadow-md
            `}
          >
            <BaseWidget
              userWidget={widget}
              onUpdate={() => {}}
              onRemove={() => onDeleteWidget(widget.user_widget_id)}
              onConfigureWidget={() => onConfigureWidget(widget)}
              isEditing={isEditing}
              className="h-full w-full"
            />
          </div>
        ))}
      </ResponsiveGridLayout>

      {/* Custom styles for better appearance */}
      <style jsx global>{`
        .react-grid-layout {
          position: relative;
        }
        
        .react-grid-item {
          transition: all 200ms ease;
          transition-property: left, top, width, height;
        }
        
        .react-grid-item.cssTransforms {
          transition-property: transform, width, height;
        }
        
        .react-grid-item > .react-resizable-handle {
          position: absolute;
          width: 20px;
          height: 20px;
          bottom: 0;
          right: 0;
          background: url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNiIgaGVpZ2h0PSI2IiB2aWV3Qm94PSIwIDAgNiA2IiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPgo8ZG90cyBmaWxsPSIjOTk5IiBkPSJtMTUgMTJjMCAuNTUyLS40NDggMS0xIDFzLTEtLjQ0OC0xLTEgLjQ0OC0xIDEtMSAxIC40NDggMSAxem0wIDRjMCAuNTUyLS40NDggMS0xIDFzLTEtLjQ0OC0xLTEgLjQ0OC0xIDEtMSAxIC40NDggMSAxem0wIDRjMCAuNTUyLS40NDggMS0xIDFzLTEtLjQ0OC0xLTEgLjQ0OC0xIDEtMSAxIC40NDggMSAxem0tNS00YzAtLjU1Mi40NDgtMSAxLTFzMSAuNDQ4IDEgMS0uNDQ4IDEtMSAxLTEtLjQ0OC0xLTF6bTAgNGMwLS41NTIuNDQ4LTEgMS0xczEgLjQ0OCAxIDEtLjQ0OCAxLTEgMS0xLS40NDgtMS0xem0wIDRjMC0uNTUyLjQ0OC0xIDEtMXMxIC40NDggMSAxLS40NDggMS0xIDEtMS0uNDQ4LTEtMXptNS04YzAtLjU1Mi40NDgtMSAxLTFzMSAuNDQ4IDEgMS0uNDQ4IDEtMSAxLTEtLjQ0OC0xLTF6bTAgNGMwLS41NTIuNDQ4LTEgMS0xczEgLjQ0OCAxIDEtLjQ0OCAxLTEgMS0xLS40NDgtMS0xeiIvPgo8L3N2Zz4K') no-repeat;
          background-size: contain;
          cursor: se-resize;
          z-index: 10;
        }
        
        .react-grid-item.react-grid-placeholder {
          background: rgb(59 130 246 / 0.15);
          border: 2px dashed rgb(59 130 246 / 0.4);
          border-radius: 8px;
          opacity: 0.8;
          transition-duration: 100ms;
          z-index: 2;
          user-select: none;
        }
        
        .react-grid-item.react-draggable-dragging {
          transition: none;
          z-index: 3;
          opacity: 0.8;
          transform: rotate(2deg) !important;
        }
        
        .react-grid-item.react-resizable-resizing {
          opacity: 0.8;
          z-index: 3;
        }
      `}</style>
    </div>
  );
}

