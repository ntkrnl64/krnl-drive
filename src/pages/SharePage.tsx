import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Title2, Text, Button, Spinner, Card, Badge, Divider, Avatar, makeStyles, shorthands
} from '@fluentui/react-components';
import {
  ArrowDownloadRegular, DocumentRegular, LinkDismissRegular,
  ImageRegular, VideoRegular, MusicNote2Regular, DocumentPdfRegular, FolderZipRegular,
} from '@fluentui/react-icons';
import { sharesApi, getConfig, formatBytes, formatDate } from '../api.ts';
import type { Share, FileItem } from '../types.ts';

const useStyles = makeStyles({
  fullScreenCenter: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageContainer: {
    minHeight: '100vh',
    backgroundColor: 'var(--colorNeutralBackground2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    ...shorthands.padding('24px'),
  },
  errorCard: {
    ...shorthands.padding('40px'),
    textAlign: 'center',
    maxWidth: '400px',
  },
  errorIcon: {
    fontSize: '64px',
    color: 'var(--colorNeutralForeground3)',
    marginBottom: '16px',
  },
  errorText: {
    color: 'var(--colorNeutralForeground3)',
    marginTop: '8px',
    display: 'block',
  },
  mainCard: {
    maxWidth: '480px',
    width: '100%',
    ...shorthands.padding('32px'),
  },
  fileIconContainer: {
    textAlign: 'center',
    marginBottom: '24px',
  },
  fileTitle: {
    marginTop: '12px',
    wordBreak: 'break-word',
  },
  folderText: {
    color: 'var(--colorNeutralForeground3)',
  },
  detailsContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    marginBottom: '24px',
  },
  detailRow: {
    display: 'flex',
    justifyContent: 'space-between',
  },
  detailLabel: {
    color: 'var(--colorNeutralForeground3)',
  },
  badgesContainer: {
    display: 'flex',
    gap: '8px',
    marginTop: '16px',
    marginBottom: '16px',
    flexWrap: 'wrap',
  },
  downloadButton: {
    width: '100%',
  },
  footerTextContainer: {
    textAlign: 'center',
    marginTop: '24px',
  },
  footerText: {
    color: 'var(--colorNeutralForeground4)',
  },
  creatorRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    marginTop: '20px',
    paddingTop: '16px',
    borderTop: '1px solid var(--colorNeutralStroke2)',
  },
  documentIconLarge: {
    fontSize: '64px',
    color: 'var(--colorNeutralForeground3)',
  }
});

function FileTypeIcon({ mimeType, styles }: { mimeType: string | null, styles: ReturnType<typeof useStyles> }) {
  const mime = mimeType ?? '';
  if (mime.startsWith('image/')) return <ImageRegular className={styles.documentIconLarge} />;
  if (mime.startsWith('video/')) return <VideoRegular className={styles.documentIconLarge} />;
  if (mime.startsWith('audio/')) return <MusicNote2Regular className={styles.documentIconLarge} />;
  if (mime.includes('pdf')) return <DocumentPdfRegular className={styles.documentIconLarge} />;
  if (mime.includes('zip') || mime.includes('tar')) return <FolderZipRegular className={styles.documentIconLarge} />;
  return <DocumentRegular className={styles.documentIconLarge} />;
}

export default function SharePage() {
  const styles = useStyles();
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<{ share: Share; file: FileItem; display?: { title: string; description: string }; creator?: { username: string; avatarUrl: string | null } } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [siteName, setSiteName] = useState('');

  useEffect(() => {
    getConfig().then(c => setSiteName(c.siteName)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!token) return;
    sharesApi.getPublic(token)
      .then(res => setData(res))
      .catch(e => setError(e instanceof Error ? e.message : 'Not found'))
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
            {error ?? 'This share link is invalid or has expired.'}
          </Text>
        </Card>
      </div>
    );
  }

  const { share, file, display, creator } = data;
  const downloadUrl = sharesApi.downloadUrl(share.token);

  const viewsLeft = share.max_views !== null ? share.max_views - share.view_count : null;
  const downloadsLeft = share.max_downloads !== null ? share.max_downloads - share.download_count : null;

  return (
    <div className={styles.pageContainer}>
      <Card className={styles.mainCard}>
        {/* File icon + name/title */}
        <div className={styles.fileIconContainer}>
          <FileTypeIcon mimeType={file.mime_type} styles={styles} />
          <br />
          <Title2 className={styles.fileTitle}>{display?.title || file.name}</Title2>
          {display?.description && (
            <Text block style={{ marginTop: 8, color: 'var(--colorNeutralForeground2)' }}>
              {display.description}
            </Text>
          )}
          {file.type === 'folder' && (
            <Text block className={styles.folderText} style={{ marginTop: 8 }}>Folder</Text>
          )}
        </div>

        {/* File details */}
        <div className={styles.detailsContainer}>
          {file.type === 'file' && (
            <div className={styles.detailRow}>
              <Text className={styles.detailLabel}>Size</Text>
              <Text weight="semibold">{formatBytes(file.size)}</Text>
            </div>
          )}
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

        <Divider />

        {/* Share stats */}
        <div className={styles.badgesContainer}>
          {share.expires_at && (
            <Badge color={Date.now() < share.expires_at ? 'warning' : 'danger'} size="small">
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
          {!share.expires_at && viewsLeft === null && downloadsLeft === null && (
            <Badge color="success" size="small">No limits</Badge>
          )}
        </div>

        {/* Download button */}
        {file.type === 'file' && (
          <Button
            appearance="primary"
            size="large"
            icon={<ArrowDownloadRegular />}
            as="a"
            href={downloadUrl}
            download={file.name}
            className={styles.downloadButton}
          >
            Download {file.name}
          </Button>
        )}

        {creator?.username && (
          <div className={styles.creatorRow}>
            <Avatar
              name={creator.username}
              image={creator.avatarUrl ? { src: creator.avatarUrl } : undefined}
              size={24}
            />
            <Text size={200} style={{ color: 'var(--colorNeutralForeground3)' }}>
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