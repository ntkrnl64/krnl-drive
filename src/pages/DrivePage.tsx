import { useState, useEffect, useCallback } from 'react';
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbButton, BreadcrumbDivider,
  Button, Popover, PopoverTrigger, PopoverSurface,
  Spinner, Toast, useToastController,
  MessageBar, MessageBarBody, Text,
  Dialog, DialogSurface, DialogBody, DialogTitle, DialogContent, DialogActions,
  Menu, MenuTrigger, MenuPopover, MenuList, MenuItem,
  makeStyles, shorthands,
} from '@fluentui/react-components';
import {
  FolderAddRegular, ArrowUploadRegular, DeleteRegular, ArrowSyncRegular, HomeRegular, CodeRegular
} from '@fluentui/react-icons';
import { filesApi } from '../api.ts';
import { useAuth } from '../contexts/AuthContext.tsx';
import FileList from '../components/FileList.tsx';
import UploadZone from '../components/UploadZone.tsx';
import ShareDialog from '../components/ShareDialog.tsx';
import { CreateFolderDialog, RenameDialog, DeleteDialog, MoveDialog, CopyDialog } from '../components/Dialogs.tsx';
import type { FileItem } from '../types.ts';

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    backgroundColor: 'var(--colorNeutralBackground1)',
  },
  header: {
    padding: '6px 8px 6px 16px',
    ...shorthands.borderBottom('1px', 'solid', 'var(--colorNeutralStroke2)'),
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    backgroundColor: 'var(--colorNeutralBackground2)',
    minHeight: '44px',
  },
  headerBreadcrumb: {
    flexGrow: 1,
    overflow: 'hidden',
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '2px',
    flexShrink: 0,
  },
listContainer: {
    flexGrow: 1,
    overflowY: 'auto',
    overflowX: 'auto',
    padding: '0 8px',
  },
  loadingContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '200px',
  }
});

interface BreadcrumbEntry {
  id: string | null;
  name: string;
}

