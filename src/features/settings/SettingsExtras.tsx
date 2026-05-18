type Props = {
  myName: string;
  onNameChange: (next: string) => void;
  stayTogether: boolean;
  onStayTogetherChange: (next: boolean) => void;
  vibration: number;
  onVibrationChange: (next: number) => void;
};

export function SettingsExtras({
  myName,
  onNameChange,
  stayTogether,
  onStayTogetherChange,
  vibration,
  onVibrationChange,
}: Props) {
  return (
    <>
      <label>
        <span>Your display name</span>
        <input value={myName} onChange={(e) => onNameChange(e.target.value)} maxLength={32} />
      </label>

      <label className="settings-check">
        <input
          type="checkbox"
          checked={stayTogether}
          onChange={(e) => onStayTogetherChange(e.target.checked)}
        />
        <span>Vibrate when I fall behind the group</span>
      </label>

      <label>
        <span>Vibration strength ({Math.round(vibration * 100)}%)</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={vibration}
          onChange={(e) => onVibrationChange(Number(e.target.value))}
        />
      </label>
    </>
  );
}
