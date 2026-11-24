import React from 'react';
import { ActivityIndicator, Modal, StyleSheet, Text, TextInput, TextInputProps, TouchableOpacity, View, ViewStyle } from 'react-native';
import { colors, font, MIN_TOUCH } from '../theme';

export function Card({ children, style, tone }: { children: React.ReactNode; style?: ViewStyle; tone?: 'red' | 'amber' | 'green' | 'blue' }) {
  const toneStyle = tone === 'red' ? { borderColor: '#FCA5A5', backgroundColor: '#FFF7F7' } : tone === 'amber' ? { borderColor: '#FCD34D', backgroundColor: '#FFFBEB' } : tone === 'green' ? { borderColor: '#6EE7B7', backgroundColor: '#F0FDF9' } : tone === 'blue' ? { borderColor: '#7DD3FC', backgroundColor: '#F0F9FF' } : null;
  return <View style={[s.card, toneStyle, style]}>{children}</View>;
}

export function H1({ children }: { children: React.ReactNode }) { return <Text style={s.h1} accessibilityRole="header">{children}</Text>; }
export function H2({ children }: { children: React.ReactNode }) { return <Text style={s.h2} accessibilityRole="header">{children}</Text>; }
export function Sub({ children, style }: { children: React.ReactNode; style?: any }) { return <Text style={[s.sub, style]}>{children}</Text>; }
export function Label({ children }: { children: React.ReactNode }) { return <Text style={s.label}>{children}</Text>; }

export function Btn({ title, onPress, kind = 'primary', disabled, busy, style }: { title: string; onPress: () => void; kind?: 'primary' | 'secondary' | 'danger' | 'ghost'; disabled?: boolean; busy?: boolean; style?: ViewStyle }) {
  const bg = kind === 'primary' ? colors.amber : kind === 'danger' ? colors.red : kind === 'secondary' ? colors.navy : 'transparent';
  const fg = kind === 'ghost' ? colors.navy : '#FFFFFF';
  return (
    <TouchableOpacity accessibilityRole="button" accessibilityLabel={title} disabled={disabled || busy} onPress={onPress} activeOpacity={0.8}
      style={[s.btn, { backgroundColor: bg, opacity: disabled ? 0.45 : 1 }, kind === 'ghost' && { borderWidth: 1, borderColor: colors.line }, style]}>
      {busy ? <ActivityIndicator color={fg} /> : <Text style={[s.btnText, { color: fg }]}>{title}</Text>}
    </TouchableOpacity>
  );
}

export function Field({ label, error, hint, ...props }: TextInputProps & { label: string; error?: string | null; hint?: string }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Label>{label}</Label>
      <TextInput accessibilityLabel={label} placeholderTextColor="#94A3B8" {...props} style={[s.input, error ? { borderColor: colors.red } : null, props.style]} />
      {hint && !error ? <Text style={s.hint}>{hint}</Text> : null}
      {error ? <Text style={s.error}>{error}</Text> : null}
    </View>
  );
}

export function Pill({ text, tone = 'gray' }: { text: string; tone?: 'green' | 'red' | 'amber' | 'gray' | 'blue' }) {
  const map = { green: [colors.greenSoft, colors.green], red: [colors.redSoft, colors.red], amber: [colors.amberSoft, colors.amberDark], gray: ['#F1F5F9', colors.sub], blue: [colors.blueSoft, colors.blue] } as const;
  const [bg, fg] = map[tone];
  return <View style={[s.pill, { backgroundColor: bg }]}><Text style={[s.pillText, { color: fg }]}>{text}</Text></View>;
}

