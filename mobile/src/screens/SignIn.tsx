import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useT } from '../i18n';
import type { Role } from '../logic';
import { colors } from '../theme';
import { Btn, Card, Chips, H2, Sub } from '../ui';

export function SignInScreen({ onSignIn, busy, message, configured, demoEnabled, onDemo }: { onSignIn: () => void; busy: boolean; message: string | null; configured: boolean; demoEnabled: boolean; onDemo: (r: Role) => void }) {
  const { t, lang, setLang } = useT();
  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.navy }} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}>
      <Text style={{ color: '#fff', fontSize: 34, fontWeight: '800', marginBottom: 6 }}>OpesFuel</Text>
      <Text style={{ color: '#94A3B8', fontSize: 15, marginBottom: 28 }}>{t('signInSub')}</Text>
      <View style={{ backgroundColor: '#fff', borderRadius: 18, padding: 20 }}>
        <H2>{t('signInTitle')}</H2>
        <View style={{ height: 16 }} />
        {message ? <Text style={{ color: colors.red, fontWeight: '700', marginBottom: 12 }}>{message}</Text> : null}
        {configured ? <Btn title={t('signInBtn')} onPress={onSignIn} busy={busy} /> : <Text style={{ color: colors.red, fontWeight: '700' }}>{t('notConfigured')}</Text>}
        <View style={{ height: 18 }} />
        <Chips options={[{ id: 'fr', label: t('french') }, { id: 'en', label: t('english') }]} value={lang} onChange={setLang} />
      </View>
      {demoEnabled ? (
        <Card style={{ marginTop: 20 }}>
          <H2>{t('demoTitle')}</H2>
          <Sub style={{ marginVertical: 8 }}>{t('demoSub')}</Sub>
          <Chips options={(['OWNER', 'MANAGER', 'ATTENDANT', 'ACCOUNTANT'] as Role[]).map((r) => ({ id: r, label: t(`role${r}`) }))} value={null} onChange={onDemo} />
        </Card>
      ) : null}
    </ScrollView>
  );
}
