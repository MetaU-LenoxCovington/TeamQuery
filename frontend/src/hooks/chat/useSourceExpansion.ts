import { useState, useCallback } from 'react';

export interface UseSourceExpansionReturn {
  expandedSources: Set<string>;
  toggleSourceExpansion: (messageId: string) => void;
  isSourceExpanded: (messageId: string) => boolean;
  expandSource: (messageId: string) => void;
  collapseSource: (messageId: string) => void;
  collapseAllSources: () => void;
}

export const useSourceExpansion = (): UseSourceExpansionReturn => {
  const [expandedSources, setExpandedSources] = useState<Set<string>>(new Set());

  const toggleSourceExpansion = useCallback((messageId: string) => {
    setExpandedSources(prev => {
      const newExpanded = new Set(prev);
      if (newExpanded.has(messageId)) {
        newExpanded.delete(messageId);
      } else {
        newExpanded.add(messageId);
      }
      return newExpanded;
    });
  }, []);

  const isSourceExpanded = useCallback((messageId: string) => {
    return expandedSources.has(messageId);
  }, [expandedSources]);

  const expandSource = useCallback((messageId: string) => {
    setExpandedSources(prev => new Set(prev).add(messageId));
  }, []);

  const collapseSource = useCallback((messageId: string) => {
    setExpandedSources(prev => {
      const newExpanded = new Set(prev);
      newExpanded.delete(messageId);
      return newExpanded;
    });
  }, []);

  const collapseAllSources = useCallback(() => {
    setExpandedSources(new Set());
  }, []);

  return {
    expandedSources,
    toggleSourceExpansion,
    isSourceExpanded,
    expandSource,
    collapseSource,
    collapseAllSources,
  };
};
