import React, { useState } from 'react';
import { COLORS } from '../../styles/colors';
import { TYPOGRAPHY_STYLES } from '../../styles/typographyStyles';
import { BUTTON_BASE_CLASSES, BUTTON_VARIANTS } from '../../styles/buttonStyles';
import { INPUT_BASE_CLASSES, INPUT_STATES } from '../../styles/inputStyles';
import { Document } from '../../types';

interface DocumentContextModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectContext: (selectedIds: string[]) => void;
  selectedContext: string[];
}

// Mock data - TODO: Replace with API service
const mockDocuments: Document[] = [
  {
    id: 'doc-1',
    title: 'Building A - Lease Agreement',
    type: 'document',
    groupId: 'group-1',
    accessLevel: 'GROUP',
    size: '2.3 MB',
  },
  {
    id: 'doc-2',
    title: 'Safety Protocols Manual',
    type: 'document',
    groupId: 'group-2',
    accessLevel: 'PUBLIC',
    size: '1.8 MB',
  },
  {
    id: 'doc-3',
    title: 'Equipment Maintenance Guide',
    type: 'document',
    groupId: 'group-2',
    accessLevel: 'GROUP',
    size: '956 KB',
  },
  {
    id: 'folder-1',
    title: 'Property Management',
    type: 'folder',
    groupId: 'group-1',
    accessLevel: 'GROUP',
    children: [
      {
        id: 'doc-4',
        title: 'Building B - Service Contract',
        type: 'document',
        groupId: 'group-1',
        accessLevel: 'GROUP',
        size: '1.2 MB',
      },
      {
        id: 'doc-5',
        title: 'Maintenance Schedule 2024',
        type: 'document',
        groupId: 'group-1',
        accessLevel: 'MANAGERS',
        size: '456 KB',
      },
    ],
  },
  {
    id: 'folder-2',
    title: 'Janitorial Procedures',
    type: 'folder',
    groupId: 'group-2',
    accessLevel: 'GROUP',
    children: [
      {
        id: 'doc-6',
        title: 'Daily Cleaning Checklist',
        type: 'document',
        groupId: 'group-2',
        accessLevel: 'PUBLIC',
        size: '123 KB',
      },
      {
        id: 'doc-7',
        title: 'Chemical Safety Data Sheets',
        type: 'document',
        groupId: 'group-2',
        accessLevel: 'GROUP',
        size: '3.1 MB',
      },
    ],
  },
];

const styles = {
  modal: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  content: {
    backgroundColor: COLORS.oatMilk,
    borderColor: COLORS.lavender,
  },
  documentItem: {
    backgroundColor: 'white',
    borderColor: COLORS.lavender,
  },
  checkbox: {
    accentColor: COLORS.forestGreen,
  },
};

const DocumentItem: React.FC<{
  document: Document;
  isSelected: boolean;
  onToggle: (id: string) => void;
}> = ({ document, isSelected, onToggle }) => (
  <div
    className="p-3 rounded-lg border transition-all hover:shadow-sm"
    style={styles.documentItem}
  >
    <label className="flex items-center gap-3 cursor-pointer">
      <input
        type="checkbox"
        checked={isSelected}
        onChange={() => onToggle(document.id)}
        className="w-4 h-4"
        style={styles.checkbox}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span>{document.type === 'document' ? '📄' : '📁'}</span>
          <span className={`${TYPOGRAPHY_STYLES.body.base} font-medium truncate`}>
            {document.title}
          </span>
        </div>
        {document.size && (
          <div className={`${TYPOGRAPHY_STYLES.secondary.small} mt-1`}>
            {document.size}
          </div>
        )}
      </div>
    </label>

    {document.children && (
      <div className="ml-6 mt-2 space-y-2">
        {document.children.map((child) => (
          <DocumentItem
            key={child.id}
            document={child}
            isSelected={isSelected}
            onToggle={onToggle}
          />
        ))}
      </div>
    )}
  </div>
);

