import type { Bot } from '../../types/api';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { SegmentedTabs } from '../../components/ui/Tabs';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { getDomainMeta } from '../../utils/domainHelpers';

interface BotConfigTab<T extends string> {
  id: T;
  label: string;
  icon: string;
}

interface BotConfigHeaderProps<T extends string> {
  bot: Bot | null;
  embedded: boolean;
  tabs: BotConfigTab<T>[];
  activeTab: T;
  onTabChange: (tab: T) => void;
  onOpenPlayground: () => void;
  onBack: () => void;
}

export function BotConfigHeader<T extends string>({
  bot,
  embedded,
  tabs,
  activeTab,
  onTabChange,
  onOpenPlayground,
  onBack,
}: BotConfigHeaderProps<T>) {
  const domainMeta = bot ? getDomainMeta(bot.config?.domain) : null;

  return (
    <Card className="overflow-hidden rounded-2xl relative">
      <div className="absolute top-0 right-1/4 w-64 h-64 bg-primary/10 rounded-full blur-[80px] pointer-events-none" />

      <div className="flex flex-col md:flex-row items-start md:items-center justify-between px-8 py-6 border-b border-white/5 gap-4 relative z-10">
        <div className="flex items-center gap-5">
          <div className="size-14 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-[inset_0_0_20px_rgba(79,142,240,0.16)] border border-primary/20">
            <span className="material-symbols-outlined text-3xl">settings</span>
          </div>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-xl font-bold text-foreground">{bot?.name || 'Agent Configuration'}</h2>
              <StatusBadge tone={bot?.is_active ? 'success' : 'neutral'} className="uppercase tracking-wider">
                {bot?.is_active ? 'Active' : 'Inactive'}
              </StatusBadge>
              {domainMeta && (
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold ${domainMeta.badge}`}>
                  <span className="material-symbols-outlined text-[11px]">{domainMeta.icon}</span>
                  {domainMeta.label}
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">Manage behavior, knowledge, and integrations</p>
          </div>
        </div>

        {!embedded && (
          <div className="flex items-center gap-3">
            <Button type="button" onClick={onOpenPlayground} className="gap-2">
              <span className="material-symbols-outlined text-[18px]">rocket_launch</span>
              Open Playground
            </Button>
            <Button type="button" variant="outline" onClick={onBack} className="gap-2">
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
              Back
            </Button>
          </div>
        )}
      </div>

      <div className="px-4 py-2 bg-black/20 relative z-10 backdrop-blur-md border-t border-white/5">
        <SegmentedTabs
          items={tabs.map((tab) => ({
            ...tab,
            icon: <span className="material-symbols-outlined text-[20px]">{tab.icon}</span>,
          }))}
          value={activeTab}
          onChange={onTabChange}
        />
      </div>
    </Card>
  );
}
