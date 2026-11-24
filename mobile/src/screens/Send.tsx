import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { useData } from '../data';
import { useT } from '../i18n';
import { useNotify } from '../notify';
import { colors } from '../theme';
import { Btn, Card, H1, H2, Pill, Sub } from '../ui';
import { Screen } from './Screen';

export function SendScreen() {
  const d = useData();
  const { t } = useT();
  const notify = useNotify();
  const [pending, setPending] = useState<{ idempotencyKey: string; label: string; createdAt: string }[]>([]);
  const [failed, setFailed] = useState<{ idempotencyKey: string; label: string; reason: string }[]>([]);
  const [busy, setBusy] = useState(false);

  const load = React.useCallback(async () => {
    const [q, f] = await Promise.all([d.client.getOfflineQueue(), d.client.getFailedQueue()]);
    setPending(q); setFailed(f);
  }, [d.client]);
  React.useEffect(() => { void load(); }, [load, d.queueCount, d.failedCount]);

  const send = async () => {
    setBusy(true);
    try {
      const r = await d.flush();
      notify(r.remaining > 0 ? 'info' : 'ok', r.sent > 0 ? t('sentN', { n: r.sent }) : r.remaining > 0 ? t('stillPending') : t('nothingPending'));
      await load();
    } finally { setBusy(false); }
  };

  const connected = d.health?.connected ?? false;
  const last = d.health?.lastSyncedAt ? new Date(d.health.lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : t('never');
  return (
    <Screen>
      <H1>{t('sendTitle')}</H1>
      <Card tone={connected ? 'green' : 'amber'}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 16, fontWeight: '800', color: connected ? colors.green : colors.amberDark, flex: 1 }}>{connected ? t('connected') : t('notConnected')}</Text>
          <Pill text={connected ? t('online') : t('offline')} tone={connected ? 'green' : 'amber'} />
        </View>
        <Sub style={{ marginTop: 6 }}>{t('lastSync', { time: last })}</Sub>
      </Card>

      <H2>{t('pendingTitle')} ({pending.length})</H2>
      <View style={{ height: 10 }} />
      {pending.length === 0 ? <Card><Text style={{ color: colors.green, fontWeight: '700' }}>✓ {t('nothingPending')}</Text></Card> : pending.map((c) => (
        <Card key={c.idempotencyKey}><Text style={{ fontWeight: '700', color: colors.text }}>{c.label}</Text><Sub>{new Date(c.createdAt).toLocaleString()}</Sub></Card>
      ))}
      {pending.length > 0 ? <Btn title={t('sendNow')} onPress={send} busy={busy} style={{ marginBottom: 16 }} /> : null}

      {failed.length > 0 ? (
        <>
          <H2>{t('failedTitle')} ({failed.length})</H2>
          <View style={{ height: 10 }} />
          {failed.map((c) => (
            <Card key={c.idempotencyKey} tone="red">
              <Text style={{ fontWeight: '700', color: colors.text }}>{c.label}</Text>
              <Text style={{ color: colors.red, marginVertical: 6, fontSize: 14 }}>{c.reason}</Text>
              <Btn title={t('discard')} kind="ghost" onPress={async () => { await d.client.discardFailed(c.idempotencyKey); await d.refreshQueue(); await load(); }} />
            </Card>
          ))}
        </>
      ) : null}
    </Screen>
  );
}
