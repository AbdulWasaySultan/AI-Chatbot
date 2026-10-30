'use client';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Icon, Sparkline } from './Icons';
/* ==========================================================================
   FJ-TECH | INTELLIGENT AI COMMAND CENTER â€” FEATURE STUDIOS (views.js)
   ========================================================================== */



const VOICE_PROVIDERS = [
  {
    id: 'ElevenLabs - Rachel (Warm & Professional)',
    provider: 'ElevenLabs Neural v2.5',
    voiceName: 'Rachel',
    personality: 'Warm & Professional',
    style: 'Healthcare & Concierge Reception'
  },
  {
    id: 'ElevenLabs - Adam (Executive & Confident)',
    provider: 'ElevenLabs Neural v2.5',
    voiceName: 'Adam',
    personality: 'Executive & Confident',
    style: 'High-Ticket B2B & Real Estate Closing'
  },
  {
    id: 'OpenAI Realtime - Nova (Energetic)',
    provider: 'OpenAI Realtime Audio',
    voiceName: 'Nova',
    personality: 'Energetic & Fast',
    style: 'Instant Dispatch & Inbound Support'
  },
  {
    id: 'Deepgram Aura - Orion (Executive Male)',
    provider: 'Deepgram Aura Enterprise',
    voiceName: 'Orion',
    personality: 'Calm & Authoritative',
    style: 'Financial, Legal & Advisory'
  },
  {
    id: 'Cartesia Sonic - British Luxury Concierge',
    provider: 'Cartesia Sonic Ultra-Low Latency',
    voiceName: 'Sterling',
    personality: 'Refined British Concierge',
    style: 'Luxury Hospitality & VIP Booking'
  }
];

const DEFAULT_TEST_SCENARIOS = [
  { label: 'Ask Pricing & Packages', prompt: 'How much do your services cost and do you take insurance?' },
  { label: 'Book Tomorrow 10:30 AM', prompt: 'I want to book an appointment for tomorrow at 10:30 AM' },
  { label: 'Hours & Location', prompt: 'What are your opening hours and where are you located?' },
  { label: 'Urgent Priority Escalation', prompt: 'I have an urgent emergency and need immediate help!' }
];

