import React from 'react';
import { chatStyles } from '../../styles/chatStyles';

interface ContextDisplayProps {
  selectedContext: string[];
  onRemoveContext: (contextId: string) => void;
}

const ContextBadge: React.FC<{
  contextId: string;
  onRemove: () => void;
}> = ({ contextId, onRemove }) => (
  <span
    className={chatStyles.contextDisplay.badge.base}
    style={chatStyles.contextDisplay.badge.getStyle()}
  >
    📄 {contextId}
    <button
      onClick={onRemove}
      className={chatStyles.contextDisplay.removeButton}
      title="Remove context"
    >
      ×
    </button>
  </span>
);

export const ContextDisplay: React.FC<ContextDisplayProps> = ({
  selectedContext,
  onRemoveContext
}) => {
  if (selectedContext.length === 0) return null;

  return (
    <div className={chatStyles.contextDisplay.container}>
      <span className={chatStyles.contextDisplay.label}>
        Context:
      </span>
      {selectedContext.map((contextId) => (
        <ContextBadge
          key={contextId}
          contextId={contextId}
          onRemove={() => onRemoveContext(contextId)}
        />
      ))}
    </div>
  );
};
