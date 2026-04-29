import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import {
  Title2,
  Title3,
  Text,
  Button,
  Spinner,
  Card,
  Badge,
  Divider,
  Avatar,
  makeStyles,
  shorthands,
} from "@fluentui/react-components";
import {
  ArrowDownloadRegular,
  DocumentRegular,
  LinkDismissRegular,
  ImageRegular,
  VideoRegular,
  MusicNote2Regular,
  DocumentPdfRegular,
  FolderZipRegular,
  FolderRegular,
  FolderOpenRegular,
  ArrowUpRegular,
  HomeRegular,
  EyeRegular,
} from "@fluentui/react-icons";
import { sharesApi, getConfig, formatBytes, formatDate } from "../api.ts";
import { isPreviewable } from "../preview.ts";
import FilePreviewDialog from "../components/FilePreviewDialog.tsx";
import type { Share, FileItem } from "../types.ts";

const useStyles = makeStyles({
  fullScreenCenter: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  pageContainer: {
    minHeight: "100vh",
    background:
      "radial-gradient(circle at 20% 0%, var(--colorBrandBackground2) 0%, transparent 45%)," +
      "radial-gradient(circle at 80% 100%, var(--colorBrandBackground2) 0%, transparent 45%)," +
      "var(--colorNeutralBackground2)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    ...shorthands.padding("24px"),
  },
  errorCard: {
    ...shorthands.padding("40px"),
    textAlign: "center",
    maxWidth: "420px",
    boxShadow: "0 8px 32px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.05)",
  },
  errorIcon: {
    fontSize: "64px",
    color: "var(--colorNeutralForeground3)",
    marginBottom: "16px",
  },
  errorText: {
    color: "var(--colorNeutralForeground3)",
    marginTop: "8px",
    display: "block",
  },
  mainCard: {
    maxWidth: "480px",
    width: "100%",
    ...shorthands.padding("32px"),
    boxShadow: "0 12px 40px rgba(0,0,0,0.10), 0 1px 2px rgba(0,0,0,0.05)",
    ...shorthands.borderRadius("12px"),
  },
  mainCardFolder: {
    maxWidth: "720px",
    width: "100%",
    ...shorthands.padding("32px"),
    boxShadow: "0 12px 40px rgba(0,0,0,0.10), 0 1px 2px rgba(0,0,0,0.05)",
    ...shorthands.borderRadius("12px"),
  },
  fileIconContainer: {
    textAlign: "center",
    marginBottom: "24px",
  },
  imageThumbWrap: {
    width: "100%",
    maxHeight: "260px",
    overflow: "hidden",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "var(--colorNeutralBackground3)",
    ...shorthands.borderRadius("8px"),
    marginBottom: "20px",
  },
  imageThumb: {
    maxWidth: "100%",
    maxHeight: "260px",
    objectFit: "contain",
    display: "block",
    cursor: "zoom-in",
  },
  iconBadge: {
    width: "84px",
    height: "84px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto",
    ...shorthands.borderRadius("18px"),
    backgroundColor: "var(--colorNeutralBackground3)",
    color: "var(--colorNeutralForeground2)",
    marginBottom: "12px",
  },
  fileTitle: {
    marginTop: "12px",
    wordBreak: "break-word",
  },
  detailsContainer: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    marginBottom: "24px",
  },
  detailRow: {
    display: "flex",
    justifyContent: "space-between",
  },
  detailLabel: {
    color: "var(--colorNeutralForeground3)",
  },
  badgesContainer: {
    display: "flex",
    gap: "8px",
    marginTop: "16px",
    marginBottom: "16px",
    flexWrap: "wrap",
  },
  downloadButton: {
    width: "100%",
  },
  footerTextContainer: {
    textAlign: "center",
    marginTop: "24px",
  },
  footerText: {
    color: "var(--colorNeutralForeground4)",
  },
  creatorRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    marginTop: "20px",
    paddingTop: "16px",
    borderTop: "1px solid var(--colorNeutralStroke2)",
  },
  documentIconLarge: {
    fontSize: "44px",
    color: "var(--colorNeutralForeground2)",
  },
  folderHeader: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginBottom: "12px",
  },
  folderBreadcrumb: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
    flexWrap: "wrap",
    flex: "1",
    minWidth: "0",
  },
  breadcrumbSep: {
    color: "var(--colorNeutralForeground3)",
  },
  breadcrumbBtn: {
    cursor: "pointer",
    color: "var(--colorBrandForeground1)",
    background: "none",
    border: "none",
    padding: "0 2px",
    fontFamily: "inherit",
    fontSize: "inherit",
    "&:hover": { textDecoration: "underline" },
  },
  breadcrumbCurrent: {
    fontWeight: 600,
    color: "var(--colorNeutralForeground1)",
  },
  fileList: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    maxHeight: "360px",
    overflowY: "auto",
    ...shorthands.border("1px", "solid", "var(--colorNeutralStroke2)"),
    ...shorthands.borderRadius("4px"),
    ...shorthands.padding("4px"),
    marginBottom: "16px",
  },
  fileRow: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    ...shorthands.padding("8px"),
    ...shorthands.borderRadius("4px"),
    "&:hover": { backgroundColor: "var(--colorNeutralBackground1Hover)" },
  },
  fileRowFolder: {
    cursor: "pointer",
  },
  fileName: {
    flex: "1",
    minWidth: "0",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  fileMeta: {
    color: "var(--colorNeutralForeground3)",
    flexShrink: 0,
  },
  emptyState: {
    ...shorthands.padding("24px"),
    textAlign: "center",
    color: "var(--colorNeutralForeground3)",
  },
});

