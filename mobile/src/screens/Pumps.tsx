import React, { useMemo, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import type { PumpDto } from '../api/opesfuelMobileClient';
import { errorText, useData } from '../data';
import { useT } from '../i18n';
import { fcfa, litres, parseNumber, shiftMath } from '../logic';
import { useNotify } from '../notify';
import { colors } from '../theme';
import { Btn, Card, Chips, Confirm, Empty, Field, H1, H2, Pill, Stat, Sub } from '../ui';
import { Screen } from './Screen';

export function PumpsScreen() {
  const d = useData();
  const { t } = useT();
  const [pump, setPump] = useState<PumpDto | null>(null);
  if (pump) return <PumpFlow pump={pump} onDone={() => setPump(null)} />;
  return (
    <Screen>
      <H1>{t('pumps')}</H1>
      {d.pumps.length === 0 ? <Empty text={d.loading ? t('loading') : t('noData')} /> : d.pumps.map((p) => <PumpCard key={p.id} pump={p} onPress={() => setPump(p)} />)}
    </Screen>
  );
}

export function PumpCard({ pump, onPress }: { pump: PumpDto; onPress: () => void }) {
  const d = useData();
  const { t } = useT();
  const shift = d.shifts.find((s) => s.pumpId === pump.id && s.status === 'OPEN');
  const open = pump.status === 'ACTIVE_SHIFT';
  return (
    <TouchableOpacity accessibilityRole="button" onPress={onPress} activeOpacity={0.85}>
      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>{pump.code} · {pump.grade}</Text>
          <Pill text={open ? t('pumpOpen') : t('pumpIdle')} tone={open ? 'green' : 'gray'} />
        </View>
        {shift ? <Sub style={{ marginTop: 6 }}>{t('attendant')} : {shift.attendantName}</Sub> : null}
        <Sub style={{ marginTop: 4 }}>{t('meter')} {litres(pump.totalizerLitres)} · {t('priceL', { p: pump.unitPriceFcfa })}</Sub>
      </Card>
    </TouchableOpacity>
  );
}

/** Open or close a shift on one pump. Closing shows the cash variance live, before anything is sent. */
export function PumpFlow({ pump, onDone }: { pump: PumpDto; onDone: () => void }) {
  const d = useData();
  const { t } = useT();
  const notify = useNotify();
  const shift = useMemo(() => d.shifts.find((s) => s.pumpId === pump.id && s.status === 'OPEN') ?? null, [d.shifts, pump.id]);
  const role = d.session.role;

  const attendants = d.employees.filter((e) => e.role === 'ATTENDANT');
  const [attendantId, setAttendantId] = useState<string | null>(role === 'ATTENDANT' ? d.me?.id ?? null : null);
  const [closing, setClosing] = useState('');
  const [cash, setCash] = useState('');
  const [momo, setMomo] = useState('');
  const [card, setCard] = useState('');
  const [fleet, setFleet] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [askConfirm, setAskConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sid = d.stationId ?? '';

  const doOpen = async () => {
    if (!attendantId) { setError(role === 'ATTENDANT' ? t('noEmployee') : t('chooseAttendant')); return; }
    setBusy(true); setError(null);
    try {
      const r = await d.client.openShift(sid, pump.id, attendantId, `Open ${pump.code}`);
      notify(r.status === 'SYNCED' ? 'ok' : 'info', r.status === 'SYNCED' ? t('shiftOpened', { pump: pump.code }) : t('savedOnPhone'));
      await d.refresh(); await d.refreshQueue(); onDone();
    } catch (e) { setError(errorText(e, t)); } finally { setBusy(false); }
  };

  if (!shift) {
    return (
      <Screen>
        <Btn title={t('back')} kind="ghost" onPress={onDone} style={{ alignSelf: 'flex-start', marginBottom: 12 }} />
        <H1>{pump.code} · {pump.grade}</H1>
        <Sub>{t('meter')} {litres(pump.totalizerLitres)} · {t('priceL', { p: pump.unitPriceFcfa })}</Sub>
        <Card style={{ marginTop: 14 }}>
          <H2>{t('openShift')}</H2>
          {role === 'ATTENDANT' ? (
            d.me ? <Sub style={{ marginVertical: 10 }}>{t('attendant')} : {d.me.fullName}</Sub> : <Text style={{ color: colors.red, marginVertical: 10, fontWeight: '600' }}>{t('noEmployee')}</Text>
          ) : attendants.length === 0 ? (
            <Text style={{ color: colors.red, marginVertical: 10, fontWeight: '600' }}>{t('noAttendants')}</Text>
          ) : (
            <View style={{ marginVertical: 12 }}>
              <Sub style={{ marginBottom: 8 }}>{t('chooseAttendant')}</Sub>
              <Chips options={attendants.map((a) => ({ id: a.id, label: a.fullName }))} value={attendantId} onChange={setAttendantId} />
            </View>
          )}
          {error ? <Text style={{ color: colors.red, fontWeight: '600', marginBottom: 10 }}>{error}</Text> : null}
          <Btn title={t('openShift')} onPress={doOpen} busy={busy} disabled={!attendantId} />
        </Card>
      </Screen>
    );
  }

  const mine = role !== 'ATTENDANT' || (d.me && shift.attendantId === d.me.id);
  const n = (v: string) => (v.trim() === '' ? 0 : parseNumber(v));
  const closingNum = closing.trim() === '' ? null : parseNumber(closing);
  const parts = [n(cash), n(momo), n(card), n(fleet)];
  const numbersOk = parts.every((x) => x !== null && x >= 0);
  const collected = numbersOk ? (parts as number[]).reduce((a, b) => a + b, 0) : 0;
  const m = shiftMath(shift.openingMeterLitres, closingNum, shift.unitPriceFcfa, collected);
  const needsReason = m.valid && m.variance !== 0;
  const tone = !m.valid ? undefined : m.variance === 0 ? 'green' : m.variance < 0 ? 'red' : 'amber';
  const meterErr = closing.trim() !== '' && closingNum === null ? t('errNumber') : closingNum !== null && closingNum <= shift.openingMeterLitres ? t('meterTooLow', { m: litres(shift.openingMeterLitres) }) : null;
  const blocker = !m.valid ? (closing.trim() === '' ? t('fillMeter') : meterErr ?? t('fillMeter')) : !numbersOk ? t('errNumber') : needsReason && reason.trim().length < 3 ? t('reasonRequired') : null;
  const varText = !m.valid ? '—' : m.variance === 0 ? t('varianceOk') : m.variance < 0 ? t('varianceShort', { amount: fcfa(Math.abs(m.variance)) }) : t('varianceOver', { amount: fcfa(m.variance) });

  const doClose = async () => {
    setAskConfirm(false); setBusy(true); setError(null);
    try {
      const r = await d.client.closeShift(shift.id, { closingMeterLitres: closingNum as number, cashFcfa: n(cash) as number, mobileMoneyFcfa: n(momo) as number, cardFcfa: n(card) as number, fleetCreditFcfa: n(fleet) as number, ...(needsReason ? { varianceReason: reason.trim() } : {}) }, `Close ${pump.code}`);
      notify(r.status === 'SYNCED' ? 'ok' : 'info', r.status === 'SYNCED' ? t('shiftClosed', { pump: pump.code }) : t('savedOnPhone'));
      await d.refresh(); await d.refreshQueue(); onDone();
    } catch (e) { setError(errorText(e, t)); } finally { setBusy(false); }
  };

  return (
    <Screen>
      <Btn title={t('back')} kind="ghost" onPress={onDone} style={{ alignSelf: 'flex-start', marginBottom: 12 }} />
      <H1>{pump.code} · {pump.grade}</H1>
      <Sub>{t('attendant')} : {shift.attendantName} · {t('openingMeter')} {litres(shift.openingMeterLitres)}</Sub>
      {!mine ? <Card tone="amber" style={{ marginTop: 14 }}><Sub>{t('attendant')} : {shift.attendantName}</Sub></Card> : (
        <Card style={{ marginTop: 14 }}>
          <H2>{t('closeShift')}</H2>
          <View style={{ height: 12 }} />
          <Card tone={tone as any} style={{ marginBottom: 14 }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Stat label={t('soldLitres')} value={m.valid ? litres(m.sold) : '—'} />
              <Stat label={t('expected')} value={m.valid ? fcfa(m.expected) : '—'} />
            </View>
            <View style={{ height: 8 }} />
            <Stat label={t('collectedTotal')} value={fcfa(collected)} />
            <Text style={{ marginTop: 12, fontSize: 18, fontWeight: '800', color: tone === 'red' ? colors.red : tone === 'green' ? colors.green : tone === 'amber' ? colors.amberDark : colors.mute }} accessibilityLiveRegion="polite">{varText}</Text>
          </Card>

          <Field label={t('closingMeter')} hint={t('closingMeterHelp')} keyboardType="decimal-pad" value={closing} onChangeText={setClosing} placeholder={String(shift.openingMeterLitres)} error={meterErr} />
          <Field label={t('cash')} keyboardType="number-pad" value={cash} onChangeText={setCash} placeholder="0" />
          <Field label={t('momo')} keyboardType="number-pad" value={momo} onChangeText={setMomo} placeholder="0" />
          <Field label={t('card')} keyboardType="number-pad" value={card} onChangeText={setCard} placeholder="0" />
          <Field label={t('fleetCredit')} keyboardType="number-pad" value={fleet} onChangeText={setFleet} placeholder="0" />

          {needsReason ? <View style={{ marginTop: 12 }}><Field label={t('varianceReason')} value={reason} onChangeText={setReason} multiline /></View> : null}
          {error ? <Text style={{ color: colors.red, fontWeight: '600', marginVertical: 10 }}>{error}</Text> : null}
          {blocker && closing.trim() !== '' ? <Text style={{ color: colors.mute, marginVertical: 8 }}>{blocker}</Text> : null}
          <Btn title={t('closeShift')} onPress={() => setAskConfirm(true)} busy={busy} disabled={Boolean(blocker)} />
        </Card>
      )}
      <Confirm visible={askConfirm} title={t('closeConfirmTitle')} body={t('closeConfirmBody', { v: varText })} confirmText={t('confirm')} cancelText={t('cancel')} onConfirm={doClose} onCancel={() => setAskConfirm(false)} danger={m.valid && m.variance < 0} />
    </Screen>
  );
}
