import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { UserWidget } from "./widget-types";
import { Widget } from "./Widget";

interface DraggableWidgetProps {
  userWidget: UserWidget;
  onEdit: (userWidget: UserWidget) => void;
  onDelete: (userWidget: UserWidget) => void;
}

export function DraggableWidget({ userWidget, onEdit, onDelete }: DraggableWidgetProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: userWidget.user_widget_id,
    data: {
      type: "widget",
      userWidget,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`
        grid-item cursor-move
        ${isDragging ? 'z-50' : ''}
      `}
      data-grid={{
        x: userWidget.position_x,
        y: userWidget.position_y,
        w: userWidget.width,
        h: userWidget.height,
        minW: userWidget.dashboard_widget.min_width,
        minH: userWidget.dashboard_widget.min_height,
      }}
    >
      <Widget
        userWidget={userWidget}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    </div>
  );
}

