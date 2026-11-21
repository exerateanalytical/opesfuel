import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  History,
  Lock,
  MessageSquare,
  RefreshCw,
  Send,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { OpesFuelApiEngine } from '../../api/opesfuelClient';
import { canPerformAction } from '../../auth/auth0';
import { formatFcfa, formatLitres, formatShortDate } from '../../domain/formatters';
import {
  AiAnalysisReport,
  ConsoleSection,
  FinancialReportBundle,
  FleetAccount,
  FuelTank,
  Pump,
  ShiftRecord,
  Station,
  TenantWorkspace,
  UserRole,
} from '../../domain/types';
import { OpesFuelLogo } from '../brand/OpesFuelLogo';

interface AiAssistantSectionProps {
  engine: OpesFuelApiEngine;
  accessToken?: string | null;
  tenant: TenantWorkspace;
  role: UserRole;
  activeStationId: string;
  stations: Station[];
  tanks: FuelTank[];
  pumps: Pump[];
  shifts: ShiftRecord[];
  fleetAccounts: FleetAccount[];
  report: FinancialReportBundle;
  onToggleAiSubscription: (enable: boolean) => void;
  onJumpTo: (section: ConsoleSection) => void;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

const VALID_JUMP_SECTIONS: ConsoleSection[] = [
  'overview',
  'forecourt',
  'inventory',
  'fleet',
  'workforce',
  'accounting',
  'admin',
];

export const AiAssistantSection: React.FC<AiAssistantSectionProps> = ({
  engine,
  accessToken,
  tenant,
  role,
  activeStationId,
  stations,
  tanks,
  pumps,
  shifts,
  fleetAccounts,
  report,
  onToggleAiSubscription,
  onJumpTo,
}) => {
  const canManageAi = canPerformAction(role, 'MANAGE_AI_ADDON');
  const aiSub = tenant.aiSubscription;
  const hasEnterprisePlan = stations.some((s) => s.monthlyFeeFcfa >= 120000);
  const effectiveToken = accessToken ?? engine.getAccessToken();

  const [analysis, setAnalysis] = useState<AiAnalysisReport | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [auditHistory, setAuditHistory] = useState<Array<Record<string, unknown>>>([]);

  const loadHistory = useCallback(async () => {
    const scope = activeStationId === 'ALL' ? stations[0]?.id ?? 'ALL' : activeStationId;
    const list = await engine.fetchAiHistory(scope, effectiveToken).catch(() => []);
    setAuditHistory(Array.isArray(list) ? list : []);
  }, [engine, activeStationId, stations, effectiveToken]);

  useEffect(() => {
    if (aiSub.active) {
      void loadHistory();
    }
  }, [aiSub.active, loadHistory]);

  const metricsPayload = useMemo(() => {
    const scopedTanks = tanks.filter((t) => activeStationId === 'ALL' || t.stationId === activeStationId);
    const scopedPumps = pumps.filter((p) => activeStationId === 'ALL' || p.stationId === activeStationId);
    const scopedShifts = shifts.filter((s) => activeStationId === 'ALL' || s.stationId === activeStationId);
    return {
      organizationName: tenant.organizationName,
      stationScope: activeStationId,
      stationCount: stations.length,
      stations: stations.map((s) => ({
        id: s.id,
        name: s.name,
        city: s.city,
        planName: s.planName,
        pricesFcfaPerLitre: s.prices,
      })),
      tanks: scopedTanks.map((t) => ({
        id: t.id,
        name: t.name,
        grade: t.grade,
        capacityLitres: t.capacityLitres,
        bookVolumeLitres: t.bookVolumeLitres,
        lastDipLitres: t.lastDipLitres,
        varianceLitres: t.varianceLitres,
        unitCostFcfa: t.unitCostFcfa,
        status: t.status,
      })),
      pumpsCount: scopedPumps.length,
      activeShiftsCount: scopedShifts.filter((s) => s.status === 'OPEN').length,
      closedShiftsSummary: scopedShifts
        .filter((s) => s.status === 'CLOSED')
        .slice(0, 10)
        .map((s) => ({
          id: s.id,
          grade: s.grade,
          litresSold: s.litresSold,
          expectedRevenueFcfa: s.expectedRevenueFcfa,
          varianceFcfa: s.varianceFcfa,
        })),
      fleetAccounts: fleetAccounts.map((f) => ({
        companyName: f.companyName,
        balanceOwedFcfa: f.balanceOwedFcfa,
        creditLimitFcfa: f.creditLimitFcfa,
      })),
      financialReportFcfa: {
        totalRevenueFcfa: report.totalRevenueFcfa,
        nonFuelRevenueFcfa: report.nonFuelRevenueFcfa,
        grossProfitFcfa: report.grossProfitFcfa,
        operatingExpensesFcfa: report.operatingExpensesFcfa,
        netIncomeFcfa: report.netIncomeFcfa,
        cashVarianceFcfa: report.cashVarianceFcfa,
        cashOnHandFcfa: report.cashOnHandFcfa,
        mobileMoneyClearingFcfa: report.mobileMoneyClearingFcfa,
        bankBalanceFcfa: report.bankBalanceFcfa,
        fleetReceivablesFcfa: report.fleetReceivablesFcfa,
        inventoryAssetFcfa: report.inventoryAssetFcfa,
        accountsPayableFcfa: report.accountsPayableFcfa,
        trialBalanceBalanced: report.trialBalanceBalanced,
      },
    };
  }, [tenant.organizationName, activeStationId, stations, tanks, pumps, shifts, fleetAccounts, report]);

  const runAnalysis = async () => {
    setAnalyzing(true);
    setAnalyzeError(null);
    try {
      const response = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(effectiveToken ? { Authorization: `Bearer ${effectiveToken}` } : {}),
        },
        body: JSON.stringify({
          aiActive: aiSub.active,
          stationScope: activeStationId,
          metrics: metricsPayload,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || `Analysis request failed (${response.status}).`);
      }
      setAnalysis(data as AiAnalysisReport);
      void loadHistory();
    } catch (err) {
      setAnalyzeError(err instanceof Error ? err.message : 'Unable to reach OpesFuel AI analysis engine.');
    } finally {
      setAnalyzing(false);
    }
  };