function FileTypeIcon({
  mimeType,
  styles,
}: {
  mimeType: string | null;
  styles: ReturnType<typeof useStyles>;
}) {
  const mime = mimeType ?? "";
  if (mime.startsWith("image/"))
    return <ImageRegular className={styles.documentIconLarge} />;
  if (mime.startsWith("video/"))
    return <VideoRegular className={styles.documentIconLarge} />;
  if (mime.startsWith("audio/"))
    return <MusicNote2Regular className={styles.documentIconLarge} />;
  if (mime.includes("pdf"))
    return <DocumentPdfRegular className={styles.documentIconLarge} />;
  if (mime.includes("zip") || mime.includes("tar"))
    return <FolderZipRegular className={styles.documentIconLarge} />;
  return <DocumentRegular className={styles.documentIconLarge} />;
}

function FileRowIcon({ item }: { item: FileItem }) {
  if (item.type === "folder") return <FolderRegular />;
  const mime = item.mime_type ?? "";
  if (mime.startsWith("image/")) return <ImageRegular />;
  if (mime.startsWith("video/")) return <VideoRegular />;
  if (mime.startsWith("audio/")) return <MusicNote2Regular />;
  if (mime.includes("pdf")) return <DocumentPdfRegular />;
  if (mime.includes("zip") || mime.includes("tar")) return <FolderZipRegular />;
  return <DocumentRegular />;
}

interface BreadcrumbEntry {
  id: string;
  name: string;
}

