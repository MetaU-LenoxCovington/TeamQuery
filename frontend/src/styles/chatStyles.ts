import { COLORS } from './colors';
import { TYPOGRAPHY_STYLES } from './typographyStyles';
import { INPUT_BASE_CLASSES, INPUT_STATES } from './inputStyles';

export const getMessageTheme = (isUser: boolean) => ({
  backgroundColor: isUser ? COLORS.mint : COLORS.palePurple,
  border: `1px solid ${isUser ? COLORS.forestGreen : COLORS.lavender}`,
});

export const getInteractiveButtonStyle = (variant: 'context' | 'send', state: 'default' | 'disabled' = 'default') => {
  const baseStyle = {
    transition: 'all 0.2s ease',
    cursor: state === 'disabled' ? 'not-allowed' : 'pointer',
    opacity: state === 'disabled' ? 0.5 : 1,
  };

  switch (variant) {
    case 'context':
      return {
        ...baseStyle,
        backgroundColor: COLORS.palePurple,
        borderColor: COLORS.lavender,
        color: COLORS.charcoal,
      };
    case 'send':
      return {
        ...baseStyle,
        backgroundColor: state === 'disabled' ? COLORS.lavender : COLORS.forestGreen,
        color: 'white',
      };
    default:
      return baseStyle;
  }
};

export const getBadgeStyle = (variant: 'context' | 'source') => {
  switch (variant) {
    case 'context':
      return {
        backgroundColor: COLORS.mint,
        color: COLORS.forestGreen,
        border: `1px solid ${COLORS.forestGreen}`,
      };
    case 'source':
      return {
        backgroundColor: COLORS.palePurple,
        borderColor: COLORS.lavender,
      };
    default:
      return {};
  }
};