  const askQuestion = async (promptText: string) => {
    const trimmed = promptText.trim();
    if (!trimmed) return;
    const userMsg: ChatMessage = {
      id: `msg_${Date.now()}_u`,
      role: 'user',
      content: trimmed,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setQuestion('');
    setAsking(true);
    setChatError(null);

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(effectiveToken ? { Authorization: `Bearer ${effectiveToken}` } : {}),
        },
        body: JSON.stringify({
          aiActive: aiSub.active,
          stationScope: activeStationId,
          question: trimmed,
          metrics: metricsPayload,
          history: messages.slice(-6).map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || `AI advisor request failed (${response.status}).`);
      }
      setMessages((prev) => [
        ...prev,
        {
          id: `msg_${Date.now()}_a`,
          role: 'assistant',
          content: data.answer,
          timestamp: data.answeredAt || new Date().toISOString(),
        },
      ]);
      void loadHistory();
    } catch (err) {
      setChatError(err instanceof Error ? err.message : 'Unable to reach OpesFuel AI advisor.');
    } finally {
      setAsking(false);
    }
  };

  if (!aiSub.active) {
    return (
      <div className="space-y-6">
        <div className="bg-slate-900 text-white border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <OpesFuelLogo variant="light" size="md" showSubline />
            <div className="inline-flex items-center gap-1.5 text-xs font-mono text-amber-400">
              <Lock className="w-3.5 h-3.5" /> PAID SAAS ADD-ON MODULE
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            <div className="lg:col-span-2 space-y-4">
              <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight">
                OpesFuel Paid AI Operations &amp; Profit Copilot
              </h1>
              <p className="text-sm text-slate-300 leading-relaxed">
                Turn live underground tank levels, dispenser meters, shift cash variances, and SYSCOHADA ledger entries into actionable predictions and executive recommendations—built specifically for multi-station petroleum networks in FCFA.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs text-slate-200">
                {[
                  'Tank stockout countdown & Litre reorder quantities',
                  '30-day FCFA revenue & gross margin forecasting',
                  'Automated dipstick shrinkage & shift variance audit',
                  'Interactive Station Financial Advisor Q&A',
                ].map((feat) => (
                  <div key={feat} className="flex items-start gap-2 bg-slate-800/70 border border-slate-700 rounded-lg p-3">
                    <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <span>{feat}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white text-slate-900 rounded-xl p-5 space-y-4 border border-slate-200">
              <div className="space-y-1">
                <div className="text-xs font-mono uppercase text-amber-700 font-bold">
                  {hasEnterprisePlan ? 'Included in Enterprise' : 'SaaS Paid Intelligence'}
                </div>
                <div className="font-display text-2xl font-bold tabular-nums">
                  {hasEnterprisePlan ? '0 FCFA / mo' : '25 000 FCFA / mo'}
                </div>
                <div className="text-xs text-slate-500">
                  {hasEnterprisePlan
                    ? 'Complimentary with your Network Enterprise subscription.'
                    : 'Flat network add-on fee billed alongside your monthly SaaS plan.'}
                </div>
              </div>

              {canManageAi ? (
                <button
                  type="button"
                  onClick={() => onToggleAiSubscription(true)}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold min-h-[44px]"
                >
                  <Sparkles className="w-4 h-4" /> Activate Paid AI Copilot
                </button>
              ) : (
                <div className="p-3 rounded-lg bg-slate-100 text-xs text-slate-600">
                  Only an Owner or Station Manager can activate the Paid AI Copilot subscription.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Active Copilot Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-3">
            <OpesFuelLogo variant="dark" size="sm" />
            <span className="font-mono text-xs font-semibold text-emerald-700">
              {aiSub.planCode === 'INCLUDED_ENTERPRISE' || hasEnterprisePlan
                ? 'Active · Included on Enterprise'
                : 'Active · 25 000 FCFA/mo Add-On'}
            </span>
          </div>
          <h1 className="font-display text-xl font-bold text-slate-900">
            AI Petroleum Intelligence &amp; Predictive Advisor
          </h1>
          <p className="text-xs text-slate-500">
            Scoped to {activeStationId === 'ALL' ? `All Stations (${stations.length})` : stations.find((s) => s.id === activeStationId)?.name} · Currency FCFA / Litres
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            disabled={analyzing}
            onClick={runAnalysis}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white text-xs font-semibold min-h-[44px]"
          >
            <RefreshCw className={`w-4 h-4 ${analyzing ? 'animate-spin' : ''}`} />
            {analyzing ? 'Analyzing Telemetry...' : analysis ? 'Refresh AI Analysis' : 'Run Fresh AI Analysis'}
          </button>

          {canManageAi && !hasEnterprisePlan && (
            <button
              type="button"
              onClick={() => onToggleAiSubscription(false)}
              className="px-3.5 py-2.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 min-h-[44px]"
            >
              Pause Add-On
            </button>
          )}
        </div>
      </div>

      {analyzeError && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{analyzeError}</span>
          </div>
          <button
            type="button"
            onClick={runAnalysis}
            className="px-3 py-1.5 rounded bg-red-700 text-white font-semibold hover:bg-red-800"
          >
            Retry Analysis
          </button>
        </div>
      )}

      {!analysis && !analyzing && (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center space-y-3">
          <div className="w-11 h-11 rounded-xl bg-slate-900 text-amber-400 flex items-center justify-center mx-auto">
            <TrendingUp className="w-5 h-5" />
          </div>
          <h2 className="font-display text-lg font-bold text-slate-900">
            Ready to Audit &amp; Forecast Station Performance
          </h2>
          <p className="text-xs text-slate-500 max-w-lg mx-auto">
            Click <span className="font-semibold text-slate-800">Run Fresh AI Analysis</span> to compute tank stockout horizons, 30-day FCFA revenue projections, dipstick anomalies, and prioritized actions from your live station snapshot.
          </p>
          <button
            type="button"
            onClick={runAnalysis}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold min-h-[44px]"
          >
            <Sparkles className="w-4 h-4 text-amber-400" /> Generate AI Executive Forecast
          </button>
        </div>
      )}

      {analysis && (
        <div className="space-y-6">
          {/* Executive KPI & Summary Row */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span className="font-semibold text-slate-900">AI Executive Summary</span>
                <span className="font-mono">{formatShortDate(analysis.generatedAt)}</span>
              </div>
              <p className="text-sm text-slate-700 leading-relaxed">{analysis.executiveSummary}</p>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
              <div className="text-xs font-medium text-slate-500">Station Operational Health</div>
              <div className="font-mono tabular-nums text-3xl font-bold text-slate-900 my-1">
                {analysis.healthScore}/100
              </div>
              <div className="text-xs text-emerald-700 font-semibold">
                {analysis.healthScore >= 80 ? 'Optimal Control' : analysis.healthScore >= 60 ? 'Attention Needed' : 'Action Required'}
              </div>
            </div>

            <div className="bg-slate-900 text-white border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
              <div className="text-xs font-medium text-slate-300">30-Day Revenue Forecast</div>
              <div className="font-mono tabular-nums text-2xl font-bold text-amber-400 my-1">
                {formatFcfa(analysis.revenueForecast30dFcfa)}
              </div>
              <div className="text-xs text-slate-400">Projected forecourt + shop turnover</div>
            </div>
          </div>

          {/* Tank Stockout Predictions */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200">
              <h2 className="font-display text-base font-bold text-slate-900">
                Predictive Tank Stockout &amp; Replenishment Schedule
              </h2>
              <p className="text-xs text-slate-500">Estimated days remaining and suggested SCDP depot order volumes</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <tr>
                    <th className="px-4 py-3">Tank</th>
                    <th className="px-4 py-3">Grade</th>
                    <th className="px-4 py-3 text-right">Days Left</th>
                    <th className="px-4 py-3 text-right">Recommended Order</th>
                    <th className="px-4 py-3">Urgency</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {analysis.stockoutPredictions.map((pred, idx) => (
                    <tr key={`${pred.tankId}-${idx}`} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3 font-medium text-slate-900">{pred.tankName}</td>
                      <td className="px-4 py-3 text-slate-600">{pred.grade}</td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums font-bold">
                        {pred.daysRemaining} d
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums font-semibold text-amber-800">
                        {formatLitres(pred.recommendedOrderLitres)}
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-800">{pred.urgency}</td>
                    </tr>
                  ))}
                  {analysis.stockoutPredictions.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                        No tanks provisioned to model replenishment forecasts yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Margin Suggestions, Anomaly Alerts & Prioritized Actions */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
              <h3 className="font-display text-base font-bold text-slate-900">Margin Optimization</h3>
              <div className="space-y-3">
                {analysis.marginSuggestions.map((item, idx) => (
                  <div key={idx} className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                    <div className="text-xs font-bold text-slate-900">{item.title}</div>
                    <div className="font-mono text-[11px] font-semibold text-emerald-700">{item.impactFcfa}</div>
                    <p className="text-xs text-slate-600">{item.recommendation}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
              <h3 className="font-display text-base font-bold text-slate-900">Variance &amp; Risk Alerts</h3>
              <div className="space-y-3">
                {analysis.anomalyAlerts.map((alert, idx) => (
                  <div key={idx} className="p-3 rounded-lg bg-amber-50/60 border border-amber-200 space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-mono font-bold text-amber-800">
                      <span>{alert.module}</span>
                      <span>{alert.severity}</span>
                    </div>
                    <p className="text-xs text-slate-700">{alert.detail}</p>
                  </div>
                ))}
                {analysis.anomalyAlerts.length === 0 && (
                  <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
                    No material shrinkage or shift variance anomalies flagged.
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
              <h3 className="font-display text-base font-bold text-slate-900">Prioritized Actions</h3>
              <div className="space-y-3">
                {analysis.prioritizedActions.map((act, idx) => {
                  const target = VALID_JUMP_SECTIONS.includes(act.targetSection as ConsoleSection)
                    ? (act.targetSection as ConsoleSection)
                    : 'overview';
                  return (
                    <div key={idx} className="p-3 rounded-lg border border-slate-200 space-y-2">
                      <div className="text-xs font-bold text-slate-900">{act.action}</div>
                      <p className="text-xs text-slate-600">{act.rationale}</p>
                      <button
                        type="button"
                        onClick={() => onJumpTo(target)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 hover:text-amber-800"
                      >
                        <span>Open {target}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Ask OpesFuel AI Q&A */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-amber-600" />
            <h2 className="font-display text-base font-bold text-slate-900">Ask OpesFuel AI Advisor</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              'Which tank runs out first?',
              'Audit our cash & dipstick variances',
              'Forecast weekly cash deposit needs',
            ].map((sample) => (
              <button
                key={sample}
                type="button"
                disabled={asking}
                onClick={() => askQuestion(sample)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-medium text-slate-700"
              >
                {sample}
              </button>
            ))}
          </div>
        </div>

        {messages.length > 0 && (
          <div className="space-y-3 max-h-80 overflow-y-auto p-3 rounded-xl bg-slate-50 border border-slate-200">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`p-3 rounded-lg text-xs leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-slate-900 text-white ml-8 sm:ml-24'
                    : 'bg-white border border-slate-200 text-slate-800 mr-8 sm:mr-24 whitespace-pre-wrap'
                }`}
              >
                <div className="font-mono text-[10px] opacity-70 mb-1">
                  {m.role === 'user' ? 'Operator' : 'OpesFuel AI Copilot'} · {formatShortDate(m.timestamp)}
                </div>
                {m.content}
              </div>
            ))}
          </div>
        )}

        {chatError && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800">
            {chatError}
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            askQuestion(question);
          }}
          className="flex flex-col sm:flex-row gap-2.5"
        >
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask about tank burn rates, attendant cash shortages, fleet credit risk, or VAT..."
            className="flex-1 px-3.5 py-2.5 rounded-lg border border-slate-300 text-xs bg-white min-h-[44px]"
          />
          <button
            type="submit"
            disabled={asking || !question.trim()}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-semibold min-h-[44px]"
          >
            <Send className="w-3.5 h-3.5" /> {asking ? 'Thinking...' : 'Ask AI'}
          </button>
        </form>
      </div>

      {/* Persisted AI Audit History */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-base font-bold text-slate-900 flex items-center gap-2">
              <History className="w-4 h-4 text-amber-600" />
              Persisted AI Audit Trail
            </h3>
            <p className="text-xs text-slate-500">
              Logged queries &amp; financial diagnostics from <span className="font-mono">GET /api/v1/ai/history</span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadHistory()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-xs font-semibold text-slate-700"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
        <div className="divide-y divide-slate-100 text-xs">
          {auditHistory.length === 0 ? (
            <div className="py-4 text-center text-slate-500">
              No persisted AI audit logs for this station yet. Run an analysis or ask a question above.
            </div>
          ) : (
            auditHistory.slice(0, 10).map((entry, idx) => (
              <div key={String(entry.id ?? idx)} className="py-2.5 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono font-bold text-amber-700">{String(entry.actionType ?? 'AI_QUERY')}</span>
                  <span className="font-mono text-slate-400">
                    {entry.createdAt ? formatShortDate(String(entry.createdAt)) : '-'}
                  </span>
                </div>
                <div className="text-slate-800 font-medium">{String(entry.promptSummary ?? '')}</div>
                <div className="text-slate-600 line-clamp-2">{String(entry.responseSummary ?? '')}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
