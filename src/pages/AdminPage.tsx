import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.tsx';
import {
  Title2, Title3, Text, Button, Field, Input, Select, Switch, Card,
  Badge, Spinner, Tab, TabList,
  Table, TableHeader, TableRow, TableHeaderCell, TableBody, TableCell, TableCellLayout,
  Dialog, DialogSurface, DialogTitle, DialogBody, DialogContent, DialogActions,
  Toast, useToastController,
  MessageBar, MessageBarBody, Tooltip, makeStyles, shorthands
} from '@fluentui/react-components';
import {
  PersonAddRegular, DeleteRegular, EditRegular,
  SettingsRegular, PeopleRegular, DocumentRegular, CheckmarkRegular,
  DatabaseRegular, LinkRegular, ArrowUploadRegular, ArrowRightRegular
} from '@fluentui/react-icons';
import { adminApi, formatBytes } from '../api.ts';
import type { User } from '../types.ts';

type AdminTab = 'users' | 'settings' | 'stats';

interface Stats {
  users: number;
  files: number;
  totalSize: number;
  shares: number;
  activeUploads: number;
}

const useStyles = makeStyles({
  root: {
    ...shorthands.padding('24px', '16px'),
  },
  title: {
    marginBottom: '24px',
  },
  contentContainer: {
    marginTop: '20px',
  },
  usersHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
  },
  settingsContainer: {
    maxWidth: '600px',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  cardContent: {
    ...shorthands.padding('16px'),
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  saveButton: {
    alignSelf: 'flex-start',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
    gap: '16px',
    maxWidth: '800px',
  },
  statCard: {
    ...shorthands.padding('20px'),
    textAlign: 'center',
  },
  statIcon: {
    fontSize: '32px',
    marginBottom: '8px',
  },
  statLabel: {
    color: 'var(--colorNeutralForeground3)',
  },
  dialogContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  errorText: {
    color: 'var(--colorPaletteRedForeground1)',
  },
  offText: {
    color: 'var(--colorNeutralForeground3)',
  },
  actionsCell: {
    display: 'flex',
    gap: '4px',
  }
});

// ─── Add User Dialog ──────────────────────────────────────────────────────────
interface AddUserDialogProps {
  open: boolean;
  onClose: () => void;
  onAdd: (username: string, password: string, role: string) => Promise<void>;
  styles: ReturnType<typeof useStyles>;
}

function AddUserDialog({ open, onClose, onAdd, styles }: AddUserDialogProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('user');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await onAdd(username, password, role);
      setUsername(''); setPassword(''); setRole('user');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(_, d) => !d.open && onClose()}>
      <DialogSurface>
        <form onSubmit={handleSubmit}>
          <DialogBody>
            <DialogTitle>Add User</DialogTitle>
            <DialogContent className={styles.dialogContent}>
              <Field label="Username" required>
                <Input value={username} onChange={(_, d) => setUsername(d.value)} autoFocus />
              </Field>
              <Field label="Password">
                <Input type="password" value={password} onChange={(_, d) => setPassword(d.value)} />
              </Field>
              <Field label="Role">
                <Select value={role} onChange={(_, d) => setRole(d.value)}>
                  <option value="admin">Admin</option>
                  <option value="user">User</option>
                  <option value="guest">Guest</option>
                </Select>
              </Field>
              {error && <Text className={styles.errorText}>{error}</Text>}
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={onClose}>Cancel</Button>
              <Button appearance="primary" type="submit" disabled={loading}>
                {loading ? <Spinner size="tiny" /> : 'Create'}
              </Button>
            </DialogActions>
          </DialogBody>
        </form>
      </DialogSurface>
    </Dialog>
  );
}

// ─── Edit User Dialog ─────────────────────────────────────────────────────────
interface EditUserDialogProps {
  user: User | null;
  open: boolean;
  onClose: () => void;
  onSave: (id: string, updates: { username?: string; password?: string; role?: string; disabled?: boolean; root_folder_id?: string | null; avatar_url?: string | null }) => Promise<void>;
  styles: ReturnType<typeof useStyles>;
}