export function Chips<T extends string>({ options, value, onChange }: { options: { id: T; label: string }[]; value: T | null; onChange: (v: T) => void }) {
  return (
    <View style={s.chipRow}>
      {options.map((o) => {
        const on = o.id === value;
        return (
          <TouchableOpacity key={o.id} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => onChange(o.id)} style={[s.chip, on && s.chipOn]}>
            <Text style={[s.chipText, on && s.chipTextOn]}>{o.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export function Bar({ pct, tone }: { pct: number; tone: 'red' | 'amber' | 'green' }) {
  const c = tone === 'red' ? colors.red : tone === 'amber' ? '#D97706' : colors.green;
  return <View style={s.barTrack}><View style={[s.barFill, { width: `${Math.max(2, Math.min(100, pct))}%`, backgroundColor: c }]} /></View>;
}

export function Stat({ label, value, tone }: { label: string; value: string; tone?: 'red' | 'green' | 'amber' }) {
  const c = tone === 'red' ? colors.red : tone === 'green' ? colors.green : tone === 'amber' ? colors.amberDark : colors.text;
  return (
    <View style={s.stat}>
      <Text style={s.statLabel}>{label}</Text>
      <Text style={[s.statValue, { color: c, fontSize: value.length > 15 ? 15 : value.length > 11 ? 17 : font.title }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{value}</Text>
    </View>
  );
}

export function Empty({ text }: { text: string }) { return <View style={{ padding: 24 }}><Text style={[s.sub, { textAlign: 'center' }]}>{text}</Text></View>; }

export function Confirm({ visible, title, body, confirmText, cancelText, onConfirm, onCancel, danger }: { visible: boolean; title: string; body: string; confirmText: string; cancelText: string; onConfirm: () => void; onCancel: () => void; danger?: boolean }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={s.modalBg}>
        <View style={s.modalCard}>
          <Text style={s.h2}>{title}</Text>
          <Text style={[s.sub, { marginTop: 8, marginBottom: 18 }]}>{body}</Text>
          <Btn title={confirmText} kind={danger ? 'danger' : 'primary'} onPress={onConfirm} />
          <View style={{ height: 10 }} />
          <Btn title={cancelText} kind="ghost" onPress={onCancel} />
        </View>
      </View>
    </Modal>
  );
}

export function Banner({ kind, text, onClose }: { kind: 'ok' | 'error' | 'info'; text: string; onClose: () => void }) {
  const bg = kind === 'ok' ? colors.green : kind === 'error' ? colors.red : colors.blue;
  return (
    <TouchableOpacity accessibilityRole="alert" onPress={onClose} activeOpacity={0.9} style={[s.banner, { backgroundColor: bg }]}>
      <Text style={s.bannerText}>{text}</Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.line, padding: 16, marginBottom: 12 },
  h1: { fontSize: font.big - 4, fontWeight: '800', color: colors.text, marginBottom: 4 },
  h2: { fontSize: font.title, fontWeight: '700', color: colors.text },
  sub: { fontSize: font.small, color: colors.sub, lineHeight: 20 },
  label: { fontSize: font.label, fontWeight: '700', color: colors.sub, marginBottom: 6, letterSpacing: 0.2 },
  btn: { minHeight: MIN_TOUCH + 4, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  btnText: { fontSize: font.body, fontWeight: '700' },
  input: { minHeight: MIN_TOUCH, borderWidth: 1.5, borderColor: colors.line, borderRadius: 10, paddingHorizontal: 14, fontSize: font.body + 1, color: colors.text, backgroundColor: '#fff' },
  hint: { fontSize: font.label, color: colors.mute, marginTop: 4 },
  error: { fontSize: font.label, color: colors.red, marginTop: 4, fontWeight: '600' },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, alignSelf: 'flex-start' },
  pillText: { fontSize: 12, fontWeight: '800', letterSpacing: 0.3 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 44, paddingHorizontal: 16, borderRadius: 999, borderWidth: 1.5, borderColor: colors.line, backgroundColor: '#fff', justifyContent: 'center' },
  chipOn: { backgroundColor: colors.navy, borderColor: colors.navy },
  chipText: { fontSize: font.small, fontWeight: '700', color: colors.sub },
  chipTextOn: { color: '#fff' },
  barTrack: { height: 10, borderRadius: 6, backgroundColor: '#E2E8F0', overflow: 'hidden' },
  barFill: { height: 10, borderRadius: 6 },
  stat: { flex: 1, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: colors.line, padding: 12 },
  statLabel: { fontSize: font.label, color: colors.mute, fontWeight: '600', marginBottom: 4 },
  statValue: { fontSize: font.title, fontWeight: '800' },
  modalBg: { flex: 1, backgroundColor: 'rgba(15,23,42,0.55)', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: '#fff', borderRadius: 16, padding: 20 },
  banner: { paddingHorizontal: 16, paddingVertical: 12 },
  bannerText: { color: '#fff', fontSize: font.small, fontWeight: '700' },
});
