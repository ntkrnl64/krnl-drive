import { useState, useEffect, useCallback } from 'react';
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbButton, BreadcrumbDivider,
  Button, Spinner, Text, makeStyles, shorthands, mergeClasses
} from '@fluentui/react-components';
import {
  FolderOpenRegular, FolderRegular, ArrowUpRegular, HomeRegular
} from '@fluentui/react-icons';
import { filesApi } from '../api.ts';
import type { FileItem } from '../types.ts';

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    ...shorthands.gap('8px'),
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('4px'),
  },
  folderList: {
    display: 'flex',
    flexDirection: 'column',
    ...shorthands.gap('4px'),
    maxHeight: '200px', // Limit height for scrollability
    overflowY: 'auto',
    ...shorthands.border('1px', 'solid', 'var(--colorNeutralStroke2)'),
    ...shorthands.borderRadius('4px'),
    padding: '4px',
  },
  folderItem: {
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('8px'),
    ...shorthands.padding('8px'),
    cursor: 'pointer',
    ...shorthands.borderRadius('4px'),
    '&:hover': {
      backgroundColor: 'var(--colorNeutralBackground1Hover)',
    },
    '&:active': {
      backgroundColor: 'var(--colorNeutralBackground1Pressed)',
    },
  },
  folderItemSelected: {
    backgroundColor: 'var(--colorBrandBackground2)',
    color: 'var(--colorBrandForeground2)',
    '&:hover': {
      backgroundColor: 'var(--colorBrandBackground2Hover)',
    },
  },
  emptyState: {
    ...shorthands.padding('16px'),
    textAlign: 'center',
    color: 'var(--colorNeutralForeground3)',
  },
  loadingSpinner: {
    ...shorthands.padding('16px'),
    textAlign: 'center',
  }
});

interface FolderNavigatorProps {
  initialFolderId?: string | null;
  onSelect: (folderId: string | null) => void;
  excludeItemId?: string; // Item being moved, should not appear in its own subfolders
  currentParentId?: string | null; // The parent of the item being moved
}

export function FolderNavigator({ initialFolderId = null, onSelect, excludeItemId, currentParentId }: FolderNavigatorProps) {
  const styles = useStyles();
  const [currentBrowseFolderId, setCurrentBrowseFolderId] = useState<string | null>(initialFolderId);
  const [breadcrumb, setBreadcrumb] = useState<{ id: string | null; name: string }[]>([{ id: null, name: 'Root' }]);
  const [folders, setFolders] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(initialFolderId);

  // Initialize selected folder with currentParentId if available, or initialFolderId
  useEffect(() => {
    if (currentParentId !== undefined) {
      setSelectedFolderId(currentParentId);
      onSelect(currentParentId);
    } else {
      setSelectedFolderId(initialFolderId);
      onSelect(initialFolderId);
    }
  }, [initialFolderId, currentParentId, onSelect]);


  const loadFolders = useCallback(async (parentId: string | null) => {
    setLoading(true);
    try {
      const res = await filesApi.list(parentId);
      // Filter out files, the item being moved, and its direct parent if it's the item itself
      setFolders(res.items.filter(item => 
        item.type === 'folder' && 
        item.id !== excludeItemId && 
        !(item.id === currentParentId && item.id === excludeItemId) // Prevent parent from appearing if it's the item itself (edge case)
      ));
    } finally {
      setLoading(false);
    }
  }, [excludeItemId, currentParentId]);

  useEffect(() => {
    void loadFolders(currentBrowseFolderId);
  }, [currentBrowseFolderId, loadFolders]);

  const navigateTo = (folderId: string | null, folderName: string) => {
    setCurrentBrowseFolderId(folderId);
    // Update breadcrumb
    const existingIndex = breadcrumb.findIndex(b => b.id === folderId);
    if (existingIndex !== -1) {
      setBreadcrumb(breadcrumb.slice(0, existingIndex + 1));
    } else {
      setBreadcrumb([...breadcrumb, { id: folderId, name: folderName }]);
    }
    // Automatically select the navigated folder as the target
    selectFolder(folderId);
  };

  const selectFolder = (folderId: string | null) => {
    setSelectedFolderId(folderId);
    onSelect(folderId);
  };

  const currentFolder = breadcrumb[breadcrumb.length - 1];

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <Button
          appearance="subtle"
          size="small"
          icon={<ArrowUpRegular />}
          onClick={() => {
            if (breadcrumb.length > 1) {
              const parent = breadcrumb[breadcrumb.length - 2];
              navigateTo(parent.id, parent.name);
            }
          }}
          disabled={breadcrumb.length <= 1}
        />
        <Breadcrumb>
          {breadcrumb.map((entry, index) => (
            <>
              <BreadcrumbItem key={entry.id || 'root'}>
                <BreadcrumbButton
                  onClick={() => navigateTo(entry.id, entry.name)}
                  disabled={entry.id === currentFolder.id}
                >
                  {entry.id === null ? <HomeRegular /> : null}
                  {entry.name}
                </BreadcrumbButton>
              </BreadcrumbItem>
              {index < breadcrumb.length - 1 && <BreadcrumbDivider />}
            </>
          ))}
        </Breadcrumb>
      </div>

      <div className={styles.folderList}>
        {loading ? (
          <div className={styles.loadingSpinner}>
            <Spinner size="tiny" />
          </div>
        ) : folders.length === 0 ? (
          <div className={styles.emptyState}>
            <Text size={200}>No subfolders</Text>
          </div>
        ) : (
          <>
            <div
              className={mergeClasses(
                styles.folderItem,
                selectedFolderId === currentBrowseFolderId && styles.folderItemSelected
              )}
              onClick={() => selectFolder(currentBrowseFolderId)}
            >
              <FolderOpenRegular />
              <Text weight="semibold">{currentFolder.name} (Select)</Text>
            </div>
            {folders.map(folder => (
              <div
                key={folder.id}
                className={mergeClasses(
                  styles.folderItem,
                  selectedFolderId === folder.id && styles.folderItemSelected
                )}
                onClick={() => navigateTo(folder.id, folder.name)} // Single click to navigate and select
              >
                <FolderRegular />
                <Text>{folder.name}</Text>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}