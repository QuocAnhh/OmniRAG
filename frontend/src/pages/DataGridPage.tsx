import { useQuery } from '@tanstack/react-query';
import Layout from '../components/Layout/Layout';
import { dataGridApi } from '../api/dataGrid';
import { useState } from 'react';

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="terminal-panel overflow-hidden">
      <div className="px-4 py-3 border-b border-terminal-border">
        <p className="terminal-section-title">{title}</p>
        {subtitle && <p className="text-[9px] font-mono text-terminal-muted mt-1">{subtitle}</p>}
      </div>
      <div className="p-4">
        {children}
      </div>
    </div>
  );
}

export default function DataGridPage() {
  const [tenantFilter, setTenantFilter] = useState<string>('');
  const [botFilter, setBotFilter] = useState<string>('');

  const usersQ = useQuery({ queryKey: ['dg-users'], queryFn: () => dataGridApi.listUsers({ limit: 50 }) });
  const tenantsQ = useQuery({ queryKey: ['dg-tenants'], queryFn: () => dataGridApi.listTenants({ limit: 50 }) });
  const botsQ = useQuery({ queryKey: ['dg-bots', tenantFilter], queryFn: () => dataGridApi.listBots({ limit: 50, tenant_id: tenantFilter || undefined }) });
  const docsQ = useQuery({ queryKey: ['dg-docs', botFilter], queryFn: () => dataGridApi.listDocuments({ limit: 50, bot_id: botFilter || undefined }) });

  const mongoQ = useQuery({ queryKey: ['dg-mongo'], queryFn: dataGridApi.mongoCollections });
  const redisQ = useQuery({ queryKey: ['dg-redis'], queryFn: () => dataGridApi.redisKeys({ max_items: 100 }) });
  const qdrantQ = useQuery({ queryKey: ['dg-qdrant'], queryFn: dataGridApi.qdrantCollections });

  return (
    <Layout breadcrumbs={[{ label: 'Home', path: '/' }, { label: 'Data Grid' }]}> 
      <div className="p-6 min-h-full">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <p className="terminal-section-title">DATA GRID</p>
            <h1 className="text-2xl font-semibold text-terminal-text-bright mt-1">
              System Database Inspector
            </h1>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-5 gap-4 mb-6">
            <div className="terminal-kpi p-4">
              <p className="terminal-section-title mb-2">TENANTS</p>
              <p className="terminal-metric text-2xl">{tenantsQ.data?.items?.length || 0}</p>
            </div>
            <div className="terminal-kpi p-4">
              <p className="terminal-section-title mb-2">USERS</p>
              <p className="terminal-metric text-2xl">{usersQ.data?.items?.length || 0}</p>
            </div>
            <div className="terminal-kpi p-4">
              <p className="terminal-section-title mb-2">BOTS</p>
              <p className="terminal-metric text-2xl">{botsQ.data?.items?.length || 0}</p>
            </div>
            <div className="terminal-kpi p-4">
              <p className="terminal-section-title mb-2">DOCUMENTS</p>
              <p className="terminal-metric text-2xl">{docsQ.data?.items?.length || 0}</p>
            </div>
            <div className="terminal-kpi p-4">
              <p className="terminal-section-title mb-2">VECTORS</p>
              <p className="terminal-metric text-2xl text-terminal-cyan">
                {qdrantQ.data?.collections?.reduce((acc: number, c: any) => acc + (c.points_count || 0), 0) || 0}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {/* PostgreSQL Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Section title="POSTGRESQL › TENANTS" subtitle="TENANT ACCOUNTS">
                {tenantsQ.isLoading ? (
                  <p className="text-center py-4 text-terminal-muted text-xs font-mono">LOADING...</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="terminal-table w-full text-left">
                      <thead>
                        <tr>
                          <th className="px-3 py-2"><span className="terminal-section-title text-[9px]">ID</span></th>
                          <th className="px-3 py-2"><span className="terminal-section-title text-[9px]">NAME</span></th>
                          <th className="px-3 py-2"><span className="terminal-section-title text-[9px]">EMAIL</span></th>
                          <th className="px-3 py-2"><span className="terminal-section-title text-[9px]">PLAN</span></th>
                        </tr>
                      </thead>
                      <tbody className="text-xs">
                        {(tenantsQ.data?.items || []).map((t: any) => (
                          <tr key={t.id} className="border-t border-terminal-border hover:bg-terminal-surface">
                            <td className="px-3 py-2 font-mono text-terminal-cyan">{t.id.slice(0, 8).toUpperCase()}</td>
                            <td className="px-3 py-2 text-terminal-text">{t.name}</td>
                            <td className="px-3 py-2 text-terminal-muted">{t.email}</td>
                            <td className="px-3 py-2"><span className="terminal-tag-success text-[9px]">{t.plan}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Section>

              <Section title="POSTGRESQL › USERS" subtitle="USER ACCOUNTS">
                {usersQ.isLoading ? (
                  <p className="text-center py-4 text-terminal-muted text-xs font-mono">LOADING...</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="terminal-table w-full text-left">
                      <thead>
                        <tr>
                          <th className="px-3 py-2"><span className="terminal-section-title text-[9px]">ID</span></th>
                          <th className="px-3 py-2"><span className="terminal-section-title text-[9px]">EMAIL</span></th>
                          <th className="px-3 py-2"><span className="terminal-section-title text-[9px]">NAME</span></th>
                          <th className="px-3 py-2"><span className="terminal-section-title text-[9px]">ROLE</span></th>
                        </tr>
                      </thead>
                      <tbody className="text-xs">
                        {(usersQ.data?.items || []).map((u: any) => (
                          <tr key={u.id} className="border-t border-terminal-border hover:bg-terminal-surface">
                            <td className="px-3 py-2 font-mono text-terminal-cyan">{u.id.slice(0, 8).toUpperCase()}</td>
                            <td className="px-3 py-2 text-terminal-text">{u.email}</td>
                            <td className="px-3 py-2 text-terminal-muted">{u.full_name}</td>
                            <td className="px-3 py-2"><span className="terminal-tag-success text-[9px]">{u.role}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Section>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Section title="POSTGRESQL › BOTS" subtitle="AGENT INSTANCES">
                <div className="flex items-center gap-2 mb-3">
                  <input 
                    className="terminal-input h-8 text-xs flex-1" 
                    placeholder="FILTER BY TENANT_ID" 
                    value={tenantFilter} 
                    onChange={e => setTenantFilter(e.target.value)} 
                  />
                </div>
                {botsQ.isLoading ? (
                  <p className="text-center py-4 text-terminal-muted text-xs font-mono">LOADING...</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="terminal-table w-full text-left">
                      <thead>
                        <tr>
                          <th className="px-3 py-2"><span className="terminal-section-title text-[9px]">ID</span></th>
                          <th className="px-3 py-2"><span className="terminal-section-title text-[9px]">NAME</span></th>
                          <th className="px-3 py-2"><span className="terminal-section-title text-[9px]">TENANT</span></th>
                          <th className="px-3 py-2"><span className="terminal-section-title text-[9px]">STATUS</span></th>
                        </tr>
                      </thead>
                      <tbody className="text-xs">
                        {(botsQ.data?.items || []).map((b: any) => (
                          <tr key={b.id} className="border-t border-terminal-border hover:bg-terminal-surface">
                            <td className="px-3 py-2 font-mono text-terminal-cyan">{b.id.slice(0, 8).toUpperCase()}</td>
                            <td className="px-3 py-2 text-terminal-text">{b.name}</td>
                            <td className="px-3 py-2 font-mono text-terminal-muted text-[10px]">{b.tenant_id.slice(0, 8)}</td>
                            <td className="px-3 py-2">
                              <span className={b.is_active ? 'terminal-tag-success text-[9px]' : 'terminal-tag-danger text-[9px]'}>
                                {b.is_active ? 'ACTIVE' : 'INACTIVE'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Section>

              <Section title="POSTGRESQL › DOCUMENTS" subtitle="INDEXED FILES">
                <div className="flex items-center gap-2 mb-3">
                  <input 
                    className="terminal-input h-8 text-xs flex-1" 
                    placeholder="FILTER BY BOT_ID" 
                    value={botFilter} 
                    onChange={e => setBotFilter(e.target.value)} 
                  />
                </div>
                {docsQ.isLoading ? (
                  <p className="text-center py-4 text-terminal-muted text-xs font-mono">LOADING...</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="terminal-table w-full text-left">
                      <thead>
                        <tr>
                          <th className="px-3 py-2"><span className="terminal-section-title text-[9px]">ID</span></th>
                          <th className="px-3 py-2"><span className="terminal-section-title text-[9px]">FILENAME</span></th>
                          <th className="px-3 py-2"><span className="terminal-section-title text-[9px]">TYPE</span></th>
                          <th className="px-3 py-2"><span className="terminal-section-title text-[9px]">STATUS</span></th>
                        </tr>
                      </thead>
                      <tbody className="text-xs">
                        {(docsQ.data?.items || []).map((d: any) => (
                          <tr key={d.id} className="border-t border-terminal-border hover:bg-terminal-surface">
                            <td className="px-3 py-2 font-mono text-terminal-cyan">{d.id.slice(0, 8).toUpperCase()}</td>
                            <td className="px-3 py-2 text-terminal-text truncate max-w-[200px]">{d.filename}</td>
                            <td className="px-3 py-2 font-mono text-terminal-muted">{d.file_type}</td>
                            <td className="px-3 py-2">
                              <span className={d.status === 'completed' ? 'terminal-tag-success text-[9px]' : 'terminal-tag-warning text-[9px]'}>
                                {d.status.toUpperCase()}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Section>
            </div>

            {/* NoSQL Stores Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Section title="MONGODB › COLLECTIONS" subtitle="DOCUMENT STORE">
                {mongoQ.isLoading ? (
                  <p className="text-center py-4 text-terminal-muted text-xs font-mono">LOADING...</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="terminal-table w-full text-left">
                      <thead>
                        <tr>
                          <th className="px-3 py-2"><span className="terminal-section-title text-[9px]">NAME</span></th>
                          <th className="px-3 py-2"><span className="terminal-section-title text-[9px]">COUNT</span></th>
                          <th className="px-3 py-2"><span className="terminal-section-title text-[9px]">SAMPLE</span></th>
                        </tr>
                      </thead>
                      <tbody className="text-xs">
                        {(mongoQ.data?.collections || []).map((c: any) => (
                          <tr key={c.name} className="border-t border-terminal-border hover:bg-terminal-surface">
                            <td className="px-3 py-2 text-terminal-text font-mono">{c.name}</td>
                            <td className="px-3 py-2 text-terminal-cyan font-mono">{c.count}</td>
                            <td className="px-3 py-2 font-mono text-terminal-muted text-[10px] truncate max-w-[200px]">
                              {JSON.stringify(c.sample)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Section>

              <Section title="REDIS › KEYS" subtitle="CACHE STORE">
                {redisQ.isLoading ? (
                  <p className="text-center py-4 text-terminal-muted text-xs font-mono">LOADING...</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="terminal-table w-full text-left">
                      <thead>
                        <tr>
                          <th className="px-3 py-2"><span className="terminal-section-title text-[9px]">KEY</span></th>
                          <th className="px-3 py-2"><span className="terminal-section-title text-[9px]">TTL</span></th>
                          <th className="px-3 py-2"><span className="terminal-section-title text-[9px]">VALUE</span></th>
                        </tr>
                      </thead>
                      <tbody className="text-xs">
                        {(redisQ.data?.items || []).map((k: any) => (
                          <tr key={k.key} className="border-t border-terminal-border hover:bg-terminal-surface">
                            <td className="px-3 py-2 font-mono text-terminal-cyan truncate max-w-[150px]">{k.key}</td>
                            <td className="px-3 py-2 font-mono text-terminal-text">{k.ttl}</td>
                            <td className="px-3 py-2 font-mono text-terminal-muted text-[10px] truncate max-w-[200px]">
                              {String(k.value).slice(0, 80)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Section>
            </div>

            {/* Vector Store Section */}
            <Section title="QDRANT › COLLECTIONS" subtitle="VECTOR EMBEDDINGS">
              {qdrantQ.isLoading ? (
                <p className="text-center py-4 text-terminal-muted text-xs font-mono">LOADING...</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="terminal-table w-full text-left">
                    <thead>
                      <tr>
                        <th className="px-3 py-2"><span className="terminal-section-title text-[9px]">COLLECTION NAME</span></th>
                        <th className="px-3 py-2"><span className="terminal-section-title text-[9px]">POINTS COUNT</span></th>
                        <th className="px-3 py-2"><span className="terminal-section-title text-[9px]">STATUS</span></th>
                      </tr>
                    </thead>
                    <tbody className="text-xs">
                      {(qdrantQ.data?.collections || []).map((c: any) => (
                        <tr key={c.name} className="border-t border-terminal-border hover:bg-terminal-surface">
                          <td className="px-3 py-2 text-terminal-text font-mono">{c.name}</td>
                          <td className="px-3 py-2 text-terminal-cyan font-mono">{c.points_count ?? '—'}</td>
                          <td className="px-3 py-2">
                            <span className="terminal-tag-success text-[9px]">READY</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Section>
          </div>
        </div>
      </div>
    </Layout>
  );
}
