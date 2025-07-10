import React from 'react';
import { TYPOGRAPHY_STYLES } from '../../styles/typographyStyles';
import { Message } from '../../types';
import { MessageBubble } from './MessageBubble';
import { SourcesSection } from './SourcesSection';
import { chatStyles } from '../../styles/chatStyles';

interface MessageContainerProps {
  message: Message;
  expandedSources: Set<string>;
  onToggleSource: (messageId: string) => void;
}

const formatTime = (timestamp: Date): string => {
  return timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const MessageTimestamp: React.FC<{
  timestamp: Date;
  isUser: boolean;
}> = ({ timestamp, isUser }) => (
  <div className={chatStyles.messageContainer.timestamp(isUser)}>
    <span className={TYPOGRAPHY_STYLES.secondary.small}>
      {formatTime(timestamp)}
    </span>
  </div>
);

export const MessageContainer: React.FC<MessageContainerProps> = ({
  message,
  expandedSources,
  onToggleSource
}) => {
  const isUser = message.type === 'user';

  return (
    <div className={chatStyles.messageContainer.wrapper(isUser)}>
      <div className={chatStyles.messageContainer.content(isUser)}>
        <MessageBubble message={message} isUser={isUser} />
        <MessageTimestamp timestamp={message.timestamp} isUser={isUser} />

        {!isUser && (
          <SourcesSection
            message={message}
            isExpanded={expandedSources.has(message.id)}
            onToggle={() => onToggleSource(message.id)}
          />
        )}
      </div>
    </div>
  );
};
