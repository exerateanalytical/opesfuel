import React, { useState } from 'react';
import { Text, View } from 'react-native';
import type { PumpDto } from '../api/opesfuelMobileClient';
import { errorText, useData } from '../data';
import { useT } from '../i18n';
import { litres } from '../logic';
import { useNotify } from '../notify';
import { colors } from '../theme';
import { Btn, Card, Empty, H1, H2, Pill, Sub } from '../ui';
import { PumpCard, PumpFlow } from './Pumps';
import { Screen } from './Screen';

/** The attendant's home: clock in/out, my open shift, free pumps. Nothing about money or other people. */
export function MyShiftScreen() {
  const d = useData();
  const { t } = useT();
  const notify = useNotify();
  const [pump, setPump] = useState<PumpDto | null>(null);
  const [busy, setBusy] = useState(false);
  if (pump) return <PumpFlow pump={pump} onDone={() => setPump(null)} />;

  const mine = d.me ? d.shifts.find((s) => s.status === 'OPEN' && s.attendantId === d.me!.id) : undefined;
  const minePump = mine ? d.pumps.find((p) => p.id === mine.pumpId) : undefined;
  const idle = d.pumps.filter((p) => p.status !== 'ACTIVE_SHIFT');

  const toggle = async () => {
    if (!d.me) return;
    setBusy(true);
    try {
      const r = await d.client.toggleAttendance(d.me.id, 'Clock');
      notify(r.status === 'SYNCED' ? 'ok' : 'info', r.status === 'SYNCED' ? (d.me.clockedIn ? t('clockedOut') : t('clockedIn')) : t('savedOnPhone'));
      await d.refresh(); await d.refreshQueue();
    } catch (e) { notify('error', errorText(e, t)); } finally { setBusy(false); }
  };

  return (
    <Screen>
      <H1>{t('hello', { name: d.me?.fullName ?? d.session.name })}</H1>
      {d.meMissing ? <Card tone="amber"><Text style={{ color: colors.amberDark, fontWeight: '700' }}>{t('noEmployee')}</Text></Card> : null}

      {d.me ? (
        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <H2>{d.me.clockedIn ? t('clockedIn') : t('clockedOut')}</H2>
            <Pill text={d.me.clockedIn ? '●' : '○'} tone={d.me.clockedIn ? 'green' : 'gray'} />
          </View>
          <Btn title={d.me.clockedIn ? t('clockOut') : t('clockIn')} kind={d.me.clockedIn ? 'secondary' : 'primary'} onPress={toggle} busy={busy} />
        </Card>
      ) : null}

      {mine && minePump ? (
        <Card tone="green">
          <H2>{minePump.code} · {minePump.grade}</H2>
          <Sub style={{ marginVertical: 8 }}>{t('openingMeter')} {litres(mine.openingMeterLitres)}</Sub>
          <Btn title={t('closeShift')} onPress={() => setPump(minePump)} />
        </Card>
      ) : (
        <>
          <H2>{t('openShift')}</H2>
          <View style={{ height: 10 }} />
          {idle.length === 0 ? <Empty text={d.loading ? t('loading') : t('noData')} /> : idle.map((p) => <PumpCard key={p.id} pump={p} onPress={() => setPump(p)} />)}
        </>
      )}
    </Screen>
  );
}