// ============================================================================
// 1. OVERVIEW COMMAND CENTER VIEW
// ============================================================================
function OverviewView({
  masterAgency,
  activeTenant,
  tenants,
  recentEvents,
  onNavigate,
  onSelectAgentForPlayground,
  onSwitchTenant,
  onOpenNewClientModal
}) {
  const [chartRange, setChartRange] = useState('7d');

  // Compute live metrics from actual backend state
  const allAgents = useMemo(
    () => tenants.flatMap((t) => (t.agents || []).map((a) => ({ ...a, tenantName: t.brandName, tenantId: t.id }))),
    [tenants]
  );
  const voiceAgentsCount = allAgents.filter((a) => a.type === 'voice').length;
  const chatAgentsCount = allAgents.filter((a) => a.type === 'chatbot').length;
  const avgLatency = useMemo(() => {
    if (!allAgents.length) return 320;
    return Math.round(allAgents.reduce((s, a) => s + (a.avgLatencyMs || 340), 0) / allAgents.length);
  }, [allAgents]);

  const greetingTime = useMemo(() => {
    const hr = new Date().getHours();
    if (hr < 12) return 'Good morning';
    if (hr < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const formattedDate = useMemo(() => {
    return new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }, []);

  const kpiCards = [
    {
      title: 'Monthly Recurring Revenue',
      value: `$${Number(masterAgency?.mrr || 14850).toLocaleString()}`,
      sub: `Across ${tenants.length} active white-label retainers`,
      trend: '+18.4%',
      icon: 'dollar',
      badgeBg: 'bg-[#DDF8EE] text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
      sparkColor: '#10B981',
      sparkData: [9200, 10500, 11400, 12800, 13200, 14100, Number(masterAgency?.mrr || 14850)]
    },
    {
      title: 'Active AI Workforce',
      value: `${allAgents.length} Agents`,
      sub: `${voiceAgentsCount} Voice Receptionists â€¢ ${chatAgentsCount} Web Chatbots`,
      trend: '100% Online',
      icon: 'bot',
      badgeBg: 'bg-[#EEEAFE] text-[#635BFF] dark:bg-indigo-500/15 dark:text-indigo-300',
      sparkColor: '#635BFF',
      sparkData: [2, 3, 3, 4, 4, 5, allAgents.length]
    },
    {
      title: 'Voice Calls Handled Today',
      value: Number(masterAgency?.activeCallsToday || 1284).toLocaleString(),
      sub: `Active workspace: ${activeTenant?.brandName || 'All'}`,
      trend: '+12.1%',
      icon: 'phone',
      badgeBg: 'bg-sky-100 text-[#3985FF] dark:bg-sky-500/15 dark:text-sky-300',
      sparkColor: '#3985FF',
      sparkData: [820, 940, 1010, 1120, 1180, 1240, Number(masterAgency?.activeCallsToday || 1284)]
    },
    {
      title: 'Omnichannel Messages',
      value: Number(masterAgency?.messagesHandled || 48920).toLocaleString(),
      sub: '98.4% automated resolution rate',
      trend: '+24.7%',
      icon: 'messages',
      badgeBg: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300',
      sparkColor: '#21C8D8',
      sparkData: [32000, 35500, 39000, 41200, 44800, 47100, Number(masterAgency?.messagesHandled || 48920)]
    },
    {
      title: 'Client Workspaces',
      value: `${tenants.length} Tenants`,
      sub: `Avg retainer: $${Math.round((masterAgency?.mrr || 5550) / Math.max(tenants.length, 1)).toLocaleString()}/mo`,
      trend: 'Multi-Tenant',
      icon: 'building',
      badgeBg: 'bg-[#FFF1D6] text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
      sparkColor: '#F59E0B',
      sparkData: [1, 1, 2, 2, 3, 3, tenants.length]
    },
    {
      title: 'AI Response Latency',
      value: `${avgLatency} ms`,
      sub: 'Sub-second neural voice & webhook engine',
      trend: '99.98% SLA',
      icon: 'zap',
      badgeBg: 'bg-[#FFE6EA] text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
      sparkColor: '#F43F5E',
      sparkData: [460, 430, 410, 390, 375, 360, avgLatency]
    }
  ];

  // Interactive Chart Data
  const dailyChartBars = useMemo(() => {
    const mult = chartRange === '30d' ? 4.2 : chartRange === '90d' ? 11.5 : 1;
    return [
      { day: 'Mon', voice: Math.round(165 * mult), chat: Math.round(420 * mult) },
      { day: 'Tue', voice: Math.round(190 * mult), chat: Math.round(480 * mult) },
      { day: 'Wed', voice: Math.round(178 * mult), chat: Math.round(510 * mult) },
      { day: 'Thu', voice: Math.round(220 * mult), chat: Math.round(590 * mult) },
      { day: 'Fri', voice: Math.round(245 * mult), chat: Math.round(640 * mult) },
      { day: 'Sat', voice: Math.round(160 * mult), chat: Math.round(390 * mult) },
      { day: 'Sun', voice: Math.round(126 * mult), chat: Math.round(310 * mult) }
    ];
  }, [chartRange]);

  const maxBarTotal = Math.max(...dailyChartBars.map((d) => d.voice + d.chat), 1);

  return (
    <div className="space-y-6 animate-view">
      {/* 1. Welcome Hero & Quick Command Actions */}
      <div className="fj-navy-surface rounded-2xl p-6 sm:p-7 shadow-xl relative overflow-hidden">
        <div
          className="absolute -right-24 -top-24 w-96 h-96 rounded-full blur-3xl opacity-20 pointer-events-none"
          style={{ background: 'linear-gradient(135deg, var(--brand-primary), var(--brand-accent))' }}
        />

        <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-xs font-medium text-cyan-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>FJ-TECH INTELLIGENT AI COMMAND CENTER â€¢ {formattedDate}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              {greetingTime}! Your AI workforce is ready.
            </h1>
            <p className="text-sm text-slate-300 max-w-2xl">
              Managing <strong className="text-white">{activeTenant?.brandName}</strong> ({activeTenant?.domain}). Deploy neural voice call agents, website chatbots, and white-label client portals from one unified command deck.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              onClick={() => onNavigate('voice-studio', { openBuilder: true })}
              className="brand-gradient hover:brightness-110 text-white font-semibold text-xs sm:text-sm px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2 transition"
            >
              <Icon name="phone" size={16} />
              <span>Create Voice Agent</span>
            </button>
            <button
              onClick={() => onNavigate('chatbot-studio', { openBuilder: true })}
              className="bg-white/10 hover:bg-white/15 text-white border border-white/15 font-semibold text-xs sm:text-sm px-4 py-2.5 rounded-xl flex items-center gap-2 transition"
            >
              <Icon name="bot" size={16} />
              <span>Create Chatbot</span>
            </button>
            <button
              onClick={() => onNavigate('playground')}
              className="bg-white/10 hover:bg-white/15 text-cyan-300 border border-cyan-400/30 font-semibold text-xs sm:text-sm px-4 py-2.5 rounded-xl flex items-center gap-2 transition"
            >
              <Icon name="terminal" size={16} />
              <span>Open AI Playground</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. 6-Card Executive KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {kpiCards.map((card, idx) => (
          <div key={idx} className="fj-card fj-card-hover p-5 flex flex-col justify-between gap-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${card.badgeBg}`}>
                  <Icon name={card.icon} size={19} />
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">
                    {card.title}
                  </span>
                  <span className="text-2xl font-extrabold tracking-tight mt-0.5 block">
                    {card.value}
                  </span>
                </div>
              </div>
              <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${card.badgeBg}`}>
                {card.trend}
              </span>
            </div>

            <div className="flex items-end justify-between gap-2 pt-2 border-t border-slate-100 dark:border-white/5">
              <span className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {card.sub}
              </span>
              <Sparkline data={card.sparkData} color={card.sparkColor} />
            </div>
          </div>
        ))}
      </div>

      {/* 3. Analytics & Live Activity Center Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left 7 Cols: Interactive Omnichannel Volume & Client Usage Charts */}
        <div className="lg:col-span-7 fj-card p-5 sm:p-6 flex flex-col justify-between">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-white/10">
            <div>
              <h2 className="text-base font-extrabold">Voice Calls vs. Chatbot Interactions</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Omnichannel throughput across {tenants.length} client workspaces
              </p>
            </div>

            <div className="inline-flex p-1 rounded-xl fj-subcard text-xs font-semibold">
              {['7d', '30d', '90d'].map((r) => (
                <button
                  key={r}
                  onClick={() => setChartRange(r)}
                  className={`px-3 py-1 rounded-lg transition ${
                    chartRange === r
                      ? 'bg-[#635BFF] text-white shadow'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {r.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Interactive Stacked Bar Chart */}
          <div className="py-6">
            <div className="h-52 flex items-end justify-between gap-3 sm:gap-5 px-2">
              {dailyChartBars.map((bar, i) => {
                const voiceH = Math.max(Math.round((bar.voice / maxBarTotal) * 160), 14);
                const chatH = Math.max(Math.round((bar.chat / maxBarTotal) * 160), 20);
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-2 group">
                    <div className="text-[10px] font-mono text-slate-400 opacity-0 group-hover:opacity-100 transition">
                      {bar.voice + bar.chat}
                    </div>
                    <div className="w-full max-w-[44px] flex flex-col justify-end gap-1">
                      <div
                        style={{ height: `${chatH}px` }}
                        title={`${bar.day} Chat Messages: ${bar.chat}`}
                        className="w-full rounded-t-lg bg-[#21C8D8] hover:brightness-110 transition-all"
                      />
                      <div
                        style={{ height: `${voiceH}px` }}
                        title={`${bar.day} Voice Calls: ${bar.voice}`}
                        className="w-full rounded-b-lg bg-[#635BFF] hover:brightness-110 transition-all"
                      />
                    </div>
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      {bar.day}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-100 dark:border-white/10 text-xs">
              <div className="flex items-center gap-4">
                <span className="inline-flex items-center gap-1.5 font-semibold">
                  <span className="w-3 h-3 rounded bg-[#635BFF]" />
                  AI Voice Calls
                </span>
                <span className="inline-flex items-center gap-1.5 font-semibold">
                  <span className="w-3 h-3 rounded bg-[#21C8D8]" />
                  Website Chatbots
                </span>
              </div>
              <button
                onClick={() => onNavigate('analytics')}
                className="text-[#635BFF] hover:underline font-bold flex items-center gap-1"
              >
                <span>Full Analytics Report</span>
                <Icon name="arrowUpRight" size={14} />
              </button>
            </div>
          </div>

          {/* Client Workspace Distribution Mini Table */}
          <div className="pt-4 border-t border-slate-100 dark:border-white/10">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Active Client Workspaces &amp; Retainers
              </span>
              <button
                onClick={onOpenNewClientModal}
                className="text-xs font-bold text-[#635BFF] hover:underline"
              >
                + Add Client Workspace
              </button>
            </div>
            <div className="space-y-2">
              {tenants.map((t) => {
                const isCurrent = t.id === activeTenant?.id;
                const tInteractions = (t.agents || []).reduce((s, a) => s + (a.interactions || 0), 0);
                return (
                  <div
                    key={t.id}
                    onClick={() => onSwitchTenant(t.id)}
                    className={`cursor-pointer p-3 rounded-xl flex items-center justify-between gap-3 transition border ${
                      isCurrent
                        ? 'border-[#635BFF] bg-[#EEEAFE]/40 dark:bg-indigo-500/10'
                        : 'border-transparent fj-subcard hover:border-slate-300 dark:hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={t.logoUrl}
                        alt={t.brandName}
                        className="w-9 h-9 rounded-lg object-cover border border-slate-200 dark:border-white/10 shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs sm:text-sm font-bold truncate">{t.brandName}</span>
                          {isCurrent && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#635BFF] text-white">
                              Active
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 block truncate">
                          {t.domain} â€¢ {(t.agents || []).length} agents
                        </span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 block">
                        ${Number(t.monthlyRetainer || 1500).toLocaleString()}/mo
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        {tInteractions.toLocaleString()} sessions
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right 5 Cols: Live AI Activity Center & Active Agent Quick-Test */}
        <div className="lg:col-span-5 fj-card p-5 sm:p-6 flex flex-col justify-between gap-5">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-white/10">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                <h2 className="text-base font-extrabold">Live AI Activity Center</h2>
              </div>
              <span className="text-[11px] font-mono text-slate-400">Real-Time Telemetry</span>
            </div>

            {/* Active Workspace Agents List */}
            <div className="mt-4 space-y-2.5">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                {activeTenant?.brandName} â€” Deployed Agents
              </div>
              {(activeTenant?.agents || []).length === 0 ? (
                <div className="fj-subcard p-4 text-xs text-slate-500 text-center">
                  No agents deployed for this workspace yet.
                </div>
              ) : (
                (activeTenant?.agents || []).map((agent) => (
                  <div
                    key={agent.id}
                    className="fj-subcard p-3.5 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                          agent.type === 'voice'
                            ? 'bg-[#EEEAFE] text-[#635BFF] dark:bg-indigo-500/20 dark:text-indigo-300'
                            : 'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-300'
                        }`}
                      >
                        <Icon name={agent.type === 'voice' ? 'phone' : 'bot'} size={17} />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs sm:text-sm font-bold truncate">{agent.name}</h4>
                        <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 block truncate">
                          {agent.phoneNumber} â€¢ {agent.avgLatencyMs || 350}ms
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => onSelectAgentForPlayground(agent)}
                      className="px-3 py-1.5 rounded-lg bg-[#635BFF] hover:bg-[#5249e6] text-white text-xs font-bold shrink-0 flex items-center gap-1 transition"
                    >
                      <Icon name="play" size={12} />
                      <span>Simulate</span>
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Recent Telemetry Stream */}
            <div className="mt-5 space-y-2.5">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Recent Operations &amp; Webhook Events
              </div>
              <div className="space-y-2 max-h-[240px] overflow-y-auto custom-scroll pr-1">
                {recentEvents.map((ev) => (
                  <div
                    key={ev.id}
                    className="p-3 rounded-xl border border-slate-100 dark:border-white/5 bg-slate-50/70 dark:bg-white/[0.02] flex items-start gap-3 text-xs"
                  >
                    <span
                      className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${
                        ev.type === 'voice'
                          ? 'bg-[#635BFF]'
                          : ev.type === 'deploy'
                          ? 'bg-emerald-500'
                          : 'bg-[#21C8D8]'
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold truncate">{ev.title}</span>
                        <span className="text-[10px] font-mono text-slate-400 shrink-0">
                          {ev.time}
                        </span>
                      </div>
                      <p className="text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        {ev.subtitle}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <button
            onClick={() => onNavigate('Branding Studio' === 'Branding Studio' ? 'branding' : 'branding')}
            className="w-full py-2.5 px-4 rounded-xl border border-slate-200 dark:border-white/10 hover:border-[#635BFF] text-xs font-bold flex items-center justify-center gap-2 transition"
          >
            <Icon name="palette" size={15} />
            <span>Customize {activeTenant?.brandName} White-Label Branding</span>
          </button>
        </div>

      </div>
    </div>
  );
}

// ============================================================================
// 2. AI VOICE AGENT STUDIO (CARDS + 5-STEP WIZARD + LIVE VOICE ORB TESTER)
// ============================================================================
function VoiceStudioView({
  activeTenant,
  tenants,
  onSwitchTenant,
  onAgentCreated,
  onDeleteAgent,
  onSimulationEvent,
  initialOpenBuilder,
  showToast
}) {
  const [mode, setMode] = useState(initialOpenBuilder ? 'create' : 'list'); // 'list' | 'create' | 'test'
  const [step, setStep] = useState(1);
  const [selectedVoiceAgent, setSelectedVoiceAgent] = useState(null);

  // 5-Step Wizard State
  const [targetTenantId, setTargetTenantId] = useState(activeTenant?.id || '');
  const [agentName, setAgentName] = useState('');
  const [agentDesc, setAgentDesc] = useState('24/7 Inbound Appointment & Lead Qualification Specialist');
  const [selectedVoiceObj, setSelectedVoiceObj] = useState(VOICE_PROVIDERS[0]);
  const [speakingStyle, setSpeakingStyle] = useState('Natural, conversational, empathetic with sub-400ms turn-taking');
  const [greeting, setGreeting] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('+1 (888) 412-9040');
  const [isDeploying, setIsDeploying] = useState(false);

  // Live Voice Tester State
  const [orbState, setOrbState] = useState('idle'); // 'idle' | 'listening' | 'processing' | 'speaking'
  const [transcript, setTranscript] = useState([]);
  const [callerInput, setCallerInput] = useState('');
  const [lastTelemetry, setLastTelemetry] = useState(null);

  useEffect(() => {
    if (activeTenant) {
      setTargetTenantId(activeTenant.id);
      const voiceAgents = (activeTenant.agents || []).filter((a) => a.type === 'voice');
      if (voiceAgents.length > 0 && !selectedVoiceAgent) {
        setSelectedVoiceAgent(voiceAgents[0]);
      }
    }
  }, [activeTenant]);

  const voiceAgents = useMemo(
    () => (activeTenant?.agents || []).filter((a) => a.type === 'voice'),
    [activeTenant]
  );

  const generateNumber = () => {
    const area = ['888', '800', '305', '415', '212'][Math.floor(Math.random() * 5)];
    const mid = Math.floor(200 + Math.random() * 700);
    const end = Math.floor(1000 + Math.random() * 8999);
    setPhoneNumber(`+1 (${area}) ${mid}-${end}`);
  };

  const fillSmartDefaults = () => {
    const bName = activeTenant?.brandName || 'Our Clinic';
    setAgentName(`Aria - ${bName.split(' ')[0]} 24/7 Voice Receptionist`);
    setGreeting(
      `Thank you for calling ${bName}! This is Aria, your automated care coordinator. How may I help you today?`
    );
    setSystemPrompt(
      `You are Aria, the senior AI voice receptionist at ${bName}. Initial consultations are $125 (waived with any treatment package starting at $499). We are open Monday through Saturday from 8:00 AM to 6:00 PM. Always ask for the caller's full name and offer appointment slots tomorrow at 10:30 AM or 2:00 PM.`
    );
    generateNumber();
    showToast('Loaded intelligent voice agent template');
  };

  const handleDeployVoiceAgent = async () => {
    if (!agentName.trim() || !systemPrompt.trim()) {
      showToast('Please provide an Agent Name and System Instructions');
      return;
    }
    setIsDeploying(true);
    try {
      const tId = targetTenantId || activeTenant.id;
      const res = await fetch(`${''}/api/tenants/${tId}/agents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: agentName,
          type: 'voice',
          voiceId: selectedVoiceObj.id,
          phoneNumber,
          greeting,
          systemPrompt
        })
      });
      const data = await res.json();
      if (res.ok) {
        onAgentCreated(data.tenant, data.agent);
        setSelectedVoiceAgent(data.agent);
        setMode('test');
        initVoiceTestSession(data.agent);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsDeploying(false);
    }
  };

  const initVoiceTestSession = (agent) => {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    setSelectedVoiceAgent(agent);
    setOrbState('idle');
    const openMsg =
      agent.greeting ||
      `Thank you for calling ${activeTenant?.brandName}. This is ${agent.name}. How can I help you today?`;
    setTranscript([
      {
        id: 'v-init',
        role: 'agent',
        text: openMsg,
        meta: 'Simulated Voice Greeting â€¢ Ready'
      }
    ]);
    setLastTelemetry({
      intent: 'call_initialized',
      confidence: 0.99,
      latencyMs: agent.avgLatencyMs || 390,
      voiceId: agent.voiceId
    });
  };

  const sendVoiceTurn = async (utteranceText) => {
    const text = (utteranceText || '').trim();
    if (!text || !selectedVoiceAgent || !activeTenant) return;

    setCallerInput('');
    const userTurn = { id: `u-${Date.now()}`, role: 'user', text };
    setTranscript((prev) => [...prev, userTurn]);
    setOrbState('processing');

    try {
      const res = await fetch(`${''}/api/simulate/webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: activeTenant.id,
          agentId: selectedVoiceAgent.id,
          userMessage: text,
          mode: 'voice',
          callHistory: [...transcript, userTurn]
        })
      });
      const data = await res.json();
      if (res.ok) {
        setTranscript((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            role: 'agent',
            text: data.reply,
            meta: `Intent: ${data.intentDetected} (${Math.round(data.confidence * 100)}%) â€¢ ${data.latencyMs}ms`
          }
        ]);
        setLastTelemetry({
          intent: data.intentDetected,
          confidence: data.confidence,
          latencyMs: data.latencyMs,
          voiceId: selectedVoiceAgent.voiceId,
          payload: data.webhookPayloadInspector
        });
        onSimulationEvent(selectedVoiceAgent, text, data);

        // Speak response using Web Speech API with animated speaking state
        if ('speechSynthesis' in window) {
          window.speechSynthesis.cancel();
          const utter = new SpeechSynthesisUtterance(data.reply);
          utter.rate = 1.03;
          utter.onstart = () => setOrbState('speaking');
          utter.onend = () => setOrbState('idle');
          utter.onerror = () => setOrbState('idle');
          setOrbState('speaking');
          window.speechSynthesis.speak(utter);
        } else {
          setOrbState('idle');
        }
      } else {
        setOrbState('idle');
      }
    } catch (e) {
      setOrbState('idle');
    }
  };

  const triggerMicListen = () => {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
      showToast('Browser Speech-to-Text requires Chrome or Edge. You can also type below!');
      return;
    }
    const rec = new SpeechRec();
    rec.lang = 'en-US';
    rec.interimResults = false;
    setOrbState('listening');
    rec.onresult = (e) => {
      const spoken = e.results[0][0].transcript;
      sendVoiceTurn(spoken);
    };
    rec.onerror = () => setOrbState('idle');
    rec.start();
  };

  return (
    <div className="space-y-6 animate-view">
      {/* Studio Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#635BFF]">
            <Icon name="phone" size={14} />
            <span>AI Voice Agent Studio â€¢ {activeTenant?.brandName}</span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight mt-1">
            Neural Voice Receptionists &amp; Call Agents
          </h1>
        </div>

        <div className="inline-flex p-1 rounded-xl fj-card">
          <button
            onClick={() => setMode('list')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition ${
              mode === 'list' ? 'bg-[#635BFF] text-white shadow' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Deployed Voice Agents ({voiceAgents.length})
          </button>
          <button
            onClick={() => {
              setStep(1);
              setMode('create');
            }}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition ${
              mode === 'create' ? 'bg-[#635BFF] text-white shadow' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            + 5-Step Voice Builder
          </button>
          <button
            onClick={() => {
              const target = selectedVoiceAgent || voiceAgents[0];
              if (target) initVoiceTestSession(target);
              setMode('test');
            }}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition ${
              mode === 'test' ? 'bg-[#635BFF] text-white shadow' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            ðŸŽ™ï¸ Interactive Voice Simulator
          </button>
        </div>
      </div>

      {/* MODE 1: VOICE AGENT CARDS */}
      {mode === 'list' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {voiceAgents.map((agent) => (
            <div key={agent.id} className="fj-card fj-card-hover p-6 flex flex-col justify-between gap-5">
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-[#EEEAFE] dark:bg-indigo-500/20 text-[#635BFF] dark:text-indigo-300 flex items-center justify-center">
                      <Icon name="phone" size={22} />
                    </div>
                    <div>
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[#DDF8EE] text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        {agent.status || 'Deployed'}
                      </span>
                      <h3 className="text-lg font-extrabold mt-1">{agent.name}</h3>
                    </div>
                  </div>

                  <button
                    onClick={() => onDeleteAgent(agent.id)}
                    title="Delete Voice Agent"
                    className="p-2 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition"
                  >
                    <Icon name="trash" size={16} />
                  </button>
                </div>

                {/* Metadata Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-5">
                  <div className="fj-subcard p-2.5">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Phone Line</span>
                    <span className="text-xs font-mono font-bold mt-0.5 block truncate">{agent.phoneNumber}</span>
                  </div>
                  <div className="fj-subcard p-2.5">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Calls Handled</span>
                    <span className="text-xs font-mono font-bold text-[#635BFF] mt-0.5 block">
                      {(agent.interactions || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="fj-subcard p-2.5">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Avg Latency</span>
                    <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 block">
                      {agent.avgLatencyMs || 395} ms
                    </span>
                  </div>
                  <div className="fj-subcard p-2.5">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Created</span>
                    <span className="text-xs font-mono mt-0.5 block">{agent.createdAt || '2026-10'}</span>
                  </div>
                </div>

                <div className="mt-4 space-y-2 text-xs">
                  <div className="fj-subcard p-3">
                    <span className="font-bold text-slate-700 dark:text-slate-200">Voice Identity: </span>
                    <span className="text-slate-600 dark:text-slate-300">{agent.voiceId}</span>
                  </div>
                  <div className="fj-subcard p-3">
                    <span className="font-bold text-slate-700 dark:text-slate-200">System Instructions: </span>
                    <p className="text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5">{agent.systemPrompt}</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-white/10">
                <span className="text-xs text-slate-400">
                  Client: <strong className="text-slate-700 dark:text-slate-200">{activeTenant?.brandName}</strong>
                </span>
                <button
                  onClick={() => {
                    initVoiceTestSession(agent);
                    setMode('test');
                  }}
                  className="brand-gradient hover:brightness-110 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow flex items-center gap-2 transition"
                >
                  <Icon name="mic" size={15} />
                  <span>Launch Voice Simulation</span>
                </button>
              </div>
            </div>
          ))}

          {/* Add New Voice Agent Card */}
          <div
            onClick={() => {
              setStep(1);
              setMode('create');
            }}
            className="cursor-pointer fj-card border-dashed border-2 border-slate-300 dark:border-white/15 hover:border-[#635BFF] p-8 flex flex-col items-center justify-center text-center gap-3 min-h-[280px] transition"
          >
            <div className="w-14 h-14 rounded-2xl bg-[#EEEAFE] dark:bg-indigo-500/20 text-[#635BFF] flex items-center justify-center">
              <Icon name="plus" size={26} />
            </div>
            <h3 className="text-base font-extrabold">Create New AI Voice Call Agent</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs">
              Use our guided 5-step studio to configure neural voice identity, greeting, knowledge, and phone routing.
            </p>
          </div>
        </div>
      )}

      {/* MODE 2: 5-STEP GUIDED VOICE AGENT CREATION WIZARD */}
      {mode === 'create' && (
        <div className="fj-card p-6 sm:p-8 max-w-4xl mx-auto">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-6 border-b border-slate-100 dark:border-white/10">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-[#635BFF]">
                Guided 5-Step Provisioning
              </span>
              <h2 className="text-xl font-extrabold mt-0.5">Build AI Voice Receptionist</h2>
            </div>
            <button
              type="button"
              onClick={fillSmartDefaults}
              className="px-3.5 py-2 rounded-xl bg-[#EEEAFE] text-[#635BFF] dark:bg-indigo-500/20 dark:text-indigo-300 text-xs font-bold flex items-center gap-1.5 hover:brightness-95 transition"
            >
              <Icon name="sparkles" size={14} />
              <span>Auto-Fill Industry Template</span>
            </button>
          </div>

          {/* Stepper Indicator */}
          <div className="grid grid-cols-5 gap-2 my-6">
            {[
              { n: 1, label: '1. Identity' },
              { n: 2, label: '2. Voice Engine' },
              { n: 3, label: '3. Conversation' },
              { n: 4, label: '4. Phone Setup' },
              { n: 5, label: '5. Review & Deploy' }
            ].map((s) => (
              <button
                key={s.n}
                type="button"
                onClick={() => setStep(s.n)}
                className={`py-2.5 px-2 rounded-xl text-xs font-bold text-center transition border ${
                  step === s.n
                    ? 'bg-[#635BFF] text-white border-[#635BFF] shadow'
                    : step > s.n
                    ? 'bg-[#DDF8EE] text-emerald-800 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30'
                    : 'fj-subcard text-slate-400'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* STEP 1: AGENT IDENTITY */}
          {step === 1 && (
            <div className="space-y-4 py-2 animate-view">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold mb-1.5">Agent Name &amp; Title *</label>
                  <input
                    type="text"
                    value={agentName}
                    onChange={(e) => setAgentName(e.target.value)}
                    placeholder="e.g., Sophia - 24/7 Patient Receptionist"
                    className="w-full rounded-xl fj-subcard px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#635BFF]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1.5">Client Workspace *</label>
                  <select
                    value={targetTenantId}
                    onChange={(e) => {
                      setTargetTenantId(e.target.value);
                      onSwitchTenant(e.target.value);
                    }}
                    className="w-full rounded-xl fj-subcard px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#635BFF]"
                  >
                    {tenants.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.brandName} ({t.industry})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1.5">Agent Role Description</label>
                <input
                  type="text"
                  value={agentDesc}
                  onChange={(e) => setAgentDesc(e.target.value)}
                  className="w-full rounded-xl fj-subcard px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#635BFF]"
                />
              </div>
            </div>
          )}

          {/* STEP 2: VOICE CONFIGURATION */}
          {step === 2 && (
            <div className="space-y-4 py-2 animate-view">
              <label className="block text-xs font-bold">Select Neural Voice Profile</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {VOICE_PROVIDERS.map((vp) => {
                  const active = selectedVoiceObj.id === vp.id;
                  return (
                    <div
                      key={vp.id}
                      onClick={() => setSelectedVoiceObj(vp)}
                      className={`cursor-pointer p-4 rounded-xl border transition ${
                        active
                          ? 'border-[#635BFF] bg-[#EEEAFE]/40 dark:bg-indigo-500/15'
                          : 'fj-subcard hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-sm">{vp.voiceName}</span>
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#635BFF]/10 text-[#635BFF] dark:text-indigo-300">
                          {vp.provider}
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mt-1">
                        Personality: {vp.personality}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">Best for: {vp.style}</p>
                    </div>
                  );
                })}
              </div>

              <div>
                <label className="block text-xs font-bold mb-1.5">Speaking Style &amp; Pacing</label>
                <input
                  type="text"
                  value={speakingStyle}
                  onChange={(e) => setSpeakingStyle(e.target.value)}
                  className="w-full rounded-xl fj-subcard px-4 py-3 text-sm"
                />
              </div>
            </div>
          )}

          {/* STEP 3: CONVERSATION SETUP */}
          {step === 3 && (
            <div className="space-y-4 py-2 animate-view">
              <div>
                <label className="block text-xs font-bold mb-1.5">
                  Spoken Greeting Message (First thing caller hears)
                </label>
                <input
                  type="text"
                  value={greeting}
                  onChange={(e) => setGreeting(e.target.value)}
                  placeholder={`Thank you for calling ${activeTenant?.brandName}! How can I help you today?`}
                  className="w-full rounded-xl fj-subcard px-4 py-3 text-sm"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold">
                    System Instructions, Pricing &amp; Qualification Knowledge *
                  </label>
                  <span className="text-[11px] text-[#635BFF] font-semibold">
                    Used live by the webhook simulator
                  </span>
                </div>
                <textarea
                  rows="4"
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  placeholder="Include service prices (e.g., $125 consultation), business hours (Mon-Sat 8am-6pm), accepted insurance, and appointment booking rules..."
                  className="w-full rounded-xl fj-subcard p-4 text-sm"
                />
              </div>
            </div>
          )}

          {/* STEP 4: CONTACT CONFIGURATION */}
          {step === 4 && (
            <div className="space-y-4 py-2 animate-view">
              <div>
                <label className="block text-xs font-bold mb-1.5">
                  Assigned Twilio / SIP Phone Number
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="w-full rounded-xl fj-subcard px-4 py-3 text-sm font-mono"
                  />
                  <button
                    type="button"
                    onClick={generateNumber}
                    className="px-4 py-3 rounded-xl bg-[#635BFF] text-white text-xs font-bold shrink-0"
                  >
                    Generate Toll-Free #
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="fj-subcard p-4">
                  <span className="text-xs font-bold block">Call Recording &amp; Transcripts</span>
                  <span className="text-xs text-slate-500 mt-1 block">
                    Enabled automatically with real-time intent &amp; entity extraction.
                  </span>
                </div>
                <div className="fj-subcard p-4">
                  <span className="text-xs font-bold block">Human Warm Transfer</span>
                  <span className="text-xs text-slate-500 mt-1 block">
                    Automatically escalates urgent / high-priority requests to staff.
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: REVIEW & DEPLOY */}
          {step === 5 && (
            <div className="space-y-4 py-2 animate-view">
              <div className="fj-subcard p-5 space-y-3 text-xs">
                <div className="flex justify-between border-b border-slate-200 dark:border-white/10 pb-2">
                  <span className="text-slate-500">Agent Name:</span>
                  <span className="font-bold">{agentName || '(Required â€” Step 1)'}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200 dark:border-white/10 pb-2">
                  <span className="text-slate-500">Client Workspace:</span>
                  <span className="font-bold">{activeTenant?.brandName}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200 dark:border-white/10 pb-2">
                  <span className="text-slate-500">Voice Profile:</span>
                  <span className="font-bold">{selectedVoiceObj.id}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200 dark:border-white/10 pb-2">
                  <span className="text-slate-500">Phone Line:</span>
                  <span className="font-mono font-bold">{phoneNumber}</span>
                </div>
                <div>
                  <span className="text-slate-500 block mb-1">System Instructions:</span>
                  <p className="p-3 rounded-lg bg-white dark:bg-black/20 text-slate-700 dark:text-slate-300">
                    {systemPrompt || '(Required â€” Step 3)'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Wizard Navigation Footer */}
          <div className="flex items-center justify-between pt-6 mt-6 border-t border-slate-100 dark:border-white/10">
            <button
              type="button"
              onClick={() => (step > 1 ? setStep(step - 1) : setMode('list'))}
              className="px-4 py-2.5 rounded-xl fj-subcard text-xs font-bold"
            >
              {step > 1 ? 'â† Previous Step' : 'Cancel'}
            </button>

            {step < 5 ? (
              <button
                type="button"
                onClick={() => setStep(step + 1)}
                className="px-6 py-2.5 rounded-xl bg-[#635BFF] hover:bg-[#5249e6] text-white text-xs font-bold shadow"
              >
                Continue to Step {step + 1} â†’
              </button>
            ) : (
              <button
                type="button"
                disabled={isDeploying}
                onClick={handleDeployVoiceAgent}
                className="brand-gradient hover:brightness-110 text-white text-xs sm:text-sm font-bold px-6 py-2.5 rounded-xl shadow-lg flex items-center gap-2"
              >
                <Icon name="zap" size={16} />
                <span>{isDeploying ? 'Deploying Voice Agent...' : 'Deploy Voice Agent Now'}</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* MODE 3: INTERACTIVE VOICE AGENT SIMULATION DECK */}
      {mode === 'test' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-view">
          {/* Left 5 Cols: Deep Navy Animated Voice Orb & Call Deck */}
          <div className="lg:col-span-5 fj-navy-surface rounded-2xl p-6 flex flex-col justify-between min-h-[520px] shadow-2xl">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/15 text-amber-300 border border-amber-400/30 text-[11px] font-bold">
                <span>âš¡ Simulated Voice Sandbox (Not PSTN Call)</span>
              </span>
              <select
                value={selectedVoiceAgent?.id || ''}
                onChange={(e) => {
                  const found = voiceAgents.find((a) => a.id === e.target.value);
                  if (found) initVoiceTestSession(found);
                }}
                className="bg-white/10 text-white text-xs font-bold rounded-lg px-2.5 py-1.5 border border-white/15"
              >
                {voiceAgents.map((a) => (
                  <option key={a.id} value={a.id} className="text-slate-900">
                    {a.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Center Animated Neural Orb */}
            <div className="my-8 flex flex-col items-center text-center">
              <div
                onClick={triggerMicListen}
                className={`cursor-pointer w-32 h-32 rounded-full brand-gradient flex items-center justify-center shadow-2xl transition-all ${
                  orbState !== 'idle' ? 'voice-orb-active' : 'hover:scale-105'
                }`}
              >
                <Icon name={orbState === 'speaking' ? 'volume' : 'mic'} size={42} className="text-white" />
              </div>

              <div className="mt-5">
                <span className="text-xs uppercase tracking-widest font-mono text-cyan-300 block">
                  {orbState === 'listening'
                    ? 'ðŸ”´ Listening to Microphone...'
                    : orbState === 'processing'
                    ? 'âš¡ Neural Engine Processing...'
                    : orbState === 'speaking'
                    ? 'ðŸ”Š Agent Speaking Response...'
                    : 'â— Ready for Voice Utterance'}
                </span>
                <h3 className="text-lg font-extrabold text-white mt-1">
                  {selectedVoiceAgent?.name || 'Select a Voice Agent'}
                </h3>
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  {selectedVoiceAgent?.voiceId} â€¢ {selectedVoiceAgent?.phoneNumber}
                </p>
              </div>

              {/* Audio Waveform Bars */}
              <div className="h-10 flex items-center justify-center gap-1.5 mt-4">
                {[...Array(14)].map((_, i) => (
                  <div
                    key={i}
                    className={`w-1.5 rounded-full brand-gradient ${
                      orbState !== 'idle' ? 'h-9 waveform-bar' : 'h-2 opacity-40'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Controls & Telemetry Footer */}
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2 text-center bg-white/5 rounded-xl p-2.5 border border-white/10 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 block">Detected Intent</span>
                  <span className="font-mono font-bold text-cyan-300 truncate block">
                    {lastTelemetry?.intent || 'ready'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Confidence</span>
                  <span className="font-mono font-bold text-emerald-400">
                    {Math.round((lastTelemetry?.confidence || 0.98) * 100)}%
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Latency</span>
                  <span className="font-mono font-bold text-white">
                    {lastTelemetry?.latencyMs || 380} ms
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={triggerMicListen}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-[#635BFF] hover:bg-[#5249e6] text-white text-xs font-bold flex items-center justify-center gap-2 transition"
                >
                  <Icon name="mic" size={15} />
                  <span>Click to Speak</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
                    setOrbState('idle');
                  }}
                  className="py-2.5 px-3.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-bold text-white"
                >
                  Mute
                </button>
                <button
                  type="button"
                  onClick={() => selectedVoiceAgent && initVoiceTestSession(selectedVoiceAgent)}
                  className="py-2.5 px-3.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-bold text-white"
                >
                  Reset
                </button>
              </div>
            </div>
          </div>

          {/* Right 7 Cols: Live Call Transcript & Starter Scenarios */}
          <div className="lg:col-span-7 fj-card p-6 flex flex-col justify-between h-[520px]">
            <div className="pb-3 border-b border-slate-100 dark:border-white/10 flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold">Live Voice Call Transcript</h3>
                <p className="text-xs text-slate-500">
                  Speak via microphone or click any caller utterance below to test {selectedVoiceAgent?.name}
                </p>
              </div>
              <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                POST /api/simulate/webhook
              </span>
            </div>

            <div className="flex-1 overflow-y-auto custom-scroll py-4 space-y-3 pr-1">
              {transcript.map((item) =>
                item.role === 'user' ? (
                  <div key={item.id} className="flex justify-end">
                    <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-[#635BFF] text-white px-4 py-2.5 text-xs sm:text-sm font-medium shadow">
                      {item.text}
                    </div>
                  </div>
                ) : (
                  <div key={item.id} className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-xl bg-[#EEEAFE] text-[#635BFF] flex items-center justify-center shrink-0 mt-0.5">
                      <Icon name="phone" size={15} />
                    </div>
                    <div className="max-w-[82%]">
                      <div className="fj-subcard px-4 py-2.5 text-xs sm:text-sm leading-relaxed">
                        {item.text}
                      </div>
                      {item.meta && (
                        <span className="text-[10px] font-mono text-slate-400 mt-1 block px-1">
                          {item.meta}
                        </span>
                      )}
                    </div>
                  </div>
                )
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-white/10 space-y-2.5">
              <div className="flex flex-wrap gap-1.5">
                {DEFAULT_TEST_SCENARIOS.map((sc, i) => (
                  <button
                    key={i}
                    onClick={() => sendVoiceTurn(sc.prompt)}
                    className="text-xs px-3 py-1 rounded-lg fj-subcard hover:border-[#635BFF] font-semibold transition"
                  >
                    {sc.label}
                  </button>
                ))}
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  sendVoiceTurn(callerInput);
                }}
                className="flex gap-2"
              >
                <input
                  type="text"
                  value={callerInput}
                  onChange={(e) => setCallerInput(e.target.value)}
                  placeholder="Type a simulated caller question (or use Click to Speak)..."
                  className="flex-1 rounded-xl fj-subcard px-4 py-2.5 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#635BFF]"
                />
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[#635BFF] hover:bg-[#5249e6] text-white text-xs font-bold flex items-center gap-1.5 shrink-0"
                >
                  <span>Send Utterance</span>
                  <Icon name="send" size={14} />
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 3. AI CHATBOT STUDIO (CARDS + GUIDED BUILDER + TWO-PANEL LIVE PLAYGROUND)
// ============================================================================
function ChatbotStudioView({
  activeTenant,
  onAgentCreated,
  onDeleteAgent,
  onSimulationEvent,
  initialOpenBuilder,
  showToast
}) {
  const [tab, setTab] = useState(initialOpenBuilder ? 'builder' : 'playground'); // 'cards' | 'builder' | 'playground'
  const chatbots = useMemo(
    () => (activeTenant?.agents || []).filter((a) => a.type === 'chatbot'),
    [activeTenant]
  );
  const [selectedBot, setSelectedBot] = useState(chatbots[0] || activeTenant?.agents?.[0] || null);

  // Builder state
  const [botName, setBotName] = useState('');
  const [embedChannel, setEmbedChannel] = useState('');
  const [welcomeMsg, setWelcomeMsg] = useState('');
  const [botPrompt, setBotPrompt] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Two-panel playground state
  const [chatLog, setChatLog] = useState([]);
  const [msgInput, setMsgInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [metrics, setMetrics] = useState({ intent: 'ready', confidence: 0.98, latencyMs: 240 });

  useEffect(() => {
    const list = (activeTenant?.agents || []).filter((a) => a.type === 'chatbot');
    const chosen = list[0] || activeTenant?.agents?.[0] || null;
    setSelectedBot(chosen);
    setEmbedChannel(`Embedded on ${activeTenant?.domain || 'clientwebsite.com'}`);
    if (chosen) {
      setChatLog([
        {
          id: 'c-init',
          role: 'agent',
          text: chosen.greeting || `Hi! Welcome to ${activeTenant?.brandName}. How can I help you today?`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    }
  }, [activeTenant]);

  const handleCreateBot = async (e) => {
    e.preventDefault();
    if (!botName.trim() || !botPrompt.trim()) return;
    setIsSaving(true);
    try {
      const res = await fetch(`${''}/api/tenants/${activeTenant.id}/agents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: botName,
          type: 'chatbot',
          voiceId: 'N/A (Web Widget)',
          phoneNumber: embedChannel,
          greeting: welcomeMsg,
          systemPrompt: botPrompt
        })
      });
      const data = await res.json();
      if (res.ok) {
        onAgentCreated(data.tenant, data.agent);
        setSelectedBot(data.agent);
        setBotName('');
        setWelcomeMsg('');
        setBotPrompt('');
        setTab('playground');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const sendChatMessage = async (textToSend) => {
    const text = (textToSend || '').trim();
    if (!text || !selectedBot || !activeTenant) return;
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userEntry = { id: `u-${Date.now()}`, role: 'user', text, time: nowTime };
    setChatLog((prev) => [...prev, userEntry]);
    setMsgInput('');
    setTyping(true);

    try {
      const res = await fetch(`${''}/api/simulate/webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: activeTenant.id,
          agentId: selectedBot.id,
          userMessage: text,
          mode: 'chat',
          callHistory: [...chatLog, userEntry]
        })
      });
      const data = await res.json();
      setTyping(false);
      if (res.ok) {
        setChatLog((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            role: 'agent',
            text: data.reply,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            intent: data.intentDetected,
            confidence: data.confidence,
            latencyMs: data.latencyMs
          }
        ]);
        setMetrics({
          intent: data.intentDetected,
          confidence: data.confidence,
          latencyMs: data.latencyMs
        });
        onSimulationEvent(selectedBot, text, data);
      }
    } catch (err) {
      setTyping(false);
    }
  };

  return (
    <div className="space-y-6 animate-view">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#21C8D8]">
            <Icon name="bot" size={15} />
            <span>AI Chatbot Studio â€¢ {activeTenant?.brandName}</span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight mt-1">
            Omnichannel Website &amp; WhatsApp Chatbots
          </h1>
        </div>

        <div className="inline-flex p-1 rounded-xl fj-card">
          <button
            onClick={() => setTab('playground')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition ${
              tab === 'playground' ? 'bg-[#635BFF] text-white shadow' : 'text-slate-500'
            }`}
          >
            ðŸ’¬ Two-Panel Live Playground
          </button>
          <button
            onClick={() => setTab('cards')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition ${
              tab === 'cards' ? 'bg-[#635BFF] text-white shadow' : 'text-slate-500'
            }`}
          >
            Chatbot Roster ({chatbots.length})
          </button>
          <button
            onClick={() => setTab('builder')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition ${
              tab === 'builder' ? 'bg-[#635BFF] text-white shadow' : 'text-slate-500'
            }`}
          >
            + Guided Chatbot Builder
          </button>
        </div>
      </div>

      {/* TAB 1: TWO-PANEL LIVE CHATBOT PLAYGROUND */}
      {tab === 'playground' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT PANEL: Configuration & Agent Telemetry */}
          <div className="lg:col-span-5 fj-card p-6 flex flex-col justify-between gap-4">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Active Chatbot Selected
                </label>
                <select
                  value={selectedBot?.id || ''}
                  onChange={(e) => {
                    const found = (activeTenant?.agents || []).find((a) => a.id === e.target.value);
                    if (found) {
                      setSelectedBot(found);
                      setChatLog([
                        {
                          id: `init-${Date.now()}`,
                          role: 'agent',
                          text: found.greeting,
                          time: 'Just now'
                        }
                      ]);
                    }
                  }}
                  className="w-full rounded-xl fj-subcard px-3.5 py-2.5 text-sm font-bold"
                >
                  {(activeTenant?.agents || []).map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.type === 'chatbot' ? 'ðŸ’¬' : 'ðŸ“ž'} {a.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="fj-subcard p-4 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Client Brand:</span>
                  <span className="font-bold">{activeTenant?.brandName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Deployment Channel:</span>
                  <span className="font-mono font-semibold">{selectedBot?.phoneNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Total Sessions:</span>
                  <span className="font-mono font-bold text-[#635BFF]">
                    {(selectedBot?.interactions || 0).toLocaleString()}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                  Active System Prompt &amp; Knowledge Base
                </span>
                <div className="fj-subcard p-3.5 text-xs text-slate-600 dark:text-slate-300 leading-relaxed max-h-40 overflow-y-auto custom-scroll">
                  {selectedBot?.systemPrompt}
                </div>
              </div>
            </div>

            {/* Live AI NLU Telemetry Box */}
            <div className="fj-navy-surface rounded-xl p-4 space-y-2">
              <div className="text-[11px] font-mono uppercase tracking-wider text-cyan-300">
                Real-Time NLU Telemetry
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 block">Intent</span>
                  <span className="font-mono font-bold text-white truncate block">{metrics.intent}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Confidence</span>
                  <span className="font-mono font-bold text-emerald-400">
                    {Math.round((metrics.confidence || 0.98) * 100)}%
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Latency</span>
                  <span className="font-mono font-bold text-cyan-300">{metrics.latencyMs} ms</span>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT PANEL: Branded Live Website Chatbot Preview */}
          <div className="lg:col-span-7 fj-card overflow-hidden flex flex-col h-[540px]">
            {/* Branded Widget Header */}
            <div className="brand-gradient p-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img
                  src={activeTenant?.logoUrl}
                  alt={activeTenant?.brandName}
                  className="w-10 h-10 rounded-xl object-cover border-2 border-white/30 bg-slate-900"
                />
                <div>
                  <h3 className="text-sm font-extrabold">{selectedBot?.name}</h3>
                  <span className="text-[11px] opacity-90 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse" />
                    {activeTenant?.brandName} â€¢ Instant AI Concierge
                  </span>
                </div>
              </div>

              <button
                onClick={() =>
                  setChatLog([
                    {
                      id: `clear-${Date.now()}`,
                      role: 'agent',
                      text: selectedBot?.greeting || 'Conversation cleared. How can I help you?',
                      time: 'Just now'
                    }
                  ])
                }
                className="px-3 py-1.5 rounded-lg bg-black/20 hover:bg-black/30 text-xs font-bold transition"
              >
                Clear Chat
              </button>
            </div>

            {/* Messages Area */}
            <div className="flex-1 p-4 overflow-y-auto custom-scroll space-y-3">
              {chatLog.map((m) =>
                m.role === 'user' ? (
                  <div key={m.id} className="flex flex-col items-end">
                    <div className="max-w-[78%] brand-gradient text-white px-4 py-2.5 rounded-2xl rounded-br-sm text-xs sm:text-sm font-medium shadow">
                      {m.text}
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1">{m.time}</span>
                  </div>
                ) : (
                  <div key={m.id} className="flex items-start gap-2.5">
                    <img
                      src={activeTenant?.logoUrl}
                      alt="Bot"
                      className="w-7 h-7 rounded-lg object-cover mt-1 shrink-0"
                    />
                    <div className="max-w-[82%]">
                      <div className="fj-subcard px-4 py-2.5 rounded-2xl rounded-tl-sm text-xs sm:text-sm leading-relaxed">
                        {m.text}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400 mt-1 px-1">
                        <span>{m.time}</span>
                        {m.intent && (
                          <>
                            <span>â€¢</span>
                            <span className="text-[#635BFF] dark:text-indigo-300">{m.intent}</span>
                            <span>â€¢</span>
                            <span>{m.latencyMs}ms</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )
              )}

              {typing && (
                <div className="flex items-center gap-2 pl-2">
                  <div className="fj-subcard px-3 py-2 rounded-2xl flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#635BFF] typing-dot" />
                    <span className="w-1.5 h-1.5 rounded-full bg-[#635BFF] typing-dot" />
                    <span className="w-1.5 h-1.5 rounded-full bg-[#635BFF] typing-dot" />
                  </div>
                </div>
              )}
            </div>

            {/* Suggested Prompts & Input */}
            <div className="p-3.5 border-t border-slate-100 dark:border-white/10 space-y-2.5">
              <div className="flex flex-wrap gap-1.5">
                {DEFAULT_TEST_SCENARIOS.map((s, idx) => (
                  <button
                    key={idx}
                    onClick={() => sendChatMessage(s.prompt)}
                    className="text-[11px] px-2.5 py-1 rounded-lg fj-subcard hover:border-[#635BFF] font-semibold transition"
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  sendChatMessage(msgInput);
                }}
                className="flex gap-2"
              >
                <input
                  type="text"
                  value={msgInput}
                  onChange={(e) => setMsgInput(e.target.value)}
                  placeholder={`Message ${selectedBot?.name || 'Chatbot'}...`}
                  className="flex-1 rounded-xl fj-subcard px-4 py-2.5 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#635BFF]"
                />
                <button
                  type="submit"
                  className="brand-gradient text-white px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow"
                >
                  <span>Send</span>
                  <Icon name="send" size={14} />
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CHATBOT CARDS */}
      {tab === 'cards' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {chatbots.map((bot) => (
            <div key={bot.id} className="fj-card p-6 flex flex-col justify-between gap-4">
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-cyan-100 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-300 flex items-center justify-center">
                      <Icon name="bot" size={22} />
                    </div>
                    <div>
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#DDF8EE] text-emerald-700">
                        Active Web Widget
                      </span>
                      <h3 className="text-base font-extrabold mt-1">{bot.name}</h3>
                    </div>
                  </div>
                  <button
                    onClick={() => onDeleteAgent(bot.id)}
                    className="p-2 text-slate-400 hover:text-rose-500"
                  >
                    <Icon name="trash" size={16} />
                  </button>
                </div>

                <div className="mt-4 fj-subcard p-3 text-xs">
                  <span className="font-bold">Greeting Preview: </span>
                  <span className="text-slate-600 dark:text-slate-300">"{bot.greeting}"</span>
                </div>
                <div className="mt-2 fj-subcard p-3 text-xs">
                  <span className="font-bold">System Prompt: </span>
                  <p className="text-slate-500 line-clamp-2 mt-0.5">{bot.systemPrompt}</p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-white/10">
                <span className="text-xs font-mono text-slate-500">
                  {(bot.interactions || 0).toLocaleString()} conversations
                </span>
                <button
                  onClick={() => {
                    setSelectedBot(bot);
                    setTab('playground');
                  }}
                  className="px-4 py-2 rounded-xl bg-[#635BFF] text-white text-xs font-bold"
                >
                  Open in Playground â†’
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB 3: GUIDED CHATBOT BUILDER */}
      {tab === 'builder' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form onSubmit={handleCreateBot} className="lg:col-span-7 fj-card p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/10">
              <h3 className="text-base font-extrabold">Configure New Website Chatbot</h3>
              <button
                type="button"
                onClick={() => {
                  const b = activeTenant?.brandName || 'Client';
                  setBotName(`${b.split(' ')[0]} 24/7 Website Concierge`);
                  setWelcomeMsg(`Hi! Welcome to ${b}. Looking for an instant quote or appointment slot?`);
                  setBotPrompt(
                    `You are the official website AI concierge for ${b}. Answer visitor questions about pricing ($199 standard package, $499 VIP package), hours (Mon-Sat 8am-6pm), and collect their name and phone number to lock in a free consultation.`
                  );
                }}
                className="text-xs font-bold text-[#635BFF] hover:underline"
              >
                âœ¨ Auto-Fill Template
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold mb-1.5">Chatbot Name *</label>
                <input
                  type="text"
                  required
                  value={botName}
                  onChange={(e) => setBotName(e.target.value)}
                  placeholder="e.g., Website Lead & Quote Concierge"
                  className="w-full rounded-xl fj-subcard px-3.5 py-2.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1.5">Embed Domain / Channel</label>
                <input
                  type="text"
                  value={embedChannel}
                  onChange={(e) => setEmbedChannel(e.target.value)}
                  className="w-full rounded-xl fj-subcard px-3.5 py-2.5 text-sm font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold mb-1.5">Welcome Bubble Message</label>
              <input
                type="text"
                value={welcomeMsg}
                onChange={(e) => setWelcomeMsg(e.target.value)}
                placeholder="Hi there! How can I help you today?"
                className="w-full rounded-xl fj-subcard px-3.5 py-2.5 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold mb-1.5">
                Knowledge Base, Pricing &amp; Personality Instructions *
              </label>
              <textarea
                rows="4"
                required
                value={botPrompt}
                onChange={(e) => setBotPrompt(e.target.value)}
                placeholder="Enter pricing details, FAQs, and qualification instructions..."
                className="w-full rounded-xl fj-subcard p-3.5 text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={isSaving}
              className="brand-gradient text-white font-bold text-xs sm:text-sm px-6 py-3 rounded-xl shadow-lg"
            >
              {isSaving ? 'Deploying Chatbot...' : 'ðŸš€ Deploy Website Chatbot'}
            </button>
          </form>

          {/* Live Widget Preview Card */}
          <div className="lg:col-span-5 fj-card p-5 flex flex-col justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Live Client Widget Preview
            </span>
            <div className="my-4 rounded-2xl overflow-hidden border border-slate-200 dark:border-white/10 shadow-lg">
              <div className="brand-gradient p-4 text-white flex items-center gap-3">
                <img
                  src={activeTenant?.logoUrl}
                  alt="Logo"
                  className="w-9 h-9 rounded-lg object-cover bg-slate-900"
                />
                <div>
                  <div className="text-xs font-extrabold">{botName || 'Website AI Concierge'}</div>
                  <div className="text-[10px] opacity-85">{activeTenant?.brandName}</div>
                </div>
              </div>
              <div className="p-4 bg-slate-50 dark:bg-slate-900/80 space-y-2 text-xs">
                <div className="fj-subcard p-3 rounded-xl">
                  {welcomeMsg || `Hi! Welcome to ${activeTenant?.brandName}. How can I help you today?`}
                </div>
              </div>
            </div>
            <p className="text-[11px] text-slate-400">
              Automatically inherits {activeTenant?.brandName}'s primary and accent brand colors.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 4. SIGNATURE AI PLAYGROUND (VOICE/CHAT SANDBOX + DEVELOPER JSON INSPECTOR)
// ============================================================================
function PlaygroundView({
  activeTenant,
  initialAgent,
  onSimulationEvent,
  showToast
}) {
  const agents = activeTenant?.agents || [];
  const [selectedAgent, setSelectedAgent] = useState(initialAgent || agents[0] || null);
  const [mode, setMode] = useState(initialAgent?.type || agents[0]?.type || 'voice');
  const [ttsOn, setTtsOn] = useState(true);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [lastWebhookData, setLastWebhookData] = useState(null);

  useEffect(() => {
    const chosen = initialAgent || agents[0] || null;
    setSelectedAgent(chosen);
    if (chosen) {
      setMode(chosen.type);
      setMessages([
        {
          id: 'pg-init',
          role: 'agent',
          text: chosen.greeting || `Hello! Welcome to ${activeTenant?.brandName}.`,
          meta: 'Sandbox Initialized'
        }
      ]);
      setLastWebhookData({
        webhookEventId: 'evt_init_ready',
        tenantBrand: activeTenant?.brandName,
        agentId: chosen.id,
        agentName: chosen.name,
        agentType: chosen.type,
        intentDetected: 'session_ready',
        confidence: 0.99,
        latencyMs: chosen.avgLatencyMs || 340,
        webhookPayloadInspector: {
          provider: chosen.type === 'voice' ? 'FJ-Tech Voice Engine' : 'FJ-Tech Chat Engine',
          tenant_id: activeTenant?.id,
          agent_id: chosen.id,
          model: 'fj-tech-realtime-4o',
          extracted_entities: { brand: activeTenant?.brandName }
        }
      });
    }
  }, [activeTenant?.id, initialAgent?.id]);

  const runSimulationTurn = async (textToSend) => {
    const text = (textToSend || '').trim();
    if (!text || !selectedAgent || !activeTenant) return;

    const userMsg = { id: `u-${Date.now()}`, role: 'user', text };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch(`${''}/api/simulate/webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: activeTenant.id,
          agentId: selectedAgent.id,
          userMessage: text,
          mode,
          callHistory: [...messages, userMsg]
        })
      });
      const data = await res.json();
      setLoading(false);
      if (res.ok) {
        setMessages((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            role: 'agent',
            text: data.reply,
            meta: `${data.intentDetected} (${Math.round(data.confidence * 100)}%) â€¢ ${data.latencyMs}ms`
          }
        ]);
        setLastWebhookData(data);
        onSimulationEvent(selectedAgent, text, data);

        if (ttsOn && 'speechSynthesis' in window) {
          window.speechSynthesis.cancel();
          const utter = new SpeechSynthesisUtterance(data.reply);
          utter.rate = 1.03;
          window.speechSynthesis.speak(utter);
        }
      }
    } catch (e) {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5 animate-view">
      {/* Top Playground Control Bar */}
      <div className="fj-navy-surface rounded-2xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl brand-gradient flex items-center justify-center text-white">
            <Icon name="terminal" size={20} />
          </div>
          <div>
            <span className="text-[10px] font-mono uppercase tracking-widest text-cyan-300 block">
              Signature Testing Environment
            </span>
            <h1 className="text-lg sm:text-xl font-extrabold text-white">
              FJ-Tech Interactive AI Playground &amp; Webhook Inspector
            </h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Agent Selector */}
          <select
            value={selectedAgent?.id || ''}
            onChange={(e) => {
              const found = agents.find((a) => a.id === e.target.value);
              if (found) {
                setSelectedAgent(found);
                setMode(found.type);
              }
            }}
            className="bg-white/10 text-white text-xs font-bold rounded-xl px-3.5 py-2 border border-white/15"
          >
            {agents.map((a) => (
              <option key={a.id} value={a.id} className="text-slate-900">
                {a.type === 'voice' ? 'ðŸ“ž' : 'ðŸ’¬'} {a.name}
              </option>
            ))}
          </select>

          {/* Voice / Chat Mode Switcher */}
          <div className="inline-flex p-1 rounded-xl bg-black/30 border border-white/10 text-xs font-bold">
            <button
              onClick={() => setMode('voice')}
              className={`px-3 py-1.5 rounded-lg transition ${
                mode === 'voice' ? 'bg-[#635BFF] text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              ðŸ“ž Voice Mode
            </button>
            <button
              onClick={() => setMode('chatbot')}
              className={`px-3 py-1.5 rounded-lg transition ${
                mode === 'chatbot' ? 'bg-[#21C8D8] text-slate-950' : 'text-slate-400 hover:text-white'
              }`}
            >
              ðŸ’¬ Chat Mode
            </button>
          </div>

          <button
            onClick={() => {
              if (ttsOn && 'speechSynthesis' in window) window.speechSynthesis.cancel();
              setTtsOn(!ttsOn);
            }}
            className={`px-3 py-2 rounded-xl text-xs font-bold border transition ${
              ttsOn
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                : 'bg-white/5 text-slate-400 border-white/10'
            }`}
          >
            {ttsOn ? 'ðŸ”Š Audio On' : 'ðŸ”‡ Audio Muted'}
          </button>

          <button
            onClick={() => setInspectorOpen(!inspectorOpen)}
            className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-bold text-white border border-white/15"
          >
            {inspectorOpen ? 'Hide Dev Inspector' : 'Show Dev Inspector'}
          </button>
        </div>
      </div>

      {/* Main Playground Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Conversation Simulator Column */}
        <div className={`${inspectorOpen ? 'lg:col-span-7' : 'lg:col-span-12'} fj-card flex flex-col h-[560px] overflow-hidden`}>
          <div className="px-5 py-3.5 border-b border-slate-100 dark:border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span className="text-sm font-extrabold">{selectedAgent?.name}</span>
              <span className="text-xs font-mono text-slate-400">({selectedAgent?.phoneNumber})</span>
            </div>
            <button
              onClick={() => {
                if ('speechSynthesis' in window) window.speechSynthesis.cancel();
                setMessages([
                  {
                    id: `rst-${Date.now()}`,
                    role: 'agent',
                    text: selectedAgent?.greeting || 'Session reset. How can I help you?',
                    meta: 'Session Reset'
                  }
                ]);
              }}
              className="text-xs font-bold text-slate-400 hover:text-[#635BFF]"
            >
              â†º Reset Transcript
            </button>
          </div>

          <div className="flex-1 p-5 overflow-y-auto custom-scroll space-y-3.5">
            {messages.map((m) =>
              m.role === 'user' ? (
                <div key={m.id} className="flex justify-end">
                  <div className="max-w-[80%] brand-gradient text-white px-4 py-2.5 rounded-2xl rounded-br-sm text-xs sm:text-sm font-medium shadow">
                    {m.text}
                  </div>
                </div>
              ) : (
                <div key={m.id} className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-[#EEEAFE] dark:bg-indigo-500/20 text-[#635BFF] dark:text-indigo-300 flex items-center justify-center shrink-0 mt-0.5">
                    <Icon name={mode === 'voice' ? 'phone' : 'bot'} size={16} />
                  </div>
                  <div className="max-w-[84%]">
                    <div className="fj-subcard px-4 py-3 rounded-2xl rounded-tl-sm text-xs sm:text-sm leading-relaxed">
                      {m.text}
                    </div>
                    {m.meta && (
                      <div className="text-[10px] font-mono text-slate-400 mt-1 px-1">{m.meta}</div>
                    )}
                  </div>
                </div>
              )
            )}
            {loading && (
              <div className="text-xs font-mono text-[#635BFF] pl-2 animate-pulse">
                Executing POST /api/simulate/webhook...
              </div>
            )}
          </div>

          <div className="p-4 border-t border-slate-100 dark:border-white/10 space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {DEFAULT_TEST_SCENARIOS.map((sc, i) => (
                <button
                  key={i}
                  onClick={() => runSimulationTurn(sc.prompt)}
                  className="text-xs px-3 py-1.5 rounded-lg fj-subcard hover:border-[#635BFF] font-semibold transition"
                >
                  {sc.label}
                </button>
              ))}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                runSimulationTurn(input);
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Test pricing, appointment booking, hours, or emergency escalation..."
                className="flex-1 rounded-xl fj-subcard px-4 py-2.5 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#635BFF]"
              />
              <button
                type="submit"
                className="brand-gradient text-white font-bold text-xs sm:text-sm px-5 py-2.5 rounded-xl shadow flex items-center gap-1.5"
              >
                <span>Execute Turn</span>
                <Icon name="send" size={14} />
              </button>
            </form>
          </div>
        </div>

        {/* Technical Webhook & Entity Inspector Column */}
        {inspectorOpen && (
          <div className="lg:col-span-5 fj-navy-surface rounded-2xl p-5 flex flex-col justify-between h-[560px] shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Icon name="code" size={16} className="text-cyan-300" />
                <span className="text-xs font-extrabold uppercase tracking-wider text-white">
                  Live Webhook Event Inspector
                </span>
              </div>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                200 OK
              </span>
            </div>

            {/* Extracted Telemetry Cards */}
            <div className="grid grid-cols-3 gap-2.5 my-3 text-xs">
              <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                <span className="text-[10px] text-slate-400 uppercase block">Detected Intent</span>
                <span className="font-mono font-bold text-cyan-300 truncate block mt-0.5">
                  {lastWebhookData?.intentDetected || 'ready'}
                </span>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                <span className="text-[10px] text-slate-400 uppercase block">Confidence</span>
                <span className="font-mono font-bold text-emerald-400 block mt-0.5">
                  {Math.round((lastWebhookData?.confidence || 0.99) * 100)}%
                </span>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                <span className="text-[10px] text-slate-400 uppercase block">Response Time</span>
                <span className="font-mono font-bold text-white block mt-0.5">
                  {lastWebhookData?.latencyMs || 310} ms
                </span>
              </div>
            </div>

            {/* Raw JSON Payload Viewer */}
            <div className="flex-1 bg-black/40 border border-white/10 rounded-xl p-3.5 overflow-y-auto custom-scroll font-mono text-[11px] text-slate-200 leading-relaxed">
              <pre>{JSON.stringify(lastWebhookData || {}, null, 2)}</pre>
            </div>

            <div className="pt-3 flex items-center justify-between text-[11px] text-slate-400">
              <span>Endpoint: POST /api/simulate/webhook</span>
              <button
                onClick={() => {
                  navigator.clipboard?.writeText(JSON.stringify(lastWebhookData || {}, null, 2));
                  showToast('Copied JSON payload to clipboard');
                }}
                className="text-cyan-300 hover:underline font-semibold"
              >
                Copy JSON
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// 5. CLIENT WORKSPACES MANAGEMENT VIEW
// ============================================================================
function WorkspacesView({
  tenants,
  activeTenant,
  onSwitchTenant,
  onOpenNewClientModal,
  onNavigate
}) {
  return (
    <div className="space-y-6 animate-view">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#635BFF]">
            Multi-Tenant Reseller Architecture
          </span>
          <h1 className="text-2xl font-extrabold tracking-tight mt-0.5">
            Client Workspaces ({tenants.length})
          </h1>
        </div>
        <button
          onClick={onOpenNewClientModal}
          className="brand-gradient text-white font-bold text-xs sm:text-sm px-5 py-2.5 rounded-xl shadow-lg flex items-center gap-2 self-start"
        >
          <Icon name="plus" size={16} />
          <span>Provision New Client Workspace</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {tenants.map((tenant) => {
          const isCurrent = tenant.id === activeTenant?.id;
          const totalCalls = (tenant.agents || []).reduce((s, a) => s + (a.interactions || 0), 0);
          return (
            <div
              key={tenant.id}
              className={`fj-card fj-card-hover p-6 flex flex-col justify-between gap-5 ${
                isCurrent ? 'ring-2 ring-[#635BFF]' : ''
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3.5">
                    <img
                      src={tenant.logoUrl}
                      alt={tenant.brandName}
                      className="w-13 h-13 rounded-2xl object-cover border border-slate-200 dark:border-white/15"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[#DDF8EE] text-emerald-700">
                          {tenant.status || 'Active'}
                        </span>
                        {isCurrent && (
                          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[#635BFF] text-white">
                            Selected
                          </span>
                        )}
                      </div>
                      <h3 className="text-base font-extrabold mt-1">{tenant.brandName}</h3>
                      <span className="text-xs text-slate-400">{tenant.industry}</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5 mt-5 text-xs">
                  <div className="fj-subcard p-3">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Monthly Retainer</span>
                    <span className="text-sm font-mono font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5 block">
                      ${Number(tenant.monthlyRetainer || 1500).toLocaleString()}/mo
                    </span>
                  </div>
                  <div className="fj-subcard p-3">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Deployed Agents</span>
                    <span className="text-sm font-extrabold mt-0.5 block">
                      {(tenant.agents || []).length} Agents ({totalCalls.toLocaleString()} runs)
                    </span>
                  </div>
                </div>

                <div className="mt-3 fj-subcard p-3 flex items-center justify-between text-xs">
                  <span className="font-mono text-slate-500 truncate">{tenant.domain}</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span
                      className="w-4 h-4 rounded-full border border-white/20"
                      style={{ backgroundColor: tenant.primaryColor }}
                    />
                    <span
                      className="w-4 h-4 rounded-full border border-white/20"
                      style={{ backgroundColor: tenant.accentColor }}
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-3 border-t border-slate-100 dark:border-white/10">
                <button
                  onClick={() => onSwitchTenant(tenant.id)}
                  className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition ${
                    isCurrent
                      ? 'fj-subcard text-slate-500'
                      : 'bg-[#635BFF] hover:bg-[#5249e6] text-white shadow'
                  }`}
                >
                  {isCurrent ? 'âœ“ Active Workspace' : 'Switch to Workspace'}
                </button>
                <button
                  onClick={() => {
                    onSwitchTenant(tenant.id);
                    onNavigate('branding');
                  }}
                  className="py-2.5 px-3.5 rounded-xl fj-subcard hover:border-[#635BFF] text-xs font-bold"
                >
                  Branding
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// 6. BRANDING STUDIO (LIVE REAL-TIME WHITE-LABEL DESIGN TOOL)
// ============================================================================
function BrandingStudioView({ activeTenant, onBrandingSaved, showToast }) {
  const [brandName, setBrandName] = useState('');
  const [industry, setIndustry] = useState('');
  const [domain, setDomain] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#635BFF');
  const [accentColor, setAccentColor] = useState('#21C8D8');
  const [monthlyRetainer, setMonthlyRetainer] = useState(1500);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (activeTenant) {
      setBrandName(activeTenant.brandName || '');
      setIndustry(activeTenant.industry || '');
      setDomain(activeTenant.domain || '');
      setLogoUrl(activeTenant.logoUrl || '');
      setPrimaryColor(activeTenant.primaryColor || '#635BFF');
      setAccentColor(activeTenant.accentColor || '#21C8D8');
      setMonthlyRetainer(activeTenant.monthlyRetainer || 1500);
    }
  }, [activeTenant]);

  // Apply live CSS preview as user drags color pickers
  const previewColorsLive = (prim, acc) => {
    document.documentElement.style.setProperty('--brand-primary', prim);
    document.documentElement.style.setProperty('--brand-accent', acc);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!activeTenant) return;
    setSaving(true);
    try {
      const res = await fetch(`${''}/api/tenants/${activeTenant.id}/branding`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandName,
          industry,
          domain,
          logoUrl,
          primaryColor,
          accentColor,
          monthlyRetainer: Number(monthlyRetainer)
        })
      });
      const data = await res.json();
      if (res.ok) {
        onBrandingSaved(data.tenant, data.masterAgency);
      }
    } finally {
      setSaving(false);
    }
  };

  const PRESET_THEMES = [
    { name: 'FJ Electric Indigo', p: '#635BFF', a: '#21C8D8' },
    { name: 'Emerald Executive', p: '#10B981', a: '#F59E0B' },
    { name: 'Solaris Amber', p: '#F97316', a: '#EAB308' },
    { name: 'Royal Rose', p: '#EC4899', a: '#8B5CF6' }
  ];

  return (
    <div className="space-y-6 animate-view">
      <div>
        <span className="text-xs font-bold uppercase tracking-wider text-[#635BFF]">
          White-Label Design System
        </span>
        <h1 className="text-2xl font-extrabold tracking-tight mt-0.5">
          Branding Studio â€” {activeTenant?.brandName}
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 6 Cols: Branding Editor Form */}
        <form onSubmit={handleSave} className="lg:col-span-6 fj-card p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold mb-1.5">Client Brand Name *</label>
              <input
                type="text"
                required
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                className="w-full rounded-xl fj-subcard px-3.5 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1.5">Industry Vertical</label>
              <input
                type="text"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                className="w-full rounded-xl fj-subcard px-3.5 py-2.5 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold mb-1.5">Custom CNAME Portal Domain</label>
              <input
                type="text"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                className="w-full rounded-xl fj-subcard px-3.5 py-2.5 text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1.5">Monthly Retainer ($/mo)</label>
              <input
                type="number"
                value={monthlyRetainer}
                onChange={(e) => setMonthlyRetainer(e.target.value)}
                className="w-full rounded-xl fj-subcard px-3.5 py-2.5 text-sm font-mono"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold">Brand Logo URL *</label>
              <div className="flex gap-2 text-xs">
                <button
                  type="button"
                  onClick={() =>
                    setLogoUrl('https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=120&auto=format&fit=crop&q=80')
                  }
                  className="text-[#635BFF] font-semibold hover:underline"
                >
                  Dental
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setLogoUrl('https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=120&auto=format&fit=crop&q=80')
                  }
                  className="text-[#635BFF] font-semibold hover:underline"
                >
                  Realty
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setLogoUrl('https://images.unsplash.com/photo-1509391366360-2e959784a276?w=120&auto=format&fit=crop&q=80')
                  }
                  className="text-[#635BFF] font-semibold hover:underline"
                >
                  Solar
                </button>
              </div>
            </div>
            <input
              type="url"
              required
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              className="w-full rounded-xl fj-subcard px-3.5 py-2.5 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-bold mb-1.5">1-Click Color Palettes</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {PRESET_THEMES.map((pt) => (
                <button
                  key={pt.name}
                  type="button"
                  onClick={() => {
                    setPrimaryColor(pt.p);
                    setAccentColor(pt.a);
                    previewColorsLive(pt.p, pt.a);
                  }}
                  className="fj-subcard p-2 rounded-xl flex items-center gap-2 text-xs font-semibold hover:border-[#635BFF]"
                >
                  <span
                    className="w-4 h-4 rounded-full shrink-0"
                    style={{ background: `linear-gradient(135deg, ${pt.p}, ${pt.a})` }}
                  />
                  <span className="truncate text-[11px]">{pt.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold mb-1.5">Primary Brand Color</label>
              <div className="fj-subcard p-2.5 flex items-center gap-3">
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => {
                    setPrimaryColor(e.target.value);
                    previewColorsLive(e.target.value, accentColor);
                  }}
                  className="w-9 h-8 rounded cursor-pointer border-0 bg-transparent"
                />
                <span className="text-xs font-mono font-bold">{primaryColor}</span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold mb-1.5">Accent Brand Color</label>
              <div className="fj-subcard p-2.5 flex items-center gap-3">
                <input
                  type="color"
                  value={accentColor}
                  onChange={(e) => {
                    setAccentColor(e.target.value);
                    previewColorsLive(primaryColor, e.target.value);
                  }}
                  className="w-9 h-8 rounded cursor-pointer border-0 bg-transparent"
                />
                <span className="text-xs font-mono font-bold">{accentColor}</span>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full brand-gradient text-white font-bold text-sm py-3 rounded-xl shadow-lg"
          >
            {saving ? 'Saving White-Label Branding...' : 'Save & Publish White-Label Theme'}
          </button>
        </form>

        {/* Right 6 Cols: Real-Time Client Portal & Widget Preview */}
        <div className="lg:col-span-6 fj-card p-6 flex flex-col justify-between gap-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Live Client Portal Preview
            </span>
            <span className="text-xs font-mono text-[#635BFF]">{domain}</span>
          </div>

          <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-white/15 shadow-xl">
            <div
              className="p-6 text-white"
              style={{ background: `linear-gradient(135deg, ${primaryColor}, ${accentColor})` }}
            >
              <div className="flex items-center gap-4">
                <img
                  src={logoUrl}
                  alt={brandName}
                  className="w-14 h-14 rounded-2xl object-cover border-2 border-white/40 bg-slate-900 shadow"
                />
                <div>
                  <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded bg-black/25">
                    {industry || 'Enterprise Client Portal'}
                  </span>
                  <h3 className="text-xl font-extrabold mt-1">{brandName}</h3>
                  <p className="text-xs opacity-90">{domain}</p>
                </div>
              </div>
            </div>

            <div className="p-5 bg-white dark:bg-[#10152A] space-y-4">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold">AI Receptionist &amp; Web Concierge Status</span>
                <span
                  className="px-2.5 py-1 rounded-full text-white font-bold text-[11px]"
                  style={{ backgroundColor: primaryColor }}
                >
                  â— 100% Online
                </span>
              </div>
              <div className="fj-subcard p-3.5 text-xs">
                "Welcome to <strong>{brandName}</strong>! How can our AI concierge assist you today?"
              </div>
            </div>
          </div>

          <p className="text-xs text-slate-400">
            Changes saved here persist via <code className="font-mono">PUT /api/tenants/:tenantId/branding</code> and update CSS variables across the entire command center.
          </p>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 7. CONVERSATIONS, ANALYTICS, INTEGRATIONS & SETTINGS VIEWS
// ============================================================================
function SecondaryViews({
  view,
  masterAgency,
  activeTenant,
  tenants,
  recentEvents,
  onNavigate,
  showToast
}) {
  if (view === 'conversations') {
    return (
      <div className="space-y-5 animate-view">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[#635BFF]">
              Omnichannel Audit Log
            </span>
            <h1 className="text-2xl font-extrabold mt-0.5">Recent Call &amp; Chat Conversations</h1>
          </div>
          <button
            onClick={() => onNavigate('playground')}
            className="px-4 py-2 rounded-xl bg-[#635BFF] text-white text-xs font-bold"
          >
            + Simulate New Interaction
          </button>
        </div>

        <div className="fj-card overflow-hidden">
          <div className="divide-y divide-slate-100 dark:divide-white/10">
            {recentEvents.map((ev) => (
              <div key={ev.id} className="p-4 sm:p-5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-[#EEEAFE] dark:bg-indigo-500/20 text-[#635BFF] flex items-center justify-center shrink-0">
                    <Icon name={ev.type === 'voice' ? 'phone' : 'messages'} size={18} />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-sm font-bold truncate">{ev.title}</h4>
                    <p className="text-xs text-slate-500 truncate mt-0.5">{ev.subtitle}</p>
                  </div>
                </div>
                <span className="text-xs font-mono text-slate-400 shrink-0">{ev.time}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (view === 'analytics') {
    return (
      <div className="space-y-6 animate-view">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#635BFF]">
            Agency &amp; Tenant Intelligence
          </span>
          <h1 className="text-2xl font-extrabold mt-0.5">Performance &amp; Revenue Analytics</h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {tenants.map((t) => {
            const total = (t.agents || []).reduce((s, a) => s + (a.interactions || 0), 0);
            return (
              <div key={t.id} className="fj-card p-5 space-y-3">
                <div className="flex items-center gap-3">
                  <img src={t.logoUrl} alt={t.brandName} className="w-10 h-10 rounded-xl object-cover" />
                  <div>
                    <h3 className="text-sm font-extrabold">{t.brandName}</h3>
                    <span className="text-xs font-mono text-emerald-600 font-bold">
                      ${Number(t.monthlyRetainer || 1500).toLocaleString()}/mo Retainer
                    </span>
                  </div>
                </div>
                <div className="fj-subcard p-3 flex justify-between text-xs">
                  <span>Total AI Sessions:</span>
                  <span className="font-mono font-bold">{total.toLocaleString()}</span>
                </div>
                <div className="fj-subcard p-3 flex justify-between text-xs">
                  <span>Active Agents:</span>
                  <span className="font-mono font-bold">{(t.agents || []).length}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (view === 'integrations') {
    const integrationsList = [
      { name: 'Twilio Programmable Voice & SIP', desc: 'Inbound/outbound PSTN voice trunks for AI phone agents', status: 'Connected' },
      { name: 'ElevenLabs Neural TTS v2.5', desc: 'Ultra-low latency expressive voice synthesis', status: 'Connected' },
      { name: 'OpenAI Realtime 4o Engine', desc: 'Sub-second conversational reasoning & intent classification', status: 'Connected' },
      { name: 'Deepgram Aura STT/TTS', desc: 'Enterprise speech recognition & medical/realty vocabulary', status: 'Connected' },
      { name: 'CRM & Calendar Booking Webhook', desc: 'Syncs captured leads and appointment slots in real time', status: 'Active' },
      { name: 'White-Label Web Widget CDN', desc: 'Embeddable JS snippet for client websites', status: 'Active' }
    ];
    return (
      <div className="space-y-6 animate-view">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#635BFF]">
            Connected Ecosystem
          </span>
          <h1 className="text-2xl font-extrabold mt-0.5">Telephony, LLM &amp; CRM Integrations</h1>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {integrationsList.map((intg, i) => (
            <div key={i} className="fj-card p-5 flex flex-col justify-between gap-4">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-extrabold">{intg.name}</span>
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[#DDF8EE] text-emerald-700">
                    {intg.status}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-2">{intg.desc}</p>
              </div>
              <button
                onClick={() => showToast(`${intg.name} is verified and active.`)}
                className="py-2 px-3 rounded-xl fj-subcard text-xs font-bold hover:border-[#635BFF]"
              >
                Test Connection
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Settings View
  return (
    <div className="space-y-6 animate-view max-w-3xl">
      <div>
        <span className="text-xs font-bold uppercase tracking-wider text-[#635BFF]">
          Master Agency Configuration
        </span>
        <h1 className="text-2xl font-extrabold mt-0.5">Platform Settings</h1>
      </div>
      <div className="fj-card p-6 space-y-4 text-xs">
        <div className="flex justify-between py-2 border-b border-slate-100 dark:border-white/10">
          <span className="text-slate-500">Master Agency Name</span>
          <span className="font-bold">{masterAgency?.name || 'FJ-Tech Solutions'}</span>
        </div>
        <div className="flex justify-between py-2 border-b border-slate-100 dark:border-white/10">
          <span className="text-slate-500">Active Client Workspace</span>
          <span className="font-bold">{activeTenant?.brandName}</span>
        </div>
        <div className="flex justify-between py-2">
          <span className="text-slate-500">API Backend Status</span>
          <span className="font-mono font-bold text-emerald-600">ONLINE (Express Multi-Tenant Engine)</span>
        </div>
      </div>
    </div>
  );
}

export { OverviewView, VoiceStudioView, ChatbotStudioView, PlaygroundView, WorkspacesView, BrandingStudioView, SecondaryViews };
