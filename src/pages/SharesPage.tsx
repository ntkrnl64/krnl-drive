import { useState, useEffect, useCallback } from "react";
import {
  Title2,
  Text,
  Button,
  Spinner,
  DataGrid,
  DataGridBody,
  DataGridRow,
  DataGridCell,
  DataGridHeader,
  DataGridHeaderCell,
  createTableColumn,
  TableCellLayout,
  Badge,
  Tooltip,
  Toast,
  useToastController,
  MessageBar,
  MessageBarBody,
  makeStyles,
  shorthands,
} from "@fluentui/react-components";
import {
  DeleteRegular,
  CopyRegular,
  LinkRegular,
  ArrowDownloadRegular,
  CheckmarkRegular,
} from "@fluentui/react-icons";
import { sharesApi } from "../api.ts";
import type { Share } from "../types.ts";

const useStyles = makeStyles({
  root: {
    ...shorthands.padding("24px", "16px"),
  },
  title: {
    marginBottom: "24px",
  },
  loadingContainer: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    height: "200px",
  },
  emptyContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    ...shorthands.padding("72px", "24px"),
  },
  emptyIconWrap: {
    width: "96px",
    height: "96px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    ...shorthands.borderRadius("50%"),
    backgroundColor: "var(--colorNeutralBackground2)",
    marginBottom: "8px",
  },
  emptyIcon: {
    fontSize: "44px",
    color: "var(--colorNeutralForeground3)",
  },
  emptyTitle: {
    color: "var(--colorNeutralForeground1)",
  },
  emptyText: {
    color: "var(--colorNeutralForeground3)",
    maxWidth: "320px",
    textAlign: "center",
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
    maxWidth: "200px",
  },
  downloadText: {
    maxWidth: "200px",
    color: "var(--colorNeutralForeground3)",
  },
  actionsCell: {
    display: "flex",
    justifyContent: "flex-end",
  },
  autoRow: {
    height: "auto",
    alignItems: "flex-start",
  },
  dataGrid: {
    tableLayout: "auto",
    width: "100%",
  },
});

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

export default function SharesPage() {
  const styles = useStyles();
  const { dispatchToast } = useToastController();

  const [shares, setShares] = useState<(Share & { file_name?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [renderedAt] = useState(() => Date.now());

  const toast = (msg: string, intent: "success" | "error" = "success") =>
    dispatchToast(
      <Toast>
        <MessageBar intent={intent}>
          <MessageBarBody>{msg}</MessageBarBody>
        </MessageBar>
      </Toast>,
      { intent },
    );

  const loadShares = useCallback(async () => {
    setLoading(true);
    try {
      const res = await sharesApi.list();
      setShares(res.shares);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to load shares", "error");
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    void loadShares();
  }, [loadShares]);

  const handleDelete = async (id: string) => {
    try {
      await sharesApi.delete(id);
      setShares((prev) => prev.filter((s) => s.id !== id));
      toast("Share deleted");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to delete", "error");
    }
  };

  const shareUrl = (token: string) =>
    `${window.location.origin}/share/${token}`;
  const downloadUrl = (token: string) => sharesApi.downloadUrl(token);

  const isExpired = (share: Share) =>
    share.expires_at !== null && renderedAt > share.expires_at;

  const isLimitReached = (share: Share) =>
    (share.max_views !== null && share.view_count >= share.max_views) ||
    (share.max_downloads !== null &&
      share.download_count >= share.max_downloads);

  const columns = [
    createTableColumn<Share & { file_name?: string }>({
      columnId: "file",
      renderHeaderCell: () => "File",
      renderCell: (share) => (
        <TableCellLayout>
          <Text weight="semibold" truncate style={{ maxWidth: 200 }}>
            {share.file_name ?? "Unknown file"}
          </Text>
        </TableCellLayout>
      ),
    }),
    createTableColumn<Share & { file_name?: string }>({
      columnId: "title",
      renderHeaderCell: () => "Custom Title",
      renderCell: (share) => (
        <TableCellLayout>
          <Text
            truncate
            style={{
              maxWidth: 150,
              color: share.custom_title
                ? undefined
                : "var(--colorNeutralForeground3)",
            }}
          >
            {share.custom_title ?? "—"}
          </Text>
        </TableCellLayout>
      ),
    }),
    createTableColumn<Share & { file_name?: string }>({
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
    createTableColumn<Share & { file_name?: string }>({
      columnId: "links",
      renderHeaderCell: () => "Links",
      renderCell: (share) => (
        <TableCellLayout>
          <div className={styles.linksContainer}>
            <div className={styles.linkRow}>
              <LinkRegular className={styles.linkIcon} />
              <Text size={100} truncate className={styles.downloadText}>
                Share page
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
    createTableColumn<Share & { file_name?: string }>({
      columnId: "views",
      renderHeaderCell: () => "Views",
      renderCell: (share) => (
        <TableCellLayout>
          <Text size={200}>
            {share.view_count}
            {share.max_views !== null ? ` / ${share.max_views}` : ""}
          </Text>
        </TableCellLayout>
      ),
    }),
    createTableColumn<Share & { file_name?: string }>({
      columnId: "downloads",
      renderHeaderCell: () => "Downloads",
      renderCell: (share) => (
        <TableCellLayout>
          <Text size={200}>
            {share.download_count}
            {share.max_downloads !== null ? ` / ${share.max_downloads}` : ""}
          </Text>
        </TableCellLayout>
      ),
    }),
    createTableColumn<Share & { file_name?: string }>({
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
    createTableColumn<Share & { file_name?: string }>({
      columnId: "actions",
      renderHeaderCell: () => "",
      renderCell: (share) => (
        <TableCellLayout>
          <div className={styles.actionsCell}>
            <Button
              appearance="subtle"
              size="small"
              icon={<DeleteRegular />}
              onClick={() => void handleDelete(share.id)}
            />
          </div>
        </TableCellLayout>
      ),
    }),
  ];

  return (
    <div className={styles.root}>
      <Title2 className={styles.title}>My Shares</Title2>

      {loading ? (
        <div className={styles.loadingContainer}>
          <Spinner label="Loading shares..." />
        </div>
      ) : shares.length === 0 ? (
        <div className={styles.emptyContainer}>
          <div className={styles.emptyIconWrap}>
            <LinkRegular className={styles.emptyIcon} />
          </div>
          <Text size={400} weight="semibold" className={styles.emptyTitle}>
            No share links yet
          </Text>
          <Text className={styles.emptyText}>
            Click "Share" on any file to create a share link. Links you create
            will appear here.
          </Text>
        </div>
      ) : (
        <DataGrid
          items={shares}
          columns={columns}
          sortable
          defaultSortState={{ sortColumn: "file", sortDirection: "ascending" }}
          className={styles.dataGrid}
        >
          <DataGridHeader>
            <DataGridRow>
              {({ renderHeaderCell }) => (
                <DataGridHeaderCell>{renderHeaderCell()}</DataGridHeaderCell>
              )}
            </DataGridRow>
          </DataGridHeader>
          <DataGridBody<Share & { file_name?: string }>>
            {({ item, rowId }) => (
              <DataGridRow<Share & { file_name?: string }>
                key={rowId}
                className={styles.autoRow}
              >
                {({ renderCell }) => (
                  <DataGridCell>{renderCell(item)}</DataGridCell>
                )}
              </DataGridRow>
            )}
          </DataGridBody>
        </DataGrid>
      )}
    </div>
  );
}
