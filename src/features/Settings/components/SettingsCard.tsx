import React from 'react';

interface SettingsCardProps {
  title: string;
  description?: string | React.ReactNode;
  headerAction?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  titleStyle?: React.CSSProperties;
  descStyle?: React.CSSProperties;
  flexRowBetween?: boolean;
}

export const SettingsCard: React.FC<SettingsCardProps> = ({
  title,
  description,
  headerAction,
  children,
  className = '',
  titleStyle,
  descStyle,
  flexRowBetween = false
}) => {
  if (flexRowBetween) {
    return (
      <div className={`settings-card flex-row-between ${className}`}>
        <div>
          <h2 className="settings-card-title" style={{ marginBottom: '4px', ...titleStyle }}>{title}</h2>
          {description && <p className="settings-card-desc" style={descStyle}>{description}</p>}
        </div>
        {headerAction || children}
      </div>
    );
  }

  return (
    <div className={`settings-card ${className}`}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: description ? '4px' : '16px' }}>
        <h2 className="settings-card-title" style={{ margin: 0, ...titleStyle }}>{title}</h2>
        {headerAction}
      </div>
      {description && <p className="settings-card-desc" style={{ marginBottom: '16px', ...descStyle }}>{description}</p>}
      {children}
    </div>
  );
};
