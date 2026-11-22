import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

export type SupportedCurrency =
  | 'XAF'
  | 'USD'
  | 'EUR'
  | 'GBP'
  | 'NGN'
  | 'GHS'
  | 'KES'
  | 'ZAR'
  | 'XOF'
  | 'CAD'
  | 'MAD'
  | 'AED';

export interface CurrencyMeta {
  code: SupportedCurrency;
  symbol: string;
  name: string;
  region: string;
  decimals: number;
}

export const SUPPORTED_CURRENCIES: CurrencyMeta[] = [
  { code: 'USD', symbol: '$', name: 'US Dollar', region: 'International', decimals: 0 },
  { code: 'XAF', symbol: 'FCFA', name: 'CEMAC CFA Franc', region: 'CEMAC Zone', decimals: 0 },
  { code: 'XOF', symbol: 'CFA', name: 'WAEMU CFA Franc', region: 'West Africa', decimals: 0 },
  { code: 'EUR', symbol: '€', name: 'Euro', region: 'Europe', decimals: 0 },
  { code: 'GBP', symbol: '£', name: 'British Pound', region: 'United Kingdom', decimals: 0 },
  { code: 'NGN', symbol: '₦', name: 'Nigerian Naira', region: 'Nigeria', decimals: 0 },
  { code: 'GHS', symbol: 'GH₵', name: 'Ghanaian Cedi', region: 'Ghana', decimals: 0 },
  { code: 'KES', symbol: 'KSh', name: 'Kenyan Shilling', region: 'Kenya', decimals: 0 },
  { code: 'ZAR', symbol: 'R', name: 'South African Rand', region: 'South Africa', decimals: 0 },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar', region: 'Canada', decimals: 0 },
  { code: 'MAD', symbol: 'MAD', name: 'Moroccan Dirham', region: 'Morocco', decimals: 0 },
  { code: 'AED', symbol: 'AED', name: 'UAE Dirham', region: 'UAE', decimals: 0 },
];

// CEMAC member countries (Cameroon, Gabon, Congo, Chad, CAR, Equatorial Guinea)
export const CEMAC_COUNTRIES = new Set(['CM', 'GA', 'CG', 'TD', 'CF', 'GQ']);

const COUNTRY_TO_CURRENCY: Record<string, SupportedCurrency> = {
  CM: 'XAF', GA: 'XAF', CG: 'XAF', TD: 'XAF', CF: 'XAF', GQ: 'XAF',
  CI: 'XOF', SN: 'XOF', BJ: 'XOF', TG: 'XOF', ML: 'XOF', BF: 'XOF', NE: 'XOF', GW: 'XOF',
  NG: 'NGN', GH: 'GHS', KE: 'KES', ZA: 'ZAR', MA: 'MAD', AE: 'AED',
  GB: 'GBP', CA: 'CAD', US: 'USD',
  FR: 'EUR', DE: 'EUR', BE: 'EUR', ES: 'EUR', IT: 'EUR', NL: 'EUR', PT: 'EUR', IE: 'EUR',
};

const TIMEZONE_TO_COUNTRY: Record<string, string> = {
  'Africa/Douala': 'CM',
  'Africa/Libreville': 'GA',
  'Africa/Brazzaville': 'CG',
  'Africa/Ndjamena': 'TD',
  'Africa/Bangui': 'CF',
  'Africa/Malabo': 'GQ',
  'Africa/Lagos': 'NG',
  'Africa/Accra': 'GH',
  'Africa/Nairobi': 'KE',
  'Africa/Johannesburg': 'ZA',
  'Africa/Abidjan': 'CI',
  'Africa/Dakar': 'SN',
  'Africa/Casablanca': 'MA',
  'Asia/Dubai': 'AE',
  'Europe/London': 'GB',
  'Europe/Paris': 'FR',
  'Europe/Berlin': 'DE',
  'Europe/Brussels': 'BE',
  'America/Toronto': 'CA',
  'America/New_York': 'US',
  'America/Chicago': 'US',
  'America/Denver': 'US',
  'America/Los_Angeles': 'US',
};

// Baseline BEAC/ECB/market FX rates per 1 XAF (updated live from open.er-api.com when online)
const FALLBACK_RATES_PER_XAF: Record<SupportedCurrency, number> = {
  XAF: 1,
  XOF: 1,
  EUR: 1 / 655.957,
  USD: 1 / 608.5,
  GBP: 1 / 772.0,
  NGN: 2.58,
  GHS: 0.0255,
  KES: 0.212,
  ZAR: 0.0298,
  CAD: 1 / 442.0,
  MAD: 0.0164,
  AED: 0.00604,
};

