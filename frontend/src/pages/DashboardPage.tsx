import { useEffect, useState } from 'react';
import Layout from '../components/Layout/Layout';
import { Link } from 'react-router-dom';
import { dashboardApi } from '../api/dashboard';
import type { DashboardStats, QuickStats, Activity } from '../api/dashboard';

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [quickStats, setQuickStats] = useState<QuickStats | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [statsRes, quickStatsRes, activitiesRes] = await Promise.all([
        dashboardApi.getStats(),
        dashboardApi.getQuickStats(),
        dashboardApi.getActivity(),
      ]);
      setStats(statsRes.data);
      setQuickStats(quickStatsRes.data);
      setActivities(activitiesRes.data);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)} hours ago`;
    return `${Math.floor(diffMins / 1440)} days ago`;
  };

  const getTrendColor = (trend: 'up' | 'down' | 'neutral') => {
    const colors = {
      up: 'bg-primary/10 text-primary',
      down: 'bg-destructive/10 text-destructive',
      neutral: 'bg-muted text-muted-foreground',
    };
    return colors[trend];
  };

  const getActivityIcon = (type: 'info' | 'success' | 'warning' | 'error') => {
    const icons = {
      info: { icon: 'info', color: 'text-accent' },
      success: { icon: 'check_circle', color: 'text-primary' },
      warning: { icon: 'warning', color: 'text-accent' },
      error: { icon: 'error', color: 'text-destructive' },
    };
    return icons[type] || icons.info;
  };

  const statsData = [
    {
      label: 'Total Bots',
      value: stats?.total_bots || 0,
      change: `+${quickStats?.active_bots || 0} active`,
      icon: 'smart_toy',
      trend: 'up' as const
    },
    {
      label: 'Active Sessions',
      value: stats?.active_sessions || 0,
      change: 'Live',
      icon: 'sensors',
      trend: 'up' as const
    },
    {
      label: 'Messages Today',
      value: stats?.messages_today || 0,
      change: 'Today',
      icon: 'chat',
      trend: 'up' as const
    },
    {
      label: 'Avg Response Time',
      value: stats?.avg_response_time || '0ms',
      change: 'Stable',
      icon: 'bolt',
      trend: 'neutral' as const
    },
  ];

  return (
    <Layout breadcrumbs={[{ label: 'Home', path: '/' }, { label: 'Dashboard' }]}>
      <div className="flex flex-col gap-8">

        {/* Page Heading */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-foreground">
              Dashboard Overview
            </h2>
            <p className="text-muted-foreground mt-2 text-lg">
              Welcome back, here's what's happening today.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground hidden sm:block">
              Last updated: Just now
            </span>
            <button
              onClick={fetchData}
              disabled={loading}
              className={`
                p-2.5 rounded-xl
                text-muted-foreground hover:text-primary
                bg-card border border-border
                hover:border-primary/50 hover:shadow-sm
                transition-all duration-200
                ${loading ? 'animate-spin' : ''}
              `}
            >
              <span className="material-symbols-outlined">refresh</span>
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {statsData.map((stat, idx) => (
            <div
              key={idx}
              className="
                group
                bg-card
                p-6 rounded-2xl
                border border-border
                hover:border-primary/30
                shadow-sm hover:shadow-lg hover:shadow-primary/5
                transition-all duration-300
                hover:-translate-y-1
              "
            >
              <div className="flex items-start justify-between mb-6">
                <div className="
                  p-3 rounded-xl
                  bg-primary/5 text-primary
                  group-hover:bg-primary/10
                  transition-all duration-300
                ">
                  <span className="material-symbols-outlined text-2xl">
                    {stat.icon}
                  </span>
                </div>

                <span className={`
                  text-xs font-semibold px-3 py-1 rounded-full
                  ${getTrendColor(stat.trend)}
                `}>
                  {stat.change}
                </span>
              </div>

              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">
                  {stat.label}
                </p>
                <p className="text-3xl font-bold text-foreground tracking-tight">
                  {stat.value}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Left Column: Recent Activity & Charts */}
          <div className="lg:col-span-2 flex flex-col gap-8">

            {/* Recent Activity */}
            <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
              <div className="p-6 border-b border-border flex justify-between items-center bg-muted/5">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">
                    Recent Activity
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Latest updates from your bots
                  </p>
                </div>
                <Link
                  to="/analytics"
                  className="text-sm font-medium text-primary hover:text-primary-600 transition-colors"
                >
                  View All →
                </Link>
              </div>

              <div className="p-6">
                <div className="relative pl-8 border-l border-border/60 space-y-8">
                  {activities.length === 0 ? (
                    <div className="text-center text-muted-foreground py-4">No recent activity</div>
                  ) : (
                    activities.map((activity, idx) => {
                      const activityIcon = getActivityIcon('success');
                      return (
                        <div key={idx} className="relative group">
                          <div className={`
                            absolute -left-[37px] top-1
                            h-4 w-4 rounded-full border-2 border-background
                            ${idx === 0
                              ? 'bg-primary ring-4 ring-primary/10'
                              : 'bg-muted-foreground/30 group-hover:bg-muted-foreground/50'
                            }
                            transition-all duration-200
                          `} />

                          <div className="flex flex-col gap-1.5">
                            <div className="flex items-center justify-between gap-4">
                              <div className="flex items-center gap-2">
                                <span className={`material-symbols-outlined text-lg ${activityIcon.color}`}>
                                  {activityIcon.icon}
                                </span>
                                <p className="font-medium text-foreground">
                                  {activity.bot_name}
                                </p>
                              </div>
                              <span className="text-xs text-muted-foreground whitesapce-nowrap">
                                {formatTime(activity.timestamp)}
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                              {activity.message}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Response Volume Chart (Mock) */}
            <div className="bg-card rounded-2xl p-6 border border-border shadow-sm">
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">
                    Response Volume
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Daily message count
                  </p>
                </div>
                <select className="
                  text-sm 
                  bg-background 
                  border border-border
                  rounded-lg
                  py-1.5 px-3
                  text-foreground
                  focus:outline-none focus:ring-2 focus:ring-primary/20
                  transition-all
                ">
                  <option>Last 7 Days</option>
                  <option>Last 30 Days</option>
                </select>
              </div>

              <div className="h-48 w-full flex items-end justify-between px-2 gap-3">
                {[40, 65, 50, 85, 70, 45, 60].map((height, idx) => (
                  <div
                    key={idx}
                    className="
                      w-full 
                      bg-primary/20
                      rounded-t-sm
                      hover:bg-primary/40
                      transition-all duration-300
                      cursor-pointer relative group
                    "
                    style={{ height: `${height}%` }}
                  >
                    <div className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 bg-popover text-popover-foreground text-xs px-2 py-1 rounded shadow-sm transition-opacity">
                      {height}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-between text-xs font-medium text-muted-foreground mt-4 px-1">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                  <span key={day}>{day}</span>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Quick Actions & Status */}
          <div className="lg:col-span-1 flex flex-col gap-6">

            {/* Quick Actions */}
            <div className="bg-card rounded-2xl p-6 border border-border shadow-sm">
              <h3 className="text-lg font-semibold text-foreground mb-6">
                Quick Actions
              </h3>

              <div className="flex flex-col gap-3">
                <Link
                  to="/bots/new"
                  className="
                    flex items-center justify-center gap-2
                    w-full py-3 px-6
                    bg-primary text-primary-foreground
                    hover:bg-primary/90
                    font-medium
                    rounded-xl
                    shadow-lg shadow-primary/20
                    hover:translate-y-px
                    transition-all duration-200
                  "
                >
                  <span className="material-symbols-outlined text-[20px]">add</span>
                  Create New Bot
                </Link>

                <Link
                  to="/documents"
                  className="
                    flex items-center justify-center gap-2
                    w-full py-3 px-6
                    bg-background border border-border
                    hover:bg-muted/50
                    text-foreground
                    font-medium
                    rounded-xl
                    hover:border-primary/30
                    transition-all duration-200
                  "
                >
                  <span className="material-symbols-outlined text-[20px]">upload_file</span>
                  Upload Knowledge
                </Link>

                <Link
                  to="/settings"
                  className="
                    flex items-center justify-center gap-2
                    w-full py-3 px-6
                    text-muted-foreground hover:text-foreground
                    font-medium
                    rounded-xl
                    hover:bg-muted/50
                    transition-all duration-200
                  "
                >
                  <span className="material-symbols-outlined text-[20px]">settings</span>
                  Settings
                </Link>
              </div>
            </div>

            {/* System Health */}
            <div className="bg-card rounded-2xl p-6 border border-border shadow-sm">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">
                    System Health
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    All services running
                  </p>
                </div>
                <span className="
                  flex items-center gap-2 
                  px-2.5 py-1
                  rounded-full 
                  bg-primary/10
                  text-xs font-semibold 
                  text-primary
                ">
                  <span className="size-1.5 rounded-full bg-primary animate-pulse" />
                  Stable
                </span>
              </div>

              <div className="space-y-4">
                {[
                  { name: 'API Gateway', status: 99.9, color: 'text-primary' },
                  { name: 'Database', status: 100, color: 'text-primary' },
                  { name: 'Vector Store', status: 98.5, color: 'text-primary' },
                  { name: 'LLM Provider', status: 97.2, color: 'text-accent' },
                ].map((service, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground">
                      {service.name}
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-foreground">
                        {service.status}%
                      </span>
                      <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`
                            h-full rounded-full
                            ${service.color === 'text-primary' ? 'bg-primary' : 'bg-accent'}
                          `}
                          style={{ width: `${service.status}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
