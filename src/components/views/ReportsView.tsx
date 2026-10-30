import React, { useState, useMemo } from 'react';
import { Lead } from '../../types';
import {
  formatINR,
  calculateConversionRate,
  calculateWonRevenue,
  calculatePipelineValue,
  categorizeFollowUp,
  filterLeadsForExport,
  calculateConversionTrend,
  ConversionTrendPoint,
  calculate30DayLeadTrend,
  DailyLeadTrendPoint,
} from '../../utils/calculations';
import { api } from '../../services/api';
import {
  ResponsiveContainer,
  ComposedChart,
  BarChart,
  AreaChart,
  Line,
  Bar,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
} from 'recharts';
import {
  BarChart3,
  TrendingUp,
  Award,
  AlertTriangle,
  Download,
  Calendar,
  Layers,
  PieChart,
  CheckCircle2,
  Filter,
  FileSpreadsheet,
  X,
  Check,
  Activity,
  ArrowUpRight,
  UserPlus,
} from 'lucide-react';

interface ReportsViewProps {
  leads: Lead[];
}

const ChartCustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0]?.payload as ConversionTrendPoint;
  if (!data) return null;

  return (
    <div className="bg-white dark:bg-[#1C2522] text-[#18211F] dark:text-white border border-[#E6EAE7] dark:border-[#2D3935] rounded-xl p-3 shadow-lg text-xs min-w-[190px]">
      <div className="flex items-center justify-between pb-1.5 border-b border-[#E6EAE7] dark:border-[#2D3935] mb-2">
        <span className="font-bold">{label}</span>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#E8F5EF] text-[#087F68] border border-[#087F68]/20">
          {data.conversionRate}% Win Rate
        </span>
      </div>
      <div className="space-y-1.5 text-[11px]">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#087F68] inline-block" />
            <span className="text-[#6B7470] dark:text-[#CBD3CF]">Won:</span>
          </div>
          <span className="font-bold text-[#087F68]">
            {data.won} {data.revenue > 0 ? `(${formatINR(data.revenue)})` : ''}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#C83C4B] inline-block" />
            <span className="text-[#6B7470] dark:text-[#CBD3CF]">Lost:</span>
          </div>
          <span className="font-bold text-[#C83C4B]">{data.lost}</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#64748B] inline-block" />
            <span className="text-[#6B7470] dark:text-[#CBD3CF]">Open:</span>
          </div>
          <span className="font-bold text-[#64748B]">{data.open}</span>
        </div>
      </div>
    </div>
  );
};

const Chart30DayTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0]?.payload as DailyLeadTrendPoint;
  if (!data) return null;

  return (
    <div className="bg-white dark:bg-[#1C2522] text-[#18211F] dark:text-white border border-[#E6EAE7] dark:border-[#2D3935] rounded-xl p-3 shadow-lg text-xs min-w-[170px]">
      <div className="flex items-center justify-between pb-1.5 border-b border-[#E6EAE7] dark:border-[#2D3935] mb-2">
        <span className="font-bold">{data.displayDate} ({data.dayOfWeek})</span>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#E8F5EF] text-[#087F68]">
          +{data.newLeads} lead{data.newLeads !== 1 ? 's' : ''}
        </span>
      </div>
      <div className="space-y-1.5 text-[11px]">
        <div className="flex items-center justify-between">
          <span className="text-[#6B7470] dark:text-[#CBD3CF]">Day Deal Pipeline:</span>
          <span className="font-bold text-[#18211F] dark:text-white">
            {data.totalValue > 0 ? formatINR(data.totalValue) : '₹0'}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[#6B7470] dark:text-[#CBD3CF]">Cumulative Leads:</span>
          <span className="font-bold text-[#087F68]">
            {data.cumulativeLeads} leads
          </span>
        </div>
      </div>
    </div>
  );
};

const ChartStageDistributionTooltip = ({ active, payload }: any) => {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0]?.payload;
  if (!data) return null;

  return (
    <div className="bg-white dark:bg-[#1C2522] text-[#18211F] dark:text-white border border-[#E6EAE7] dark:border-[#2D3935] rounded-xl p-3 shadow-lg text-xs min-w-[190px]">
      <div className="flex items-center justify-between pb-1.5 border-b border-[#E6EAE7] dark:border-[#2D3935] mb-2">
        <span className="font-bold flex items-center space-x-1.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: data.color }} />
          <span>{data.stage}</span>
        </span>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#E8F5EF] text-[#087F68]">
          {data.count} lead{data.count !== 1 ? 's' : ''} ({data.percentage}%)
        </span>
      </div>
      <div className="space-y-1 text-[11px]">
        <div className="flex items-center justify-between">
          <span className="text-[#6B7470] dark:text-[#CBD3CF]">Total Stage Value:</span>
          <span className="font-bold text-[#087F68]">
            {data.value > 0 ? formatINR(data.value) : '₹0'}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[#6B7470] dark:text-[#CBD3CF]">Share of Pipeline:</span>
          <span className="font-bold text-[#18211F] dark:text-white">{data.percentage}%</span>
        </div>
      </div>
    </div>
  );
};

