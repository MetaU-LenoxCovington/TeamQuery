import React from 'react';
import { TYPOGRAPHY_STYLES } from '../../styles/typographyStyles';
import { Message } from '../../types';
import { chatStyles, combineStyles, getConditionalStyle } from '../../styles/chatStyles';

interface MessageBubbleProps {
  message: Message;
  isUser: boolean;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message, isUser }) => (
  <div
    className={combineStyles(
      chatStyles.messageBubble.base,
      getConditionalStyle(isUser, chatStyles.messageBubble.userVariant, chatStyles.messageBubble.assistantVariant)
    )}
    style={chatStyles.messageBubble.getThemeStyle(isUser)}
  >
    <p className={TYPOGRAPHY_STYLES.body.base}>
      {message.content}
    </p>
  </div>
);
