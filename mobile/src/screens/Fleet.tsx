import React from 'react';
import { Text, View } from 'react-native';
import { useData } from '../data';
import { useT } from '../i18n';
import { fcfa } from '../logic';
import { colors } from '../theme';
import { Bar, Card, Empty, H1, Pill, Sub } from '../ui';
import { Screen } from './Screen';

export function FleetScreen() {
  const d = useData();
  const { t } = useT();
  return (
    <Screen>
      <H1>{t('tabFleet')}</H1>
      {d.fleets.length === 0 ? <Empty text={d.loading ? t('loading') : t('noAccounts')} /> : d.fleets.map((f) => {
        const pct = f.creditLimitFcfa > 0 ? (f.balanceOwedFcfa / f.creditLimitFcfa) * 100 : 0;
        const tone = pct >= 90 ? 'red' : pct >= 70 ? 'amber' : 'green';
        return (
          <Card key={f.id} tone={pct >= 90 ? 'red' : undefined}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text, flex: 1, paddingRight: 8 }}>{f.companyName}</Text>
              <Pill text={f.status} tone={f.status === 'ACTIVE' ? 'green' : 'gray'} />
            </View>
            <Bar pct={pct} tone={tone} />
            <Sub style={{ marginTop: 8 }}>{t('balance')} {fcfa(f.balanceOwedFcfa)} · {t('limit')} {fcfa(f.creditLimitFcfa)}</Sub>
          </Card>
        );
      })}
    </Screen>
  );
}
