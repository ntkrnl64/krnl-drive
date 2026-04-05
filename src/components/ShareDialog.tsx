import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogSurface,
  DialogTitle,
  DialogBody,
  DialogActions,
  DialogContent,
  Button,
  Field,
  Input,
  Spinner,
  Text,
  Badge,
  Tooltip,
  Divider,
  DataGrid,
  DataGridBody,
  DataGridRow,
  DataGridCell,
  DataGridHeader,
  DataGridHeaderCell,
  createTableColumn,
  TableCellLayout,
  makeStyles,
} from "@fluentui/react-components";
import type { TableColumnDefinition } from "@fluentui/react-components";
import {
  CopyRegular,
  DeleteRegular,
  LinkRegular,
  ArrowDownloadRegular,
  CheckmarkRegular,
  AddRegular,
} from "@fluentui/react-icons";
import { sharesApi, adminApi } from "../api.ts";
import type { Share, FileItem } from "../types.ts";
import { useAuth } from "../contexts/AuthContext.tsx";

const useStyles = makeStyles({
  dialogSurface: {
    maxWidth: "700px",
    width: "90vw",
  },
  createSection: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    marginBottom: "16px",
  },
  formGroup: {
    display: "flex",
    gap: "12px",
    flexWrap: "wrap",
  },
  field: {
    flexGrow: 1,
    minWidth: "140px",
  },
  createButton: {
    alignSelf: "flex-start",
  },
  existingSection: {
    marginTop: "16px",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  loadingContainer: {
    textAlign: "center",
    paddingTop: "24px",
    paddingBottom: "24px",
  },
  emptyText: {
    color: "var(--colorNeutralForeground3)",
    display: "block",
    marginTop: "8px",
  },
  dataGrid: {
    marginTop: "8px",
  },
  linksContainer: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  linkRow: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
  },
  linkIcon: {
    fontSize: "12px",
    color: "var(--colorBrandForeground1)",
  },
  downloadIcon: {
    fontSize: "12px",
    color: "var(--colorNeutralForeground3)",
  },
  linkText: {
    maxWidth: "160px",
  },
  downloadText: {
    maxWidth: "160px",
    color: "var(--colorNeutralForeground3)",
  },
});

interface ShareDialogProps {
  file: FileItem | null;
  open: boolean;
  onClose: () => void;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <Tooltip content={copied ? "Copied!" : "Copy"} relationship="label">
      <Button
        appearance="subtle"
        size="small"
        icon={copied ? <CheckmarkRegular /> : <CopyRegular />}
        onClick={copy}
      />
    </Tooltip>
  );
}

