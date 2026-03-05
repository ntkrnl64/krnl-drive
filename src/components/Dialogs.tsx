import { useEffect, useState } from 'react';
import {
  Dialog, DialogSurface, DialogTitle, DialogBody, DialogActions, DialogContent,
  Button, Field, Input, Spinner, Text, makeStyles
} from '@fluentui/react-components';
import type { FileItem } from '../types.ts';
import { FolderNavigator } from './FolderNavigator.tsx';

const useStyles = makeStyles({
  dialogContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    paddingTop: '8px',
  },
  dangerButton: {
    backgroundColor: 'var(--colorPaletteRedBackground3)',
    color: 'white',
    '&:hover': {
      backgroundColor: 'var(--colorPaletteRedBackground3Hover)',
      color: 'white',
    },
    '&:active': {
      backgroundColor: 'var(--colorPaletteRedBackground3Pressed)',
      color: 'white',
    }
  },
  errorText: {
    color: 'var(--colorPaletteRedForeground1)',
  }
});

// ─── Create Folder Dialog ─────────────────────────────────────────────────────
interface CreateFolderDialogProps {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string) => Promise<void>;
}

export function CreateFolderDialog({ open, onClose, onCreate }: CreateFolderDialogProps) {
  const styles = useStyles();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      await onCreate(name.trim());
      setName('');
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(_, d) => !d.open && onClose()}>
      <DialogSurface>
        <form onSubmit={handleSubmit}>
          <DialogBody>
            <DialogTitle>New folder</DialogTitle>
            <DialogContent className={styles.dialogContent}>
              <Field label="Folder name">
                <Input
                  value={name}
                  onChange={(_, d) => setName(d.value)}
                  placeholder="New folder"
                  autoFocus
                />
              </Field>
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
              <Button appearance="primary" type="submit" disabled={loading || !name.trim()}>
                {loading ? <Spinner size="tiny" /> : 'Create'}
              </Button>
            </DialogActions>
          </DialogBody>
        </form>
      </DialogSurface>
    </Dialog>
  );
}

// ─── Rename Dialog ────────────────────────────────────────────────────────────
interface RenameDialogProps {
  item: FileItem | null;
  open: boolean;
  onClose: () => void;
  onRename: (id: string, newName: string) => Promise<void>;
}

export function RenameDialog({ item, open, onClose, onRename }: RenameDialogProps) {
  const styles = useStyles();
  const [name, setName] = useState(item?.name ?? '');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!item || !name.trim()) return;
    setLoading(true);
    try {
      await onRename(item.id, name.trim());
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(_, d) => { if (!d.open) { onClose(); setName(item?.name ?? ''); } }}>
      <DialogSurface>
        <form onSubmit={handleSubmit}>
          <DialogBody>
            <DialogTitle>Rename "{item?.name}"</DialogTitle>
            <DialogContent className={styles.dialogContent}>
              <Field label="New name">
                <Input
                  value={name}
                  onChange={(_, d) => setName(d.value)}
                  autoFocus
                  onFocus={e => e.target.select()}
                />
              </Field>
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
              <Button appearance="primary" type="submit" disabled={loading || !name.trim() || name === item?.name}>
                {loading ? <Spinner size="tiny" /> : 'Rename'}
              </Button>
            </DialogActions>
          </DialogBody>
        </form>
      </DialogSurface>
    </Dialog>
  );
}

// ─── Delete Confirm Dialog ────────────────────────────────────────────────────
interface DeleteDialogProps {
  item: FileItem | null;
  open: boolean;
  onClose: () => void;
  onDelete: (id: string) => Promise<void>;
}

