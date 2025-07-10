import React from 'react';
import { TYPOGRAPHY_STYLES } from '../../styles/typographyStyles';
import { Message } from '../../types';
import { useSourceExpansion } from '../../hooks/chat';
import { MessageContainer } from './MessageContainer';

interface ChatMessagesProps {
  messages: Message[];
}

const EmptyState: React.FC = () => (
  <div className="flex-1 flex items-center justify-center">
    <div className="text-center">
      <div className="text-6xl mb-4">💬</div>
      <h3 className={TYPOGRAPHY_STYLES.headings.h3}>
        Start a conversation
      </h3>
      <p className={`${TYPOGRAPHY_STYLES.secondary.base} mt-2`}>
        Ask questions about your documents and I'll help you find the answers.
      </p>
    </div>
  </div>
);

export const ChatMessages: React.FC<ChatMessagesProps> = ({ messages }) => {
  const { expandedSources, toggleSourceExpansion } = useSourceExpansion();

  if (messages.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {messages.map((message) => (
        <MessageContainer
          key={message.id}
          message={message}
          expandedSources={expandedSources}
          onToggleSource={toggleSourceExpansion}
        />
      ))}
    </div>
  );
};
