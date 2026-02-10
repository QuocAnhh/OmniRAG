// 🎨 Refactored Dashboard - Modern & Spacious
// Reference: /frontend/src/pages/DashboardPage.REFACTORED.tsx

import Layout from '../components/Layout/Layout';
import { Link } from 'react-router-dom';

export default function DashboardPageRefactored() {
  const stats = [
    { 
      label: 'Total Bots', 
      value: '12', 
      change: '+2 this week', 
      icon: 'smart_toy', 
      trend: 'up' as const 
    },
    { 
      label: 'Active Sessions', 
      value: '843', 
      change: '+12%', 
      icon: 'group', 
      trend: 'up' as const 
    },
    { 
      label: 'Messages Today', 
      value: '14.2k', 
      change: '+5%', 
      icon: 'chat', 
      trend: 'up' as const 
    },
    { 
      label: 'Avg Response Time', 
      value: '1.2s', 
      change: 'Stable', 
      icon: 'bolt', 
      trend: 'neutral' as const 
    },
  ];

  const activities = [
    { 
      title: 'Knowledge Base Updated', 
      time: '2 min ago', 
      desc: 'Admin uploaded Q3_Financial_Report.pdf to Finance Bot.',
      type: 'info' as const
    },
    { 
      title: 'New Integration Connected', 
      time: '1 hour ago', 
      desc: 'Slack workspace has been successfully connected.',
      type: 'success' as const
    },
    { 
      title: 'Bot "Support_v1" Deployed', 
      time: '3 hours ago', 
      desc: 'Version 1.2.4 was deployed to production environment.',
      type: 'success' as const
    },
    { 
      title: 'System Alert', 
      time: '5 hours ago', 
      desc: 'High traffic detected on API endpoint /v1/chat/completions.',
      type: 'warning' as const
    },
  ];

  const getTrendColor = (trend: 'up' | 'down' | 'neutral') => {
    const colors = {
      up: 'bg-success-50 text-success-600 dark:bg-success-900/20 dark:text-success-400',
      down: 'bg-error-50 text-error-600 dark:bg-error-900/20 dark:text-error-400',
      neutral: 'bg-gray-50 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
    };
    return colors[trend];
  };

  const getActivityIcon = (type: 'info' | 'success' | 'warning' | 'error') => {
    const icons = {
      info: { icon: 'info', color: 'text-accent-500' },
      success: { icon: 'check_circle', color: 'text-success-500' },
      warning: { icon: 'warning', color: 'text-warning-500' },
      error: { icon: 'error', color: 'text-error-500' },
    };
    return icons[type];
  };

  return (
    <Layout breadcrumbs={[{ label: 'Home', path: '/' }, { label: 'Dashboard' }]}>
      {/* MORE SPACIOUS WRAPPER - p-8 lg:p-12 instead of p-8 */}
      <div className="p-8 lg:p-12 bg-background-light dark:bg-background-dark min-h-full">
        {/* WIDER CONTAINER - max-w-[1400px] instead of max-w-7xl */}
        <div className="max-w-[1400px] mx-auto flex flex-col gap-8 lg:gap-12">
          
          {/* ========================================
              PAGE HEADING - More breathing room
              ======================================== */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
            <div>
              <h2 className="text-3xl lg:text-4xl font-bold text-text-main dark:text-white tracking-tight">
                Dashboard Overview
              </h2>
              <p className="text-base text-text-muted dark:text-gray-400 mt-2">
                Welcome back, here's what's happening today.
              </p>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-text-muted hidden sm:block">
                Last updated: Just now
              </span>
              <button 
                className="
                  p-2.5 rounded-xl
                  text-gray-400 hover:text-primary-500
                  bg-white dark:bg-gray-900
                  border border-gray-200 dark:border-gray-800
                  hover:border-primary-200 dark:hover:border-primary-900
                  hover:shadow-sm
                  transition-all duration-200
                "
              >
                <span className="material-symbols-outlined">refresh</span>
              </button>
            </div>
          </div>

          {/* ========================================
              STATS GRID - Much more spacious!
              ======================================== */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
            {stats.map((stat, idx) => (
              <div 
                key={idx} 
                className="
                  group
                  bg-white dark:bg-gray-900
                  p-6 lg:p-8
                  rounded-2xl
                  border border-gray-100 dark:border-gray-800
                  hover:border-primary-200 dark:hover:border-primary-900
                  shadow-sm hover:shadow-lg
                  transition-all duration-300
                  hover:-translate-y-2
                  cursor-default
                "
              >
                {/* Icon & Badge Row - Better spacing */}
                <div className="flex items-start justify-between mb-6">
                  {/* Icon with gradient background */}
                  <div className="
                    p-3 rounded-xl
                    bg-gradient-to-br from-primary-500/10 to-accent-500/10
                    text-primary-600 dark:text-primary-400
                    group-hover:from-primary-500/20 group-hover:to-accent-500/20
                    transition-all duration-300
                  ">
                    <span className="material-symbols-outlined text-2xl">
                      {stat.icon}
                    </span>
                  </div>
                  
                  {/* Change badge - more rounded */}
                  <span className={`
                    text-xs font-semibold px-3 py-1.5 rounded-full
                    ${getTrendColor(stat.trend)}
                    transition-colors duration-200
                  `}>
                    {stat.change}
                  </span>
                </div>

                {/* Stats content - better hierarchy */}
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    {stat.label}
                  </p>
                  <p className="text-4xl font-bold text-gray-900 dark:text-white tracking-tight">
                    {stat.value}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* ========================================
              MAIN CONTENT GRID
              ======================================== */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-10">
            
            {/* ====== LEFT COLUMN: Recent Activity ====== */}
            <div className="lg:col-span-2 flex flex-col gap-8">
              
              {/* Recent Activity Card */}
              <div className="
                bg-white dark:bg-gray-900 
                rounded-2xl 
                border border-gray-100 dark:border-gray-800
                shadow-sm
                overflow-hidden
              ">
                {/* Header */}
                <div className="p-6 lg:p-8 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                      Recent Activity
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      Latest updates from your bots
                    </p>
                  </div>
                  <Link 
                    to="/activity" 
                    className="
                      text-sm font-medium 
                      text-primary-600 dark:text-primary-400
                      hover:text-primary-700 dark:hover:text-primary-300
                      transition-colors
                    "
                  >
                    View All →
                  </Link>
                </div>

                {/* Activity Timeline */}
                <div className="p-6 lg:p-8">
                  <div className="relative pl-8 border-l-2 border-gray-200 dark:border-gray-800 space-y-10">
                    {activities.map((activity, idx) => {
                      const activityIcon = getActivityIcon(activity.type);
                      return (
                        <div key={idx} className="relative group">
                          {/* Timeline dot */}
                          <div className={`
                            absolute -left-[33px] top-1
                            h-3 w-3 rounded-full
                            ${idx === 0 
                              ? 'bg-primary-500 ring-4 ring-primary-500/20' 
                              : 'bg-gray-300 dark:bg-gray-700 group-hover:bg-gray-400 dark:group-hover:bg-gray-600'
                            }
                            transition-all duration-200
                          `} />
                          
                          {/* Content */}
                          <div className="flex flex-col gap-2">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex items-center gap-2">
                                <span className={`material-symbols-outlined text-lg ${activityIcon.color}`}>
                                  {activityIcon.icon}
                                </span>
                                <p className="font-semibold text-gray-900 dark:text-white">
                                  {activity.title}
                                </p>
                              </div>
                              <span className="text-xs text-gray-500 whitespace-nowrap">
                                {activity.time}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                              {activity.desc}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Chart Card - More polished */}
              <div className="
                bg-white dark:bg-gray-900 
                rounded-2xl 
                p-6 lg:p-8
                border border-gray-100 dark:border-gray-800
                shadow-sm
              ">
                <div className="flex justify-between items-center mb-8">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                      Response Volume
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      Daily message count
                    </p>
                  </div>
                  <select className="
                    text-sm 
                    bg-gray-50 dark:bg-gray-800 
                    border border-gray-200 dark:border-gray-700
                    rounded-xl 
                    py-2 px-3
                    text-gray-700 dark:text-gray-300
                    focus:outline-none focus:ring-2 focus:ring-primary-500
                    transition-all
                  ">
                    <option>Last 7 Days</option>
                    <option>Last 30 Days</option>
                    <option>Last 90 Days</option>
                  </select>
                </div>

                {/* Chart Area - Better styling */}
                <div className="h-56 w-full bg-gradient-to-t from-primary-500/5 via-transparent to-transparent rounded-xl flex items-end justify-between px-2 pb-0 gap-3">
                  {[40, 65, 50, 85, 70, 45, 60].map((height, idx) => (
                    <div 
                      key={idx} 
                      className="
                        w-full 
                        bg-gradient-to-t from-primary-500 to-primary-400
                        rounded-t-lg 
                        hover:from-primary-600 hover:to-primary-500
                        transition-all duration-300
                        cursor-pointer
                        shadow-sm hover:shadow-md
                      " 
                      style={{ height: `${height}%` }}
                    />
                  ))}
                </div>
                
                {/* Chart Labels */}
                <div className="flex justify-between text-xs font-medium text-gray-500 mt-4 px-1">
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                    <span key={day}>{day}</span>
                  ))}
                </div>
              </div>
            </div>

            {/* ====== RIGHT COLUMN: Quick Actions & System Health ====== */}
            <div className="lg:col-span-1 flex flex-col gap-8">
              
              {/* Quick Actions */}
              <div className="
                bg-white dark:bg-gray-900 
                rounded-2xl 
                p-6 lg:p-8
                border border-gray-100 dark:border-gray-800
                shadow-sm
              ">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
                  Quick Actions
                </h3>
                
                <div className="flex flex-col gap-3">
                  {/* Primary CTA */}
                  <Link 
                    to="/bots/new" 
                    className="
                      flex items-center justify-center gap-2
                      w-full py-4 px-6
                      bg-gradient-to-r from-primary-500 to-primary-600
                      hover:from-primary-600 hover:to-primary-700
                      text-white font-semibold
                      rounded-xl
                      shadow-lg shadow-primary-500/25
                      hover:shadow-xl hover:shadow-primary-500/40
                      hover:scale-105
                      transition-all duration-200
                    "
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>add</span>
                    Create New Bot
                  </Link>
                  
                  {/* Secondary Actions */}
                  <Link 
                    to="/documents" 
                    className="
                      flex items-center justify-center gap-2
                      w-full py-4 px-6
                      bg-white dark:bg-gray-800
                      hover:bg-gray-50 dark:hover:bg-gray-700
                      text-gray-700 dark:text-gray-200
                      font-semibold
                      rounded-xl
                      border-2 border-gray-200 dark:border-gray-700
                      hover:border-gray-300 dark:hover:border-gray-600
                      hover:scale-105
                      transition-all duration-200
                    "
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>upload_file</span>
                    Upload Knowledge Base
                  </Link>
                  
                  <Link 
                    to="/integrations" 
                    className="
                      flex items-center justify-center gap-2
                      w-full py-4 px-6
                      bg-transparent
                      hover:bg-gray-100 dark:hover:bg-gray-800
                      text-gray-700 dark:text-gray-300
                      font-semibold
                      rounded-xl
                      border border-gray-200 dark:border-gray-700
                      hover:border-gray-300 dark:hover:border-gray-600
                      transition-all duration-200
                    "
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>link</span>
                    Connect Integration
                  </Link>
                </div>
              </div>

              {/* System Health */}
              <div className="
                bg-white dark:bg-gray-900 
                rounded-2xl 
                p-6 lg:p-8
                border border-gray-100 dark:border-gray-800
                shadow-sm
              ">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                      System Health
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      All services running
                    </p>
                  </div>
                  <span className="
                    flex items-center gap-2 
                    px-3 py-1.5 
                    rounded-full 
                    bg-success-50 dark:bg-success-900/20 
                    text-xs font-semibold 
                    text-success-600 dark:text-success-400
                    border border-success-100 dark:border-success-800
                  ">
                    <span className="size-2 rounded-full bg-success-500 animate-pulse" />
                    Operational
                  </span>
                </div>
                
                <div className="space-y-4">
                  {[
                    { name: 'API Gateway', status: 99.9, color: 'success' },
                    { name: 'Database', status: 100, color: 'success' },
                    { name: 'Vector Store', status: 98.5, color: 'success' },
                    { name: 'LLM Provider', status: 97.2, color: 'warning' },
                  ].map((service, idx) => (
                    <div key={idx} className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {service.name}
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-gray-900 dark:text-white">
                          {service.status}%
                        </span>
                        <div className="w-24 h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                          <div 
                            className={`
                              h-full rounded-full
                              ${service.color === 'success' 
                                ? 'bg-success-500' 
                                : 'bg-warning-500'
                              }
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
      </div>
    </Layout>
  );
}