export function DeleteDialog({ item, open, onClose, onDelete }: DeleteDialogProps) {
  const styles = useStyles();
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    if (!item) return;
    setLoading(true);
    try {
      await onDelete(item.id);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(_, d) => !d.open && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Delete "{item?.name}"?</DialogTitle>
          <DialogContent className={styles.dialogContent}>
            <Text>
              {item?.type === 'folder'
                ? 'This will permanently delete the folder and all its contents. This cannot be undone.'
                : 'This will permanently delete the file. This cannot be undone.'}
            </Text>
          </DialogContent>
          <DialogActions>
            <Button appearance="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
            <Button className={styles.dangerButton} onClick={handleDelete} disabled={loading}>
              {loading ? <Spinner size="tiny" /> : 'Delete'}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

// ─── Move Dialog ──────────────────────────────────────────────────────────────
interface MoveDialogProps {
  item: FileItem | null;
  open: boolean;
  onClose: () => void;
  onMove: (id: string, parentId: string | null) => Promise<void>;
  currentParentId: string | null;
}

export function MoveDialog({ item, open, onClose, onMove, currentParentId }: MoveDialogProps) {
  const styles = useStyles();
  const [targetId, setTargetId] = useState<string | null>(null); // Initial state should be null

  // Set initial targetId based on the current parent of the item being moved
  useEffect(() => {
    setTargetId(currentParentId);
  }, [currentParentId]);

  const [loading, setLoading] = useState(false);

  const handleMove = async () => {
    if (!item || targetId === null) return; // targetId cannot be null if we are moving
    setLoading(true);
    try {
      await onMove(item.id, targetId === 'root' ? null : targetId);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  // Check if targetId is a parent of item, meaning moving item into itself or its subfolder
  const isMovingIntoSelf = (selectedTargetId: string | null) => {
    if (!item || !selectedTargetId) return false;
    // For simplicity, we'll just prevent moving into the item's own ID.
    // A more robust check would involve checking if selectedTargetId is a descendant of item.id
    return selectedTargetId === item.id;
  }

  return (
    <Dialog open={open} onOpenChange={(_, d) => !d.open && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Move "{item?.name}"</DialogTitle>
          <DialogContent className={styles.dialogContent}>
            <Text weight="semibold">Move to folder:</Text>
            <FolderNavigator
              initialFolderId={currentParentId}
              onSelect={selectedId => setTargetId(selectedId)}
              excludeItemId={item?.id}
              currentParentId={currentParentId}
            />
            {targetId === null && <Text className={styles.errorText}>Please select a destination folder.</Text>}
            {isMovingIntoSelf(targetId) && <Text className={styles.errorText}>Cannot move item into itself or its subfolder.</Text>}
          </DialogContent>
          <DialogActions>
            <Button appearance="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
            <Button
              appearance="primary"
              onClick={handleMove}
              disabled={loading || targetId === null || isMovingIntoSelf(targetId)}
            >
              {loading ? <Spinner size="tiny" /> : 'Move'}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

// ─── Copy Dialog ──────────────────────────────────────────────────────────────
interface CopyDialogProps {
  item: FileItem | null;
  open: boolean;
  onClose: () => void;
  onCopy: (id: string, parentId: string | null) => Promise<void>;
  currentParentId: string | null;
}

export function CopyDialog({ item, open, onClose, onCopy, currentParentId }: CopyDialogProps) {
  const styles = useStyles();
  const [targetId, setTargetId] = useState<string | null>(null);

  useEffect(() => {
    setTargetId(currentParentId);
  }, [currentParentId]);

  const [loading, setLoading] = useState(false);

  const handleCopy = async () => {
    if (!item || targetId === null) return;
    setLoading(true);
    try {
      await onCopy(item.id, targetId === 'root' ? null : targetId);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const isCopyingIntoSelf = (selectedTargetId: string | null) => {
    if (!item || !selectedTargetId) return false;
    return selectedTargetId === item.id;
  }

  return (
    <Dialog open={open} onOpenChange={(_, d) => !d.open && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Copy "{item?.name}"</DialogTitle>
          <DialogContent className={styles.dialogContent}>
            <Text weight="semibold">Copy to folder:</Text>
            <FolderNavigator
              initialFolderId={currentParentId}
              onSelect={selectedId => setTargetId(selectedId)}
              excludeItemId={item?.id}
              currentParentId={currentParentId}
            />
            {targetId === null && <Text className={styles.errorText}>Please select a destination folder.</Text>}
            {isCopyingIntoSelf(targetId) && <Text className={styles.errorText}>Cannot copy item into itself or its subfolder.</Text>}
          </DialogContent>
          <DialogActions>
            <Button appearance="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
            <Button
              appearance="primary"
              onClick={handleCopy}
              disabled={loading || targetId === null || isCopyingIntoSelf(targetId)}
            >
              {loading ? <Spinner size="tiny" /> : 'Copy'}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

// ─── Change Password Dialog ───────────────────────────────────────────────────
interface ChangePasswordDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (current: string, next: string) => Promise<void>;
}

export function ChangePasswordDialog({ open, onClose, onSubmit }: ChangePasswordDialogProps) {
  const styles = useStyles();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (next !== confirm) { setError('Passwords do not match'); return; }
    setLoading(true);
    setError('');
    try {
      await onSubmit(current, next);
      setCurrent(''); setNext(''); setConfirm('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(_, d) => !d.open && onClose()}>
      <DialogSurface>
        <form onSubmit={handleSubmit}>
          <DialogBody>
            <DialogTitle>Change Password</DialogTitle>
            <DialogContent className={styles.dialogContent}>
              <Field label="Current password">
                <Input type="password" value={current} onChange={(_, d) => setCurrent(d.value)} autoFocus />
              </Field>
              <Field label="New password">
                <Input type="password" value={next} onChange={(_, d) => setNext(d.value)} />
              </Field>
              <Field label="Confirm new password">
                <Input type="password" value={confirm} onChange={(_, d) => setConfirm(d.value)} />
              </Field>
              {error && <Text className={styles.errorText}>{error}</Text>}
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
              <Button appearance="primary" type="submit" disabled={loading}>
                {loading ? <Spinner size="tiny" /> : 'Change password'}
              </Button>
            </DialogActions>
          </DialogBody>
        </form>
      </DialogSurface>
    </Dialog>
  );
}