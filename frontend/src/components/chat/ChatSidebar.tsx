import React, { useState, useEffect } from 'react';
import { COLORS } from '../../styles/colors';
import { TYPOGRAPHY_STYLES } from '../../styles/typographyStyles';
import { Organization, Group, ChatHistory } from '../../types';
import { groupService, GroupWithDocuments } from '../../services/groupService';
import { organizationService } from '../../services/organizationService';
import { useAuthContext } from '../../contexts/AuthContext';

interface ChatSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  currentOrganization?: Organization;
  organizations: Organization[];
  onOrganizationChange: (organizationId: string) => void;
  onClearChat?: () => void;
}

const styles = {
  sidebar: {
    borderColor: COLORS.lavender,
    backgroundColor: COLORS.oatMilk,
  },
  orgSelector: {
    backgroundColor: 'white',
    borderColor: COLORS.lavender,
  },
  collapsed: {
    backgroundColor: COLORS.palePurple,
    color: COLORS.charcoal,
  },
};

const ROLE_COLORS = {
  ADMIN: { bg: COLORS.forestGreen, text: 'white' },
  MANAGER: { bg: COLORS.mint, text: COLORS.forestGreen },
  MEMBER: { bg: COLORS.palePurple, text: COLORS.lavender },
  VIEWER: { bg: COLORS.oatMilk, text: COLORS.charcoal },
};


const RoleBadge: React.FC<{ role: Organization['role'] }> = ({ role }) => {
  const colors = ROLE_COLORS[role] || ROLE_COLORS.MEMBER;

  return (
    <span
      className="px-2 py-1 rounded-full text-xs font-medium"
      style={{ backgroundColor: colors.bg, color: colors.text }}
    >
      {role}
    </span>
  );
};

const CollapsedSidebar: React.FC<{ onToggle: () => void }> = ({ onToggle }) => (
  <div
    className="w-16 border-r flex flex-col items-center py-4 space-y-4"
    style={styles.sidebar}
  >
  </div>
);

