import React from 'react';
import { Message, Source } from '../../types';
import { chatStyles } from '../../styles/chatStyles';

interface SourcesSectionProps {
  message: Message;
  isExpanded: boolean;
  onToggle: () => void;
}

const SourceItem: React.FC<{ source: Source }> = ({ source }) => (
  <div
    className={chatStyles.sourcesSection.sourceItem.base}
    style={chatStyles.sourcesSection.sourceItem.getStyle()}
  >
    <div className={chatStyles.sourcesSection.sourceHeader}>
      <span>{source.type === 'document' ? '📄' : '📁'}</span>
      <span className={chatStyles.sourcesSection.sourceTitle}>
        {source.title}
      </span>
    </div>
    {source.excerpt && (
      <p className={chatStyles.sourcesSection.sourceExcerpt}>
        "{source.excerpt}"
      </p>
    )}
  </div>
);

export const SourcesSection: React.FC<SourcesSectionProps> = ({ message, isExpanded, onToggle }) => {
  if (!message.sources || message.sources.length === 0) {
    return null;
  }

  return (
    <div className={chatStyles.sourcesSection.container}>
      <button
        onClick={onToggle}
        className={chatStyles.sourcesSection.toggleButton}
      >
        <span>📚</span>
        Sources ({message.sources.length})
        <span className="text-xs">
          {isExpanded ? '▼' : '▶'}
        </span>
      </button>

      {isExpanded && (
        <div className={chatStyles.sourcesSection.expandedContainer}>
          {message.sources.map((source) => (
            <SourceItem key={source.id} source={source} />
          ))}
        </div>
      )}
    </div>
  );
};