export const chatStyles = {
  messageBubble: {
    base: 'rounded-2xl px-4 py-3',
    userVariant: 'rounded-br-md',
    assistantVariant: 'rounded-bl-md',
    getThemeStyle: getMessageTheme,
  },

  messageContainer: {
    wrapper: (isUser: boolean) => `flex ${isUser ? 'justify-end' : 'justify-start'}`,
    content: (isUser: boolean) => `max-w-[80%] ${isUser ? 'ml-12' : 'mr-12'}`,
    timestamp: (isUser: boolean) => `mt-1 text-xs ${isUser ? 'text-right' : 'text-left'}`,
  },

  sourcesSection: {
    container: 'mt-3',
    toggleButton: `flex items-center gap-2 text-sm font-medium transition-colors hover:opacity-75 ${TYPOGRAPHY_STYLES.interactive.link}`,
    expandedContainer: 'mt-2 space-y-2',
    sourceItem: {
      base: 'p-3 rounded-lg border cursor-pointer transition-all hover:shadow-sm',
      getStyle: () => getBadgeStyle('source'),
    },
    sourceHeader: 'flex items-center gap-2 mb-1',
    sourceTitle: `${TYPOGRAPHY_STYLES.body.base} font-medium`,
    sourceExcerpt: `${TYPOGRAPHY_STYLES.secondary.small} leading-relaxed`,
  },

  contextDisplay: {
    container: 'mb-3 flex flex-wrap gap-2',
    label: `${TYPOGRAPHY_STYLES.body.base} font-medium`,
    badge: {
      base: 'inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium',
      getStyle: () => getBadgeStyle('context'),
    },
    removeButton: 'ml-1 hover:opacity-75',
  },

  messageInput: {
    container: 'flex gap-3 items-end',
    textareaWrapper: 'flex-1 relative',
    textarea: {
      base: `w-full resize-none ${INPUT_BASE_CLASSES} ${INPUT_STATES.default}`,
      style: {
        minHeight: '44px',
        maxHeight: '120px',
        paddingRight: '60px',
      },
    },
    contextButton: {
      base: 'flex-shrink-0 p-3 rounded-lg border transition-all hover:shadow-sm',
      getStyle: () => getInteractiveButtonStyle('context'),
    },
    sendButton: {
      base: 'absolute right-2 bottom-2 p-2 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed',
      getStyle: (canSend: boolean, isLoading: boolean) =>
        getInteractiveButtonStyle('send', (!canSend || isLoading) ? 'disabled' : 'default'),
    },
    hints: `mt-2 ${TYPOGRAPHY_STYLES.secondary.small}`,
  },

  chatInput: {
    container: {
      base: 'border-t p-4',
      style: {
        borderColor: COLORS.lavender,
      },
    },
  },

  loadingSpinner: {
    base: 'w-4 h-4 animate-spin rounded-full border-2 border-white border-t-transparent',
  },

  layout: {
    flexCenter: 'flex items-center justify-center',
    flexBetween: 'flex items-center justify-between',
    flexStart: 'flex items-center justify-start',
    flexEnd: 'flex items-center justify-end',
    spacingSmall: 'gap-2',
    spacingMedium: 'gap-3',
    spacingLarge: 'gap-4',
  },

  interactive: {
    hover: 'hover:opacity-75 transition-opacity',
    clickable: 'cursor-pointer transition-all',
    disabled: 'opacity-50 cursor-not-allowed',
    loading: 'opacity-75 pointer-events-none',
  },
  animations: {
    fadeIn: 'animate-fade-in',
    slideIn: 'animate-slide-in',
    spin: 'animate-spin',
    pulse: 'animate-pulse',
  },

  chatHeader: {
    container: {
      base: 'border-b px-6 py-4 flex items-center justify-between',
      style: {
        backgroundColor: 'white',
        borderColor: COLORS.lavender,
      },
    },
    leftSection: 'flex items-center gap-4',
    menuButton: {
      base: 'p-3 rounded-lg transition-all hover:shadow-sm',
      getStyle: () => getInteractiveButtonStyle('context'),
    },
    organizationDisplay: {
      container: 'text-center',
      title: TYPOGRAPHY_STYLES.headings.h1,
      orgInfo: 'flex items-center justify-center gap-2 mt-1',
      orgName: TYPOGRAPHY_STYLES.secondary.base,
      roleBadge: 'px-2 py-1 rounded-full text-xs font-medium',
    },
    profileDropdown: {
      container: 'relative',
      trigger: {
        base: 'flex items-center gap-2 p-3 rounded-lg transition-all hover:shadow-sm',
        getStyle: () => getBadgeStyle('context'),
      },
      avatar: 'w-8 h-8 rounded-full bg-white flex items-center justify-center',
      userName: `${TYPOGRAPHY_STYLES.body.base} font-medium hidden sm:block`,
      dropdown: {
        container: 'absolute top-full right-0 mt-1 bg-white border rounded-lg shadow-lg z-10 min-w-48',
        style: { borderColor: COLORS.lavender },
        userInfo: {
          container: 'p-3 border-b',
          style: { borderColor: COLORS.lavender },
          name: `${TYPOGRAPHY_STYLES.body.base} font-medium`,
          email: TYPOGRAPHY_STYLES.secondary.small,
        },
        menu: 'p-1',
        menuItem: 'w-full p-2 text-left hover:bg-gray-50 rounded transition-colors',
        menuItemText: TYPOGRAPHY_STYLES.body.base,
        divider: { style: { borderColor: COLORS.lavender } },
        logoutItem: 'w-full p-2 text-left hover:bg-gray-50 rounded transition-colors text-red-600',
      },
    },
  },
};

export const getRoleBadgeStyle = (role: string) => {
  const roleColors = {
    ADMIN: { backgroundColor: COLORS.forestGreen, color: 'white' },
    MANAGER: { backgroundColor: COLORS.mint, color: COLORS.forestGreen },
    MEMBER: { backgroundColor: COLORS.palePurple, color: COLORS.lavender },
    VIEWER: { backgroundColor: COLORS.oatMilk, color: COLORS.charcoal },
  };

  return roleColors[role as keyof typeof roleColors] || roleColors.MEMBER;
};

export const combineStyles = (...styles: (string | undefined)[]): string => {
  return styles.filter(Boolean).join(' ');
};

export const getConditionalStyle = (condition: boolean, trueStyle: string, falseStyle: string = ''): string => {
  return condition ? trueStyle : falseStyle;
};