const RATES_CACHE_KEY = 'opesfuel_live_fx_xaf_v1';
const CURRENCY_PREF_KEY = 'opesfuel_currency_pref_v1';
const GEO_CACHE_KEY = 'opesfuel_geo_country_v1';

interface CurrencyContextValue {
  currency: SupportedCurrency;
  setCurrency: (c: SupportedCurrency) => void;
  detectedCountry: string;
  isCemacVisitor: boolean;
  ratesPerXaf: Record<SupportedCurrency, number>;
  liveRateSource: 'LIVE_FX' | 'REFERENCE_FX';
  ratesUpdatedAt: string;
  convertFromXaf: (amountXaf: number, target?: SupportedCurrency) => number;
  formatFromXaf: (amountXaf: number, target?: SupportedCurrency) => string;
  formatUsdFromXaf: (amountXaf: number) => string;
  xafPerUsd: number;
}

function guessInitialCountry(): string {
  try {
    const cached = window.localStorage.getItem(GEO_CACHE_KEY);
    if (cached && cached.length === 2) return cached.toUpperCase();
  } catch {
    // ignore
  }
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && TIMEZONE_TO_COUNTRY[tz]) return TIMEZONE_TO_COUNTRY[tz];
  } catch {
    // ignore
  }
  try {
    const locale = navigator.language || '';
    const region = locale.split('-')[1]?.toUpperCase();
    if (region && COUNTRY_TO_CURRENCY[region]) return region;
  } catch {
    // ignore
  }
  return 'US';
}

function defaultCurrencyForCountry(country: string): SupportedCurrency {
  if (CEMAC_COUNTRIES.has(country)) return 'XAF';
  return COUNTRY_TO_CURRENCY[country] ?? 'USD';
}

const CurrencyContext = createContext<CurrencyContextValue>({
  currency: 'USD',
  setCurrency: () => {},
  detectedCountry: 'US',
  isCemacVisitor: false,
  ratesPerXaf: FALLBACK_RATES_PER_XAF,
  liveRateSource: 'REFERENCE_FX',
  ratesUpdatedAt: '',
  convertFromXaf: (v) => Math.round(v * FALLBACK_RATES_PER_XAF.USD),
  formatFromXaf: (v) => `$${Math.round(v * FALLBACK_RATES_PER_XAF.USD).toLocaleString('en-US')}`,
  formatUsdFromXaf: (v) => `$${Math.round(v * FALLBACK_RATES_PER_XAF.USD).toLocaleString('en-US')}`,
  xafPerUsd: 609,
});

