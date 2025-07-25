import React, { useState } from 'react';
import { TYPOGRAPHY_STYLES } from '../../styles/typographyStyles';
import { Message } from '../../types';
import { chatStyles, combineStyles, getConditionalStyle } from '../../styles/chatStyles';

interface MessageBubbleProps {
  message: Message;
  isUser: boolean;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message, isUser }) => {
  const [selectedSource, setSelectedSource] = useState<any>(null);

  const handleSourceClick = (source: any) => {
    setSelectedSource(source);
  };

  const closeModal = () => {
    setSelectedSource(null);
  };

  return (
    <>
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

        {/* Show sources if available */}
        {message.sources && message.sources.length > 0 && (
          <div className="mt-2 pt-2 border-t border-gray-200">
            <p className="text-xs text-gray-600 mb-1">Sources:</p>
            <div className="space-y-1">
              {message.sources.map((source, index) => (
                <button
                  key={index}
                  onClick={() => handleSourceClick(source)}
                  className="block text-xs text-blue-600 hover:text-blue-800 text-left"
                >
                  📄 {source.title}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/*Source Content */}
      {selectedSource && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl max-h-96 overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">{selectedSource.title}</h3>
              <button
                onClick={closeModal}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <div className="text-sm text-gray-700">
              {selectedSource.excerpt || 'No content available'}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
