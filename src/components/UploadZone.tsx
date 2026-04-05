import { useState, useRef } from "react";
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
import { formatBytes } from "../api.ts";
import type { PendingSession } from "../api.ts";
import { useUpload } from "../contexts/UploadContext.tsx";

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
}

export default function UploadZone({ parentId }: UploadZoneProps) {
  const styles = useStyles();
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const resumeInput = useRef<HTMLInputElement>(null);
  const resumeTarget = useRef<PendingSession | null>(null);

  const {
    tasks,
    pendingSessions,
    addFiles,
    cancelTask,
    removeTask,
    retryTask,
    resumeSession,
    dismissSession,
  } = useUpload();

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  };

  const onDragLeave = () => setDragging(false);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) addFiles(files, parentId);
  };

  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) addFiles(files, parentId);
    e.target.value = "";
  };

  const onResumeClick = (session: PendingSession) => {
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
      resumeSession(session, file);
    }
    e.target.value = "";
    resumeTarget.current = null;
  };

  const activeTasks = tasks.filter(
    (t) => t.status === "uploading" || t.status === "queued",
  );
  const doneTasks = tasks.filter(
    (t) => t.status === "done" || t.status === "error",
  );

  return (
    <div className={styles.container}>
      {/* Hidden file input for resume (outside drop zone to avoid click conflicts) */}
      <input
        ref={resumeInput}
        type="file"
        hidden
        onChange={onResumeFileSelect}
      />

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
                  onClick={() => onResumeClick(session)}
                />
              </Tooltip>
              <Tooltip content="Discard" relationship="label">
                <Button
                  appearance="subtle"
                  size="small"
                  icon={<DismissRegular />}
                  onClick={() => void dismissSession(session)}
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