function FolderBrowser({
  token,
  rootFile,
  styles,
}: {
  token: string;
  rootFile: FileItem;
  styles: ReturnType<typeof useStyles>;
}) {
  const [breadcrumb, setBreadcrumb] = useState<BreadcrumbEntry[]>([
    { id: rootFile.id, name: rootFile.name },
  ]);
  const [items, setItems] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewItem, setPreviewItem] = useState<FileItem | null>(null);

  const currentId = breadcrumb[breadcrumb.length - 1].id;

  const loadFolder = useCallback(
    async (folderId: string) => {
      setLoading(true);
      try {
        const res = await sharesApi.browse(token, folderId);
        setItems(res.items);
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    },
    [token],
  );

  useEffect(() => {
    void loadFolder(currentId);
  }, [currentId, loadFolder]);

  const navigateTo = (entry: BreadcrumbEntry) => {
    const idx = breadcrumb.findIndex((b) => b.id === entry.id);
    if (idx !== -1) {
      setBreadcrumb(breadcrumb.slice(0, idx + 1));
    } else {
      setBreadcrumb([...breadcrumb, entry]);
    }
  };

  return (
    <>
      <div className={styles.folderHeader}>
        <Button
          appearance="subtle"
          size="small"
          icon={<ArrowUpRegular />}
          onClick={() => setBreadcrumb((bc) => bc.slice(0, -1))}
          disabled={breadcrumb.length <= 1}
        />
        <nav className={styles.folderBreadcrumb} aria-label="Folder path">
          {breadcrumb.map((entry, i) => (
            <span
              key={entry.id}
              style={{ display: "flex", alignItems: "center", gap: 4 }}
            >
              {i > 0 && <span className={styles.breadcrumbSep}>/</span>}
              {i === 0 && (
                <HomeRegular style={{ fontSize: 14, marginRight: 2 }} />
              )}
              {i < breadcrumb.length - 1 ? (
                <button
                  className={styles.breadcrumbBtn}
                  onClick={() => navigateTo(entry)}
                >
                  {entry.name}
                </button>
              ) : (
                <span className={styles.breadcrumbCurrent}>{entry.name}</span>
              )}
            </span>
          ))}
        </nav>
      </div>

      <div className={styles.fileList}>
        {loading ? (
          <div className={styles.emptyState}>
            <Spinner size="tiny" />
          </div>
        ) : items.length === 0 ? (
          <div className={styles.emptyState}>
            <Text size={200}>Empty folder</Text>
          </div>
        ) : (
          items.map((item) => {
            const previewable =
              item.type === "file" && isPreviewable(item.mime_type, item.name);
            const clickable = item.type === "folder" || previewable;
            return (
              <div
                key={item.id}
                className={`${styles.fileRow}${clickable ? ` ${styles.fileRowFolder}` : ""}`}
                onClick={
                  item.type === "folder"
                    ? () => navigateTo({ id: item.id, name: item.name })
                    : previewable
                      ? () => setPreviewItem(item)
                      : undefined
                }
              >
                <FileRowIcon item={item} />
                <Text className={styles.fileName}>{item.name}</Text>
                {item.type === "file" && (
                  <Text size={100} className={styles.fileMeta}>
                    {formatBytes(item.size)}
                  </Text>
                )}
                {previewable && (
                  <Button
                    appearance="subtle"
                    size="small"
                    icon={<EyeRegular />}
                    onClick={(e) => {
                      e.stopPropagation();
                      setPreviewItem(item);
                    }}
                  >
                    Preview
                  </Button>
                )}
                {item.type === "file" && (
                  <Button
                    appearance="subtle"
                    size="small"
                    icon={<ArrowDownloadRegular />}
                    as="a"
                    href={sharesApi.fileDownloadUrl(token, item.id)}
                    download={item.name}
                    onClick={(e) => e.stopPropagation()}
                  >
                    Download
                  </Button>
                )}
                {item.type === "folder" && (
                  <ArrowUpRegular
                    style={{
                      transform: "rotate(90deg)",
                      color: "var(--colorNeutralForeground3)",
                      fontSize: 14,
                    }}
                  />
                )}
              </div>
            );
          })
        )}
      </div>

      <FilePreviewDialog
        file={previewItem}
        open={!!previewItem}
        onClose={() => setPreviewItem(null)}
        previewUrl={
          previewItem ? sharesApi.filePreviewUrl(token, previewItem.id) : null
        }
        downloadUrl={
          previewItem ? sharesApi.fileDownloadUrl(token, previewItem.id) : null
        }
      />
    </>
  );
}

