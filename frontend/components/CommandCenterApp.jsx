'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { Icon } from './Icons';
import { OverviewView, VoiceStudioView, ChatbotStudioView, PlaygroundView, WorkspacesView, BrandingStudioView, SecondaryViews } from './Studios';
/* ==========================================================================
   FJ-TECH | INTELLIGENT AI COMMAND CENTER â€” NEXT.JS 15 COMPONENT SHELL
   ========================================================================== */





const NAV_GROUPS = [
  {
    group: 'Command Center',
    items: [
      { id: 'overview', label: 'Overview', icon: 'grid' },
      { id: 'voice-studio', label: 'AI Voice Agents', icon: 'phone' },
      { id: 'chatbot-studio', label: 'AI Chatbots', icon: 'bot' },
      { id: 'playground', label: 'AI Playground', icon: 'terminal', badge: 'LIVE' }
    ]
  },
  {
    group: 'Multi-Tenant Operations',
    items: [
      { id: 'workspaces', label: 'Client Workspaces', icon: 'building' },
      { id: 'conversations', label: 'Conversations', icon: 'messages' },
      { id: 'analytics', label: 'Analytics', icon: 'chart' }
    ]
  },
  {
    group: 'Platform & White-Label',
    items: [
      { id: 'branding', label: 'Branding Studio', icon: 'palette' },
      { id: 'integrations', label: 'Integrations', icon: 'blocks' },
      { id: 'settings', label: 'Settings', icon: 'settings' }
    ]
  }
];