function EditUserDialog({ user, open, onClose, onSave, styles }: EditUserDialogProps) {
  const [username, setUsername] = useState(user?.username ?? '');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<string>(user?.role ?? 'user');
  const [disabled, setDisabled] = useState(!!user?.disabled);
  const [rootFolderId, setRootFolderId] = useState(user?.root_folder_id ?? '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) {
      setUsername(user.username);
      setRole(user.role);
      setDisabled(!!user.disabled);
      setRootFolderId(user.root_folder_id ?? '');
      setAvatarUrl(user.avatar_url ?? '');
      setPassword('');
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    setError('');
    const updates: Parameters<typeof onSave>[1] = {};
    if (username !== user.username) updates.username = username;
    if (password) updates.password = password;
    if (role !== user.role) updates.role = role;
    if (disabled !== !!user.disabled) updates.disabled = disabled;
    const newRootId = rootFolderId.trim() || null;
    if (newRootId !== (user.root_folder_id ?? null)) updates.root_folder_id = newRootId;
    const newAvatarUrl = avatarUrl.trim() || null;
    if (newAvatarUrl !== (user.avatar_url ?? null)) updates.avatar_url = newAvatarUrl;

    try {
      await onSave(user.id, updates);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(_, d) => !d.open && onClose()}>
      <DialogSurface>
        <form onSubmit={handleSubmit}>
          <DialogBody>
            <DialogTitle>Edit User: {user?.username}</DialogTitle>
            <DialogContent className={styles.dialogContent}>
              <Field label="Username">
                <Input value={username} onChange={(_, d) => setUsername(d.value)} />
              </Field>
              <Field label="New password (leave blank to keep current)">
                <Input type="password" value={password} onChange={(_, d) => setPassword(d.value)} placeholder="••••••••" />
              </Field>
              <Field label="Role">
                <Select value={role} onChange={(_, d) => setRole(d.value)}>
                  <option value="admin">Admin</option>
                  <option value="user">User</option>
                  <option value="guest">Guest</option>
                </Select>
              </Field>
              <Field label="Avatar URL" hint="URL for the user's profile picture. Leave blank to clear.">
                <Input
                  value={avatarUrl}
                  onChange={(_, d) => setAvatarUrl(d.value)}
                  placeholder="https://example.com/avatar.png"
                />
              </Field>
              <Field label="Root folder ID" hint="Restricts user to this folder. Leave blank for full access.">
                <Input
                  value={rootFolderId}
                  onChange={(_, d) => setRootFolderId(d.value)}
                  placeholder="Paste folder ID here"
                />
              </Field>
              <Switch
                checked={disabled}
                onChange={(_, d) => setDisabled(d.checked)}
                label="Disable account"
              />
              {error && <Text className={styles.errorText}>{error}</Text>}
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={onClose}>Cancel</Button>
              <Button appearance="primary" type="submit" disabled={loading}>
                {loading ? <Spinner size="tiny" /> : 'Save'}
              </Button>
            </DialogActions>
          </DialogBody>
        </form>
      </DialogSurface>
    </Dialog>
  );
}

