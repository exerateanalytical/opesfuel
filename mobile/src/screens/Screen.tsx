import React, { useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { useData } from '../data';
import { useT } from '../i18n';
import { colors } from '../theme';

export function Screen({ children }: { children: React.ReactNode }) {
  const d = useData();
  const { t } = useT();
  const [refreshing, setRefreshing] = useState(false);
  const time = d.lastUpdated ? new Date(d.lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null;
  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 32 }} keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); try { await d.flush().catch(() => {}); await d.refresh(); } finally { setRefreshing(false); } }} />}>
      {d.stale ? (
        <View style={{ backgroundColor: '#FEF3C7', borderRadius: 10, padding: 10, marginBottom: 12 }}>
          <Text style={{ color: colors.amberDark, fontWeight: '700', fontSize: 13 }}>{t('offline')}{time ? ` · ${t('updatedAt', { time })}` : ''}</Text>
        </View>
      ) : null}
      {children}
      {time && !d.stale ? <Text style={{ textAlign: 'center', color: colors.mute, fontSize: 12, marginTop: 8 }}>{t('updatedAt', { time })} · {t('pullToRefresh')}</Text> : null}
    </ScrollView>
  );
}