export const CurrencyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [detectedCountry, setDetectedCountry] = useState<string>(() => guessInitialCountry());
  const [currency, setCurrencyState] = useState<SupportedCurrency>(() => {
    try {
      const saved = window.localStorage.getItem(CURRENCY_PREF_KEY) as SupportedCurrency | null;
      if (saved && SUPPORTED_CURRENCIES.some((c) => c.code === saved)) return saved;
    } catch {
      // ignore
    }
    return defaultCurrencyForCountry(guessInitialCountry());
  });
  const [ratesPerXaf, setRatesPerXaf] = useState<Record<SupportedCurrency, number>>(() => {
    try {
      const raw = window.localStorage.getItem(RATES_CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { rates?: Record<SupportedCurrency, number> };
        if (parsed.rates?.USD) return { ...FALLBACK_RATES_PER_XAF, ...parsed.rates };
      }
    } catch {
      // ignore
    }
    return FALLBACK_RATES_PER_XAF;
  });
  const [liveRateSource, setLiveRateSource] = useState<'LIVE_FX' | 'REFERENCE_FX'>('REFERENCE_FX');
  const [ratesUpdatedAt, setRatesUpdatedAt] = useState<string>(() => new Date().toISOString().slice(0, 10));

  const setCurrency = (next: SupportedCurrency) => {
    setCurrencyState(next);
    try {
      window.localStorage.setItem(CURRENCY_PREF_KEY, next);
    } catch {
      // ignore
    }
  };

  // 1. Fetch LIVE exchange rates (base XAF) and cache for 6 hours
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const raw = window.localStorage.getItem(RATES_CACHE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as {
            fetchedAt: number;
            updatedAt: string;
            rates: Record<SupportedCurrency, number>;
          };
          if (Date.now() - parsed.fetchedAt < 6 * 3600 * 1000 && parsed.rates?.USD) {
            if (active) {
              setRatesPerXaf({ ...FALLBACK_RATES_PER_XAF, ...parsed.rates });
              setLiveRateSource('LIVE_FX');
              setRatesUpdatedAt(parsed.updatedAt);
            }
            return;
          }
        }
      } catch {
        // ignore cache parse errors
      }

      try {
        const controller = new AbortController();
        const timer = window.setTimeout(() => controller.abort(), 4500);
        const res = await fetch('https://open.er-api.com/v6/latest/XAF', { signal: controller.signal });
        window.clearTimeout(timer);
        if (!res.ok) return;
        const data = (await res.json()) as {
          result?: string;
          time_last_update_utc?: string;
          rates?: Record<string, number>;
        };
        if (data.result === 'success' && data.rates?.USD && active) {
          const merged: Record<SupportedCurrency, number> = { ...FALLBACK_RATES_PER_XAF };
          for (const meta of SUPPORTED_CURRENCIES) {
            const liveVal = data.rates[meta.code];
            if (typeof liveVal === 'number' && liveVal > 0) {
              merged[meta.code] = liveVal;
            }
          }
          const updatedAt = data.time_last_update_utc?.slice(0, 16) ?? new Date().toISOString().slice(0, 10);
          setRatesPerXaf(merged);
          setLiveRateSource('LIVE_FX');
          setRatesUpdatedAt(updatedAt);
          try {
            window.localStorage.setItem(
              RATES_CACHE_KEY,
              JSON.stringify({ fetchedAt: Date.now(), updatedAt, rates: merged })
            );
          } catch {
            // ignore storage quota
          }
        }
      } catch {
        // Offline / blocked: keep reliable reference FX table cleanly
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // 2. Non-blocking geo-IP country check (only sets default if user hasn't manually overridden currency)
  useEffect(() => {
    let active = true;
    const hasManualPref = (() => {
      try {
        return Boolean(window.localStorage.getItem(CURRENCY_PREF_KEY));
      } catch {
        return false;
      }
    })();
    const cachedGeo = (() => {
      try {
        return window.localStorage.getItem(GEO_CACHE_KEY);
      } catch {
        return null;
      }
    })();
    if (cachedGeo) return;

    (async () => {
      try {
        const controller = new AbortController();
        const timer = window.setTimeout(() => controller.abort(), 3500);
        const res = await fetch('https://ipwho.is/?fields=country_code,success', { signal: controller.signal });
        window.clearTimeout(timer);
        if (!res.ok) return;
        const data = (await res.json()) as { success?: boolean; country_code?: string };
        const code = data.country_code?.toUpperCase();
        if (data.success && code && code.length === 2 && active) {
          setDetectedCountry(code);
          try {
            window.localStorage.setItem(GEO_CACHE_KEY, code);
          } catch {
            // ignore
          }
          if (!hasManualPref) {
            setCurrencyState(defaultCurrencyForCountry(code));
          }
        }
      } catch {
        // Timezone/locale detection already handled initial value
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const value = useMemo<CurrencyContextValue>(() => {
    const isCemacVisitor = CEMAC_COUNTRIES.has(detectedCountry);
    const convertFromXaf = (amountXaf: number, target: SupportedCurrency = currency) => {
      const rate = ratesPerXaf[target] ?? FALLBACK_RATES_PER_XAF[target];
      const converted = amountXaf * rate;
      if (target === 'XAF' || target === 'XOF') return Math.round(converted);
      return converted >= 100 ? Math.round(converted) : Math.round(converted * 100) / 100;
    };

    const formatCurrencyValue = (amountXaf: number, target: SupportedCurrency = currency) => {
      const val = convertFromXaf(amountXaf, target);
      const meta = SUPPORTED_CURRENCIES.find((c) => c.code === target) ?? SUPPORTED_CURRENCIES[0];
      if (target === 'XAF' || target === 'XOF') {
        return `${Math.round(val).toLocaleString('fr-FR')} ${meta.symbol}`;
      }
      const formattedNum = Number.isInteger(val)
        ? val.toLocaleString('en-US')
        : val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      if (meta.symbol === 'MAD' || meta.symbol === 'AED') {
        return `${formattedNum} ${meta.symbol}`;
      }
      return `${meta.symbol}${formattedNum}`;
    };

    const xafPerUsd = Math.round(1 / (ratesPerXaf.USD || FALLBACK_RATES_PER_XAF.USD));

    return {
      currency,
      setCurrency,
      detectedCountry,
      isCemacVisitor,
      ratesPerXaf,
      liveRateSource,
      ratesUpdatedAt,
      convertFromXaf,
      formatFromXaf: formatCurrencyValue,
      formatUsdFromXaf: (amountXaf: number) => formatCurrencyValue(amountXaf, 'USD'),
      xafPerUsd,
    };
  }, [currency, detectedCountry, ratesPerXaf, liveRateSource, ratesUpdatedAt]);

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
};

export function useCurrency(): CurrencyContextValue {
  return useContext(CurrencyContext);
}
