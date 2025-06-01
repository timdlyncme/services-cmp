import React, { useState, useEffect } from 'react';
import { UserWidget } from '../../services/dashboard-service';

interface WidgetConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  userWidget: UserWidget;
  onSave: (updates: Partial<UserWidget>) => void;
}

const WIDGET_COLORS = [
  { name: 'Blue', value: 'bg-blue-50 border-blue-200', header: 'bg-blue-100' },
  { name: 'Green', value: 'bg-green-50 border-green-200', header: 'bg-green-100' },
  { name: 'Purple', value: 'bg-purple-50 border-purple-200', header: 'bg-purple-100' },
  { name: 'Red', value: 'bg-red-50 border-red-200', header: 'bg-red-100' },
  { name: 'Yellow', value: 'bg-yellow-50 border-yellow-200', header: 'bg-yellow-100' },
  { name: 'Gray', value: 'bg-gray-50 border-gray-200', header: 'bg-gray-100' },
  { name: 'Indigo', value: 'bg-indigo-50 border-indigo-200', header: 'bg-indigo-100' },
  { name: 'Pink', value: 'bg-pink-50 border-pink-200', header: 'bg-pink-100' },
];

const WIDGET_SIZES = [
  { name: 'Small', width: 1, height: 1 },
  { name: 'Medium', width: 2, height: 1 },
  { name: 'Large', width: 2, height: 2 },
  { name: 'Wide', width: 3, height: 1 },
  { name: 'Tall', width: 1, height: 2 },
  { name: 'Extra Large', width: 3, height: 2 },
];

export const WidgetConfigModal: React.FC<WidgetConfigModalProps> = ({
  isOpen,
  onClose,
  userWidget,
  onSave
}) => {
  const [customName, setCustomName] = useState(userWidget.custom_name || '');
  const [selectedColor, setSelectedColor] = useState(userWidget.color || WIDGET_COLORS[0].value);
  const [selectedSize, setSelectedSize] = useState({
    width: userWidget.width,
    height: userWidget.height
  });

  useEffect(() => {
    if (isOpen) {
      setCustomName(userWidget.custom_name || '');
      setSelectedColor(userWidget.color || WIDGET_COLORS[0].value);
      setSelectedSize({
        width: userWidget.width,
        height: userWidget.height
      });
    }
  }, [isOpen, userWidget]);

  const handleSave = () => {
    const updates: Partial<UserWidget> = {
      custom_name: customName.trim() || null,
      color: selectedColor,
      width: selectedSize.width,
      height: selectedSize.height
    };

    onSave(updates);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Configure Widget</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          {/* Widget Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Custom Name
            </label>
            <input
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder={userWidget.widget_template.name}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Leave empty to use default name: {userWidget.widget_template.name}
            </p>
          </div>

          {/* Widget Color */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Widget Color
            </label>
            <div className="grid grid-cols-4 gap-2">
              {WIDGET_COLORS.map((color) => (
                <button
                  key={color.name}
                  onClick={() => setSelectedColor(color.value)}
                  className={`p-3 rounded-md border-2 transition-all ${
                    selectedColor === color.value
                      ? 'border-blue-500 ring-2 ring-blue-200'
                      : 'border-gray-200 hover:border-gray-300'
                  } ${color.value}`}
                  title={color.name}
                >
                  <div className={`w-full h-4 rounded ${color.header}`}></div>
                </button>
              ))}
            </div>
          </div>

          {/* Widget Size */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Widget Size
            </label>
            <div className="grid grid-cols-2 gap-2">
              {WIDGET_SIZES.map((size) => (
                <button
                  key={size.name}
                  onClick={() => setSelectedSize({ width: size.width, height: size.height })}
                  className={`p-3 text-sm rounded-md border-2 transition-all ${
                    selectedSize.width === size.width && selectedSize.height === size.height
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="font-medium">{size.name}</div>
                  <div className="text-xs text-gray-500">
                    {size.width} × {size.height}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Preview
            </label>
            <div 
              className={`p-4 rounded-lg border-2 ${selectedColor}`}
              style={{
                width: `${selectedSize.width * 100}px`,
                height: `${selectedSize.height * 80}px`,
                minWidth: '100px',
                minHeight: '80px'
              }}
            >
              <div className="font-medium text-sm">
                {customName.trim() || userWidget.widget_template.name}
              </div>
              <div className="text-xs text-gray-600 mt-1">
                Size: {selectedSize.width} × {selectedSize.height}
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end space-x-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};
