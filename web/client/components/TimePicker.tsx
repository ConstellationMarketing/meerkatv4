import { useState } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";

interface TimePickerProps {
  hours: number;
  minutes: number;
  onHoursChange: (hours: number) => void;
  onMinutesChange: (minutes: number) => void;
}

export function TimePicker({
  hours,
  minutes,
  onHoursChange,
  onMinutesChange,
}: TimePickerProps) {
  const hoursList = Array.from({ length: 24 }, (_, i) => i);
  const minutesList = Array.from({ length: 60 }, (_, i) => i);

  const incrementHours = () => {
    onHoursChange(hours === 23 ? 0 : hours + 1);
  };

  const decrementHours = () => {
    onHoursChange(hours === 0 ? 23 : hours - 1);
  };

  const incrementMinutes = () => {
    onMinutesChange(minutes === 59 ? 0 : minutes + 1);
  };

  const decrementMinutes = () => {
    onMinutesChange(minutes === 0 ? 59 : minutes - 1);
  };

  return (
    <div className="flex items-center justify-center gap-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
      {/* Hours Section */}
      <div className="flex flex-col items-center gap-2">
        <label className="text-xs font-semibold text-foreground">Hours</label>
        <button
          onClick={incrementHours}
          className="p-2 rounded hover:bg-gray-200 transition-colors"
          title="Increase hours"
        >
          <ChevronUp className="w-5 h-5 text-slate-600" />
        </button>

        {/* Hours Display */}
        <div className="flex items-center justify-center">
          <input
            type="number"
            min="0"
            max="23"
            value={String(hours).padStart(2, "0")}
            onChange={(e) => {
              const val = parseInt(e.target.value) || 0;
              onHoursChange(Math.min(Math.max(val, 0), 23));
            }}
            className="w-16 px-2 py-2 text-center text-2xl font-bold border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-slate-500"
          />
        </div>

        <button
          onClick={decrementHours}
          className="p-2 rounded hover:bg-gray-200 transition-colors"
          title="Decrease hours"
        >
          <ChevronDown className="w-5 h-5 text-slate-600" />
        </button>
      </div>

      {/* Colon Separator */}
      <div className="text-3xl font-bold text-foreground">:</div>

      {/* Minutes Section */}
      <div className="flex flex-col items-center gap-2">
        <label className="text-xs font-semibold text-foreground">Minutes</label>
        <button
          onClick={incrementMinutes}
          className="p-2 rounded hover:bg-gray-200 transition-colors"
          title="Increase minutes"
        >
          <ChevronUp className="w-5 h-5 text-slate-600" />
        </button>

        {/* Minutes Display */}
        <div className="flex items-center justify-center">
          <input
            type="number"
            min="0"
            max="59"
            value={String(minutes).padStart(2, "0")}
            onChange={(e) => {
              const val = parseInt(e.target.value) || 0;
              onMinutesChange(Math.min(Math.max(val, 0), 59));
            }}
            className="w-16 px-2 py-2 text-center text-2xl font-bold border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-slate-500"
          />
        </div>

        <button
          onClick={decrementMinutes}
          className="p-2 rounded hover:bg-gray-200 transition-colors"
          title="Decrease minutes"
        >
          <ChevronDown className="w-5 h-5 text-slate-600" />
        </button>
      </div>
    </div>
  );
}