const OrganizationSelector: React.FC<{
  currentOrganization?: Organization;
  organizations: Organization[];
  isOpen: boolean;
  onToggle: () => void;
  onSelect: (orgId: string) => void;
  onCreateOrganization: () => void;
}> = ({ currentOrganization, organizations, isOpen, onToggle, onSelect, onCreateOrganization }) => (
  <div className="p-4 border-b" style={{ borderColor: COLORS.lavender }}>
    <div className="relative">
      <button
        onClick={onToggle}
        className="w-full p-3 rounded-lg border text-left flex items-center justify-between transition-all hover:shadow-sm"
        style={styles.orgSelector}
      >
        <div className="flex-1 min-w-0">
          <div className={`${TYPOGRAPHY_STYLES.body.base} font-medium truncate`}>
            {currentOrganization?.name || 'Select Organization'}
          </div>
          {currentOrganization && (
            <div className="flex items-center gap-2 mt-1">
              <RoleBadge role={currentOrganization.role} />
            </div>
          )}
        </div>
        <span className={TYPOGRAPHY_STYLES.secondary.base}>
          {isOpen ? '▼' : '▶'}
        </span>
      </button>

      {isOpen && (
        <div
          className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto"
          style={{ borderColor: COLORS.lavender }}
        >
          {organizations.map((org) => (
            <button
              key={org.id}
              onClick={() => onSelect(org.id)}
              className="w-full p-3 text-left hover:bg-gray-50 transition-colors"
            >
              <div className={`${TYPOGRAPHY_STYLES.body.base} font-medium`}>
                {org.name}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <RoleBadge role={org.role} />
              </div>
            </button>
          ))}

          {/* Create Organization Button */}
          <div className="border-t" style={{ borderColor: COLORS.lavender }}>
            <button
              onClick={onCreateOrganization}
              className="w-full p-3 text-left hover:bg-gray-50 transition-colors"
              style={{ color: COLORS.forestGreen }}
            >
              <div className={`${TYPOGRAPHY_STYLES.body.base} font-medium`}>
                + Create New Organization
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  </div>
);

const GroupsSection: React.FC<{
  isExpanded: boolean;
  onToggle: () => void;
  groups: Group[];
}> = ({ isExpanded, onToggle, groups }) => (
  <div className="p-4">
    <button
      onClick={onToggle}
      className={`w-full flex items-center justify-between ${TYPOGRAPHY_STYLES.body.base} font-medium hover:opacity-75 transition-opacity`}
    >
      <span>📁 Groups</span>
      <span>{isExpanded ? '▼' : '▶'}</span>
    </button>

    {isExpanded && (
      <div className="mt-3 space-y-2">
        {groups.map((group) => (
          <GroupItem key={group.id} group={group} />
        ))}
      </div>
    )}
  </div>
);

const GroupItem: React.FC<{ group: Group }> = ({ group }) => (
  <div className="pl-4">
    <div className={`flex items-center gap-2 ${TYPOGRAPHY_STYLES.body.base} py-1`}>
      <span>{group.name}</span>
      <span className={`${TYPOGRAPHY_STYLES.secondary.small} opacity-75`}>
        ({group.documentCount})
      </span>
    </div>
    {group.documents.map((doc, index) => (
      <DocumentItem key={index} name={doc} />
    ))}
  </div>
);


const DocumentItem: React.FC<{ name: string }> = ({ name }) => (
  <div className={`pl-4 ${TYPOGRAPHY_STYLES.secondary.small} py-1 hover:opacity-75 cursor-pointer`}>
    📄 {name}
  </div>
);

const ChatHistorySection: React.FC<{
  isExpanded: boolean;
  onToggle: () => void;
  chatHistory: ChatHistory[];
}> = ({ isExpanded, onToggle, chatHistory }) => (
  <div className="p-4 border-t" style={{ borderColor: COLORS.lavender }}>
    <button
      onClick={onToggle}
      className={`w-full flex items-center justify-between ${TYPOGRAPHY_STYLES.body.base} font-medium hover:opacity-75 transition-opacity`}
    >
      <span>💬 Recent Conversations</span>
      <span>{isExpanded ? '▼' : '▶'}</span>
    </button>

    {isExpanded && (
      <div className="mt-3 space-y-2">
        {chatHistory.map((chat) => (
          <ChatHistoryItem key={chat.id} chat={chat} />
        ))}
      </div>
    )}
  </div>
);

const ChatHistoryItem: React.FC<{ chat: ChatHistory }> = ({ chat }) => (
  <div className="p-2 rounded-lg hover:bg-white hover:shadow-sm transition-all cursor-pointer">
    <div className={`${TYPOGRAPHY_STYLES.body.base} font-medium truncate`}>
      {chat.title}
    </div>
    <div className={`${TYPOGRAPHY_STYLES.secondary.small} mt-1`}>
      {chat.timestamp}
    </div>
    <div className={`${TYPOGRAPHY_STYLES.secondary.small} truncate opacity-75`}>
      {chat.preview}
    </div>
  </div>
);

export const ChatSidebar: React.FC<ChatSidebarProps> = ({
  isOpen,
  onToggle,
  currentOrganization,
  organizations,
  onOrganizationChange,
  onClearChat,
}) => {
  const { refreshUserData, setCurrentOrganization } = useAuthContext();
  const [groupsExpanded, setGroupsExpanded] = useState(true);
  const [chatHistoryExpanded, setChatHistoryExpanded] = useState(true);
  const [orgSelectorOpen, setOrgSelectorOpen] = useState(false);
  const [userGroups, setUserGroups] = useState<GroupWithDocuments[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [groupsError, setGroupsError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserGroups = async () => {
      if (!currentOrganization) {
        setUserGroups([]);
        return;
      }

      try {
        setGroupsLoading(true);
        setGroupsError(null);
        const groups = await groupService.getUserGroups(currentOrganization.id);
        setUserGroups(groups);
      } catch (error) {
        console.error('Failed to fetch user groups:', error);
        setGroupsError(error instanceof Error ? error.message : 'Failed to load groups');
        setUserGroups([]);
      } finally {
        setGroupsLoading(false);
      }
    };

    fetchUserGroups();
  }, [currentOrganization]);

  const handleOrganizationSelect = (orgId: string) => {
    onOrganizationChange(orgId);
    setOrgSelectorOpen(false);
  };

  const handleCreateOrganization = async () => {
    const orgName = prompt('Enter organization name:');
    if (orgName && orgName.trim()) {
      try {
        const newOrg = await organizationService.createOrganization({
          name: orgName.trim()
        });

        // Refresh user data to get updated organization list
        await refreshUserData();

        // Auto switch to new organization
        setCurrentOrganization(newOrg.id);

      } catch (error) {
        console.error('Failed to create organization:', error);
        alert('Failed to create organization. Please try again.');
      }
    }
    setOrgSelectorOpen(false);
  };

  const handleClearChat = () => {
    if (confirm('Are you sure you want to clear the chat history?')) {
      onClearChat?.();
    }
  };

  if (!isOpen) {
    return <CollapsedSidebar onToggle={onToggle} />;
  }

  return (
    <div className="w-80 border-r flex flex-col" style={styles.sidebar}>
      <OrganizationSelector
        currentOrganization={currentOrganization}
        organizations={organizations}
        isOpen={orgSelectorOpen}
        onToggle={() => setOrgSelectorOpen(!orgSelectorOpen)}
        onSelect={handleOrganizationSelect}
        onCreateOrganization={handleCreateOrganization}
      />

      <div className="flex-1 overflow-y-auto">
        <div className="p-4">
          <button
            onClick={() => setGroupsExpanded(!groupsExpanded)}
            className={`w-full flex items-center justify-between ${TYPOGRAPHY_STYLES.body.base} font-medium hover:opacity-75 transition-opacity`}
          >
            <span>📁 Groups</span>
            <span>{groupsExpanded ? '▼' : '▶'}</span>
          </button>

          {groupsExpanded && (
            <div className="mt-3 space-y-2">
              {groupsLoading && (
                <div className={`${TYPOGRAPHY_STYLES.secondary.small} text-center py-2`}>
                  Loading groups...
                </div>
              )}

              {groupsError && (
                <div className={`${TYPOGRAPHY_STYLES.secondary.small} text-red-600 py-2`}>
                  Error: {groupsError}
                </div>
              )}

              {!groupsLoading && !groupsError && userGroups.length === 0 && (
                <div className={`${TYPOGRAPHY_STYLES.secondary.small} text-gray-500 py-2`}>
                  No groups found
                </div>
              )}

              {!groupsLoading && !groupsError && userGroups.map((group) => (
                <div key={group.id} className="pl-4">
                  <div className={`flex items-center gap-2 ${TYPOGRAPHY_STYLES.body.base} py-1`}>
                    <span>{group.name}</span>
                    <span className={`${TYPOGRAPHY_STYLES.secondary.small} opacity-75`}>
                      ({group.documents.length})
                    </span>
                  </div>
                  {group.documents.map((doc) => (
                    <div key={doc.id} className={`pl-4 ${TYPOGRAPHY_STYLES.secondary.small} py-1 hover:opacity-75 cursor-pointer`}>
                      📄 {doc.title}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t" style={{ borderColor: COLORS.lavender }}>
          <h3>Recent Conversations</h3>
          <p>Chat history coming soon</p>
          <button
            onClick={handleClearChat}
            className={`mt-2 text-sm ${TYPOGRAPHY_STYLES.secondary.base} hover:opacity-75 cursor-pointer`}
            style={{ color: COLORS.forestGreen }}
          >
            Clear Chat
          </button>
        </div>
      </div>
    </div>
  );
};
