import React, { useMemo, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { errorText, useData } from '../data';
import { useT } from '../i18n';
import { fcfa, parseNumber } from '../logic';
import { useNotify } from '../notify';
import { colors } from '../theme';
import { Btn, Card, Chips, Confirm, Empty, Field, H1, H2, Pill, Sub } from '../ui';
import { Screen } from './Screen';

export function SellScreen() {
  const { t } = useT();
  const [mode, setMode] = useState<'fleet' | 'shop'>('fleet');
  return (
    <Screen>
      <H1>{t('sell')}</H1>
      <View style={{ marginBottom: 14 }}>
        <Chips options={[{ id: 'fleet', label: t('fleetVoucher') }, { id: 'shop', label: t('shopSale') }]} value={mode} onChange={setMode} />
      </View>
      {mode === 'fleet' ? <FleetVoucher /> : <ShopSale />}
    </Screen>
  );
}

function FleetVoucher() {
  const d = useData();
  const { t } = useT();
  const notify = useNotify();
  const [accountId, setAccountId] = useState<string | null>(null);
  const [plate, setPlate] = useState('');
  const [driver, setDriver] = useState('');
  const [grade, setGrade] = useState<string | null>(null);
  const [litresText, setLitresText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ask, setAsk] = useState(false);

  const grades = useMemo(() => [...new Set(d.pumps.map((p) => p.grade))], [d.pumps]);
  const lit = litresText.trim() === '' ? null : parseNumber(litresText);
  const valid = Boolean(accountId && plate.trim() && driver.trim() && grade && lit !== null && lit > 0);
  const account = d.fleets.find((f) => f.id === accountId);

  const submit = async () => {
    setAsk(false); setBusy(true); setError(null);
    try {
      const r = await d.client.recordFleetVoucher({ accountId: accountId!, stationId: d.stationId ?? '', vehiclePlate: plate.trim().toUpperCase(), driverName: driver.trim(), grade: grade!, litres: lit! }, `Voucher ${plate}`);
      notify(r.status === 'SYNCED' ? 'ok' : 'info', r.status === 'SYNCED' ? t('voucherSaved', { plate: plate.trim().toUpperCase() }) : t('savedOnPhone'));
      setPlate(''); setDriver(''); setLitresText('');
      await d.refresh(); await d.refreshQueue();
    } catch (e) { setError(errorText(e, t)); } finally { setBusy(false); }
  };

  if (d.fleets.length === 0) return <Empty text={d.loading ? t('loading') : t('noAccounts')} />;
  return (
    <Card>
      <Sub style={{ marginBottom: 8 }}>{t('chooseAccount')}</Sub>
      <Chips options={d.fleets.filter((f) => f.status === 'ACTIVE').map((f) => ({ id: f.id, label: f.companyName }))} value={accountId} onChange={setAccountId} />
      {account ? <Sub style={{ marginTop: 8, marginBottom: 4 }}>{t('balance')} {fcfa(account.balanceOwedFcfa)} / {t('limit')} {fcfa(account.creditLimitFcfa)}</Sub> : null}
      <View style={{ height: 14 }} />
      <Field label={t('plate')} autoCapitalize="characters" value={plate} onChangeText={setPlate} placeholder="LT-482-AK" />
      <Field label={t('driver')} value={driver} onChangeText={setDriver} />
      <Sub style={{ marginBottom: 8 }}>{t('grade')}</Sub>
      <View style={{ marginBottom: 14 }}><Chips options={grades.map((g) => ({ id: g, label: g }))} value={grade} onChange={setGrade} /></View>
      <Field label={t('litresDispensed')} keyboardType="decimal-pad" value={litresText} onChangeText={setLitresText} placeholder="0" />
      {error ? <Text style={{ color: colors.red, fontWeight: '600', marginBottom: 10 }}>{error}</Text> : null}
      <Btn title={t('postVoucher')} onPress={() => setAsk(true)} busy={busy} disabled={!valid} />
      <Confirm visible={ask} title={t('postVoucher')} body={`${plate.trim().toUpperCase()} · ${grade} · ${lit} L`} confirmText={t('confirm')} cancelText={t('cancel')} onConfirm={submit} onCancel={() => setAsk(false)} />
    </Card>
  );
}

function ShopSale() {
  const d = useData();
  const { t } = useT();
  const notify = useNotify();
  const [itemId, setItemId] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [pay, setPay] = useState<'CASH' | 'MOBILE_MONEY' | 'CARD'>('CASH');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const item = d.items.find((i) => i.id === itemId);

  const submit = async () => {
    if (!item) return;
    setBusy(true); setError(null);
    try {
      const r = await d.client.recordShopSale(item.id, qty, pay, `Sale ${item.name}`);
      notify(r.status === 'SYNCED' ? 'ok' : 'info', r.status === 'SYNCED' ? t('saleSaved', { name: item.name }) : t('savedOnPhone'));
      setQty(1); setItemId(null);
      await d.refresh(); await d.refreshQueue();
    } catch (e) { setError(errorText(e, t)); } finally { setBusy(false); }
  };

  if (d.items.length === 0) return <Empty text={d.loading ? t('loading') : t('noItems')} />;
  return (
    <>
      {d.items.map((i) => {
        const on = i.id === itemId; const out = i.stockQty <= 0;
        return (
          <TouchableOpacity key={i.id} accessibilityRole="button" disabled={out} onPress={() => { setItemId(i.id); setQty(1); }} activeOpacity={0.85}>
            <Card style={on ? { borderColor: colors.amber, borderWidth: 2 } : out ? { opacity: 0.55 } : undefined}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text, flex: 1, paddingRight: 8 }}>{i.name}</Text>
                <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>{fcfa(i.unitPriceFcfa)}</Text>
              </View>
              <View style={{ marginTop: 6 }}><Pill text={out ? t('outOfStock') : t('inStock', { n: i.stockQty })} tone={out ? 'red' : i.stockQty <= i.reorderLevel ? 'amber' : 'green'} /></View>
            </Card>
          </TouchableOpacity>
        );
      })}
      {item ? (
        <Card>
          <H2>{item.name}</H2>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 14, gap: 16 }}>
            <Btn title="−" kind="ghost" onPress={() => setQty(Math.max(1, qty - 1))} style={{ width: 64 }} />
            <Text style={{ fontSize: 26, fontWeight: '800', minWidth: 40, textAlign: 'center' }}>{qty}</Text>
            <Btn title="+" kind="ghost" onPress={() => setQty(Math.min(item.stockQty, qty + 1))} style={{ width: 64 }} />
          </View>
          <Sub style={{ marginBottom: 8 }}>{t('payment')}</Sub>
          <View style={{ marginBottom: 14 }}>
            <Chips options={(['CASH', 'MOBILE_MONEY', 'CARD'] as const).map((p) => ({ id: p, label: t(`pay${p}`) }))} value={pay} onChange={setPay} />
          </View>
          <Text style={{ fontSize: 20, fontWeight: '800', marginBottom: 12 }}>{t('total')} : {fcfa(qty * item.unitPriceFcfa)}</Text>
          {error ? <Text style={{ color: colors.red, fontWeight: '600', marginBottom: 10 }}>{error}</Text> : null}
          <Btn title={t('recordSale')} onPress={submit} busy={busy} />
        </Card>
      ) : null}
    </>
  );
}
