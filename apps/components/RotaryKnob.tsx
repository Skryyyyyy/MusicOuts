import React, { useState, useRef, useEffect, useCallback } from 'react';

interface RotaryKnobProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  defaultValue?: number;
  onChange: (value: number) => void;
  onAddKeyframe?: () => void;
  accentColor?: string;
}

export const RotaryKnob: React.FC<RotaryKnobProps> = ({
  label,
  value,
  min,
  max,
  step = 0.1,
  unit = '',
  defaultValue,
  onChange,
  onAddKeyframe,
  accentColor = '#22C55E', // Apple / Logic Green
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const dragStartY = useRef(0);
  const dragStartValue = useRef(value);

  // Map value to angle (-135deg to +135deg, 270deg sweep)
  const normalized = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const angle = -135 + normalized * 270;

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragStartY.current = e.clientY;
    dragStartValue.current = value;
  };

  const handleDoubleClick = () => {
    if (defaultValue !== undefined) {
      onChange(defaultValue);
    } else {
      onChange((min + max) / 2);
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    if (onAddKeyframe) {
      onAddKeyframe();
    }
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return;
      const deltaY = dragStartY.current - e.clientY;
      const range = max - min;
      const sensitivity = e.shiftKey ? 0.001 : 0.005; // Fine adjust with Shift
      const deltaValue = deltaY * range * sensitivity;
      let newValue = dragStartValue.current + deltaValue;
      newValue = Math.max(min, Math.min(max, newValue));

      if (step) {
        newValue = Math.round(newValue / step) * step;
      }

      onChange(parseFloat(newValue.toFixed(2)));
    },
    [isDragging, min, max, step, onChange]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return (
    <div
      className="flex flex-col items-center justify-center select-none group cursor-pointer"
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
      title={`${label}: ${value}${unit} (Drag up/down, Shift for fine, Double-click to reset, Right-click for keyframe)`}
    >
      {/* Knob Dial Body */}
      <div className="relative w-12 h-12 rounded-full bg-gradient-to-b from-[#2A2D36] to-[#17191F] border border-white/10 shadow-inner flex items-center justify-center p-1">
        {/* Arc Background Ring */}
        <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none" viewBox="0 0 48 48">
          <circle
            cx="24"
            cy="24"
            r="18"
            fill="none"
            stroke="rgba(255, 255, 255, 0.08)"
            strokeWidth="3"
            strokeDasharray="85 100"
            strokeDashoffset="-25"
          />
          <circle
            cx="24"
            cy="24"
            r="18"
            fill="none"
            stroke={accentColor}
            strokeWidth="3"
            strokeDasharray={`${normalized * 85} 100`}
            strokeDashoffset="-25"
            strokeLinecap="round"
            className="transition-all duration-75"
          />
        </svg>

        {/* Center Knob Cap */}
        <div className="w-8 h-8 rounded-full bg-[#1C1E24] shadow-md border border-white/10 flex items-center justify-center relative">
          {/* Pointer Marker */}
          <div
            className="absolute w-0.5 h-3 top-1 rounded-full shadow-sm"
            style={{
              backgroundColor: accentColor,
              transformOrigin: '50% 12px',
              transform: `rotate(${angle}deg)`,
            }}
          />
        </div>
      </div>

      {/* Label and Value */}
      <span className="text-[10px] font-semibold text-slate-300 mt-1.5 uppercase tracking-wider group-hover:text-white transition-colors">
        {label}
      </span>
      <span className="text-[10px] font-mono text-slate-400">
        {value > 0 && unit === 'dB' ? `+${value}` : value}
        {unit}
      </span>
    </div>
  );
};
