import { useQuery } from '@tanstack/react-query';
import Layout from '../components/Layout/Layout';
import { dataGridApi } from '../api/dataGrid';
import { useState } from 'react';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark shadow-sm p-6">
      <h3 className="font-semibold text-text-main dark:text-white mb-4">{title}</h3>
      {children}
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
      <div className="p-8 bg-background-off dark:bg-background-dark min-h-full">
        <div className="max-w-7xl mx-auto space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Section title="PostgreSQL: Tenants">
              {tenantsQ.isLoading ? 'Loading...' : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-background-off dark:bg-surface-dark text-xs uppercase tracking-wider text-text-muted dark:text-gray-400">
                      <tr>
                        <th className="px-4 py-2">ID</th>
                        <th className="px-4 py-2">Name</th>
                        <th className="px-4 py-2">Email</th>
                        <th className="px-4 py-2">Plan</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm divide-y divide-border-light dark:divide-border-dark">
                      {(tenantsQ.data?.items || []).map((t: any) => (
                        <tr key={t.id}>
                          <td className="px-4 py-2 font-mono text-xs">{t.id}</td>
                          <td className="px-4 py-2">{t.name}</td>
                          <td className="px-4 py-2">{t.email}</td>
                          <td className="px-4 py-2">{t.plan}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Section>

            <Section title="PostgreSQL: Users">
              {usersQ.isLoading ? 'Loading...' : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-background-off dark:bg-surface-dark text-xs uppercase tracking-wider text-text-muted dark:text-gray-400">
                      <tr>
                        <th className="px-4 py-2">ID</th>
                        <th className="px-4 py-2">Email</th>
                        <th className="px-4 py-2">Name</th>
                        <th className="px-4 py-2">Role</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm divide-y divide-border-light dark:divide-border-dark">
                      {(usersQ.data?.items || []).map((u: any) => (
                        <tr key={u.id}>
                          <td className="px-4 py-2 font-mono text-xs">{u.id}</td>
                          <td className="px-4 py-2">{u.email}</td>
                          <td className="px-4 py-2">{u.full_name}</td>
                          <td className="px-4 py-2">{u.role}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Section>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Section title="PostgreSQL: Bots">
              <div className="flex items-center gap-2 mb-3">
                <input className="h-9 px-3 rounded border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark text-sm" placeholder="Filter by tenant_id" value={tenantFilter} onChange={e => setTenantFilter(e.target.value)} />
              </div>
              {botsQ.isLoading ? 'Loading...' : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-background-off dark:bg-surface-dark text-xs uppercase tracking-wider text-text-muted dark:text-gray-400">
                      <tr>
                        <th className="px-4 py-2">ID</th>
                        <th className="px-4 py-2">Name</th>
                        <th className="px-4 py-2">Tenant</th>
                        <th className="px-4 py-2">Active</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm divide-y divide-border-light dark:divide-border-dark">
                      {(botsQ.data?.items || []).map((b: any) => (
                        <tr key={b.id}>
                          <td className="px-4 py-2 font-mono text-xs">{b.id}</td>
                          <td className="px-4 py-2">{b.name}</td>
                          <td className="px-4 py-2 font-mono text-xs">{b.tenant_id}</td>
                          <td className="px-4 py-2">{String(b.is_active)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Section>

            <Section title="PostgreSQL: Documents">
              <div className="flex items-center gap-2 mb-3">
                <input className="h-9 px-3 rounded border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark text-sm" placeholder="Filter by bot_id" value={botFilter} onChange={e => setBotFilter(e.target.value)} />
              </div>
              {docsQ.isLoading ? 'Loading...' : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-background-off dark:bg-surface-dark text-xs uppercase tracking-wider text-text-muted dark:text-gray-400">
                      <tr>
                        <th className="px-4 py-2">ID</th>
                        <th className="px-4 py-2">Filename</th>
                        <th className="px-4 py-2">Type</th>
                        <th className="px-4 py-2">Status</th>
                        <th className="px-4 py-2">Bot</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm divide-y divide-border-light dark:divide-border-dark">
                      {(docsQ.data?.items || []).map((d: any) => (
                        <tr key={d.id}>
                          <td className="px-4 py-2 font-mono text-xs">{d.id}</td>
                          <td className="px-4 py-2">{d.filename}</td>
                          <td className="px-4 py-2">{d.file_type}</td>
                          <td className="px-4 py-2">{d.status}</td>
                          <td className="px-4 py-2 font-mono text-xs">{d.bot_id}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Section>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Section title="MongoDB: Collections">
              {mongoQ.isLoading ? 'Loading...' : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-background-off dark:bg-surface-dark text-xs uppercase tracking-wider text-text-muted dark:text-gray-400">
                      <tr>
                        <th className="px-4 py-2">Name</th>
                        <th className="px-4 py-2">Count</th>
                        <th className="px-4 py-2">Sample (truncated)</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm divide-y divide-border-light dark:divide-border-dark">
                      {(mongoQ.data?.collections || []).map((c: any) => (
                        <tr key={c.name}>
                          <td className="px-4 py-2">{c.name}</td>
                          <td className="px-4 py-2">{c.count}</td>
                          <td className="px-4 py-2 font-mono text-xs">{JSON.stringify(c.sample)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Section>

            <Section title="Redis: Keys">
              {redisQ.isLoading ? 'Loading...' : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-background-off dark:bg-surface-dark text-xs uppercase tracking-wider text-text-muted dark:text-gray-400">
                      <tr>
                        <th className="px-4 py-2">Key</th>
                        <th className="px-4 py-2">TTL</th>
                        <th className="px-4 py-2">Value (truncated)</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm divide-y divide-border-light dark:divide-border-dark">
                      {(redisQ.data?.items || []).map((k: any) => (
                        <tr key={k.key}>
                          <td className="px-4 py-2 font-mono text-xs">{k.key}</td>
                          <td className="px-4 py-2">{k.ttl}</td>
                          <td className="px-4 py-2 font-mono text-xs">{String(k.value).slice(0, 120)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Section>
          </div>

          <Section title="Qdrant: Collections">
            {qdrantQ.isLoading ? 'Loading...' : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-background-off dark:bg-surface-dark text-xs uppercase tracking-wider text-text-muted dark:text-gray-400">
                    <tr>
                      <th className="px-4 py-2">Name</th>
                      <th className="px-4 py-2">Points Count</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm divide-y divide-border-light dark:divide-border-dark">
                    {(qdrantQ.data?.collections || []).map((c: any) => (
                      <tr key={c.name}>
                        <td className="px-4 py-2">{c.name}</td>
                        <td className="px-4 py-2">{c.points_count ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        </div>
      </div>
    </Layout>
  );
}
