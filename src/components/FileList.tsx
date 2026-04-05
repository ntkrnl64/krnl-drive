import { useState, useEffect } from "react";
import {
  DataGrid,
  DataGridBody,
  DataGridRow,
  DataGridCell,
  DataGridHeader,
  DataGridHeaderCell,
  TableCellLayout,
  createTableColumn,
  Button,
  Menu,
  MenuTrigger,
  MenuPopover,
  MenuList,
  MenuItem,
  MenuDivider,
  Checkbox,
  Text,
  Tooltip,
  makeStyles,
} from "@fluentui/react-components";
import type { TableColumnDefinition } from "@fluentui/react-components";
import {
  FolderRegular,
  DocumentRegular,
  MoreHorizontalRegular,
  ArrowDownloadRegular,
  ShareAndroidRegular,
  EditRegular,
  DeleteRegular,
  FolderOpenRegular,
  ArrowMoveRegular,
  DocumentCopyRegular,
  ImageRegular,
  VideoRegular,
  MusicNote2Regular,
  DocumentPdfRegular,
  FolderZipRegular,
  CodeRegular,
} from "@fluentui/react-icons";
import { formatBytes, formatDate, filesApi } from "../api.ts";
import type { FileItem } from "../types.ts";
import type { User } from "../types.ts";

const useStyles = makeStyles({
  emptyState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "64px 24px",
    height: "100%",
  },
  emptyIcon: {
    fontSize: "48px",
    color: "var(--colorNeutralForeground4)",
    marginBottom: "16px",
  },
  emptyText: {
    color: "var(--colorNeutralForeground3)",
  },
  actionsContainer: {
    display: "flex",
    gap: "4px",
    justifyContent: "flex-end",
  },
  fileNameCellFolder: {
    cursor: "pointer",
  },
  folderIcon: {
    fontSize: "20px",
    color: "var(--colorBrandForeground1)",
  },
  documentIcon: {
    fontSize: "20px",
    color: "var(--colorNeutralForeground3)",
  },
  folderText: {
    color: "var(--colorBrandForeground1)",
  },
  metaText: {
    color: "var(--colorNeutralForeground3)",
  },
  dataGridRowSelected: {
    backgroundColor: "var(--colorNeutralBackground1Selected)",
  },
});

interface FileListProps {
  items: FileItem[];
  currentUser: User;
  onNavigate: (folder: FileItem) => void;
  onDelete: (item: FileItem) => void;
  onRename: (item: FileItem) => void;
  onShare: (item: FileItem) => void;
  onMove: (item: FileItem) => void;
  onCopy: (item: FileItem) => void;
  selected: Set<string>;
  onSelectionChange: (id: string, checked: boolean) => void;
}

function FileIcon({
  item,
  styles,
}: {
  item: FileItem;
  styles: ReturnType<typeof useStyles>;
}) {
  if (item.type === "folder")
    return <FolderRegular className={styles.folderIcon} />;
  const mime = item.mime_type ?? "";
  if (mime.startsWith("image/"))
    return <ImageRegular className={styles.documentIcon} />;
  if (mime.startsWith("video/"))
    return <VideoRegular className={styles.documentIcon} />;
  if (mime.startsWith("audio/"))
    return <MusicNote2Regular className={styles.documentIcon} />;
  if (mime.includes("pdf"))
    return <DocumentPdfRegular className={styles.documentIcon} />;
  if (mime.includes("zip") || mime.includes("tar") || mime.includes("rar"))
    return <FolderZipRegular className={styles.documentIcon} />;
  return <DocumentRegular className={styles.documentIcon} />;
}