function NewClientWorkspaceModal({ isOpen, onClose, onCreated }) {
  const [brandName, setBrandName] = useState('');
  const [industry, setIndustry] = useState('Healthcare / Medical');
  const [domain, setDomain] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#635BFF');
  const [accentColor, setAccentColor] = useState('#21C8D8');
  const [monthlyRetainer, setMonthlyRetainer] = useState(1800);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!brandName.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/tenants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandName,
          industry,
          domain: domain || `ai.${brandName.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`,
          logoUrl,
          primaryColor,
          accentColor,
          monthlyRetainer: Number(monthlyRetainer)
        })
      });
      const data = await res.json();
      if (res.ok) {
        setBrandName('');
        setDomain('');
        setLogoUrl('');
        onCreated(data);
        onClose();
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-view">
      <div className="w-full max-w-lg fj-card p-6 sm:p-7 shadow-2xl">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-white/10">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#635BFF]">
              Multi-Tenant Sub-Account
            </span>
            <h3 className="text-lg font-extrabold mt-0.5">Create Client Workspace</h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg fj-subcard text-slate-400 hover:text-slate-800 dark:hover:text-white"
          >
            <Icon name="x" size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-bold mb-1.5">Business / Brand Name *</label>
              <input
                type="text"
                required
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                placeholder="e.g., Sterling Legal Partners"
                className="w-full rounded-xl fj-subcard px-3.5 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1.5">Industry *</label>
              <input
                type="text"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                className="w-full rounded-xl fj-subcard px-3.5 py-2.5 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-bold mb-1.5">White-Label Domain</label>
              <input
                type="text"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="ai.clientdomain.com"
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
            <label className="block text-xs font-bold mb-1.5">Logo URL (Optional)</label>
            <input
              type="url"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=120"
              className="w-full rounded-xl fj-subcard px-3.5 py-2.5 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-bold mb-1.5">Primary Color</label>
              <div className="fj-subcard p-2 flex items-center gap-2.5">
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="w-8 h-7 rounded cursor-pointer border-0 bg-transparent"
                />
                <span className="text-xs font-mono">{primaryColor}</span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold mb-1.5">Accent Color</label>
              <div className="fj-subcard p-2 flex items-center gap-2.5">
                <input
                  type="color"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="w-8 h-7 rounded cursor-pointer border-0 bg-transparent"
                />
                <span className="text-xs font-mono">{accentColor}</span>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl fj-subcard text-xs font-bold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="brand-gradient text-white font-bold text-xs sm:text-sm px-5 py-2.5 rounded-xl shadow-lg"
            >
              {loading ? 'Provisioning...' : 'Provision Client Workspace'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CommandCenterApp() {
  const [darkMode, setDarkMode] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeView, setActiveView] = useState('overview');
  const [viewOptions, setViewOptions] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [newClientModalOpen, setNewClientModalOpen] = useState(false);
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [toast, setToast] = useState(null);

  // Core Multi-Tenant State from Express API
  const [masterAgency, setMasterAgency] = useState({});
  const [tenants, setTenants] = useState([]);
  const [activeTenant, setActiveTenant] = useState(null);
  const [playgroundAgent, setPlaygroundAgent] = useState(null);
  const [recentEvents, setRecentEvents] = useState([
    {
      id: 'ev-1',
      type: 'voice',
      title: 'Sophia - 24/7 Patient Receptionist handled inbound call',
      subtitle: 'Intent: appointment_booking (98% confidence) â€¢ 390ms latency',
      time: '2m ago'
    },
    {
      id: 'ev-2',
      type: 'chat',
      title: 'Apex Web Concierge verified Invisalign pricing inquiry',
      subtitle: 'Intent: pricing_and_packages â€¢ Dispatched consultation link',
      time: '9m ago'
    },
    {
      id: 'ev-3',
      type: 'deploy',
      title: 'White-label CNAME verified for ai.apexdentalstudio.com',
      subtitle: 'SSL certificate & custom brand palette active',
      time: '24m ago'
    }
  ]);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => {
      setToast((prev) => (prev === msg ? null : prev));
    }, 3400);
  };

  // Sync Dark/Light Mode Class
  useEffect(() => {
    const rootEl = document.documentElement;
    if (darkMode) {
      rootEl.classList.add('dark');
    } else {
      rootEl.classList.remove('dark');
    }
  }, [darkMode]);

  // Fetch initial state from GET /api/state
  useEffect(() => {
    fetch(`/api/state`)
      .then((r) => r.json())
      .then((data) => {
        setMasterAgency(data.masterAgency);
        setTenants(data.tenants || []);
        setActiveTenant(data.activeTenant);
        setPlaygroundAgent(data.activeTenant?.agents?.[0] || null);
      })
      .catch((err) => console.error('Failed to load state:', err));
  }, []);

  // Update dynamic CSS variables whenever activeTenant changes
  useEffect(() => {
    if (activeTenant) {
      document.documentElement.style.setProperty(
        '--brand-primary',
        activeTenant.primaryColor || '#635BFF'
      );
      document.documentElement.style.setProperty(
        '--brand-accent',
        activeTenant.accentColor || '#21C8D8'
      );
    }
  }, [activeTenant]);

  const handleNavigate = (viewId, opts = {}) => {
    setActiveView(viewId);
    setViewOptions(opts);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSwitchTenant = async (tenantId) => {
    try {
      const res = await fetch(`/api/tenants/switch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId })
      });
      const data = await res.json();
      if (res.ok) {
        setActiveTenant(data.activeTenant);
        setPlaygroundAgent(data.activeTenant?.agents?.[0] || null);
        showToast(`Switched active workspace to ${data.activeTenant.brandName}`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteAgent = async (agentId) => {
    if (!activeTenant) return;
    if (!window.confirm('Are you sure you want to remove this AI agent from the client workspace?')) {
      return;
    }
    try {
      const res = await fetch(
        `/api/tenants/${activeTenant.id}/agents/${agentId}`,
        { method: 'DELETE' }
      );
      const data = await res.json();
      if (res.ok) {
        setActiveTenant(data.tenant);
        setTenants((prev) => prev.map((t) => (t.id === data.tenant.id ? data.tenant : t)));
        showToast('Agent removed from workspace');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAgentCreated = (updatedTenant, newAgent) => {
    setActiveTenant(updatedTenant);
    setTenants((prev) => prev.map((t) => (t.id === updatedTenant.id ? updatedTenant : t)));
    setPlaygroundAgent(newAgent);
    setRecentEvents((prev) => [
      {
        id: `ev-${Date.now()}`,
        type: 'deploy',
        title: `Deployed ${newAgent.name} (${newAgent.type.toUpperCase()})`,
        subtitle: `Provisioned for ${updatedTenant.brandName}`,
        time: 'Just now'
      },
      ...prev
    ]);
    showToast(`ðŸš€ Deployed "${newAgent.name}"!`);
  };

  const handleSimulationEvent = (agent, userText, apiData) => {
    if (apiData.updatedStats) {
      setMasterAgency((prev) => ({
        ...prev,
        activeCallsToday: apiData.updatedStats.activeCallsToday,
        messagesHandled: apiData.updatedStats.messagesHandled
      }));
      setActiveTenant((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          agents: prev.agents.map((a) =>
            a.id === agent.id ? { ...a, interactions: apiData.updatedStats.agentInteractions } : a
          )
        };
      });
    }
    setRecentEvents((prev) => [
      {
        id: `ev-${Date.now()}`,
        type: agent.type,
        title: `${agent.name}: "${userText.slice(0, 42)}..."`,
        subtitle: `Intent: ${apiData.intentDetected} (${Math.round(apiData.confidence * 100)}%) â€¢ ${apiData.latencyMs}ms`,
        time: 'Just now'
      },
      ...prev.slice(0, 14)
    ]);
  };

  const currentViewLabel = useMemo(() => {
    for (const g of NAV_GROUPS) {
      const found = g.items.find((i) => i.id === activeView);
      if (found) return found.label;
    }
    return 'Overview';
  }, [activeView]);

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* ======================================================= */}
      {/* 1. COLLAPSIBLE ENTERPRISE SIDEBAR NAVIGATION            */}
      {/* ======================================================= */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 lg:static flex flex-col fj-navy-surface transition-all duration-200 ${
          sidebarCollapsed ? 'w-20' : 'w-64'
        } ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* Top Brand Header */}
        <div className="h-16 px-4 flex items-center justify-between border-b border-white/10">
          <div
            onClick={() => handleNavigate('overview')}
            className="cursor-pointer flex items-center gap-3 overflow-hidden"
          >
            <div className="w-9 h-9 rounded-xl brand-gradient flex items-center justify-center font-extrabold text-sm text-white shrink-0 shadow-md">
              FJ
            </div>
            {!sidebarCollapsed && (
              <div className="min-w-0">
                <span className="font-extrabold text-sm tracking-tight text-white block truncate">
                  FJ-TECH
                </span>
                <span className="text-[10px] font-mono text-cyan-300 uppercase tracking-widest block truncate">
                  AI Command Center
                </span>
              </div>
            )}
          </div>

          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            title={sidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            className="hidden lg:flex p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300"
          >
            <Icon name={sidebarCollapsed ? 'chevronRight' : 'chevronLeft'} size={16} />
          </button>

          <button
            onClick={() => setMobileMenuOpen(false)}
            className="lg:hidden p-1.5 rounded-lg bg-white/5 text-slate-300"
          >
            <Icon name="x" size={16} />
          </button>
        </div>

        {/* Navigation Groups */}
        <div className="flex-1 overflow-y-auto custom-scroll py-4 px-3 space-y-5">
          {NAV_GROUPS.map((group, gIdx) => (
            <div key={gIdx}>
              {!sidebarCollapsed && (
                <div className="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {group.group}
                </div>
              )}
              <div className="space-y-1">
                {group.items.map((item) => {
                  const isActive = activeView === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleNavigate(item.id)}
                      title={sidebarCollapsed ? item.label : ''}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition ${
                        isActive
                          ? 'bg-[#635BFF] text-white shadow-md'
                          : 'text-slate-300 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      <Icon name={item.icon} size={18} />
                      {!sidebarCollapsed && (
                        <>
                          <span className="truncate flex-1 text-left">{item.label}</span>
                          {item.badge && (
                            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-cyan-400/20 text-cyan-300">
                              {item.badge}
                            </span>
                          )}
                        </>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Active Client Footer Pill inside Sidebar */}
        {activeTenant && (
          <div className="p-3 border-t border-white/10">
            <div
              onClick={() => handleNavigate('branding')}
              className="cursor-pointer p-2.5 rounded-xl bg-white/5 hover:bg-white/10 flex items-center gap-2.5 transition"
            >
              <img
                src={activeTenant.logoUrl}
                alt={activeTenant.brandName}
                className="w-8 h-8 rounded-lg object-cover shrink-0"
              />
              {!sidebarCollapsed && (
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-white truncate">
                    {activeTenant.brandName}
                  </div>
                  <div className="text-[10px] font-mono text-emerald-400 truncate">
                    ${Number(activeTenant.monthlyRetainer || 1500).toLocaleString()}/mo Active
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </aside>

      {/* ======================================================= */}
      {/* 2. MAIN CONTENT SHELL (TOPBAR + VIEWPORT)               */}
      {/* ======================================================= */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Sticky Top Command Navigation */}
        <header className="sticky top-0 z-30 h-16 px-4 sm:px-6 bg-white/85 dark:bg-[#10152A]/85 backdrop-blur-md border-b border-slate-200/80 dark:border-white/10 flex items-center justify-between gap-3">
          {/* Left: Mobile Drawer Trigger + Breadcrumbs */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-xl fj-subcard"
            >
              <Icon name="menu" size={18} />
            </button>

            <div className="flex items-center gap-2 text-xs sm:text-sm min-w-0">
              <span className="text-slate-400 font-medium hidden sm:inline">FJ-Tech</span>
              <span className="text-slate-300 dark:text-slate-600 hidden sm:inline">/</span>
              <span className="font-bold text-slate-700 dark:text-slate-200 truncate">
                {activeTenant?.brandName || 'Workspace'}
              </span>
              <span className="text-slate-300 dark:text-slate-600">/</span>
              <span className="font-extrabold text-[#635BFF] truncate">{currentViewLabel}</span>
            </div>
          </div>

          {/* Center: Prominent Client Workspace Selector & Search */}
          <div className="flex items-center gap-2.5">
            {/* Global Search Input */}
            <div className="hidden xl:flex items-center gap-2 px-3 py-1.5 rounded-xl fj-subcard w-56">
              <Icon name="search" size={15} className="text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && searchQuery.trim()) {
                    handleNavigate('playground');
                  }
                }}
                placeholder="Search agents, clients..."
                className="bg-transparent text-xs w-full focus:outline-none"
              />
            </div>

            {/* Prominent Client Workspace Switcher */}
            <div className="flex items-center gap-2 p-1 pl-2.5 rounded-xl fj-subcard border border-slate-200 dark:border-white/15">
              {activeTenant && (
                <img
                  src={activeTenant.logoUrl}
                  alt={activeTenant.brandName}
                  className="w-6 h-6 rounded-md object-cover shrink-0"
                />
              )}
              <select
                value={activeTenant?.id || ''}
                onChange={(e) => handleSwitchTenant(e.target.value)}
                aria-label="Client Workspace Switcher"
                className="bg-transparent text-xs font-extrabold pr-2 py-1 focus:outline-none cursor-pointer max-w-[160px] sm:max-w-[210px] truncate"
              >
                {tenants.map((t) => (
                  <option key={t.id} value={t.id} className="text-slate-900">
                    {t.brandName}
                  </option>
                ))}
              </select>
              <button
                onClick={() => setNewClientModalOpen(true)}
                title="Add New Client Workspace"
                className="px-2 py-1 rounded-lg bg-[#635BFF] text-white text-[11px] font-bold hover:bg-[#5249e6] transition shrink-0"
              >
                + Client
              </button>
            </div>
          </div>

          {/* Right: Quick Create, Notifications, Theme Switcher, Profile */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Quick Create Dropdown */}
            <div className="relative">
              <button
                onClick={() => setQuickCreateOpen(!quickCreateOpen)}
                className="brand-gradient text-white text-xs font-bold px-3.5 py-2 rounded-xl shadow flex items-center gap-1.5"
              >
                <Icon name="plus" size={15} />
                <span className="hidden sm:inline">Quick Create</span>
              </button>
              {quickCreateOpen && (
                <div
                  onMouseLeave={() => setQuickCreateOpen(false)}
                  className="absolute right-0 mt-2 w-52 fj-card p-2 shadow-2xl z-50 space-y-1 text-xs font-bold"
                >
                  <button
                    onClick={() => {
                      setQuickCreateOpen(false);
                      handleNavigate('voice-studio', { openBuilder: true });
                    }}
                    className="w-full px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 flex items-center gap-2 text-left"
                  >
                    <Icon name="phone" size={15} className="text-[#635BFF]" />
                    <span>New AI Voice Call Agent</span>
                  </button>
                  <button
                    onClick={() => {
                      setQuickCreateOpen(false);
                      handleNavigate('chatbot-studio', { openBuilder: true });
                    }}
                    className="w-full px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 flex items-center gap-2 text-left"
                  >
                    <Icon name="bot" size={15} className="text-[#21C8D8]" />
                    <span>New Website Chatbot</span>
                  </button>
                  <button
                    onClick={() => {
                      setQuickCreateOpen(false);
                      setNewClientModalOpen(true);
                    }}
                    className="w-full px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 flex items-center gap-2 text-left"
                  >
                    <Icon name="building" size={15} className="text-emerald-500" />
                    <span>New Client Workspace</span>
                  </button>
                </div>
              )}
            </div>

            {/* Notification Center */}
            <div className="relative">
              <button
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                className="p-2 rounded-xl fj-subcard relative"
                title="Notifications"
              >
                <Icon name="bell" size={17} />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500" />
              </button>
              {notificationsOpen && (
                <div
                  onMouseLeave={() => setNotificationsOpen(false)}
                  className="absolute right-0 mt-2 w-80 fj-card p-4 shadow-2xl z-50 space-y-2.5"
                >
                  <div className="flex items-center justify-between text-xs font-extrabold border-b border-slate-100 dark:border-white/10 pb-2">
                    <span>Live Telemetry Alerts</span>
                    <span className="text-[10px] text-[#635BFF]">{recentEvents.length} events</span>
                  </div>
                  <div className="space-y-2 max-h-60 overflow-y-auto custom-scroll">
                    {recentEvents.slice(0, 4).map((ev) => (
                      <div key={ev.id} className="text-xs fj-subcard p-2.5">
                        <div className="font-bold truncate">{ev.title}</div>
                        <div className="text-[11px] text-slate-500 truncate">{ev.subtitle}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Light / Dark Mode Switcher */}
            <button
              onClick={() => setDarkMode(!darkMode)}
              title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              className="p-2 rounded-xl fj-subcard"
            >
              <Icon name={darkMode ? 'sun' : 'moon'} size={17} />
            </button>
          </div>
        </header>

        {/* Main Viewport Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto">
          {activeView === 'overview' && (
            <OverviewView
              masterAgency={masterAgency}
              activeTenant={activeTenant}
              tenants={tenants}
              recentEvents={recentEvents}
              onNavigate={handleNavigate}
              onSelectAgentForPlayground={(agent) => {
                setPlaygroundAgent(agent);
                handleNavigate('playground');
              }}
              onSwitchTenant={handleSwitchTenant}
              onOpenNewClientModal={() => setNewClientModalOpen(true)}
            />
          )}

          {activeView === 'voice-studio' && (
            <VoiceStudioView
              activeTenant={activeTenant}
              tenants={tenants}
              onSwitchTenant={handleSwitchTenant}
              onAgentCreated={handleAgentCreated}
              onDeleteAgent={handleDeleteAgent}
              onSimulationEvent={handleSimulationEvent}
              initialOpenBuilder={viewOptions?.openBuilder}
              showToast={showToast}
            />
          )}

          {activeView === 'chatbot-studio' && (
            <ChatbotStudioView
              activeTenant={activeTenant}
              onAgentCreated={handleAgentCreated}
              onDeleteAgent={handleDeleteAgent}
              onSimulationEvent={handleSimulationEvent}
              initialOpenBuilder={viewOptions?.openBuilder}
              showToast={showToast}
            />
          )}

          {activeView === 'playground' && (
            <PlaygroundView
              activeTenant={activeTenant}
              initialAgent={playgroundAgent}
              onSimulationEvent={handleSimulationEvent}
              showToast={showToast}
            />
          )}

          {activeView === 'workspaces' && (
            <WorkspacesView
              tenants={tenants}
              activeTenant={activeTenant}
              onSwitchTenant={handleSwitchTenant}
              onOpenNewClientModal={() => setNewClientModalOpen(true)}
              onNavigate={handleNavigate}
            />
          )}

          {activeView === 'branding' && (
            <BrandingStudioView
              activeTenant={activeTenant}
              onBrandingSaved={(updatedTenant, updatedAgency) => {
                setActiveTenant(updatedTenant);
                setMasterAgency(updatedAgency);
                setTenants((prev) =>
                  prev.map((t) => (t.id === updatedTenant.id ? updatedTenant : t))
                );
                showToast(`âœ¨ Published white-label branding for ${updatedTenant.brandName}`);
              }}
              showToast={showToast}
            />
          )}

          {['conversations', 'analytics', 'integrations', 'settings'].includes(activeView) && (
            <SecondaryViews
              view={activeView}
              masterAgency={masterAgency}
              activeTenant={activeTenant}
              tenants={tenants}
              recentEvents={recentEvents}
              onNavigate={handleNavigate}
              showToast={showToast}
            />
          )}
        </main>
      </div>

      {/* Create Client Workspace Modal */}
      <NewClientWorkspaceModal
        isOpen={newClientModalOpen}
        onClose={() => setNewClientModalOpen(false)}
        onCreated={(data) => {
          setActiveTenant(data.activeTenant);
          setTenants(data.tenants);
          setMasterAgency(data.masterAgency);
          showToast(`ðŸŽ‰ Created client workspace "${data.activeTenant.brandName}"!`);
        }}
      />

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 fj-navy-surface px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2.5 text-xs font-bold animate-view">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span>{toast}</span>
        </div>
      )}
    </div>
  );
}

export default CommandCenterApp;
