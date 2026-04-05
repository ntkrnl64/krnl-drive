import {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
  useCallback,
} from "react";
import type { ReactNode } from "react";
import { uploadFile, cancelUpload, listPendingUploads } from "../api.ts";
import type { PendingSession } from "../api.ts";
import type { UploadTask } from "../types.ts";

let taskIdCounter = 0;

interface UploadContextValue {
  tasks: UploadTask[];
  pendingSessions: PendingSession[];
  addFiles: (files: File[], parentId: string | null) => void;
  cancelTask: (task: UploadTask) => Promise<void>;
  removeTask: (id: string) => void;
  retryTask: (task: UploadTask) => void;
  resumeSession: (session: PendingSession, file: File) => void;
  dismissSession: (session: PendingSession) => Promise<void>;
}

const UploadContext = createContext<UploadContextValue>(null!);

export function useUpload() {
  return useContext(UploadContext);
}

export function UploadProvider({
  onUploaded,
  children,
}: {
  onUploaded: () => void;
  children: ReactNode;
}) {
  const [tasks, setTasks] = useState<UploadTask[]>([]);
  const [pendingSessions, setPendingSessions] = useState<PendingSession[]>([]);
  const abortControllers = useRef<Map<string, AbortController>>(new Map());
  const onUploadedRef = useRef(onUploaded);
  onUploadedRef.current = onUploaded;

  useEffect(() => {
    listPendingUploads()
      .then((sessions) => setPendingSessions(sessions))
      .catch(() => {});
  }, []);

  const startUpload = useCallback(
    async (task: UploadTask, resume?: PendingSession) => {
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
          resume,
        );
        setTasks((prev) =>
          prev.map((t) =>
            t.id === task.id ? { ...t, status: "done", progress: 100 } : t,
          ),
        );
        if (resume) {
          setPendingSessions((prev) =>
            prev.filter((s) => s.sessionId !== resume.sessionId),
          );
        }
        onUploadedRef.current();
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
    },
    [],
  );

  const addFiles = useCallback(
    (files: File[], parentId: string | null) => {
      const newTasks: UploadTask[] = files.map((file) => ({
        id: String(taskIdCounter++),
        file,
        progress: 0,
        status: "queued" as const,
        parentId,
      }));
      setTasks((prev) => [...prev, ...newTasks]);
      newTasks.forEach((task) => void startUpload(task));
    },
    [startUpload],
  );

  const cancelTask = useCallback(async (task: UploadTask) => {
    const ctrl = abortControllers.current.get(task.id);
    if (ctrl) ctrl.abort();
    if (task.sessionId) await cancelUpload(task.sessionId).catch(() => {});
    setTasks((prev) => prev.filter((t) => t.id !== task.id));
  }, []);

  const removeTask = useCallback((id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const retryTask = useCallback(
    (task: UploadTask) => {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === task.id
            ? { ...t, status: "queued" as const, progress: 0, error: undefined }
            : t,
        ),
      );
      if (task.sessionId) {
        listPendingUploads()
          .then((sessions) => {
            setPendingSessions(sessions);
            const session = sessions.find(
              (s) => s.sessionId === task.sessionId,
            );
            void startUpload(task, session);
          })
          .catch(() => {
            void startUpload(task);
          });
      } else {
        void startUpload(task);
      }
    },
    [startUpload],
  );

  const resumeSession = useCallback(
    (session: PendingSession, file: File) => {
      const task: UploadTask = {
        id: String(taskIdCounter++),
        file,
        sessionId: session.sessionId,
        progress: Math.round(
          (session.uploadedChunks.length / session.totalChunks) * 100,
        ),
        status: "queued",
        parentId: session.parentId,
      };
      setPendingSessions((prev) =>
        prev.filter((s) => s.sessionId !== session.sessionId),
      );
      setTasks((prev) => [...prev, task]);
      void startUpload(task, session);
    },
    [startUpload],
  );

  const dismissSession = useCallback(async (session: PendingSession) => {
    await cancelUpload(session.sessionId).catch(() => {});
    setPendingSessions((prev) =>
      prev.filter((s) => s.sessionId !== session.sessionId),
    );
  }, []);

  return (
    <UploadContext.Provider
      value={{
        tasks,
        pendingSessions,
        addFiles,
        cancelTask,
        removeTask,
        retryTask,
        resumeSession,
        dismissSession,
      }}
    >
      {children}
    </UploadContext.Provider>
  );
}
