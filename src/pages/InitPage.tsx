import { useState } from 'react';
import {
  Button, Input, Field, Title1, Text, Spinner, Card, Switch, makeStyles,
  Title2,
} from '@fluentui/react-components';
import { FolderRegular } from '@fluentui/react-icons';
import { initApi } from '../api.ts';

const useStyles = makeStyles({
  root: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'var(--colorNeutralBackground2)',
  },
  card: {
    width: '400px',
    paddingTop: '32px',
    paddingBottom: '32px',
    paddingLeft: '32px',
    paddingRight: '32px',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  header: {
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
  },
  icon: {
    fontSize: '40px',
    color: 'var(--colorBrandForeground1)',
  },
  subText: {
    color: 'var(--colorNeutralForeground3)',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  errorText: {
    color: 'var(--colorPaletteRedForeground1)',
  },
});

export default function InitPage({ onComplete }: { onComplete: () => void }) {
  const styles = useStyles();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [enableGuest, setEnableGuest] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) { setError('Passwords do not match'); return; }
    setLoading(true);
    try {
      await initApi.setup(username.trim(), password, enableGuest);
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Setup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.root}>
      <Card className={styles.card}>
        <div className={styles.header}>
          <FolderRegular className={styles.icon} />
          <Title2>Welcome to</Title2>
          <Title1>KRNL Drive</Title1>
          <Text className={styles.subText}>Create your administrator account to get started.</Text>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <Field label="Admin username" required>
            <Input
              value={username}
              onChange={(_, d) => setUsername(d.value)}
              placeholder="admin"
              autoFocus
            />
          </Field>
          <Field label="Password" required>
            <Input
              type="password"
              value={password}
              onChange={(_, d) => setPassword(d.value)}
              placeholder="••••••••"
            />
          </Field>
          <Field label="Confirm password" required>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(_, d) => setConfirmPassword(d.value)}
              placeholder="••••••••"
            />
          </Field>
          <Switch
            label="Enable guest access (read-only, no login required)"
            checked={enableGuest}
            onChange={(_, d) => setEnableGuest(d.checked)}
          />
          {error && <Text className={styles.errorText}>{error}</Text>}
          <Button appearance="primary" type="submit" disabled={loading} icon={loading ? <Spinner size="tiny" /> : undefined}>
            {loading ? 'Setting up...' : 'Set up KRNL Drive'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
