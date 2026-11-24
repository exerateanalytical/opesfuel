import React, { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { ApiError, MobileInstitutionalFuelTemplate } from '../api/opesfuelMobileClient';
import { errorText, useData } from '../data';
import { useT } from '../i18n';
import type { TabId } from '../logic';
import { parseNumber } from '../logic';
import { useNotify } from '../notify';
import { colors } from '../theme';
import { Btn, Card, Chips, Field, H1, H2, Pill, Sub } from '../ui';
import { Screen } from './Screen';

export const APP_VERSION = '1.1.0';

export function MoreScreen({ onGo, onSignOut }: { onGo: (t: TabId | 'setup' | 'ai') => void; onSignOut: () => void }) {
  const d = useData();
  const { t, lang, setLang } = useT();
  const role = d.session.role;
  const manage = role === 'OWNER' || role === 'MANAGER';
  const Row = ({ label, badge, onPress }: { label: string; badge?: string; onPress: () => void }) => (
    <TouchableOpacity accessibilityRole="button" onPress={onPress} activeOpacity={0.85}>
      <Card style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14 }}>
        <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>{label}</Text>
        {badge ? <Pill text={badge} tone="amber" /> : <Text style={{ color: colors.mute, fontSize: 18 }}>›</Text>}
      </Card>
    </TouchableOpacity>
  );
  return (
    <Screen>
      <H1>{t('more')}</H1>
      <Card>
        <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>{d.session.name || '—'}</Text>
        <Sub>{t(`role${role}`)}{d.session.email ? ` · ${d.session.email}` : ''}</Sub>
        {d.session.mode === 'DEMO' ? <View style={{ marginTop: 8 }}><Pill text={t('demoTitle')} tone="blue" /></View> : null}
      </Card>

      {d.stations.length > 1 ? (
        <Card>
          <H2>{t('station')}</H2>
          <View style={{ height: 10 }} />
          <Chips options={d.stations.map((s) => ({ id: s.id, label: s.name }))} value={d.stationId} onChange={d.setStationId} />
        </Card>
      ) : null}

      <Card>
        <H2>{t('language')}</H2>
        <View style={{ height: 10 }} />
        <Chips options={[{ id: 'fr', label: t('french') }, { id: 'en', label: t('english') }]} value={lang} onChange={setLang} />
      </Card>

      <Row label={t('sendTitle')} badge={d.queueCount + d.failedCount > 0 ? String(d.queueCount + d.failedCount) : undefined} onPress={() => onGo('send')} />
      {manage ? <Row label={t('setup')} onPress={() => onGo('setup')} /> : null}
      {manage ? <Row label={t('ai')} onPress={() => onGo('ai')} /> : null}
      <View style={{ height: 8 }} />
      <Btn title={t('signOut')} kind="secondary" onPress={onSignOut} />
      <Text style={{ textAlign: 'center', color: colors.mute, fontSize: 12, marginTop: 14 }}>OpesFuel · {t('version')} {APP_VERSION}</Text>
    </Screen>
  );
}

interface Row { selected: boolean; tpl: MobileInstitutionalFuelTemplate; opening: string; price: string; cost: string; capacity: string }