// ─── Main Admin Page ──────────────────────────────────────────────────────────
export default function AdminPage() {
  const styles = useStyles();
  const { dispatchToast } = useToastController();
  const { refresh } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<AdminTab>('users');
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [localSettings, setLocalSettings] = useState<Record<string, string>>({});

  const toast = (msg: string, intent: 'success' | 'error' = 'success') =>
    dispatchToast(
      <Toast><MessageBar intent={intent}><MessageBarBody>{msg}</MessageBarBody></MessageBar></Toast>,
      { intent }
    );

  const loadAll = async () => {
    setLoading(true);
    try {
      const [u, s, st] = await Promise.all([
        adminApi.listUsers(),
        adminApi.getSettings(),
        adminApi.getStats(),
      ]);
      setUsers(u.users);
      setLocalSettings(s.settings);
      setStats(st);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadAll(); }, []);

  const handleAddUser = async (username: string, password: string, role: string) => {
    await adminApi.createUser(username, password, role);
    await loadAll();
    toast(`User "${username}" created`);
  };

  const handleEditUser = async (id: string, updates: Parameters<typeof adminApi.updateUser>[1]) => {
    await adminApi.updateUser(id, updates);
    await loadAll();
    toast('User updated');
  };

  const handleDeleteUser = async (id: string, username: string) => {
    if (!confirm(`Delete user "${username}"? This cannot be undone.`)) return;
    await adminApi.deleteUser(id);
    await loadAll();
    toast(`User "${username}" deleted`);
  };

  const handleForceLogin = async (id: string, username: string) => {
    if (!confirm(`Force login as user "${username}"? You will be logged out of your current admin session.`)) return;
    try {
      await adminApi.forceLogin(id);
      await refresh();
      navigate('/');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to force login', 'error');
    }
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      await adminApi.updateSettings(localSettings);

      toast('Settings saved');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed', 'error');
    } finally {
      setSavingSettings(false);
    }
  };

  const setSetting = (key: string, value: string) =>
    setLocalSettings(prev => ({ ...prev, [key]: value }));

  return (
    <div className={styles.root}>
      <Title2 className={styles.title}>Admin Panel</Title2>

      <TabList selectedValue={tab} onTabSelect={(_, d) => setTab(d.value as AdminTab)}>
        <Tab value="users" icon={<PeopleRegular />}>Users</Tab>
        <Tab value="settings" icon={<SettingsRegular />}>Settings</Tab>
        <Tab value="stats" icon={<DocumentRegular />}>Statistics</Tab>
      </TabList>

      <div className={styles.contentContainer}>
        {loading ? <Spinner label="Loading..." /> : (
          <>
            {/* Users tab */}
            {tab === 'users' && (
              <div>
                <div className={styles.usersHeader}>
                  <Text weight="semibold">{users.length} users</Text>
                  <Button
                    appearance="primary"
                    icon={<PersonAddRegular />}
                    onClick={() => setAddUserOpen(true)}
                  >
                    Add User
                  </Button>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHeaderCell>Username</TableHeaderCell>
                      <TableHeaderCell>Role</TableHeaderCell>
                      <TableHeaderCell>2FA</TableHeaderCell>
                      <TableHeaderCell>Status</TableHeaderCell>
                      <TableHeaderCell>Created</TableHeaderCell>
                      <TableHeaderCell style={{ width: 100 }}>Actions</TableHeaderCell>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map(u => (
                      <TableRow key={u.id}>
                        <TableCell>
                          <TableCellLayout>
                            <Text weight="semibold">{u.username}</Text>
                          </TableCellLayout>
                        </TableCell>
                        <TableCell>
                          <TableCellLayout>
                            <Badge
                              color={u.role === 'admin' ? 'danger' : u.role === 'guest' ? 'subtle' : 'brand'}
                              size="small"
                            >
                              {u.role}
                            </Badge>
                          </TableCellLayout>
                        </TableCell>
                        <TableCell>
                          <TableCellLayout>
                            {u.totp_enabled ? <Badge color="success" size="small">Enabled</Badge> : <Text size={200} className={styles.offText}>Off</Text>}
                          </TableCellLayout>
                        </TableCell>
                        <TableCell>
                          <TableCellLayout>
                            <Badge color={u.disabled ? 'danger' : 'success'} size="small">
                              {u.disabled ? 'Disabled' : 'Active'}
                            </Badge>
                          </TableCellLayout>
                        </TableCell>
                        <TableCell>
                          <TableCellLayout>
                            <Text size={200}>{new Date(u.created_at).toLocaleDateString()}</Text>
                          </TableCellLayout>
                        </TableCell>
                        <TableCell>
                          <TableCellLayout>
                            <div className={styles.actionsCell}>
                              <Tooltip content="Edit" relationship="label">
                                <Button
                                  appearance="subtle"
                                  size="small"
                                  icon={<EditRegular />}
                                  onClick={() => setEditUser(u)}
                                />
                              </Tooltip>
                              <Tooltip content="Force Login" relationship="label">
                                <Button
                                  appearance="subtle"
                                  size="small"
                                  icon={<ArrowRightRegular />}
                                  onClick={() => void handleForceLogin(u.id, u.username)}
                                  disabled={!!u.disabled}
                                />
                              </Tooltip>
                              <Tooltip content="Delete" relationship="label">
                                <Button
                                  appearance="subtle"
                                  size="small"
                                  icon={<DeleteRegular />}
                                  onClick={() => void handleDeleteUser(u.id, u.username)}
                                />
                              </Tooltip>
                            </div>
                          </TableCellLayout>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Settings tab */}
            {tab === 'settings' && (
              <div className={styles.settingsContainer}>
                <Card>
                  <div className={styles.cardContent}>
                    <Title3>Site Settings</Title3>
                    <Field label="Site name">
                      <Input
                        value={localSettings.site_name ?? ''}
                        onChange={(_, d) => setSetting('site_name', d.value)}
                      />
                    </Field>
                    <Field label="Site icon URL" hint="Displayed in the sidebar and as the browser tab favicon">
                      <Input
                        value={localSettings.site_icon_url ?? ''}
                        onChange={(_, d) => setSetting('site_icon_url', d.value)}
                        placeholder="https://example.com/icon.png"
                        contentAfter={localSettings.site_icon_url ? (
                          <img
                            src={localSettings.site_icon_url}
                            alt="icon preview"
                            style={{ width: 20, height: 20, objectFit: 'contain' }}
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                        ) : undefined}
                      />
                    </Field>
                    <Switch
                      label="Allow public registration"
                      checked={localSettings.allow_registration === '1'}
                      onChange={(_, d) => setSetting('allow_registration', d.checked ? '1' : '0')}
                    />
                    <Switch
                      label="Allow guests to download"
                      checked={localSettings.guest_can_download !== '0'}
                      onChange={(_, d) => setSetting('guest_can_download', d.checked ? '1' : '0')}
                    />
                  </div>
                </Card>

                <Card>
                  <div className={styles.cardContent}>
                    <Title3>Share Link Defaults</Title3>
                    <Field label="Site-wide Default Share Title">
                      <Input
                        value={localSettings.default_share_title ?? ''}
                        onChange={(_, d) => setSetting('default_share_title', d.value)}
                        placeholder={`E.g., ${localSettings.site_name || 'Drive'} Shared File`}
                      />
                    </Field>
                    <Field label="Site-wide Default Share Description">
                      <Input
                        value={localSettings.default_share_description ?? ''}
                        onChange={(_, d) => setSetting('default_share_description', d.value)}
                        placeholder="E.g., Click below to download."
                      />
                    </Field>
                    <Field label="Default expiry (hours, 0=never)">
                      <Input
                        type="number"
                        min="0"
                        value={localSettings.default_share_expiry_hours ?? '168'}
                        onChange={(_, d) => setSetting('default_share_expiry_hours', d.value)}
                      />
                    </Field>
                    <Field label="Default max views (0=unlimited)">
                      <Input
                        type="number"
                        min="0"
                        value={localSettings.default_max_views ?? '0'}
                        onChange={(_, d) => setSetting('default_max_views', d.value)}
                      />
                    </Field>
                    <Field label="Default max downloads (0=unlimited)">
                      <Input
                        type="number"
                        min="0"
                        value={localSettings.default_max_downloads ?? '0'}
                        onChange={(_, d) => setSetting('default_max_downloads', d.value)}
                      />
                    </Field>
                  </div>
                </Card>

                <Card>
                  <div className={styles.cardContent}>
                    <Title3>Upload Settings</Title3>
                    <Field label="Chunk size (bytes, default 5MB = 5242880)">
                      <Input
                        type="number"
                        min="1048576"
                        value={localSettings.chunk_size ?? '5242880'}
                        onChange={(_, d) => setSetting('chunk_size', d.value)}
                      />
                    </Field>
                  </div>
                </Card>

                <Button
                  appearance="primary"
                  icon={savingSettings ? <Spinner size="tiny" /> : <CheckmarkRegular />}
                  onClick={handleSaveSettings}
                  disabled={savingSettings}
                  className={styles.saveButton}
                >
                  Save Settings
                </Button>
              </div>
            )}

            {/* Stats tab */}
            {tab === 'stats' && stats && (
              <div className={styles.statsGrid}>
                {[
                  { label: 'Total Users', value: stats.users, icon: <PeopleRegular /> },
                  { label: 'Total Files', value: stats.files, icon: <DocumentRegular /> },
                  { label: 'Storage Used', value: formatBytes(stats.totalSize), icon: <DatabaseRegular /> },
                  { label: 'Share Links', value: stats.shares, icon: <LinkRegular /> },
                  { label: 'Active Uploads', value: stats.activeUploads, icon: <ArrowUploadRegular /> },
                ].map(stat => (
                  <Card key={stat.label} className={styles.statCard}>
                    <div className={styles.statIcon}>{stat.icon}</div>
                    <Text size={600} weight="bold" block>{String(stat.value)}</Text>
                    <Text size={200} className={styles.statLabel}>{stat.label}</Text>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <AddUserDialog
        open={addUserOpen}
        onClose={() => setAddUserOpen(false)}
        onAdd={handleAddUser}
        styles={styles}
      />
      <EditUserDialog
        user={editUser}
        open={!!editUser}
        onClose={() => setEditUser(null)}
        onSave={handleEditUser}
        styles={styles}
      />
    </div>
  );
}