export default function ShareDialog({ file, open, onClose }: ShareDialogProps) {
  const styles = useStyles();
  const { user } = useAuth();
  const [shares, setShares] = useState<Share[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [settings, setSettings] = useState<Record<string, string>>({});

  // Create form state
  const [customTitle, setCustomTitle] = useState("");
  const [customDescription, setCustomDescription] = useState("");
  const [expiresIn, setExpiresIn] = useState("168"); // hours
  const [maxViews, setMaxViews] = useState("0");
  const [maxDownloads, setMaxDownloads] = useState("0");

  const load = useCallback(async () => {
    if (!file) return;
    setLoading(true);
    try {
      const [sharesRes, settingsRes] = await Promise.all([
        sharesApi.list(file.id),
        adminApi
          .getSettings()
          .catch(() => ({ settings: {} as Record<string, string> })),
      ]);
      setShares(sharesRes.shares);
      setSettings(settingsRes.settings);
      setExpiresIn(settingsRes.settings.default_share_expiry_hours ?? "168");
      setMaxViews(settingsRes.settings.default_max_views ?? "0");
      setMaxDownloads(settingsRes.settings.default_max_downloads ?? "0");
    } finally {
      setLoading(false);
    }
  }, [file]);

  useEffect(() => {
    if (open && file) void load();
  }, [open, file, load]);

  const handleCreate = async () => {
    if (!file) return;
    setCreating(true);
    try {
      const expiresInSec =
        parseInt(expiresIn) > 0 ? parseInt(expiresIn) * 3600 : null;
      const mv = parseInt(maxViews) || null;
      const md = parseInt(maxDownloads) || null;
      await sharesApi.create(file.id, {
        customTitle: customTitle.trim() || null,
        customDescription: customDescription.trim() || null,
        expiresIn: expiresInSec,
        maxViews: mv,
        maxDownloads: md,
      });
      setCustomTitle("");
      setCustomDescription("");
      await load();
    } catch (e) {
      console.error(e);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    await sharesApi.delete(id);
    setShares((prev) => prev.filter((s) => s.id !== id));
  };

  const shareUrl = (token: string) =>
    `${window.location.origin}/share/${token}`;
  const downloadUrl = (token: string) => `/api/share/${token}/download`;

  const isExpired = (share: Share) =>
    share.expires_at !== null && Date.now() > share.expires_at;

  const isLimitReached = (share: Share) =>
    (share.max_views !== null && share.view_count >= share.max_views) ||
    (share.max_downloads !== null &&
      share.download_count >= share.max_downloads);

  const columns: TableColumnDefinition<Share>[] = [
    createTableColumn<Share>({
      columnId: "status",
      renderHeaderCell: () => "Status",
      renderCell: (share) => (
        <TableCellLayout>
          {isExpired(share) || isLimitReached(share) ? (
            <Badge color="danger" size="small">
              Expired
            </Badge>
          ) : (
            <Badge color="success" size="small">
              Active
            </Badge>
          )}
        </TableCellLayout>
      ),
    }),
    createTableColumn<Share>({
      columnId: "links",
      renderHeaderCell: () => "Links",
      renderCell: (share) => (
        <TableCellLayout>
          <div className={styles.linksContainer}>
            <div className={styles.linkRow}>
              <LinkRegular className={styles.linkIcon} />
              <Text size={100} truncate className={styles.linkText}>
                {shareUrl(share.token)}
              </Text>
              <CopyButton text={shareUrl(share.token)} />
            </div>
            <div className={styles.linkRow}>
              <ArrowDownloadRegular className={styles.downloadIcon} />
              <Text size={100} truncate className={styles.downloadText}>
                Direct download
              </Text>
              <CopyButton
                text={`${window.location.origin}${downloadUrl(share.token)}`}
              />
            </div>
          </div>
        </TableCellLayout>
      ),
    }),
    createTableColumn<Share>({
      columnId: "stats",
      renderHeaderCell: () => "Views / Downloads",
      renderCell: (share) => (
        <TableCellLayout>
          <Text size={200}>
            {share.view_count}
            {share.max_views !== null ? `/${share.max_views}` : ""} ·{" "}
            {share.download_count}
            {share.max_downloads !== null ? `/${share.max_downloads}` : ""}
          </Text>
        </TableCellLayout>
      ),
    }),
    createTableColumn<Share>({
      columnId: "expires",
      renderHeaderCell: () => "Expires",
      renderCell: (share) => (
        <TableCellLayout>
          <Text size={200}>
            {share.expires_at
              ? new Date(share.expires_at).toLocaleDateString()
              : "Never"}
          </Text>
        </TableCellLayout>
      ),
    }),
    createTableColumn<Share>({
      columnId: "actions",
      renderHeaderCell: () => "",
      renderCell: (share) => (
        <TableCellLayout>
          <Button
            appearance="subtle"
            size="small"
            icon={<DeleteRegular />}
            onClick={() => void handleDelete(share.id)}
          />
        </TableCellLayout>
      ),
    }),
  ];

  return (
    <Dialog open={open} onOpenChange={(_, d) => !d.open && onClose()}>
      <DialogSurface className={styles.dialogSurface}>
        <DialogBody>
          <DialogTitle>Share "{file?.name}"</DialogTitle>
          <DialogContent>
            {/* Create new share */}
            {user?.role !== "guest" && (
              <div className={styles.createSection}>
                <Text weight="semibold">Create new share link</Text>
                <div className={styles.formGroup}>
                  <Field
                    label="Custom Title (optional)"
                    className={styles.field}
                    style={{ minWidth: "100%" }}
                  >
                    <Input
                      value={customTitle}
                      onChange={(_, d) => setCustomTitle(d.value)}
                      placeholder="Leave blank to use defaults or file name"
                    />
                  </Field>
                  <Field
                    label="Custom Description (optional)"
                    className={styles.field}
                    style={{ minWidth: "100%" }}
                  >
                    <Input
                      value={customDescription}
                      onChange={(_, d) => setCustomDescription(d.value)}
                      placeholder="Leave blank to use defaults"
                    />
                  </Field>
                  <Field
                    label="Expires in (hours, 0=never)"
                    className={styles.field}
                  >
                    <Input
                      type="number"
                      min="0"
                      value={expiresIn}
                      onChange={(_, d) => setExpiresIn(d.value)}
                      placeholder={settings.default_share_expiry_hours ?? "168"}
                    />
                  </Field>
                  <Field
                    label="Max views (0=unlimited)"
                    className={styles.field}
                  >
                    <Input
                      type="number"
                      min="0"
                      value={maxViews}
                      onChange={(_, d) => setMaxViews(d.value)}
                      placeholder={settings.default_max_views ?? "0"}
                    />
                  </Field>
                  <Field
                    label="Max downloads (0=unlimited)"
                    className={styles.field}
                  >
                    <Input
                      type="number"
                      min="0"
                      value={maxDownloads}
                      onChange={(_, d) => setMaxDownloads(d.value)}
                      placeholder={settings.default_max_downloads ?? "0"}
                    />
                  </Field>
                </div>
                <Button
                  appearance="primary"
                  icon={creating ? <Spinner size="tiny" /> : <AddRegular />}
                  onClick={handleCreate}
                  disabled={creating}
                  className={styles.createButton}
                >
                  Create share link
                </Button>
              </div>
            )}

            <Divider />

            {/* Existing shares */}
            <div className={styles.existingSection}>
              <Text weight="semibold">
                Existing share links ({shares.length})
              </Text>
              {loading ? (
                <div className={styles.loadingContainer}>
                  <Spinner />
                </div>
              ) : shares.length === 0 ? (
                <Text className={styles.emptyText}>No share links yet</Text>
              ) : (
                <DataGrid
                  items={shares}
                  columns={columns}
                  className={styles.dataGrid}
                >
                  <DataGridHeader>
                    <DataGridRow>
                      {({ renderHeaderCell }) => (
                        <DataGridHeaderCell>
                          {renderHeaderCell()}
                        </DataGridHeaderCell>
                      )}
                    </DataGridRow>
                  </DataGridHeader>
                  <DataGridBody<Share>>
                    {({ item, rowId }) => (
                      <DataGridRow<Share> key={rowId}>
                        {({ renderCell }) => (
                          <DataGridCell>{renderCell(item)}</DataGridCell>
                        )}
                      </DataGridRow>
                    )}
                  </DataGridBody>
                </DataGrid>
              )}
            </div>
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose}>Close</Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