export function SetupScreen({ onBack }: { onBack: () => void }) {
  const d = useData();
  const { t } = useT();
  const notify = useNotify();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    void d.client.fetchInstitutionalFuels().then((list) => setRows(list.map((f) => ({ selected: f.code === 'SUPER' || f.code === 'GASOIL', tpl: f, opening: String(f.defaultOpeningLitres), price: String(f.defaultSellingPriceFcfa), cost: String(f.defaultUnitCostFcfa), capacity: String(f.defaultCapacityLitres) }))));
  }, [d.client]);

  const chosen = (rows ?? []).filter((r) => r.selected);
  const parsed = chosen.map((r) => ({ r, opening: parseNumber(r.opening), price: parseNumber(r.price), cost: parseNumber(r.cost), capacity: parseNumber(r.capacity) }));
  const valid = parsed.length > 0 && parsed.every((p) => p.opening !== null && p.price !== null && p.cost !== null && p.capacity !== null && p.opening >= 0 && p.opening <= (p.capacity as number) && p.price > 0);

  const save = async () => {
    setBusy(true); setError(null);
    try {
      const items = parsed.map((p) => ({ grade: p.r.tpl.code, tankName: p.r.tpl.tankName, capacityLitres: p.capacity as number, openingLitres: p.opening as number, unitCostFcfa: p.cost as number, sellingPriceFcfa: p.price as number, nozzleCount: p.r.tpl.defaultNozzleCount }));
      const res = await d.client.applyInstitutionalSetup(d.stationId ?? '', items, { includeLubricants: false, oilBottlesQty: 0, lpgCylindersQty: 0 });
      notify(res.status === 'SYNCED' ? 'ok' : 'info', res.status === 'SYNCED' ? t('configSaved') : t('savedOnPhone'));
      await d.refresh(); await d.refreshQueue(); onBack();
    } catch (e) { setError(errorText(e, t)); } finally { setBusy(false); }
  };

  const set = (i: number, patch: Partial<Row>) => setRows((prev) => (prev ? prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)) : prev));
  return (
    <Screen>
      <Btn title={t('back')} kind="ghost" onPress={onBack} style={{ alignSelf: 'flex-start', marginBottom: 12 }} />
      <H1>{t('setup')}</H1>
      <Sub style={{ marginBottom: 12 }}>{t('setupSub')}</Sub>
      {(rows ?? []).map((r, i) => (
        <Card key={r.tpl.code} style={r.selected ? { borderColor: colors.amber, borderWidth: 2 } : undefined}>
          <TouchableOpacity accessibilityRole="checkbox" accessibilityState={{ checked: r.selected }} onPress={() => set(i, { selected: !r.selected })} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 44 }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text, flex: 1 }}>{r.tpl.label}</Text>
            <Pill text={r.selected ? '✓' : '○'} tone={r.selected ? 'amber' : 'gray'} />
          </TouchableOpacity>
          {r.selected ? (
            <View style={{ marginTop: 10 }}>
              <Field label={t('capacity')} keyboardType="number-pad" value={r.capacity} onChangeText={(v) => set(i, { capacity: v })} />
              <Field label={t('openingStock')} keyboardType="number-pad" value={r.opening} onChangeText={(v) => set(i, { opening: v })} />
              <Field label={`${t('priceL', { p: '' }).trim()}`} keyboardType="number-pad" value={r.price} onChangeText={(v) => set(i, { price: v })} />
            </View>
          ) : null}
        </Card>
      ))}
      {error ? <Text style={{ color: colors.red, fontWeight: '600', marginBottom: 10 }}>{error}</Text> : null}
      <Btn title={t('saveConfig')} onPress={save} busy={busy} disabled={!valid} />
    </Screen>
  );
}

export function AiScreen({ onBack }: { onBack: () => void }) {
  const d = useData();
  const { t } = useT();
  const [q, setQ] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ask = async () => {
    setBusy(true); setError(null); setAnswer(null);
    try {
      const snapshot = { tanks: d.tanks.map((x) => ({ name: x.name, grade: x.grade, bookLitres: x.bookVolumeLitres, lastDipLitres: x.lastDipLitres, capacityLitres: x.capacityLitres })), todayRevenueFcfa: d.summary.revenue, todayVarianceFcfa: d.summary.variance, openPumps: d.pumps.filter((p) => p.status === 'ACTIVE_SHIFT').length };
      const r = await d.client.askAiAdvisor(d.stationId ?? '', q.trim(), snapshot);
      setAnswer(r.answer);
    } catch (e) {
      setError(e instanceof ApiError && [402, 403, 404, 503].includes(e.status) ? t('aiUnavailable') : errorText(e, t));
    } finally { setBusy(false); }
  };

  return (
    <Screen>
      <Btn title={t('back')} kind="ghost" onPress={onBack} style={{ alignSelf: 'flex-start', marginBottom: 12 }} />
      <H1>{t('aiTitle')}</H1>
      <Sub style={{ marginBottom: 12 }}>{t('aiSub')}</Sub>
      <Card>
        <Field label={t('ai')} value={q} onChangeText={setQ} placeholder={t('aiPlaceholder')} multiline style={{ minHeight: 80, textAlignVertical: 'top', paddingTop: 12 }} />
        <Btn title={busy ? t('aiThinking') : t('aiAsk')} onPress={ask} busy={busy} disabled={q.trim().length < 3} />
      </Card>
      {error ? <Card tone="amber"><Text style={{ color: colors.amberDark, fontWeight: '700' }}>{error}</Text></Card> : null}
      {answer ? <Card tone="blue"><Text style={{ fontSize: 15, color: colors.text, lineHeight: 22 }}>{answer}</Text></Card> : null}
    </Screen>
  );
}
