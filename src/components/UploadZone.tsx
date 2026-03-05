import { useState, useRef, useCallback } from 'react';
import {
  Button, Text, ProgressBar, Tooltip, Spinner, makeStyles, shorthands, mergeClasses
} from '@fluentui/react-components';
import { ArrowUploadRegular, DismissRegular, CheckmarkRegular, ErrorCircleRegular } from '@fluentui/react-icons';
import { uploadFile, cancelUpload } from '../api.ts';
import type { UploadTask } from '../types.ts';

const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  dropZone: {
    ...shorthands.border('2px', 'dashed', 'var(--colorNeutralStroke2)'),
    ...shorthands.borderRadius('8px'),
    ...shorthands.padding('24px', '16px'),
    textAlign: 'center',
    justifyContent: "center",
    backgroundColor: 'var(--colorNeutralBackground2)',
    cursor: 'pointer',
    transitionProperty: 'all',
    transitionDuration: '0.15s',
    '&:hover': {
      backgroundColor: 'var(--colorNeutralBackground2Hover)',
    }
  },
  dropZoneDragging: {
    ...shorthands.borderColor('var(--colorBrandStroke1)'),
    backgroundColor: 'var(--colorBrandBackground2)',
  },
  icon: {
    fontSize: '32px',
    color: 'var(--colorBrandForeground1)',
    marginBottom: '8px',
  },
  subText: {
    color: 'var(--colorNeutralForeground3)',
    marginTop: '4px',
  },
  listContainer: {
    ...shorthands.border('1px', 'solid', 'var(--colorNeutralStroke2)'),
    ...shorthands.borderRadius('8px'),
    overflowY: 'hidden',
    overflowX: 'hidden',
  },
  listItem: {
    ...shorthands.padding('10px', '12px'),
    ...shorthands.borderBottom('1px', 'solid', 'var(--colorNeutralStroke2)'),
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    '&:last-child': {
      borderBottomStyle: 'none',
    }
  },
  taskInfo: {
    flexGrow: 1,
    overflowY: 'hidden',
    overflowX: 'hidden',
  },
  progressText: {
    color: 'var(--colorNeutralForeground3)',
  },
  doneIcon: {
    color: 'var(--colorPaletteGreenForeground1)',
  },
  errorIcon: {
    color: 'var(--colorPaletteRedForeground1)',
  },
  errorText: {
    color: 'var(--colorPaletteRedForeground1)',
  }
});

interface UploadZoneProps {
  parentId: string | null;
  onUploaded: () => void;
}

let taskId = 0;

export default function UploadZone({ parentId, onUploaded }: UploadZoneProps) {
  const styles = useStyles();
  const [dragging, setDragging] = useState(false);
  const [tasks, setTasks] = useState<UploadTask[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);
  const abortControllers = useRef<Map<string, AbortController>>(new Map());

  const addTasks = useCallback((files: File[]) => {
    const newTasks: UploadTask[] = files.map(file => ({
      id: String(taskId++),
      file,
      progress: 0,
      status: 'queued',
      parentId,
    }));
    setTasks(prev => [...prev, ...newTasks]);
    newTasks.forEach(task => void startUpload(task));
  }, [parentId]);  // eslint-disable-line react-hooks/exhaustive-deps

  const startUpload = async (task: UploadTask) => {
    const controller = new AbortController();
    abortControllers.current.set(task.id, controller);

    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: 'uploading' } : t));

    try {
      await uploadFile(
        task.file,
        task.parentId,
        ({ progress, sessionId }) => {
          setTasks(prev => prev.map(t =>
            t.id === task.id ? { ...t, progress, sessionId } : t
          ));
        },
        controller.signal
      );
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: 'done', progress: 100 } : t));
      onUploaded();
    } catch (e) {
      if ((e as Error).message === 'Upload cancelled') {
        setTasks(prev => prev.filter(t => t.id !== task.id));
      } else {
        setTasks(prev => prev.map(t =>
          t.id === task.id ? { ...t, status: 'error', error: (e as Error).message } : t
        ));
      }
    } finally {
      abortControllers.current.delete(task.id);
    }
  };

  const cancelTask = async (task: UploadTask) => {
    const ctrl = abortControllers.current.get(task.id);
    if (ctrl) ctrl.abort();
    if (task.sessionId) await cancelUpload(task.sessionId).catch(() => {});
    setTasks(prev => prev.filter(t => t.id !== task.id));
  };

  const removeTask = (id: string) => setTasks(prev => prev.filter(t => t.id !== id));

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  };

  const onDragLeave = () => setDragging(false);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) addTasks(files);
  };

  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) addTasks(files);
    e.target.value = '';
  };

  const activeTasks = tasks.filter(t => t.status === 'uploading' || t.status === 'queued');
  const doneTasks = tasks.filter(t => t.status === 'done' || t.status === 'error');

  return (
    <div className={styles.container}>
      {/* Drop zone */}
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={mergeClasses(styles.dropZone, dragging && styles.dropZoneDragging)}
        onClick={() => fileInput.current?.click()}
      >
        <input ref={fileInput} type="file" multiple hidden onChange={onFileSelect} />
        <ArrowUploadRegular className={styles.icon} />
        <Text block weight="semibold">Drop files here or click to upload</Text>
        <Text block size={200} className={styles.subText}>
          Supports chunked upload for large files
        </Text>
      </div>

      {/* Active uploads */}
      {activeTasks.length > 0 && (
        <div className={styles.listContainer}>
          {activeTasks.map(task => (
            <div key={task.id} className={styles.listItem}>
              <Spinner size="tiny" />
              <div className={styles.taskInfo}>
                <Text truncate block size={200} weight="semibold">{task.file.name}</Text>
                <ProgressBar value={task.progress / 100} style={{ marginTop: 4 }} />
                <Text size={100} className={styles.progressText}>
                  {task.progress}%
                </Text>
              </div>
              <Tooltip content="Cancel" relationship="label">
                <Button
                  appearance="subtle"
                  size="small"
                  icon={<DismissRegular />}
                  onClick={() => void cancelTask(task)}
                />
              </Tooltip>
            </div>
          ))}
        </div>
      )}

      {/* Completed/error uploads */}
      {doneTasks.length > 0 && (
        <div className={styles.listContainer}>
          {doneTasks.map(task => (
            <div key={task.id} className={styles.listItem}>
              {task.status === 'done'
                ? <CheckmarkRegular className={styles.doneIcon} />
                : <ErrorCircleRegular className={styles.errorIcon} />
              }
              <div className={styles.taskInfo}>
                <Text truncate block size={200}>{task.file.name}</Text>
                {task.status === 'error' && (
                  <Text size={100} className={styles.errorText}>{task.error}</Text>
                )}
              </div>
              <Button appearance="subtle" size="small" icon={<DismissRegular />} onClick={() => removeTask(task.id)} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}