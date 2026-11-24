import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useData } from '../data';
import { useT } from '../i18n';
import { fcfa } from '../logic';
import type { TabId } from '../logic';
import { colors } from '../theme';
import { Card, H1, H2, Stat, Sub } from '../ui';
import { Screen } from './Screen';

export function HomeScreen({ onGo }: { onGo: (t: TabId) => void }) {
  const d = useData();
  const { t } = useT();
  const open = d.pumps.filter((p) => p.status === 'ACTIVE_SHIFT').length;
  const s = d.summary;
  const showMoney = d.session.role !== 'ATTENDANT';
  return (
    <Screen>
      <H1>{t('hello', { name: d.session.name || t(`role${d.session.role}`) })}</H1>
      {showMoney ? (
        <>
          <H2>{t('todayMoney')}</H2>
          <View style={{ height: 10 }} />
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
            <Stat label={t('revenue')} value={fcfa(s.revenue)} />
            <Stat label={t('collected')} value={fcfa(s.collected)} />
          </View>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
            <Stat label={t('variance')} value={fcfa(s.variance)} tone={s.variance < 0 ? 'red' : s.variance > 0 ? 'amber' : 'green'} />
            <Stat label={t('pumpsOpen')} value={t('openOfTotal', { open, total: d.pumps.length })} />
          </View>
        </>
      ) : null}

      <H2>{t('alerts')}</H2>
      <View style={{ height: 10 }} />
      {d.alerts.length === 0 ? (
        <Card tone="green"><Text style={{ color: colors.green, fontWeight: '700', fontSize: 15 }}>✓ {t('allGood')}</Text></Card>
      ) : d.alerts.map((a) => (
        <TouchableOpacity key={a.id} accessibilityRole="button" onPress={() => a.go && onGo(a.go as TabId)} activeOpacity={0.85}>
          <Card tone={a.level}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: a.level === 'red' ? colors.red : a.level === 'amber' ? colors.amberDark : colors.blue }}>{t(a.key, a.vars)}</Text>
          </Card>
        </TouchableOpacity>
      ))}
      {d.loading && d.pumps.length === 0 ? <Sub>{t('loading')}</Sub> : null}
    </Screen>
  );
}
