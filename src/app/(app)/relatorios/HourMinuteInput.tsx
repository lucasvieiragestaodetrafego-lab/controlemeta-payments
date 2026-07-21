"use client";

/** Par de campos hora/minuto (formato HH:MM), como o resto da UI de horário do app. */
export default function HourMinuteInput({
  defaultHour = 9,
  defaultMinute = 0,
}: {
  defaultHour?: number;
  defaultMinute?: number;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm text-slate-300">Horário (UTC)</label>
      <div className="flex items-center gap-1">
        <input
          type="number"
          name="send_hour"
          min={0}
          max={23}
          defaultValue={defaultHour}
          className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-center text-sm"
        />
        <span className="text-slate-400">:</span>
        <input
          type="number"
          name="send_minute"
          min={0}
          max={59}
          defaultValue={defaultMinute}
          className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-center text-sm"
        />
      </div>
    </div>
  );
}