const SearchInput: React.FC<{
  value: string;
  onChange: (value: string) => void;
}> = ({ value, onChange }) => (
  <div className="relative">
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Search documents and folders..."
      className={`w-full ${INPUT_BASE_CLASSES} ${INPUT_STATES.default} pl-10`}
    />
    <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
      🔍
    </div>
  </div>
);

const SelectAllToggle: React.FC<{
  allSelected: boolean;
  onToggle: () => void;
}> = ({ allSelected, onToggle }) => (
  <button
    onClick={onToggle}
    className={`${TYPOGRAPHY_STYLES.body.base} font-medium transition-colors hover:opacity-75`}
    style={{ color: COLORS.forestGreen }}
  >
    {allSelected ? 'Deselect All' : 'Select All'}
  </button>
);

const ActionButtons: React.FC<{
  onCancel: () => void;
  onApply: () => void;
  selectedCount: number;
}> = ({ onCancel, onApply, selectedCount }) => (
  <div className="flex justify-between items-center">
    <span className={TYPOGRAPHY_STYLES.secondary.base}>
      {selectedCount} item{selectedCount !== 1 ? 's' : ''} selected
    </span>
    <div className="flex gap-3">
      <button
        onClick={onCancel}
        className={`${BUTTON_BASE_CLASSES} ${BUTTON_VARIANTS.secondary}`}
      >
        Cancel
      </button>
      <button
        onClick={onApply}
        className={`${BUTTON_BASE_CLASSES} ${BUTTON_VARIANTS.primary}`}
      >
        Apply Context
      </button>
    </div>
  </div>
);

export const DocumentContextModal: React.FC<DocumentContextModalProps> = ({
  isOpen,
  onClose,
  onSelectContext,
  selectedContext,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [localSelectedIds, setLocalSelectedIds] = useState<Set<string>>(
    new Set(selectedContext)
  );

  if (!isOpen) return null;

  const filteredDocuments = mockDocuments.filter((doc) =>
    doc.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const allDocumentIds = mockDocuments.flatMap((doc) => {
    if (doc.children) {
      return [doc.id, ...doc.children.map((child) => child.id)];
    }
    return [doc.id];
  });

  const allSelected = allDocumentIds.every((id) => localSelectedIds.has(id));

  const handleToggleDocument = (id: string) => {
    const newSelected = new Set(localSelectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setLocalSelectedIds(newSelected);
  };

  const handleSelectAll = () => {
    if (allSelected) {
      setLocalSelectedIds(new Set());
    } else {
      setLocalSelectedIds(new Set(allDocumentIds));
    }
  };

  const handleApply = () => {
    onSelectContext(Array.from(localSelectedIds));
  };

  const handleCancel = () => {
    setLocalSelectedIds(new Set(selectedContext));
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={styles.modal}
    >
      <div
        className="w-full max-w-2xl max-h-[80vh] rounded-xl border shadow-xl flex flex-col"
        style={styles.content}
      >
        <div className="p-6 border-b" style={{ borderColor: COLORS.lavender }}>
          <h2 className={TYPOGRAPHY_STYLES.headings.h2}>
            Select Document Context
          </h2>
          <p className={`${TYPOGRAPHY_STYLES.secondary.base} mt-2`}>
            Choose documents and folders to provide context for your question.
          </p>
        </div>

        <div className="p-6 space-y-4">
          <SearchInput value={searchTerm} onChange={setSearchTerm} />

          <div className="flex justify-between items-center">
            <span className={`${TYPOGRAPHY_STYLES.body.base} font-medium`}>
              Available Documents
            </span>
            <SelectAllToggle
              allSelected={allSelected}
              onToggle={handleSelectAll}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-4">
          <div className="space-y-3">
            {filteredDocuments.map((document) => (
              <DocumentItem
                key={document.id}
                document={document}
                isSelected={localSelectedIds.has(document.id)}
                onToggle={handleToggleDocument}
              />
            ))}
          </div>
        </div>

        <div className="p-6 border-t" style={{ borderColor: COLORS.lavender }}>
          <ActionButtons
            onCancel={handleCancel}
            onApply={handleApply}
            selectedCount={localSelectedIds.size}
          />
        </div>
      </div>
    </div>
  );
}; 