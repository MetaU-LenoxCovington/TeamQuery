import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
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
        <div className={TYPOGRAPHY_STYLES.body.base}>
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              h1: ({children}) => <h1 className="text-xl font-bold mb-2">{children}</h1>,
              h2: ({children}) => <h2 className="text-lg font-semibold mb-2">{children}</h2>,
              h3: ({children}) => <h3 className="text-base font-medium mb-1">{children}</h3>,
              p: ({children}) => <p className="mb-2 last:mb-0">{children}</p>,
              ul: ({children}) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
              ol: ({children}) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
              li: ({children}) => <li className="ml-2">{children}</li>,
              code: ({node, inline, className, children, ...props}: any) =>
                inline ? (
                  <code className="bg-gray-100 px-1 py-0.5 rounded text-sm font-mono" {...props}>{children}</code>
                ) : (
                  <code className="block bg-gray-100 p-2 rounded text-sm font-mono whitespace-pre-wrap mb-2" {...props}>{children}</code>
                ),
              pre: ({children}) => <pre className="bg-gray-100 p-2 rounded text-sm font-mono whitespace-pre-wrap mb-2 overflow-x-auto">{children}</pre>,
              blockquote: ({children}) => <blockquote className="border-l-4 border-gray-300 pl-4 italic mb-2">{children}</blockquote>,
              strong: ({children}) => <strong className="font-semibold">{children}</strong>,
              em: ({children}) => <em className="italic">{children}</em>,
              a: ({href, children}) => <a href={href} className="text-blue-600 hover:text-blue-800 underline" target="_blank" rel="noopener noreferrer">{children}</a>,
              table: ({children}) => <table className="border-collapse border border-gray-300 mb-2">{children}</table>,
              th: ({children}) => <th className="border border-gray-300 px-2 py-1 bg-gray-100 font-semibold">{children}</th>,
              td: ({children}) => <td className="border border-gray-300 px-2 py-1">{children}</td>,
            }}
          >
            {message.content}
          </ReactMarkdown>
        </div>

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
