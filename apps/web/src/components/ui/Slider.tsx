import React from "react";

interface SliderProps {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
  className?: string;
}

export const Slider: React.FC<SliderProps> = ({
  value,
  min = 0,
  max = 100,
  step = 1,
  onChange,
  className = "",
}) => {
  const percentage = ((value - min) / (max - min)) * 100;

  return (
    <div className={`relative w-full flex items-center select-none ${className}`}>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-3 bg-olive-100 rounded-full appearance-none cursor-pointer focus:outline-none accent-deepGreen"
        style={{
          background: `linear-gradient(to right, #678638 0%, #8DA568 ${percentage}%, #E8EFE0 ${percentage}%, #E8EFE0 100%)`,
        }}
      />
    </div>
  );
};
