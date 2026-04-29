import { useEffect, useState } from "react";
import {
  Dialog,
  DialogSurface,
  DialogBody,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Spinner,
  Text,
  makeStyles,
  shorthands,
} from "@fluentui/react-components";
import {
  ArrowDownloadRegular,
  DismissRegular,
  DocumentRegular,
} from "@fluentui/react-icons";
import { formatBytes } from "../api.ts";
import { getPreviewType } from "../preview.ts";
import type { FileItem } from "../types.ts";

const TEXT_PREVIEW_LIMIT = 2 * 1024 * 1024; // 2 MB

const useStyles = makeStyles({
  surface: {
    maxWidth: "min(96vw, 1200px)",
    width: "min(96vw, 1200px)",
  },
  body: {
    display: "flex",
    flexDirection: "column",
    minHeight: 0,
  },
  title: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  viewport: {
    flex: 1,
    minHeight: "60vh",
    maxHeight: "78vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "auto",
    backgroundColor: "var(--colorNeutralBackground3)",
    ...shorthands.borderRadius("4px"),
    ...shorthands.padding("8px"),
  },
  image: {
    maxWidth: "100%",
    maxHeight: "76vh",
    objectFit: "contain",
    display: "block",
  },
  video: {
    maxWidth: "100%",
    maxHeight: "76vh",
    width: "auto",
    height: "auto",
    display: "block",
    backgroundColor: "black",
  },
  audio: {
    width: "100%",
    maxWidth: "560px",
  },
  iframe: {
    width: "100%",
    height: "76vh",
    border: 0,
    backgroundColor: "white",
    ...shorthands.borderRadius("4px"),
  },
  textBox: {
    width: "100%",
    height: "76vh",
    overflow: "auto",
    fontFamily:
      "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace",
    fontSize: "13px",
    lineHeight: 1.5,
    whiteSpace: "pre",
    wordBreak: "normal",
    backgroundColor: "var(--colorNeutralBackground1)",
    color: "var(--colorNeutralForeground1)",
    ...shorthands.padding("12px"),
    ...shorthands.borderRadius("4px"),
    ...shorthands.border("1px", "solid", "var(--colorNeutralStroke2)"),
    margin: 0,
  },
  unsupported: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "12px",
    color: "var(--colorNeutralForeground3)",
    ...shorthands.padding("48px", "24px"),
    textAlign: "center",
  },
  unsupportedIcon: {
    fontSize: "56px",
    color: "var(--colorNeutralForeground4)",
  },
  meta: {
    color: "var(--colorNeutralForeground3)",
  },
  errorText: {
    color: "var(--colorPaletteRedForeground1)",
  },
});

interface Props {
  open: boolean;
  onClose: () => void;
  file: FileItem | null;
  previewUrl: string | null;
  downloadUrl: string | null;
}

interface TextState {
  key: string;
  status: "loading" | "loaded" | "error";
  content: string;
  error: string;
}

export default function FilePreviewDialog({
  open,
  onClose,
  file,
  previewUrl,
  downloadUrl,
}: Props) {
  const styles = useStyles();
  const [textState, setTextState] = useState<TextState | null>(null);

  const previewType = file ? getPreviewType(file.mime_type, file.name) : null;
  const isTextPreview = !!(
    open &&
    file &&
    previewType === "text" &&
    previewUrl
  );
  const tooLarge = !!(isTextPreview && file && file.size > TEXT_PREVIEW_LIMIT);
  const textKey =
    isTextPreview && !tooLarge && file && previewUrl
      ? `${file.id}::${previewUrl}`
      : null;

  useEffect(() => {
    if (!textKey || !previewUrl) return;
    const ctrl = new AbortController();
    fetch(previewUrl, { credentials: "include", signal: ctrl.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error(`Failed to load (HTTP ${r.status})`);
        return r.text();
      })
      .then((t) => {
        if (ctrl.signal.aborted) return;
        setTextState({
          key: textKey,
          status: "loaded",
          content: t,
          error: "",
        });
      })
      .catch((e: unknown) => {
        if (ctrl.signal.aborted) return;
        setTextState({
          key: textKey,
          status: "error",
          content: "",
          error: e instanceof Error ? e.message : "Failed to load",
        });
      });
    return () => ctrl.abort();
  }, [textKey, previewUrl]);

  if (!file) return null;

  const currentText = textState && textState.key === textKey ? textState : null;
  const textLoading = !!textKey && !currentText;
  const textError = currentText?.status === "error" ? currentText.error : null;
  const textContent =
    currentText?.status === "loaded" ? currentText.content : null;
  const tooLargeMsg =
    tooLarge && file
      ? `File too large to preview as text (${formatBytes(file.size)}). Download to view.`
      : null;

  const renderBody = () => {
    if (!previewUrl) return null;

    if (previewType === "image") {
      return <img src={previewUrl} alt={file.name} className={styles.image} />;
    }
    if (previewType === "video") {
      return (
        <video
          src={previewUrl}
          controls
          autoPlay={false}
          className={styles.video}
        />
      );
    }
    if (previewType === "audio") {
      return <audio src={previewUrl} controls className={styles.audio} />;
    }
    if (previewType === "pdf") {
      return (
        <iframe src={previewUrl} title={file.name} className={styles.iframe} />
      );
    }
    if (previewType === "text") {
      if (tooLargeMsg)
        return <Text className={styles.errorText}>{tooLargeMsg}</Text>;
      if (textLoading) return <Spinner label="Loading…" />;
      if (textError)
        return <Text className={styles.errorText}>{textError}</Text>;
      return <pre className={styles.textBox}>{textContent ?? ""}</pre>;
    }
    return (
      <div className={styles.unsupported}>
        <DocumentRegular className={styles.unsupportedIcon} />
        <Text>Preview is not available for this file type.</Text>
        <Text size={200} className={styles.meta}>
          {file.mime_type || "Unknown type"} · {formatBytes(file.size)}
        </Text>
      </div>
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(_, d) => !d.open && onClose()}
      modalType="modal"
    >
      <DialogSurface className={styles.surface}>
        <DialogBody className={styles.body}>
          <DialogTitle className={styles.title}>{file.name}</DialogTitle>
          <DialogContent>
            <div className={styles.viewport}>{renderBody()}</div>
          </DialogContent>
          <DialogActions>
            {downloadUrl && (
              <Button
                appearance="secondary"
                icon={<ArrowDownloadRegular />}
                as="a"
                href={downloadUrl}
                download={file.name}
              >
                Download
              </Button>
            )}
            <Button
              appearance="primary"
              icon={<DismissRegular />}
              onClick={onClose}
            >
              Close
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
