import React from 'react';
import { Text, View } from 'react-native';
import { useData } from '../data';
import { useT } from '../i18n';
import { fcfa, litres } from '../logic';
import { colors } from '../theme';
import { Card, Empty, H1, H2, Pill, Stat, Sub } from '../ui';
import { Screen } from './Screen';

export function ReportsScreen() {
  const d = useData();
  const { t } = useT();
  const s = d.summary;
  const r = d.report;
  return (
    <Screen>
      <H1>{t('reports')}</H1>
      <H2>{t('today')}</H2>
      <View style={{ height: 10 }} />
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
        <Stat label={t('revenue')} value={fcfa(s.revenue)} />
        <Stat label={t('collected')} value={fcfa(s.collected)} />
      </View>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
        <Stat label={t('variance')} value={fcfa(s.variance)} tone={s.variance < 0 ? 'red' : s.variance > 0 ? 'amber' : 'green'} />
        <Stat label={t('soldLitres')} value={litres(s.litresSold)} />
      </View>
      <Sub style={{ marginBottom: 8 }}>{t('shiftsToday')} : {s.count}</Sub>
      {s.byAttendant.length > 0 ? (
        <Card>
          <H2>{t('byAttendant')}</H2>
          {s.byAttendant.map((a) => (
            <View key={a.name} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.line }}>
              <View style={{ flex: 1 }}><Text style={{ fontWeight: '700', color: colors.text, fontSize: 15 }}>{a.name}</Text><Sub>{a.count} · {fcfa(a.revenue)}</Sub></View>
              <Text style={{ fontWeight: '800', color: a.variance < 0 ? colors.red : a.variance > 0 ? colors.amberDark : colors.green }}>{fcfa(a.variance)}</Text>
            </View>
          ))}
        </Card>
      ) : <Empty text={d.loading ? t('loading') : t('noData')} />}

      <View style={{ height: 8 }} />
      {r ? (
        <Card>
          <H2>{t('reports')}</H2>
          <View style={{ height: 10 }} />
          <Row label={t('revenue')} value={fcfa(r.totalRevenueFcfa)} />
          <Row label={t('cogs')} value={fcfa(r.cogsFcfa)} />
          <Row label={t('grossProfit')} value={fcfa(r.grossProfitFcfa)} bold />
          <Row label={t('expenses')} value={fcfa(r.operatingExpensesFcfa)} />
          <Row label={t('vatPayable')} value={fcfa(r.vatPayableFcfa)} />
          <Row label={t('netIncome')} value={fcfa(r.netIncomeFcfa)} bold />
          <View style={{ marginTop: 12 }}><Pill text={r.trialBalanceBalanced ? t('trialOk') : t('trialBad')} tone={r.trialBalanceBalanced ? 'green' : 'red'} /></View>
        </Card>
      ) : d.reportDenied ? <Sub>{t('reportUnavailable')}</Sub> : null}
    </Screen>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 }}>
      <Text style={{ color: colors.sub, fontSize: 15 }}>{label}</Text>
      <Text style={{ color: colors.text, fontSize: 15, fontWeight: bold ? '800' : '600' }}>{value}</Text>
    </View>
  );
}
