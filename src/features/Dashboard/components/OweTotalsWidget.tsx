import React from 'react';

interface OweSummary {
  userName: string;
  amount: number;
}

interface OweTotalsWidgetProps {
  oweSummaries: OweSummary[];
  onNavigate: (viewId: string) => void;
}

export const OweTotalsWidget: React.FC<OweTotalsWidgetProps> = ({ oweSummaries, onNavigate }) => {
  return (
    <div 
      className="total-expenses-card" 
      onClick={() => onNavigate('owe-details')}
    >
      <div className="card-header-row" style={{ marginBottom: '16px' }}>
        <span className="card-label">OWED TO YOU</span>
        <span className="card-subtitle">ALL TIME</span>
      </div>
      
      {oweSummaries.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--text-muted)', fontSize: '13px', fontWeight: 500 }}>
          No outstanding balances 🎉
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {oweSummaries.map((owe, idx) => {
            // Generate avatar color based on name
            const hues = [0, 35, 140, 200, 260, 310];
            const hueIdx = userNameHash(owe.userName) % hues.length;
            const avatarBg = `hsla(${hues[hueIdx]}, 70%, 50%, 0.15)`;
            const avatarColor = `hsl(${hues[hueIdx]}, 85%, 65%)`;

            return (
              <React.Fragment key={idx}>
                {idx > 0 && (
                  <div style={{ height: '1px', backgroundColor: 'var(--border-light)', margin: '4px 0' }} />
                )}
                <div 
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between', 
                    padding: '10px 4px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div 
                      style={{ 
                        width: '32px', 
                        height: '32px', 
                        borderRadius: '50%', 
                        backgroundColor: avatarBg, 
                        color: avatarColor, 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        fontWeight: 700, 
                        fontSize: '13px',
                        textTransform: 'uppercase'
                      }}
                    >
                      {owe.userName.charAt(0)}
                    </div>
                    <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>
                      {owe.userName}
                    </span>
                  </div>
                  <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--color-success)' }}>
                    PHP {owe.amount.toFixed(2)}
                  </span>
                </div>
              </React.Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
};

// Simple string hashing helper for deterministic avatar color assignment
function userNameHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}