export default function DrivePage() {
  const styles = useStyles();
  const { user } = useAuth();
  const { dispatchToast } = useToastController();

  const [currentId, setCurrentId] = useState<string | null>(null);
  const [breadcrumb, setBreadcrumb] = useState<BreadcrumbEntry[]>([{ id: null, name: 'Home' }]);
  const [items, setItems] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Dialog state
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [renameItem, setRenameItem] = useState<FileItem | null>(null);
  const [deleteItem, setDeleteItem] = useState<FileItem | null>(null);
  const [shareItem, setShareItem] = useState<FileItem | null>(null);
  const [moveItem, setMoveItem] = useState<FileItem | null>(null);
  const [copyItem, setCopyItem] = useState<FileItem | null>(null);
  const [deleteBatchOpen, setDeleteBatchOpen] = useState(false);

  const toast = (msg: string, intent: 'success' | 'error' = 'success') =>
    dispatchToast(
      <Toast><MessageBar intent={intent}><MessageBarBody>{msg}</MessageBarBody></MessageBar></Toast>,
      { intent }
    );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await filesApi.list(currentId);
      setItems(res.items);
      setSelected(new Set());
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to load files', 'error');
    } finally {
      setLoading(false);
    }
  }, [currentId]);  // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { void load(); }, [load]);

  const navigate = (folder: FileItem) => {
    setCurrentId(folder.id);
    setBreadcrumb(prev => [...prev, { id: folder.id, name: folder.name }]);
    setSelected(new Set());
  };

  const navigateTo = (entry: BreadcrumbEntry) => {
    const idx = breadcrumb.findIndex(b => b.id === entry.id);
    if (idx >= 0) {
      setCurrentId(entry.id);
      setBreadcrumb(prev => prev.slice(0, idx + 1));
      setSelected(new Set());
    }
  };

  const handleCreateFolder = async (name: string) => {
    await filesApi.createFolder(name, currentId);
    await load();
    toast(`Folder "${name}" created`);
  };

  const handleRename = async (id: string, name: string) => {
    await filesApi.rename(id, name);
    await load();
    toast('Renamed successfully');
  };

  const handleDelete = async (id: string) => {
    const item = items.find(i => i.id === id);
    await filesApi.delete(id);
    await load();
    toast(`"${item?.name ?? 'Item'}" deleted`);
  };

  const handleDeleteSelected = async () => {
    let count = 0;
    for (const id of selected) {
      await filesApi.delete(id).catch(() => {});
      count++;
    }
    await load();
    toast(`${count} item(s) deleted`);
    setDeleteBatchOpen(false);
  };

  const handleMove = async (id: string, parentId: string | null) => {
    await filesApi.move(id, parentId);
    await load();
    toast('Moved successfully');
  };

  const handleCopy = async (id: string, parentId: string | null) => {
    await filesApi.copy(id, parentId);
    await load();
    toast('Copied successfully');
  };

  const toggleSelection = (id: string, checked: boolean) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const isGuest = user?.role === 'guest';

  return (
    <div className={styles.root}>

      {/* Header: breadcrumb + actions */}
      <div className={styles.header}>
        <div className={styles.headerBreadcrumb}>
          <Breadcrumb>
            {breadcrumb.map((entry, idx) => (
              <span key={entry.id ?? 'root'} style={{ display: 'contents' }}>
                {idx > 0 && <BreadcrumbDivider />}
                <BreadcrumbItem>
                  <BreadcrumbButton
                    current={idx === breadcrumb.length - 1}
                    icon={idx === 0 ? <HomeRegular /> : undefined}
                    onClick={() => navigateTo(entry)}
                  >
                    {entry.name}
                  </BreadcrumbButton>
                </BreadcrumbItem>
              </span>
            ))}
          </Breadcrumb>
        </div>
        <div className={styles.headerActions}>
          {selected.size > 0 && !isGuest && (
            <Button
              appearance="subtle"
              size="small"
              icon={<DeleteRegular />}
              onClick={() => setDeleteBatchOpen(true)}
            >
              Delete ({selected.size})
            </Button>
          )}
          {!isGuest && (
            <>
              <Button
                appearance="subtle"
                size="small"
                icon={<FolderAddRegular />}
                onClick={() => setCreateFolderOpen(true)}
              >
                New Folder
              </Button>
              <Popover positioning="below-end" trapFocus={false}>
                <PopoverTrigger disableButtonEnhancement>
                  <Button id="upload-button" appearance="subtle" size="small" icon={<ArrowUploadRegular />}>
                    Upload
                  </Button>
                </PopoverTrigger>
                <PopoverSurface style={{ padding: '16px', width: '360px' }}>
                  <UploadZone parentId={currentId} onUploaded={() => void load()} />
                </PopoverSurface>
              </Popover>
            </>
          )}
          <Button appearance="subtle" size="small" icon={<ArrowSyncRegular />} onClick={() => void load()} />
        </div>
      </div>


      {/* File list */}
      <Menu openOnContext>
        <MenuTrigger disableButtonEnhancement>
          <div className={styles.listContainer}>
            {loading ? (
              <div className={styles.loadingContainer}>
                <Spinner label="Loading files..." />
              </div>
            ) : (
              <FileList
                items={items}
                currentUser={user!}
                onNavigate={navigate}
                onDelete={item => setDeleteItem(item)}
                onRename={item => setRenameItem(item)}
                onShare={item => setShareItem(item)}
                onMove={item => setMoveItem(item)}
                onCopy={item => setCopyItem(item)}
                selected={selected}
                onSelectionChange={toggleSelection}
              />
            )}
          </div>
        </MenuTrigger>
        <MenuPopover>
          <MenuList>
            {!isGuest && (
              <>
                <MenuItem icon={<FolderAddRegular />} onClick={() => setCreateFolderOpen(true)}>
                  New Folder
                </MenuItem>
                <MenuItem icon={<ArrowUploadRegular />} onClick={() => document.getElementById('upload-button')?.click()}>
                  Upload
                </MenuItem>
              </>
            )}
            {currentId && (
              <MenuItem icon={<CodeRegular />} onClick={() => void navigator.clipboard.writeText(currentId)}>
                Copy Current Folder ID
              </MenuItem>
            )}
            <MenuItem icon={<ArrowSyncRegular />} onClick={() => void load()}>
              Refresh
            </MenuItem>
          </MenuList>
        </MenuPopover>
      </Menu>

      {/* Dialogs */}
      <CreateFolderDialog
        open={createFolderOpen}
        onClose={() => setCreateFolderOpen(false)}
        onCreate={handleCreateFolder}
      />
      <RenameDialog
        item={renameItem}
        open={!!renameItem}
        onClose={() => setRenameItem(null)}
        onRename={handleRename}
      />
      <DeleteDialog
        item={deleteItem}
        open={!!deleteItem}
        onClose={() => setDeleteItem(null)}
        onDelete={handleDelete}
      />
      <ShareDialog
        file={shareItem}
        open={!!shareItem}
        onClose={() => setShareItem(null)}
      />
      <MoveDialog
        item={moveItem}
        open={!!moveItem}
        onClose={() => setMoveItem(null)}
        onMove={handleMove}
        currentParentId={currentId}
      />
      <CopyDialog
        item={copyItem}
        open={!!copyItem}
        onClose={() => setCopyItem(null)}
        onCopy={handleCopy}
        currentParentId={currentId}
      />

      {/* Batch delete confirm */}
      <Dialog open={deleteBatchOpen} onOpenChange={(_, d) => !d.open && setDeleteBatchOpen(false)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Delete {selected.size} item(s)?</DialogTitle>
            <DialogContent>
              <Text>This will permanently delete the selected items. This cannot be undone.</Text>
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={() => setDeleteBatchOpen(false)}>Cancel</Button>
              <Button
                style={{ background: 'var(--colorPaletteRedBackground3)', color: 'white' }}
                onClick={handleDeleteSelected}
              >
                Delete all
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
}