export default function FileList({
  items,
  currentUser,
  onNavigate,
  onDelete,
  onRename,
  onShare,
  onMove,
  onCopy,
  selected,
  onSelectionChange,
}: FileListProps) {
  const styles = useStyles();
  const [shiftHeld, setShiftHeld] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => setShiftHeld(e.shiftKey);
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
    };
  }, []);

  const canModify = (item: FileItem) =>
    currentUser.role === "admin" || item.owner_id === currentUser.id;

  const isGuest = currentUser.role === "guest";

  const columns: TableColumnDefinition<FileItem>[] = [
    createTableColumn<FileItem>({
      columnId: "select",
      renderHeaderCell: () => null,
      renderCell: (item) => (
        <TableCellLayout>
          <Checkbox
            checked={selected.has(item.id)}
            onChange={(_, d) => onSelectionChange(item.id, !!d.checked)}
          />
        </TableCellLayout>
      ),
    }),
    createTableColumn<FileItem>({
      columnId: "name",
      compare: (a, b) => {
        if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
        return a.name.localeCompare(b.name);
      },
      renderHeaderCell: () => "Name",
      renderCell: (item) => (
        <TableCellLayout
          media={<FileIcon item={item} styles={styles} />}
          className={
            item.type === "folder" ? styles.fileNameCellFolder : undefined
          }
          onClick={() => item.type === "folder" && onNavigate(item)}
        >
          <Text
            weight={item.type === "folder" ? "semibold" : "regular"}
            className={item.type === "folder" ? styles.folderText : undefined}
          >
            {item.name}
          </Text>
        </TableCellLayout>
      ),
    }),
    createTableColumn<FileItem>({
      columnId: "size",
      compare: (a, b) => a.size - b.size,
      renderHeaderCell: () => "Size",
      renderCell: (item) => (
        <TableCellLayout>
          <Text size={200} className={styles.metaText}>
            {item.type === "folder" ? "—" : formatBytes(item.size)}
          </Text>
        </TableCellLayout>
      ),
    }),
    createTableColumn<FileItem>({
      columnId: "modified",
      compare: (a, b) => a.updated_at - b.updated_at,
      renderHeaderCell: () => "Modified",
      renderCell: (item) => (
        <TableCellLayout>
          <Text size={200} className={styles.metaText}>
            {formatDate(item.updated_at)}
          </Text>
        </TableCellLayout>
      ),
    }),
    createTableColumn<FileItem>({
      columnId: "actions",
      renderHeaderCell: () => "",
      renderCell: (item) => (
        <TableCellLayout>
          <div className={styles.actionsContainer}>
            {item.type === "file" && (
              <Tooltip content="Download" relationship="label">
                <a
                  href={filesApi.downloadUrl(item.id)}
                  download={item.name}
                  style={{ display: "inline-flex" }}
                >
                  <Button
                    appearance="subtle"
                    size="small"
                    icon={<ArrowDownloadRegular />}
                  />
                </a>
              </Tooltip>
            )}
            {!isGuest && (
              <Tooltip content="Share" relationship="label">
                <Button
                  appearance="subtle"
                  size="small"
                  icon={<ShareAndroidRegular />}
                  onClick={() => onShare(item)}
                />
              </Tooltip>
            )}
            {/* Shift key: show inline Rename/Move/Delete */}
            {shiftHeld && canModify(item) && !isGuest && (
              <>
                <Tooltip content="Copy" relationship="label">
                  <Button
                    appearance="subtle"
                    size="small"
                    icon={<DocumentCopyRegular />}
                    onClick={() => onCopy(item)}
                  />
                </Tooltip>
                <Tooltip content="Rename" relationship="label">
                  <Button
                    appearance="subtle"
                    size="small"
                    icon={<EditRegular />}
                    onClick={() => onRename(item)}
                  />
                </Tooltip>
                <Tooltip content="Move" relationship="label">
                  <Button
                    appearance="subtle"
                    size="small"
                    icon={<ArrowMoveRegular />}
                    onClick={() => onMove(item)}
                  />
                </Tooltip>
                <Tooltip content="Delete" relationship="label">
                  <Button
                    appearance="subtle"
                    size="small"
                    icon={<DeleteRegular />}
                    onClick={() => onDelete(item)}
                  />
                </Tooltip>
              </>
            )}
            <Menu>
              <MenuTrigger>
                <Button
                  appearance="subtle"
                  size="small"
                  icon={<MoreHorizontalRegular />}
                />
              </MenuTrigger>
              <MenuPopover>
                <MenuList>
                  {item.type === "folder" && (
                    <MenuItem
                      icon={<FolderOpenRegular />}
                      onClick={() => onNavigate(item)}
                    >
                      Open
                    </MenuItem>
                  )}
                  {item.type === "folder" && (
                    <MenuItem
                      icon={<CodeRegular />}
                      onClick={() => navigator.clipboard.writeText(item.id)}
                    >
                      Copy Folder ID
                    </MenuItem>
                  )}
                  {item.type === "file" && (
                    <MenuItem
                      icon={<ArrowDownloadRegular />}
                      onClick={() => {
                        window.location.href = filesApi.downloadUrl(item.id);
                      }}
                    >
                      Download
                    </MenuItem>
                  )}
                  {!isGuest && (
                    <MenuItem
                      icon={<ShareAndroidRegular />}
                      onClick={() => onShare(item)}
                    >
                      Share
                    </MenuItem>
                  )}
                  {canModify(item) && !isGuest && (
                    <>
                      <MenuDivider />
                      <MenuItem
                        icon={<DocumentCopyRegular />}
                        onClick={() => onCopy(item)}
                      >
                        Copy
                      </MenuItem>
                      <MenuItem
                        icon={<EditRegular />}
                        onClick={() => onRename(item)}
                      >
                        Rename
                      </MenuItem>
                      <MenuItem
                        icon={<ArrowMoveRegular />}
                        onClick={() => onMove(item)}
                      >
                        Move
                      </MenuItem>
                      <MenuDivider />
                      <MenuItem
                        icon={<DeleteRegular />}
                        onClick={() => onDelete(item)}
                      >
                        Delete
                      </MenuItem>
                    </>
                  )}
                </MenuList>
              </MenuPopover>
            </Menu>
          </div>
        </TableCellLayout>
      ),
    }),
  ];

  if (items.length === 0) {
    return (
      <div className={styles.emptyState}>
        <FolderOpenRegular className={styles.emptyIcon} />
        <Text block className={styles.emptyText}>
          This folder is empty
        </Text>
      </div>
    );
  }

  return (
    <DataGrid
      items={items}
      columns={columns}
      sortable
      defaultSortState={{ sortColumn: "name", sortDirection: "ascending" }}
    >
      <DataGridHeader>
        <DataGridRow>
          {({ renderHeaderCell }) => (
            <DataGridHeaderCell>{renderHeaderCell()}</DataGridHeaderCell>
          )}
        </DataGridRow>
      </DataGridHeader>
      <DataGridBody<FileItem>>
        {({ item, rowId }) => (
          <Menu openOnContext>
            <MenuTrigger disableButtonEnhancement>
              <DataGridRow<FileItem>
                key={rowId}
                className={
                  selected.has(item.id) ? styles.dataGridRowSelected : undefined
                }
              >
                {({ renderCell }) => (
                  <DataGridCell>{renderCell(item)}</DataGridCell>
                )}
              </DataGridRow>
            </MenuTrigger>
            <MenuPopover>
              <MenuList>
                {item.type === "folder" && (
                  <MenuItem
                    icon={<FolderOpenRegular />}
                    onClick={() => onNavigate(item)}
                  >
                    Open
                  </MenuItem>
                )}
                <MenuItem
                  icon={<CodeRegular />}
                  onClick={() => void navigator.clipboard.writeText(item.id)}
                >
                  {item.type === "folder" ? "Copy Folder ID" : "Copy File ID"}
                </MenuItem>
                {item.type === "file" && (
                  <MenuItem
                    icon={<ArrowDownloadRegular />}
                    onClick={() => {
                      window.location.href = filesApi.downloadUrl(item.id);
                    }}
                  >
                    Download
                  </MenuItem>
                )}
                {!isGuest && (
                  <MenuItem
                    icon={<ShareAndroidRegular />}
                    onClick={() => onShare(item)}
                  >
                    Share
                  </MenuItem>
                )}
                {canModify(item) && !isGuest && (
                  <>
                    <MenuDivider />
                    <MenuItem
                      icon={<EditRegular />}
                      onClick={() => onRename(item)}
                    >
                      Rename
                    </MenuItem>
                    <MenuItem
                      icon={<ArrowMoveRegular />}
                      onClick={() => onMove(item)}
                    >
                      Move
                    </MenuItem>
                    <MenuDivider />
                    <MenuItem
                      icon={<DeleteRegular />}
                      onClick={() => onDelete(item)}
                    >
                      Delete
                    </MenuItem>
                  </>
                )}
              </MenuList>
            </MenuPopover>
          </Menu>
        )}
      </DataGridBody>
    </DataGrid>
  );
}