export default function SharePage() {
  const styles = useStyles();
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<{
    share: Share;
    file: FileItem;
    display?: { title: string; description: string };
    creator?: { username: string; avatarUrl: string | null };
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [siteName, setSiteName] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [renderedAt] = useState(() => Date.now());

  useEffect(() => {
    getConfig()
      .then((c) => setSiteName(c.siteName))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!token) return;
    sharesApi
      .getPublic(token)
      .then((res) => setData(res))
      .catch((e) => setError(e instanceof Error ? e.message : "Not found"))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className={styles.fullScreenCenter}>
        <Spinner label="Loading share..." size="large" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className={styles.fullScreenCenter}>
        <Card className={styles.errorCard}>
          <LinkDismissRegular className={styles.errorIcon} />
          <Title2>Share not available</Title2>
          <Text className={styles.errorText}>
            {error ?? "This share link is invalid or has expired."}
          </Text>
        </Card>
      </div>
    );
  }

  const { share, file, display, creator } = data;
  const isFolder = file.type === "folder";
  const viewsLeft =
    share.max_views !== null ? share.max_views - share.view_count : null;
  const downloadsLeft =
    share.max_downloads !== null
      ? share.max_downloads - share.download_count
      : null;

  const isImage = !isFolder && (file.mime_type ?? "").startsWith("image/");

  return (
    <div className={styles.pageContainer}>
      <Card className={isFolder ? styles.mainCardFolder : styles.mainCard}>
        {/* Inline image preview, otherwise badge icon */}
        {isImage && token && (
          <div
            className={styles.imageThumbWrap}
            onClick={() => setPreviewOpen(true)}
            role="button"
            tabIndex={0}
          >
            <img
              src={sharesApi.previewUrl(token)}
              alt={file.name}
              className={styles.imageThumb}
            />
          </div>
        )}

        {/* Icon + title */}
        <div className={styles.fileIconContainer}>
          {!isImage && (
            <div className={styles.iconBadge}>
              {isFolder ? (
                <FolderOpenRegular className={styles.documentIconLarge} />
              ) : (
                <FileTypeIcon mimeType={file.mime_type} styles={styles} />
              )}
            </div>
          )}
          <Title2 className={styles.fileTitle}>
            {display?.title || file.name}
          </Title2>
          {display?.description && (
            <Text
              block
              style={{ marginTop: 8, color: "var(--colorNeutralForeground2)" }}
            >
              {display.description}
            </Text>
          )}
          {isFolder && (
            <Text
              block
              style={{ marginTop: 4, color: "var(--colorNeutralForeground3)" }}
            >
              Shared Folder
            </Text>
          )}
        </div>

        {/* Folder browser */}
        {isFolder && token && (
          <>
            <Title3 style={{ marginBottom: 8 }}>Contents</Title3>
            <FolderBrowser token={token} rootFile={file} styles={styles} />
          </>
        )}

        {/* File details (files only) */}
        {!isFolder && (
          <div className={styles.detailsContainer}>
            <div className={styles.detailRow}>
              <Text className={styles.detailLabel}>Size</Text>
              <Text weight="semibold">{formatBytes(file.size)}</Text>
            </div>
            {file.mime_type && (
              <div className={styles.detailRow}>
                <Text className={styles.detailLabel}>Type</Text>
                <Text weight="semibold">{file.mime_type}</Text>
              </div>
            )}
            <div className={styles.detailRow}>
              <Text className={styles.detailLabel}>Uploaded</Text>
              <Text weight="semibold">{formatDate(file.created_at)}</Text>
            </div>
          </div>
        )}

        <Divider />

        {/* Share stats */}
        <div className={styles.badgesContainer}>
          {share.expires_at && (
            <Badge
              color={renderedAt < share.expires_at ? "warning" : "danger"}
              size="small"
            >
              Expires {new Date(share.expires_at).toLocaleDateString()}
            </Badge>
          )}
          {viewsLeft !== null && (
            <Badge color="informative" size="small">
              {viewsLeft} views remaining
            </Badge>
          )}
          {downloadsLeft !== null && (
            <Badge color="informative" size="small">
              {downloadsLeft} downloads remaining
            </Badge>
          )}
          {!share.expires_at &&
            viewsLeft === null &&
            downloadsLeft === null && (
              <Badge color="success" size="small">
                No limits
              </Badge>
            )}
        </div>

        {/* Action buttons (files only) */}
        {!isFolder && (
          <div style={{ display: "flex", gap: 8, flexDirection: "column" }}>
            {isPreviewable(file.mime_type, file.name) && (
              <Button
                appearance="secondary"
                size="large"
                icon={<EyeRegular />}
                onClick={() => setPreviewOpen(true)}
                className={styles.downloadButton}
              >
                Preview
              </Button>
            )}
            <Button
              appearance="primary"
              size="large"
              icon={<ArrowDownloadRegular />}
              as="a"
              href={sharesApi.downloadUrl(share.token)}
              download={file.name}
              className={styles.downloadButton}
            >
              Download {file.name}
            </Button>
          </div>
        )}

        {!isFolder && (
          <FilePreviewDialog
            file={file}
            open={previewOpen}
            onClose={() => setPreviewOpen(false)}
            previewUrl={sharesApi.previewUrl(share.token)}
            downloadUrl={sharesApi.downloadUrl(share.token)}
          />
        )}

        {creator?.username && (
          <div className={styles.creatorRow}>
            <Avatar
              name={creator.username}
              image={creator.avatarUrl ? { src: creator.avatarUrl } : undefined}
              size={24}
            />
            <Text
              size={200}
              style={{ color: "var(--colorNeutralForeground3)" }}
            >
              Shared by <strong>{creator.username}</strong>
            </Text>
          </div>
        )}

        <div className={styles.footerTextContainer}>
          <Text size={200} className={styles.footerText}>
            Shared via {siteName}
          </Text>
        </div>
      </Card>
    </div>
  );
}
