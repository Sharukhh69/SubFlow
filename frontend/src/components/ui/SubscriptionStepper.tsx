import React from 'react';
import { SubscriptionStatus } from '../../types';
import { Check, Clock, AlertCircle } from 'lucide-react';

interface SubscriptionStepperProps {
  currentStatus: SubscriptionStatus;
}

const STEPS = [
  { status: SubscriptionStatus.DRAFT, label: 'Draft' },
  { status: SubscriptionStatus.QUOTATION, label: 'Quotation' },
  { status: SubscriptionStatus.CONFIRMED, label: 'Confirmed' },
  { status: SubscriptionStatus.ACTIVE, label: 'Active' },
  { status: SubscriptionStatus.CLOSED, label: 'Closed' },
];

export const SubscriptionStepper: React.FC<SubscriptionStepperProps> = ({ currentStatus }) => {
  const isPaused = currentStatus === SubscriptionStatus.PAUSED;
  const isClosed = currentStatus === SubscriptionStatus.CLOSED;

  const getStepIndex = (status: SubscriptionStatus) => {
    switch (status) {
      case SubscriptionStatus.DRAFT: return 0;
      case SubscriptionStatus.QUOTATION: return 1;
      case SubscriptionStatus.CONFIRMED: return 2;
      case SubscriptionStatus.ACTIVE: return 3;
      case SubscriptionStatus.PAUSED: return 3;
      case SubscriptionStatus.CLOSED: return 4;
      default: return 0;
    }
  };

  const currentIndex = getStepIndex(currentStatus);

  return (
    <div style={{ padding: '16px 0', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: 20,
            right: 20,
            height: 2,
            background: 'var(--border-default)',
            transform: 'translateY(-50%)',
            zIndex: 1,
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: 20,
            width: `${(Math.min(currentIndex, 4) / 4) * 100}%`,
            height: 2,
            background: isPaused ? 'var(--warning)' : isClosed ? 'var(--danger)' : 'var(--primary)',
            transform: 'translateY(-50%)',
            zIndex: 2,
            transition: 'width 0.3s ease',
          }}
        />

        {STEPS.map((step, idx) => {
          const isCompleted = idx < currentIndex;
          const isCurrent = idx === currentIndex;

          let bg = 'var(--bg-elevated)';
          let borderColor = 'var(--border-default)';
          let color = 'var(--text-muted)';

          if (isCompleted) {
            bg = 'var(--primary)';
            borderColor = 'var(--primary)';
            color = '#fff';
          } else if (isCurrent) {
            bg = isPaused ? 'var(--warning)' : isClosed ? 'var(--danger)' : 'var(--primary)';
            borderColor = bg;
            color = '#fff';
          }

          return (
            <div
              key={step.status}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                zIndex: 3,
                position: 'relative',
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: bg,
                  border: `2px solid ${borderColor}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color,
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  transition: 'all 0.2s ease',
                }}
              >
                {isCompleted ? (
                  <Check size={16} />
                ) : isCurrent ? (
                  isPaused ? (
                    <Clock size={16} />
                  ) : isClosed ? (
                    <AlertCircle size={16} />
                  ) : (
                    idx + 1
                  )
                ) : (
                  idx + 1
                )}
              </div>
              <span
                style={{
                  marginTop: 6,
                  fontSize: '0.75rem',
                  fontWeight: isCurrent ? 600 : 400,
                  color: isCurrent ? 'var(--text-primary)' : 'var(--text-secondary)',
                }}
              >
                {isCurrent && isPaused ? 'Paused' : step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

