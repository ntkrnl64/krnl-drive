import { useState, useRef, useCallback, useEffect } from "react";
import {
  Button,
  Text,
  ProgressBar,
  Tooltip,
  Spinner,
  makeStyles,
  shorthands,
  mergeClasses,
} from "@fluentui/react-components";
import {
  ArrowUploadRegular,
  DismissRegular,
  CheckmarkRegular,
  ErrorCircleRegular,
  ArrowSyncRegular,
} from "@fluentui/react-icons";
import {
  uploadFile,
  cancelUpload,
  listPendingUploads,
  formatBytes,
} from "../api.ts";
import type { PendingSession } from "../api.ts";
import type { UploadTask } from "../types.ts";

const useStyles = makeStyles({
  container: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  dropZone: {
    ...shorthands.border("2px", "dashed", "var(--colorNeutralStroke2)"),
    ...shorthands.borderRadius("8px"),
    ...shorthands.padding("24px", "16px"),
    textAlign: "center",
    justifyContent: "center",
    backgroundColor: "var(--colorNeutralBackground2)",
    cursor: "pointer",
    transitionProperty: "all",
    transitionDuration: "0.15s",
    "&:hover": {
      backgroundColor: "var(--colorNeutralBackground2Hover)",
    },
  },
  dropZoneDragging: {
    ...shorthands.borderColor("var(--colorBrandStroke1)"),
    backgroundColor: "var(--colorBrandBackground2)",
  },
  icon: {
    fontSize: "32px",
    color: "var(--colorBrandForeground1)",
    marginBottom: "8px",
  },
  subText: {
    color: "var(--colorNeutralForeground3)",
    marginTop: "4px",
  },
  listContainer: {
    ...shorthands.border("1px", "solid", "var(--colorNeutralStroke2)"),
    ...shorthands.borderRadius("8px"),
    overflowY: "hidden",
    overflowX: "hidden",
  },
  listItem: {
    ...shorthands.padding("10px", "12px"),
    ...shorthands.borderBottom("1px", "solid", "var(--colorNeutralStroke2)"),
    display: "flex",
    alignItems: "center",
    gap: "10px",
    "&:last-child": {
      borderBottomStyle: "none",
    },
  },
  taskInfo: {
    flexGrow: 1,
    overflowY: "hidden",
    overflowX: "hidden",
  },
  progressText: {
    color: "var(--colorNeutralForeground3)",
  },
  doneIcon: {
    color: "var(--colorPaletteGreenForeground1)",
  },
  errorIcon: {
    color: "var(--colorPaletteRedForeground1)",
  },
  errorText: {
    color: "var(--colorPaletteRedForeground1)",
  },
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
  const [pendingSessions, setPendingSessions] = useState<PendingSession[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);
  const resumeInput = useRef<HTMLInputElement>(null);
  const abortControllers = useRef<Map<string, AbortController>>(new Map());
  const resumeTarget = useRef<PendingSession | null>(null);

  // Load pending upload sessions on mount
  useEffect(() => {
    listPendingUploads()
      .then((sessions) => {
        setPendingSessions(sessions);
      })
      .catch(() => {});
  }, []);

  const addTasks = useCallback(
    (files: File[]) => {
      const newTasks: UploadTask[] = files.map((file) => ({
        id: String(taskId++),
        file,
        progress: 0,
        status: "queued",
        parentId,
      }));
      setTasks((prev) => [...prev, ...newTasks]);
      newTasks.forEach((task) => void startUpload(task));
    },
    [parentId],
  ); // eslint-disable-line react-hooks/exhaustive-deps

  const startUpload = async (
    task: UploadTask,
    resumeSession?: PendingSession,
  ) => {
    const controller = new AbortController();
    abortControllers.current.set(task.id, controller);

    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, status: "uploading" } : t)),
    );

    try {
      await uploadFile(
        task.file,
        task.parentId,
        ({ progress, sessionId }) => {
          setTasks((prev) =>
            prev.map((t) =>
              t.id === task.id ? { ...t, progress, sessionId } : t,
            ),
          );
        },
        controller.signal,
        resumeSession,
      );
      setTasks((prev) =>
        prev.map((t) =>
          t.id === task.id ? { ...t, status: "done", progress: 100 } : t,
        ),
      );
      if (resumeSession) {
        setPendingSessions((prev) =>
          prev.filter((s) => s.sessionId !== resumeSession.sessionId),
        );
      }
      onUploaded();
    } catch (e) {
      if ((e as Error).message === "Upload cancelled") {
        setTasks((prev) => prev.filter((t) => t.id !== task.id));
      } else {
        setTasks((prev) =>
          prev.map((t) =>
            t.id === task.id
              ? { ...t, status: "error", error: (e as Error).message }
              : t,
          ),
        );
      }
    } finally {
      abortControllers.current.delete(task.id);
    }
  };

  const retryTask = (task: UploadTask) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === task.id
          ? { ...t, status: "queued", progress: 0, error: undefined }
          : t,
      ),
    );
    // If the task has a sessionId, re-fetch pending sessions to get updated chunk info, then resume
    if (task.sessionId) {
      listPendingUploads()
        .then((sessions) => {
          setPendingSessions(sessions);
          const session = sessions.find((s) => s.sessionId === task.sessionId);
          void startUpload(task, session);
        })
        .catch(() => {
          void startUpload(task); // Fall back to fresh upload
        });
    } else {
      void startUpload(task);
    }
  };

  const resumeSession = (session: PendingSession) => {
    resumeTarget.current = session;
    resumeInput.current?.click();
  };

  const onResumeFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const session = resumeTarget.current;
    if (file && session) {
      if (file.size !== session.totalSize) {
        alert(
          `File size mismatch. Expected ${formatBytes(session.totalSize)} but got ${formatBytes(file.size)}. Please select the same file.`,
        );
        e.target.value = "";
        resumeTarget.current = null;
        return;
      }
      const task: UploadTask = {
        id: String(taskId++),
        file,
        sessionId: session.sessionId,
        progress: Math.round(
          (session.uploadedChunks.length / session.totalChunks) * 100,
        ),
        status: "queued",
        parentId: session.parentId,
      };
      setTasks((prev) => [...prev, task]);
      void startUpload(task, session);
    }
    e.target.value = "";
    resumeTarget.current = null;
  };

  const dismissPendingSession = async (session: PendingSession) => {
    await cancelUpload(session.sessionId).catch(() => {});
    setPendingSessions((prev) =>
      prev.filter((s) => s.sessionId !== session.sessionId),
    );
  };

  const cancelTask = async (task: UploadTask) => {
    const ctrl = abortControllers.current.get(task.id);
    if (ctrl) ctrl.abort();
    if (task.sessionId) await cancelUpload(task.sessionId).catch(() => {});
    setTasks((prev) => prev.filter((t) => t.id !== task.id));
  };

  const removeTask = (id: string) =>
    setTasks((prev) => prev.filter((t) => t.id !== id));

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
    e.target.value = "";
  };

  const activeTasks = tasks.filter(
    (t) => t.status === "uploading" || t.status === "queued",
  );
  const doneTasks = tasks.filter(
    (t) => t.status === "done" || t.status === "error",
  );

  return (
    <div className={styles.container}>
      {/* Drop zone */}
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={mergeClasses(
          styles.dropZone,
          dragging && styles.dropZoneDragging,
        )}
        onClick={() => fileInput.current?.click()}
      >
        <input
          ref={fileInput}
          type="file"
          multiple
          hidden
          onChange={onFileSelect}
        />
        <input
          ref={resumeInput}
          type="file"
          hidden
          onChange={onResumeFileSelect}
        />
        <ArrowUploadRegular className={styles.icon} />
        <Text block weight="semibold">
          Drop files here or click to upload
        </Text>
        <Text block size={200} className={styles.subText}>
          Supports chunked upload for large files
        </Text>
      </div>

      {/* Pending sessions from previous page loads */}
      {pendingSessions.length > 0 && (
        <div className={styles.listContainer}>
          {pendingSessions.map((session) => (
            <div key={session.sessionId} className={styles.listItem}>
              <ArrowSyncRegular
                style={{ color: "var(--colorBrandForeground1)" }}
              />
              <div className={styles.taskInfo}>
                <Text truncate block size={200} weight="semibold">
                  {session.filename}
                </Text>
                <ProgressBar
                  value={session.uploadedChunks.length / session.totalChunks}
                  style={{ marginTop: 4 }}
                />
                <Text size={100} className={styles.progressText}>
                  {formatBytes(session.totalSize)} —{" "}
                  {Math.round(
                    (session.uploadedChunks.length / session.totalChunks) * 100,
                  )}
                  % uploaded, select file to resume
                </Text>
              </div>
              <Tooltip content="Resume" relationship="label">
                <Button
                  appearance="subtle"
                  size="small"
                  icon={<ArrowSyncRegular />}
                  onClick={() => resumeSession(session)}
                />
              </Tooltip>
              <Tooltip content="Discard" relationship="label">
                <Button
                  appearance="subtle"
                  size="small"
                  icon={<DismissRegular />}
                  onClick={() => void dismissPendingSession(session)}
                />
              </Tooltip>
            </div>
          ))}
        </div>
      )}

      {/* Active uploads */}
      {activeTasks.length > 0 && (
        <div className={styles.listContainer}>
          {activeTasks.map((task) => (
            <div key={task.id} className={styles.listItem}>
              <Spinner size="tiny" />
              <div className={styles.taskInfo}>
                <Text truncate block size={200} weight="semibold">
                  {task.file.name}
                </Text>
                <ProgressBar
                  value={task.progress / 100}
                  style={{ marginTop: 4 }}
                />
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
          {doneTasks.map((task) => (
            <div key={task.id} className={styles.listItem}>
              {task.status === "done" ? (
                <CheckmarkRegular className={styles.doneIcon} />
              ) : (
                <ErrorCircleRegular className={styles.errorIcon} />
              )}
              <div className={styles.taskInfo}>
                <Text truncate block size={200}>
                  {task.file.name}
                </Text>
                {task.status === "error" && (
                  <Text size={100} className={styles.errorText}>
                    {task.error}
                  </Text>
                )}
              </div>
              {task.status === "error" && (
                <Tooltip content="Retry" relationship="label">
                  <Button
                    appearance="subtle"
                    size="small"
                    icon={<ArrowSyncRegular />}
                    onClick={() => retryTask(task)}
                  />
                </Tooltip>
              )}
              <Button
                appearance="subtle"
                size="small"
                icon={<DismissRegular />}
                onClick={() => removeTask(task.id)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
