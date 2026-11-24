import React, { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import type { TankDto } from '../api/opesfuelMobileClient';
import { errorText, useData } from '../data';
import { useT } from '../i18n';
import { dipGap, dipGapIsLarge, litres, parseNumber, tankIsLow, tankPct } from '../logic';
import { useNotify } from '../notify';
import { colors } from '../theme';
import { Bar, Btn, Card, Empty, Field, H1, H2, Pill, Sub } from '../ui';
import { Screen } from './Screen';

export function TanksScreen() {
  const d = useData();
  const { t } = useT();
  const [tank, setTank] = useState<TankDto | null>(null);
  if (tank) return <DipFlow tank={tank} onDone={() => setTank(null)} />;
  return (
    <Screen>
      <H1>{t('tanks')}</H1>
      {d.tanks.length === 0 ? <Empty text={d.loading ? t('loading') : t('noData')} /> : d.tanks.map((x) => {
        const low = tankIsLow(x), gap = dipGapIsLarge(x);
        const pct = tankPct(x);
        const tone = low ? 'red' : gap ? 'amber' : 'green';
        return (
          <TouchableOpacity key={x.id} accessibilityRole="button" onPress={() => setTank(x)} activeOpacity={0.85}>
            <Card tone={low ? 'red' : gap ? 'amber' : undefined}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <Text style={{ fontSize: 17, fontWeight: '800', color: colors.text, flex: 1, paddingRight: 8 }}>{x.name}</Text>
                <Pill text={low ? t('lowStock') : gap ? t('dipGap', { l: Math.abs(dipGap(x)) }) : t('nominal')} tone={low ? 'red' : gap ? 'amber' : 'green'} />
              </View>
              <Bar pct={pct} tone={tone} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                <Text style={{ fontSize: 15, fontWeight: '800', color: low ? colors.red : colors.text }}>{Math.round(pct)} % · {litres(x.bookVolumeLitres)}</Text>
                <Sub>{t('capacity')} {litres(x.capacityLitres)}</Sub>
              </View>
              <Sub style={{ marginTop: 4 }}>{t('lastDip')} : {litres(x.lastDipLitres)}</Sub>
            </Card>
          </TouchableOpacity>
        );
      })}
    </Screen>
  );
}

function DipFlow({ tank, onDone }: { tank: TankDto; onDone: () => void }) {
  const d = useData();
  const { t } = useT();
  const notify = useNotify();
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const num = value.trim() === '' ? null : parseNumber(value);
  const bad = value.trim() !== '' && (num === null || num < 0 || num > tank.capacityLitres * 1.05);
  const preview = num !== null && !bad ? Math.round((num - tank.bookVolumeLitres) * 10) / 10 : null;
  const canWrite = d.session.role !== 'ACCOUNTANT';

  const save = async () => {
    if (num === null) return;
    setBusy(true); setError(null);
    try {
      const r = await d.client.recordDipstick(tank.id, num, `Dip ${tank.name}`);
      notify(r.status === 'SYNCED' ? 'ok' : 'info', r.status === 'SYNCED' ? t('dipSaved', { name: tank.name }) : t('savedOnPhone'));
      await d.refresh(); await d.refreshQueue(); onDone();
    } catch (e) { setError(errorText(e, t)); } finally { setBusy(false); }
  };

  return (
    <Screen>
      <Btn title={t('back')} kind="ghost" onPress={onDone} style={{ alignSelf: 'flex-start', marginBottom: 12 }} />
      <H1>{tank.name}</H1>
      <Sub>{t('book')} {litres(tank.bookVolumeLitres)} · {t('lastDip')} {litres(tank.lastDipLitres)}</Sub>
      {canWrite ? (
        <Card style={{ marginTop: 14 }}>
          <H2>{t('recordDip')}</H2>
          <View style={{ height: 12 }} />
          <Field label={t('measured')} keyboardType="decimal-pad" value={value} onChangeText={setValue} placeholder={String(Math.round(tank.lastDipLitres))} error={bad ? t('errNumber') : null} />
          {preview !== null ? <Text style={{ fontWeight: '800', fontSize: 16, color: Math.abs(preview) / tank.capacityLitres * 100 > 0.5 ? colors.amberDark : colors.green, marginBottom: 12 }}>{t('dipGap', { l: preview })}</Text> : null}
          {error ? <Text style={{ color: colors.red, fontWeight: '600', marginBottom: 10 }}>{error}</Text> : null}
          <Btn title={t('save')} onPress={save} busy={busy} disabled={num === null || bad} />
        </Card>
      ) : null}
    </Screen>
  );
}