export const ReportsView: React.FC<ReportsViewProps> = ({ leads }) => {
  const [timeframe, setTimeframe] = useState<'all' | 'this_month' | 'last_30_days'>('all');
  const [chartMode, setChartMode] = useState<'all' | 'rate' | 'volume'>('all');
  const [growthChartMode, setGrowthChartMode] = useState<'daily' | 'cumulative'>('daily');
  const [stageChartMetric, setStageChartMetric] = useState<'count' | 'value'>('count');
  const todayStr = new Date().toISOString().split('T')[0];

  // 30-Day New Leads Trend
  const thirtyDayTrendData = useMemo(() => {
    return calculate30DayLeadTrend(leads as any, todayStr);
  }, [leads, todayStr]);

  // CSV Export Filter State
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportStatus, setExportStatus] = useState<string>('all');
  const [exportTimeframe, setExportTimeframe] = useState<string>('all');
  const [exportStartDate, setExportStartDate] = useState<string>('');
  const [exportEndDate, setExportEndDate] = useState<string>('');
  const [downloading, setDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  // Filtered leads for the general reports display
  const filteredLeads = useMemo(() => {
    return filterLeadsForExport(leads as any, {
      timeframe,
      todayStr,
    }) as Lead[];
  }, [leads, timeframe, todayStr]);

  // Pure calculations for dashboard
  const { rate: conversionRate, wonCount, lostCount, resolvedCount } = calculateConversionRate(filteredLeads);
  const wonRevenue = calculateWonRevenue(filteredLeads);
  const { totalValue: openPipelineValue, openCount } = calculatePipelineValue(filteredLeads);

  const completedFollowUps = filteredLeads.filter(l => l.followUpCompleted).length;
  const overdueFollowUps = filteredLeads.filter(l => categorizeFollowUp(l, todayStr) === 'overdue').length;

  // Estimated Revenue Forecast based on Negotiation and Quoted stages
  const negotiationAndQuotedLeads = useMemo(() => {
    return filteredLeads.filter(l => l.stage === 'Negotiation' || l.stage === 'Quotation Sent');
  }, [filteredLeads]);

  const forecastTotalValue = useMemo(() => {
    return negotiationAndQuotedLeads.reduce((sum, l) => sum + (l.quotationAmount || l.estimatedValue || 0), 0);
  }, [negotiationAndQuotedLeads]);

  const forecastWeightedValue = useMemo(() => {
    return negotiationAndQuotedLeads.reduce((sum, l) => {
      const val = l.quotationAmount || l.estimatedValue || 0;
      const prob = l.stage === 'Negotiation' ? 0.75 : 0.45;
      return sum + (val * prob);
    }, 0);
  }, [negotiationAndQuotedLeads]);

  // Breakdown by Source
  const sourceBreakdown = useMemo(() => {
    const counts: Record<string, { count: number; value: number }> = {};
    filteredLeads.forEach(l => {
      const src = l.source || 'Other';
      if (!counts[src]) counts[src] = { count: 0, value: 0 };
      counts[src].count += 1;
      counts[src].value += (l.quotationAmount || l.estimatedValue || 0);
    });
    return Object.entries(counts).sort((a, b) => b[1].count - a[1].count);
  }, [filteredLeads]);

  // Stage Distribution Data for Recharts Bar Chart
  const stageDistributionData = useMemo(() => {
    const STAGES_CONFIG = [
      { name: 'New', color: '#3B82F6' },
      { name: 'Contacted', color: '#6366F1' },
      { name: 'Site Visit Scheduled', color: '#14B8A6' },
      { name: 'Quotation Sent', color: '#F97316' },
      { name: 'Negotiation', color: '#F59E0B' },
      { name: 'Won', color: '#087F68' },
      { name: 'Lost', color: '#C83C4B' },
    ];

    const totalCount = filteredLeads.length || 1;

    return STAGES_CONFIG.map(st => {
      const stageLeads = filteredLeads.filter(l => l.stage === st.name);
      const count = stageLeads.length;
      const value = stageLeads.reduce((sum, l) => sum + (l.quotationAmount || l.estimatedValue || 0), 0);
      const percentage = Math.round((count / totalCount) * 100);

      return {
        stage: st.name,
        shortName: st.name === 'Site Visit Scheduled' ? 'Site Visit' : st.name === 'Quotation Sent' ? 'Quoted' : st.name,
        count,
        value,
        percentage,
        color: st.color,
      };
    });
  }, [filteredLeads]);

  // Identify primary sales bottleneck (stage with highest concentration of open leads)
  const bottleneckStage = useMemo(() => {
    const openData = stageDistributionData.filter(d => !['Won', 'Lost'].includes(d.stage));
    if (!openData.length) return null;
    const sorted = [...openData].sort((a, b) => b.count - a.count);
    return sorted[0].count > 0 ? sorted[0] : null;
  }, [stageDistributionData]);

  // Breakdown by Stage
  const stageBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredLeads.forEach(l => {
      counts[l.stage] = (counts[l.stage] || 0) + 1;
    });
    return Object.entries(counts);
  }, [filteredLeads]);

  // 6-Month historical conversion trend and lead status changes
  const trendData = useMemo(() => {
    return calculateConversionTrend(leads as any, todayStr);
  }, [leads, todayStr]);

  const bestMonth = useMemo(() => {
    if (!trendData.length) return null;
    const resolvedMonths = trendData.filter(d => (d.won + d.lost) > 0);
    if (!resolvedMonths.length) return trendData[trendData.length - 1];
    return [...resolvedMonths].sort((a, b) => b.conversionRate - a.conversionRate)[0];
  }, [trendData]);

  const total6mRevenue = useMemo(() => {
    return trendData.reduce((acc, p) => acc + p.revenue, 0);
  }, [trendData]);

  // Compute matching leads for the CSV export filter preview
  const matchingExportLeads = useMemo(() => {
    return filterLeadsForExport(leads as any, {
      status: exportStatus,
      timeframe: exportTimeframe,
      startDate: exportTimeframe === 'custom' ? exportStartDate : undefined,
      endDate: exportTimeframe === 'custom' ? exportEndDate : undefined,
      todayStr,
    }) as Lead[];
  }, [leads, exportStatus, exportTimeframe, exportStartDate, exportEndDate, todayStr]);

  const matchingExportValue = useMemo(() => {
    return matchingExportLeads.reduce((sum, l) => sum + (l.quotationAmount || l.estimatedValue || 0), 0);
  }, [matchingExportLeads]);

  const handleDownloadCsv = async () => {
    setDownloading(true);
    setDownloadSuccess(false);
    try {
      await api.downloadCsv({
        status: exportStatus,
        timeframe: exportTimeframe,
        startDate: exportTimeframe === 'custom' ? exportStartDate : undefined,
        endDate: exportTimeframe === 'custom' ? exportEndDate : undefined,
      });
      setDownloadSuccess(true);
      setTimeout(() => {
        setDownloadSuccess(false);
      }, 4000);
    } catch (err) {
      console.error('Error downloading CSV:', err);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="p-3.5 sm:p-5 space-y-4 max-w-4xl mx-auto overflow-x-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-black text-[#18211F] dark:text-white tracking-tight truncate">
            Sales Performance
          </h1>
          <p className="text-[11px] text-[#6B7470] dark:text-[#9BA5A0] truncate">
            Real outcomes from your quotations and deals.
          </p>
        </div>

        {/* Date Filter & CSV Export Actions */}
        <div className="flex items-center space-x-1.5 shrink-0">
          <select
            value={timeframe}
            onChange={e => setTimeframe(e.target.value as any)}
            className="bg-white dark:bg-[#18211F] border border-[#E6EAE7] dark:border-[#26312E] rounded-xl px-2.5 py-1.5 text-xs text-[#18211F] dark:text-white shadow-xs cursor-pointer"
          >
            <option value="all">All Time</option>
            <option value="this_month">This Month</option>
            <option value="last_30_days">Last 30 Days</option>
          </select>

          <button
            onClick={() => setShowExportModal(true)}
            className="px-2.5 py-1.5 rounded-xl bg-[#087F68] hover:bg-[#066956] text-white font-semibold text-xs flex items-center space-x-1 shadow-xs transition active:scale-95"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export CSV</span>
            <span className="sm:hidden">CSV</span>
          </button>
        </div>
      </div>

      {/* Download Success Banner */}
      {downloadSuccess && (
        <div className="p-3 bg-[#E8F5EF] dark:bg-[#087F68]/20 border border-[#CBE7DC] dark:border-[#087F68]/30 rounded-2xl text-[#087F68] dark:text-[#45C3A5] text-xs flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Check className="w-4 h-4 text-[#087F68]" />
            <span>CSV downloaded successfully! Check your downloads folder.</span>
          </div>
          <button onClick={() => setDownloadSuccess(false)} className="text-[#6B7470] hover:text-[#18211F]">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Stats Grid */}
      <div className="grid grid-cols-2 gap-2.5">
        {/* Metric: Conversion Rate */}
        <div className="p-3.5 rounded-2xl bg-white dark:bg-[#18211F] border border-[#E6EAE7] dark:border-[#26312E] shadow-xs">
          <div className="flex items-center justify-between text-xs text-[#6B7470] dark:text-[#9BA5A0]">
            <span>Conversion Rate</span>
            <Award className="w-3.5 h-3.5 text-[#087F68]" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-[#087F68] mt-1">
            {resolvedCount > 0 ? `${conversionRate}%` : '—'}
          </div>
          <p className="text-[10px] text-[#6B7470] dark:text-[#9BA5A0] mt-0.5 truncate">
            {wonCount} won of {resolvedCount} resolved
          </p>
        </div>

        {/* Metric: Won Sales Revenue */}
        <div className="p-3.5 rounded-2xl bg-white dark:bg-[#18211F] border border-[#E6EAE7] dark:border-[#26312E] shadow-xs">
          <div className="flex items-center justify-between text-xs text-[#6B7470] dark:text-[#9BA5A0]">
            <span>Recorded Revenue</span>
            <TrendingUp className="w-3.5 h-3.5 text-[#087F68]" />
          </div>
          <div className="text-base sm:text-lg font-black text-[#18211F] dark:text-white mt-1 truncate">
            {formatINR(wonRevenue)}
          </div>
          <p className="text-[10px] text-[#087F68] mt-0.5 font-semibold truncate">
            {wonCount} closed deal{wonCount === 1 ? '' : 's'}
          </p>
        </div>

        {/* Metric: Open Quotation Pipeline */}
        <div className="p-3.5 rounded-2xl bg-white dark:bg-[#18211F] border border-[#E6EAE7] dark:border-[#26312E] shadow-xs">
          <div className="flex items-center justify-between text-xs text-[#6B7470] dark:text-[#9BA5A0]">
            <span>Open Pipeline</span>
            <Layers className="w-3.5 h-3.5 text-[#087F68]" />
          </div>
          <div className="text-base sm:text-lg font-black text-[#087F68] mt-1 truncate">
            {formatINR(openPipelineValue)}
          </div>
          <p className="text-[10px] text-[#6B7470] dark:text-[#9BA5A0] mt-0.5 truncate">
            Across {openCount} active leads
          </p>
        </div>

        {/* Metric: Follow-up Discipline */}
        <div className="p-3.5 rounded-2xl bg-white dark:bg-[#18211F] border border-[#E6EAE7] dark:border-[#26312E] shadow-xs">
          <div className="flex items-center justify-between text-xs text-[#6B7470] dark:text-[#9BA5A0]">
            <span>Overdue Follow-ups</span>
            <AlertTriangle className={`w-3.5 h-3.5 ${overdueFollowUps > 0 ? 'text-[#C83C4B]' : 'text-[#6B7470]'}`} />
          </div>
          <div className={`text-xl sm:text-2xl font-black mt-1 ${overdueFollowUps > 0 ? 'text-[#C83C4B]' : 'text-[#18211F] dark:text-white'}`}>
            {overdueFollowUps}
          </div>
          <p className="text-[10px] text-[#6B7470] dark:text-[#9BA5A0] mt-0.5 truncate">
            {completedFollowUps} completed
          </p>
        </div>
      </div>

      {/* Estimated Revenue Forecast (Negotiation & Quoted Stages) */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-[#E8F5EF] to-white dark:from-[#087F68]/20 dark:to-[#18211F] border border-[#CBE7DC] dark:border-[#087F68]/30 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="p-1.5 rounded-xl bg-[#087F68] text-white">
              <ArrowUpRight className="w-4 h-4" />
            </span>
            <div>
              <h2 className="text-xs sm:text-sm font-bold text-[#18211F] dark:text-white">
                Estimated Revenue Forecast (Negotiation & Quoted Stages)
              </h2>
              <p className="text-[11px] text-[#6B7470] dark:text-[#9BA5A0]">
                Projected cash flow from {negotiationAndQuotedLeads.length} active deals in final pipeline stages.
              </p>
            </div>
          </div>
          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-white dark:bg-[#222C28] text-[#087F68] dark:text-[#38D6AB] border border-[#CBE7DC] dark:border-[#087F68]/30">
            Pipeline Forecast
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-1">
          <div className="p-3 rounded-xl bg-white/80 dark:bg-[#18211F]/80 border border-[#E6EAE7] dark:border-[#26312E]">
            <div className="text-[11px] text-[#6B7470] dark:text-[#9BA5A0]">Total Potential Value</div>
            <div className="text-base sm:text-lg font-black text-[#18211F] dark:text-white mt-0.5 truncate">
              {formatINR(forecastTotalValue)}
            </div>
            <div className="text-[10px] text-[#087F68] mt-0.5">Sum of Quotations & Estimated Values</div>
          </div>

          <div className="p-3 rounded-xl bg-white/80 dark:bg-[#18211F]/80 border border-[#E6EAE7] dark:border-[#26312E]">
            <div className="text-[11px] text-[#6B7470] dark:text-[#9BA5A0]">Weighted Probable Forecast</div>
            <div className="text-base sm:text-lg font-black text-[#087F68] dark:text-[#38D6AB] mt-0.5 truncate">
              {formatINR(forecastWeightedValue)}
            </div>
            <div className="text-[10px] text-[#6B7470] dark:text-[#9BA5A0] mt-0.5">Negotiation (75%) + Quoted (45%)</div>
          </div>
        </div>
      </div>

      {/* Prominent Lead Export Card with Direct Filters */}
      <div className="p-4 rounded-2xl bg-white dark:bg-[#18211F] border border-[#E6EAE7] dark:border-[#26312E] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center space-x-1.5 text-[#087F68]">
            <FileSpreadsheet className="w-4 h-4" />
            <span className="font-bold text-[11px] uppercase tracking-wider">Export Lead Data (CSV)</span>
          </div>
          <h2 className="text-sm font-bold text-[#18211F] dark:text-white truncate">
            Download Filtered Lead & Quotation Records
          </h2>
          <p className="text-[11px] text-[#6B7470] dark:text-[#9BA5A0] leading-relaxed">
            Export customer names, phones, quotation values, and notes to Excel or Sheets. Filter by status or date range.
          </p>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <button
            onClick={() => setShowExportModal(true)}
            className="w-full sm:w-auto px-3.5 py-2 rounded-xl bg-[#087F68] hover:bg-[#066956] text-white font-semibold text-xs flex items-center justify-center space-x-1.5 shadow-xs transition active:scale-95"
          >
            <Filter className="w-3.5 h-3.5" />
            <span>Filter & Download CSV</span>
          </button>
        </div>
      </div>

      {/* Pipeline Stage Distribution & Bottleneck Analysis Chart (Recharts) */}
      <div className="p-4 rounded-2xl bg-white dark:bg-[#18211F] border border-[#E6EAE7] dark:border-[#26312E] shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <div className="flex items-center space-x-1.5">
              <span className="p-1 rounded-lg bg-[#E8F5EF] text-[#087F68]">
                <Layers className="w-3.5 h-3.5" />
              </span>
              <h2 className="text-xs sm:text-sm font-bold text-[#18211F] dark:text-white">
                Sales Pipeline Stage Distribution & Bottlenecks
              </h2>
            </div>
            <p className="text-[11px] text-[#6B7470] dark:text-[#9BA5A0] mt-0.5">
              Identify stage accumulation & conversion friction points across the pipeline.
            </p>
          </div>

          {/* Metric toggle: Lead Count vs Pipeline Value */}
          <div className="flex items-center bg-[#F2F4F2] dark:bg-[#202A27] p-0.5 rounded-xl text-[10px] font-semibold self-start sm:self-auto shrink-0">
            <button
              type="button"
              onClick={() => setStageChartMetric('count')}
              className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                stageChartMetric === 'count'
                  ? 'bg-white dark:bg-[#18211F] text-[#087F68] font-bold shadow-xs'
                  : 'text-[#6B7470] dark:text-[#A1ACA6]'
              }`}
            >
              Lead Volume
            </button>
            <button
              type="button"
              onClick={() => setStageChartMetric('value')}
              className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                stageChartMetric === 'value'
                  ? 'bg-white dark:bg-[#18211F] text-[#087F68] font-bold shadow-xs'
                  : 'text-[#6B7470] dark:text-[#A1ACA6]'
              }`}
            >
              Pipeline Value (₹)
            </button>
          </div>
        </div>

        {/* Bottleneck Alert Banner */}
        {bottleneckStage && (
          <div className="p-2.5 rounded-xl bg-[#FEF9EE] dark:bg-[#2A2215] border border-[#FDE6B8] dark:border-[#524123] text-xs flex items-center justify-between gap-2">
            <div className="flex items-center space-x-2 min-w-0">
              <AlertTriangle className="w-4 h-4 text-[#D97706] shrink-0" />
              <div className="min-w-0 text-[11px]">
                <span className="font-bold text-[#18211F] dark:text-white mr-1">
                  Primary Pipeline Bottleneck:
                </span>
                <span className="text-[#D97706] font-semibold">
                  &apos;{bottleneckStage.stage}&apos; contains {bottleneckStage.count} leads ({bottleneckStage.percentage}% of pipeline).
                </span>
              </div>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#FDE6B8] text-[#92400E] shrink-0">
              {formatINR(bottleneckStage.value)}
            </span>
          </div>
        )}

        {/* Recharts Bar Chart */}
        <div className="h-60 w-full pt-1">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={stageDistributionData}
              margin={{ top: 10, right: 10, left: -15, bottom: 25 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E6EAE7" opacity={0.6} />
              <XAxis
                dataKey="shortName"
                stroke="#6B7470"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                interval={0}
                angle={-15}
                textAnchor="end"
              />
              <YAxis
                allowDecimals={false}
                stroke="#6B7470"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                tickFormatter={val => stageChartMetric === 'value' ? (val >= 100000 ? `${(val / 100000).toFixed(1)}L` : val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val) : val}
              />
              <Tooltip content={<ChartStageDistributionTooltip />} />
              <Bar
                dataKey={stageChartMetric === 'count' ? 'count' : 'value'}
                name={stageChartMetric === 'count' ? 'Lead Count' : 'Stage Value (₹)'}
                radius={[4, 4, 0, 0]}
                maxBarSize={32}
              >
                {stageDistributionData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 30-Day New Leads Trend & Business Growth Chart (Recharts) */}
      <div className="p-4 rounded-2xl bg-white dark:bg-[#18211F] border border-[#E6EAE7] dark:border-[#26312E] shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <div className="flex items-center space-x-1.5">
              <span className="p-1 rounded-lg bg-[#E8F5EF] text-[#087F68]">
                <UserPlus className="w-3.5 h-3.5" />
              </span>
              <h2 className="text-xs sm:text-sm font-bold text-[#18211F] dark:text-white">
                New Leads Trend (Last 30 Days)
              </h2>
            </div>
            <p className="text-[11px] text-[#6B7470] dark:text-[#9BA5A0] mt-0.5">
              Daily incoming client enquiries & business acquisition velocity.
            </p>
          </div>

          {/* Growth Chart View Toggles */}
          <div className="flex items-center bg-[#F2F4F2] dark:bg-[#202A27] p-0.5 rounded-xl text-[10px] font-semibold self-start sm:self-auto shrink-0">
            <button
              type="button"
              onClick={() => setGrowthChartMode('daily')}
              className={`px-2 py-1 rounded-lg transition cursor-pointer ${
                growthChartMode === 'daily'
                  ? 'bg-white dark:bg-[#18211F] text-[#087F68] font-bold shadow-xs'
                  : 'text-[#6B7470] dark:text-[#A1ACA6]'
              }`}
            >
              Daily Influx
            </button>
            <button
              type="button"
              onClick={() => setGrowthChartMode('cumulative')}
              className={`px-2 py-1 rounded-lg transition cursor-pointer ${
                growthChartMode === 'cumulative'
                  ? 'bg-white dark:bg-[#18211F] text-[#087F68] font-bold shadow-xs'
                  : 'text-[#6B7470] dark:text-[#A1ACA6]'
              }`}
            >
              Cumulative Growth
            </button>
          </div>
        </div>

        {/* 30-Day Key Stat Highlights */}
        <div className="grid grid-cols-3 gap-2 py-1 border-y border-[#F2F4F2] dark:border-[#24302C] text-center">
          <div className="p-1.5 rounded-lg bg-[#FAFBFA] dark:bg-[#1A2320]">
            <div className="text-[10px] text-[#6B7470] dark:text-[#9BA5A0]">30-Day New Leads</div>
            <div className="text-sm font-black text-[#087F68]">+{thirtyDayTrendData.totalNewLeads}</div>
          </div>
          <div className="p-1.5 rounded-lg bg-[#FAFBFA] dark:bg-[#1A2320]">
            <div className="text-[10px] text-[#6B7470] dark:text-[#9BA5A0]">New Deal Pipeline</div>
            <div className="text-sm font-black text-[#18211F] dark:text-white truncate">
              {formatINR(thirtyDayTrendData.totalNewValue)}
            </div>
          </div>
          <div className="p-1.5 rounded-lg bg-[#FAFBFA] dark:bg-[#1A2320]">
            <div className="text-[10px] text-[#6B7470] dark:text-[#9BA5A0]">Acquisition Velocity</div>
            <div className="text-sm font-black text-[#18211F] dark:text-white">
              {thirtyDayTrendData.averagePerDay}/day
            </div>
          </div>
        </div>

        {/* Recharts Chart */}
        <div className="h-56 sm:h-64 w-full pt-1">
          <ResponsiveContainer width="100%" height="100%">
            {growthChartMode === 'daily' ? (
              <BarChart
                data={thirtyDayTrendData.trend}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E6EAE7" opacity={0.6} />
                <XAxis
                  dataKey="displayDate"
                  interval={5}
                  stroke="#6B7470"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  dy={4}
                />
                <YAxis
                  allowDecimals={false}
                  stroke="#6B7470"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip content={<Chart30DayTooltip />} />
                <Bar
                  dataKey="newLeads"
                  name="New Enquiries"
                  fill="#087F68"
                  radius={[3, 3, 0, 0]}
                  maxBarSize={16}
                />
              </BarChart>
            ) : (
              <AreaChart
                data={thirtyDayTrendData.trend}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="growthGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#087F68" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#087F68" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E6EAE7" opacity={0.6} />
                <XAxis
                  dataKey="displayDate"
                  interval={5}
                  stroke="#6B7470"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  dy={4}
                />
                <YAxis
                  allowDecimals={false}
                  stroke="#6B7470"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip content={<Chart30DayTooltip />} />
                <Area
                  type="monotone"
                  dataKey="cumulativeLeads"
                  name="Cumulative Leads"
                  stroke="#087F68"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#growthGradient)"
                />
              </AreaChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      {/* Conversion Rate Trend & Lead Status Changes Chart (Recharts) */}
      <div className="p-4 rounded-2xl bg-white dark:bg-[#18211F] border border-[#E6EAE7] dark:border-[#26312E] shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <div className="flex items-center space-x-1.5">
              <span className="p-1 rounded-lg bg-[#E8F5EF] text-[#087F68]">
                <BarChart3 className="w-3.5 h-3.5" />
              </span>
              <h2 className="text-xs sm:text-sm font-bold text-[#18211F] dark:text-white">
                Conversion Rate & Status Trends (6 Months)
              </h2>
            </div>
            <p className="text-[11px] text-[#6B7470] dark:text-[#9BA5A0] mt-0.5">
              Monthly deal outcomes and win rate percentage.
            </p>
          </div>

          {/* Chart display view toggles */}
          <div className="flex items-center bg-[#F2F4F2] dark:bg-[#202A27] p-0.5 rounded-xl text-[10px] font-semibold self-start sm:self-auto shrink-0">
            <button
              onClick={() => setChartMode('all')}
              className={`px-2 py-1 rounded-lg transition ${
                chartMode === 'all'
                  ? 'bg-white dark:bg-[#18211F] text-[#18211F] dark:text-white shadow-xs font-bold'
                  : 'text-[#6B7470] hover:text-[#18211F]'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setChartMode('rate')}
              className={`px-2 py-1 rounded-lg transition ${
                chartMode === 'rate'
                  ? 'bg-white dark:bg-[#18211F] text-[#18211F] dark:text-white shadow-xs font-bold'
                  : 'text-[#6B7470] hover:text-[#18211F]'
              }`}
            >
              Win Rate %
            </button>
            <button
              onClick={() => setChartMode('volume')}
              className={`px-2 py-1 rounded-lg transition ${
                chartMode === 'volume'
                  ? 'bg-white dark:bg-[#18211F] text-[#18211F] dark:text-white shadow-xs font-bold'
                  : 'text-[#6B7470] hover:text-[#18211F]'
              }`}
            >
              Volume
            </button>
          </div>
        </div>

        {/* Quick trend KPI highlight pills */}
        <div className="grid grid-cols-3 gap-2 py-2 px-2.5 bg-[#F7F8F6] dark:bg-[#202A27]/40 rounded-xl text-xs border border-[#E6EAE7] dark:border-[#26312E]">
          <div>
            <span className="text-[9px] uppercase font-bold text-[#6B7470] block tracking-wider">Latest Win Rate</span>
            <span className="font-bold text-[#087F68] text-xs sm:text-sm">
              {trendData[trendData.length - 1]?.conversionRate ?? 0}%
            </span>
          </div>
          <div>
            <span className="text-[9px] uppercase font-bold text-[#6B7470] block tracking-wider">Peak Month</span>
            <span className="font-bold text-[#18211F] dark:text-white text-xs sm:text-sm truncate block">
              {bestMonth ? `${bestMonth.period} (${bestMonth.conversionRate}%)` : '—'}
            </span>
          </div>
          <div>
            <span className="text-[9px] uppercase font-bold text-[#6B7470] block tracking-wider">6M Won Total</span>
            <span className="font-bold text-[#18211F] dark:text-white text-xs sm:text-sm truncate block">
              {formatINR(total6mRevenue)}
            </span>
          </div>
        </div>

        {/* The Recharts Container */}
        <div className="w-full h-56 select-none">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={trendData}
              margin={{ top: 8, right: 8, left: -24, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E6EAE7" opacity={0.6} />
              <XAxis
                dataKey="period"
                stroke="#6B7470"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                dy={4}
              />
              <YAxis
                yAxisId="left"
                orientation="left"
                stroke="#6B7470"
                fontSize={10}
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                domain={[0, 100]}
                unit="%"
                stroke="#087F68"
                fontSize={10}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<ChartCustomTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: '10px', paddingTop: '8px' }}
                iconType="circle"
              />
              {(chartMode === 'all' || chartMode === 'volume') && (
                <>
                  <Bar
                    yAxisId="left"
                    dataKey="won"
                    name="Won Deals"
                    fill="#087F68"
                    radius={[3, 3, 0, 0]}
                    maxBarSize={22}
                  />
                  <Bar
                    yAxisId="left"
                    dataKey="lost"
                    name="Lost Deals"
                    fill="#C83C4B"
                    radius={[3, 3, 0, 0]}
                    maxBarSize={22}
                  />
                  <Bar
                    yAxisId="left"
                    dataKey="open"
                    name="Open in Pipeline"
                    fill="#64748B"
                    radius={[3, 3, 0, 0]}
                    maxBarSize={22}
                  />
                </>
              )}
              {(chartMode === 'all' || chartMode === 'rate') && (
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="conversionRate"
                  name="Win Rate %"
                  stroke="#087F68"
                  strokeWidth={2.5}
                  dot={{ r: 3.5, fill: '#087F68', strokeWidth: 1.5, stroke: '#ffffff' }}
                  activeDot={{ r: 5, fill: '#087F68', stroke: '#ffffff', strokeWidth: 2 }}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Source Breakdown & Pipeline Stage Distribution */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Leads by Source */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#18211F] border border-[#E6EAE7] dark:border-[#26312E] shadow-xs space-y-2.5">
          <h2 className="font-bold text-[#18211F] dark:text-white text-xs flex items-center space-x-1.5">
            <PieChart className="w-3.5 h-3.5 text-[#087F68]" />
            <span>Enquiry Sources</span>
          </h2>

          {sourceBreakdown.length === 0 ? (
            <p className="text-xs text-[#6B7470]">No data for this timeframe.</p>
          ) : (
            <div className="space-y-2">
              {sourceBreakdown.map(([source, data]) => {
                const percentage = Math.round((data.count / filteredLeads.length) * 100);
                return (
                  <div key={source} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-[#18211F] dark:text-[#EAEFEA]">{source}</span>
                      <span className="text-[11px] text-[#6B7470]">
                        {data.count} ({formatINR(data.value)})
                      </span>
                    </div>
                    <div className="w-full bg-[#F2F4F2] dark:bg-[#202A27] h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-[#087F68] h-1.5 rounded-full transition-all"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Pipeline Stage Distribution */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#18211F] border border-[#E6EAE7] dark:border-[#26312E] shadow-xs space-y-2.5">
          <h2 className="font-bold text-[#18211F] dark:text-white text-xs flex items-center space-x-1.5">
            <Layers className="w-3.5 h-3.5 text-[#087F68]" />
            <span>Pipeline Stages</span>
          </h2>

          {stageBreakdown.length === 0 ? (
            <p className="text-xs text-[#6B7470]">No leads recorded yet.</p>
          ) : (
            <div className="space-y-2 text-xs">
              {stageBreakdown.map(([stage, count]) => {
                const percentage = Math.round((count / filteredLeads.length) * 100);
                return (
                  <div key={stage} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-[#18211F] dark:text-[#EAEFEA]">{stage}</span>
                      <span className="text-[11px] text-[#6B7470]">{count} ({percentage}%)</span>
                    </div>
                    <div className="w-full bg-[#F2F4F2] dark:bg-[#202A27] h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`h-1.5 rounded-full transition-all ${
                          stage === 'Won' ? 'bg-[#087F68]' : stage === 'Lost' ? 'bg-[#C83C4B]' : 'bg-[#64748B]'
                        }`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Dedicated Filtered CSV Download Modal */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white dark:bg-[#18211F] rounded-3xl max-w-md w-full max-h-[92vh] flex flex-col shadow-2xl border border-[#E6EAE7] dark:border-[#26312E] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-4 py-3.5 border-b border-[#E6EAE7] dark:border-[#26312E] flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 rounded-lg bg-[#E8F5EF] text-[#087F68] flex items-center justify-center">
                  <Download className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-[#18211F] dark:text-white text-sm">
                    Export Leads to CSV
                  </h3>
                  <p className="text-[10px] text-[#6B7470]">
                    Filter by status and date range
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowExportModal(false)}
                className="p-1 rounded-full text-[#6B7470] hover:text-[#18211F]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 space-y-3.5 overflow-y-auto text-xs sm:text-sm">
              {/* Filter 1: Status / Stage */}
              <div>
                <label className="block text-[11px] font-semibold text-[#18211F] dark:text-[#EAEFEA] mb-1">
                  Filter by Lead Status
                </label>
                <select
                  value={exportStatus}
                  onChange={e => setExportStatus(e.target.value)}
                  className="w-full bg-[#F7F8F6] dark:bg-[#202A27] border border-[#E6EAE7] dark:border-[#26312E] rounded-xl p-2 text-xs text-[#18211F] dark:text-white focus:ring-1 focus:ring-[#087F68]"
                >
                  <option value="all">All Statuses (Entire Pipeline)</option>
                  <option value="open">Open Pipeline Only (New to Negotiation)</option>
                  <option value="resolved">Resolved Deals Only (Won & Lost)</option>
                  <option value="Won">Won Deals Only</option>
                  <option value="Lost">Lost Deals Only</option>
                  <option value="Quotation Sent">Quotation Sent Only</option>
                  <option value="Site Visit Scheduled">Site Visit Scheduled</option>
                  <option value="Contacted">Contacted</option>
                  <option value="New">New Enquiries</option>
                </select>
              </div>

              {/* Filter 2: Date Range */}
              <div>
                <label className="block text-[11px] font-semibold text-[#18211F] dark:text-[#EAEFEA] mb-1">
                  Filter by Date Range
                </label>
                <select
                  value={exportTimeframe}
                  onChange={e => setExportTimeframe(e.target.value)}
                  className="w-full bg-[#F7F8F6] dark:bg-[#202A27] border border-[#E6EAE7] dark:border-[#26312E] rounded-xl p-2 text-xs text-[#18211F] dark:text-white focus:ring-1 focus:ring-[#087F68]"
                >
                  <option value="all">All Time</option>
                  <option value="this_month">This Month</option>
                  <option value="last_30_days">Last 30 Days</option>
                  <option value="last_quarter">Last Quarter (90 Days)</option>
                  <option value="custom">Custom Date Range...</option>
                </select>
              </div>

              {/* Custom Date Pickers */}
              {exportTimeframe === 'custom' && (
                <div className="p-2.5 bg-[#F7F8F6] dark:bg-[#202A27] border border-[#E6EAE7] dark:border-[#26312E] rounded-xl space-y-1.5">
                  <div className="text-[10px] font-semibold text-[#6B7470]">
                    Select Date Boundary
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] text-[#6B7470] mb-0.5">From</label>
                      <input
                        type="date"
                        value={exportStartDate}
                        onChange={e => setExportStartDate(e.target.value)}
                        className="w-full bg-white dark:bg-[#18211F] border border-[#E6EAE7] dark:border-[#26312E] rounded-lg p-1.5 text-xs text-[#18211F] dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-[#6B7470] mb-0.5">To</label>
                      <input
                        type="date"
                        value={exportEndDate}
                        onChange={e => setExportEndDate(e.target.value)}
                        className="w-full bg-white dark:bg-[#18211F] border border-[#E6EAE7] dark:border-[#26312E] rounded-lg p-1.5 text-xs text-[#18211F] dark:text-white"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Live Matching Preview Box */}
              <div className="p-3 bg-[#E8F5EF] dark:bg-[#087F68]/15 border border-[#CBE7DC] dark:border-[#087F68]/30 rounded-xl space-y-1">
                <div className="flex items-center justify-between text-xs font-bold text-[#087F68]">
                  <span>Matching Records:</span>
                  <span>{matchingExportLeads.length} Lead{matchingExportLeads.length === 1 ? '' : 's'}</span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-[#087F68]">
                  <span>Total Value:</span>
                  <span className="font-semibold">{formatINR(matchingExportValue)}</span>
                </div>
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="p-3.5 border-t border-[#E6EAE7] dark:border-[#26312E] flex items-center justify-between bg-[#F7F8F6] dark:bg-[#202A27]/60">
              <button
                type="button"
                onClick={() => setShowExportModal(false)}
                className="px-3 py-1.5 text-xs text-[#6B7470] hover:text-[#18211F] font-medium"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleDownloadCsv}
                disabled={downloading || matchingExportLeads.length === 0}
                className="px-4 py-2 rounded-xl bg-[#087F68] hover:bg-[#066956] disabled:opacity-50 text-white font-bold text-xs flex items-center space-x-1.5 shadow-xs active:scale-95 transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{downloading ? 'Exporting...' : `Download (${matchingExportLeads.length})`}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
