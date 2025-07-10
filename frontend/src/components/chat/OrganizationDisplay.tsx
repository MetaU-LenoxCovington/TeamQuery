import React from 'react';
import { Organization } from '../../types';
import { chatStyles, getRoleBadgeStyle } from '../../styles/chatStyles';

interface OrganizationDisplayProps {
  organization?: Organization;
}

export const OrganizationDisplay: React.FC<OrganizationDisplayProps> = ({ organization }) => {
  if (!organization) return null;

  const roleStyle = getRoleBadgeStyle(organization.role);

  return (
    <div className={chatStyles.chatHeader.organizationDisplay.container}>
      <h1 className={chatStyles.chatHeader.organizationDisplay.title}>
        TeamQuery
      </h1>
      <div className={chatStyles.chatHeader.organizationDisplay.orgInfo}>
        <span className={chatStyles.chatHeader.organizationDisplay.orgName}>
          {organization.name}
        </span>
        <span
          className={chatStyles.chatHeader.organizationDisplay.roleBadge}
          style={roleStyle}
        >
          {organization.role}
        </span>
      </div>
    </div>
  );
};
