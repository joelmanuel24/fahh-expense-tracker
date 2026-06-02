import React from 'react';

interface SwitchToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  id?: string;
  disabled?: boolean;
  scale?: number;
  className?: string;
}

export const SwitchToggle: React.FC<SwitchToggleProps> = ({
  checked,
  onChange,
  id,
  disabled = false,
  scale,
  className = ''
}) => {
  const style: React.CSSProperties = {
    flexShrink: 0,
    margin: 0
  };

  if (scale !== undefined) {
    style.transform = `scale(${scale})`;
  }

  return (
    <label className={`switch-toggle ${className}`} style={style}>
      <input
        type="checkbox"
        id={id}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="switch-slider"></span>
    </label>
  );
};
