import Layout from '../components/Layout/Layout';
import { Button } from '../components/ui/Button';
import { Input } from '../components/forms/Input';
import GradientText from '../components/ui/GradientText';

export default function LinearShowcasePage() {
  return (
    <Layout breadcrumbs={[{ label: 'Home', path: '/' }, { label: 'Linear Showcase' }]}>
      <div className="p-8 min-h-full">
        <div className="max-w-6xl mx-auto space-y-12">
          
          {/* Hero Section */}
          <div className="text-center space-y-4 fade-in-up">
            <GradientText as="h1" className="text-5xl font-bold">
              Linear Design System
            </GradientText>
            <p className="text-xl text-[var(--color-text-secondary)] max-w-2xl mx-auto">
              A modern, refined design system inspired by Linear's minimalist aesthetic
            </p>
          </div>

          {/* Typography Section */}
          <section className="linear-card p-8 space-y-6 fade-in-up stagger-1">
            <h2 className="text-2xl font-semibold text-[var(--color-text-primary)] mb-4">
              Typography
            </h2>
            
            <div className="space-y-4">
              <div>
                <p className="text-xs text-[var(--color-text-tertiary)] mb-2">Title 5 - 32px</p>
                <h3 className="text-[32px] font-medium leading-tight">
                  The future of product development
                </h3>
              </div>
              
              <div>
                <p className="text-xs text-[var(--color-text-tertiary)] mb-2">Title 3 - 20px</p>
                <h3 className="text-[20px] font-medium">
                  Purpose-built for modern teams
                </h3>
              </div>
              
              <div>
                <p className="text-xs text-[var(--color-text-tertiary)] mb-2">Text Regular - 14px</p>
                <p className="text-sm text-[var(--color-text-secondary)]">
                  Linear streamlines issues, projects, and product roadmaps. It's the tool of choice for high-performing teams.
                </p>
              </div>

              <div>
                <p className="text-xs text-[var(--color-text-tertiary)] mb-2">Gradient Text</p>
                <GradientText className="text-2xl font-semibold">
                  This is not a story about magic
                </GradientText>
              </div>
            </div>
          </section>

          {/* Buttons Section */}
          <section className="linear-card p-8 space-y-6 fade-in-up stagger-2">
            <h2 className="text-2xl font-semibold text-[var(--color-text-primary)] mb-4">
              Buttons
            </h2>
            
            <div className="flex flex-wrap gap-4">
              <Button variant="primary">Primary Button</Button>
              <Button variant="secondary">Secondary Button</Button>
              <Button variant="danger">Danger Button</Button>
              <Button variant="ghost">Ghost Button</Button>
            </div>

            <div className="flex flex-wrap gap-4">
              <Button variant="primary" size="sm">Small</Button>
              <Button variant="primary" size="md">Medium</Button>
              <Button variant="primary" size="lg">Large</Button>
            </div>

            <div className="flex flex-wrap gap-4">
              <Button variant="primary" isLoading>Loading...</Button>
              <Button variant="primary" disabled>Disabled</Button>
            </div>
          </section>

          {/* Inputs Section */}
          <section className="linear-card p-8 space-y-6 fade-in-up stagger-3">
            <h2 className="text-2xl font-semibold text-[var(--color-text-primary)] mb-4">
              Form Inputs
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl">
              <Input
                label="Email address"
                type="email"
                placeholder="hello@linear.app"
              />
              
              <Input
                label="Password"
                type="password"
                placeholder="Enter your password"
                required
              />

              <Input
                label="With helper text"
                placeholder="Enter something..."
                helperText="This is a helper text"
              />

              <Input
                label="With error"
                placeholder="This has an error"
                error="This field is required"
              />
            </div>
          </section>

          {/* Badges Section */}
          <section className="linear-card p-8 space-y-6 fade-in-up stagger-4">
            <h2 className="text-2xl font-semibold text-[var(--color-text-primary)] mb-4">
              Status Badges
            </h2>
            
            <div className="flex flex-wrap gap-3">
              <span className="linear-badge linear-badge-success">
                Success
              </span>
              <span className="linear-badge linear-badge-warning">
                Warning
              </span>
              <span className="linear-badge linear-badge-error">
                Error
              </span>
              <span className="linear-badge linear-badge-info">
                Info
              </span>
            </div>
          </section>

          {/* Cards Section */}
          <section className="space-y-6 fade-in-up stagger-5">
            <h2 className="text-2xl font-semibold text-[var(--color-text-primary)] mb-4">
              Cards & Metrics
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="linear-kpi-card">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-[var(--color-text-tertiary)]">
                    Total Users
                  </span>
                  <span className="material-symbols-outlined text-[var(--color-brand-primary)]">
                    group
                  </span>
                </div>
                <div className="text-3xl font-bold text-[var(--color-text-primary)] mb-1">
                  12,458
                </div>
                <div className="text-xs text-[var(--color-success)] font-medium">
                  +12% from last month
                </div>
              </div>

              <div className="linear-kpi-card">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-[var(--color-text-tertiary)]">
                    Active Now
                  </span>
                  <span className="material-symbols-outlined text-[var(--color-success)]">
                    sensors
                  </span>
                </div>
                <div className="text-3xl font-bold text-[var(--color-text-primary)] mb-1">
                  1,249
                </div>
                <div className="flex items-center gap-1 text-xs text-[var(--color-text-tertiary)]">
                  <span className="status-dot bg-[var(--color-success)] pulse"></span>
                  Live sessions
                </div>
              </div>

              <div className="linear-kpi-card">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-[var(--color-text-tertiary)]">
                    Avg Response
                  </span>
                  <span className="material-symbols-outlined text-[var(--color-warning)]">
                    bolt
                  </span>
                </div>
                <div className="text-3xl font-bold text-[var(--color-text-primary)] mb-1">
                  23ms
                </div>
                <div className="text-xs text-[var(--color-text-tertiary)]">
                  -5ms improvement
                </div>
              </div>
            </div>
          </section>

          {/* Table Section */}
          <section className="linear-card p-8 space-y-6 fade-in-up">
            <h2 className="text-2xl font-semibold text-[var(--color-text-primary)] mb-4">
              Data Table
            </h2>
            
            <table className="linear-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Status</th>
                  <th>Role</th>
                  <th>Last Active</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="font-medium text-[var(--color-text-primary)]">
                    John Doe
                  </td>
                  <td>
                    <span className="linear-badge linear-badge-success">Active</span>
                  </td>
                  <td>Administrator</td>
                  <td>2 minutes ago</td>
                </tr>
                <tr>
                  <td className="font-medium text-[var(--color-text-primary)]">
                    Jane Smith
                  </td>
                  <td>
                    <span className="linear-badge linear-badge-warning">Away</span>
                  </td>
                  <td>Developer</td>
                  <td>1 hour ago</td>
                </tr>
                <tr>
                  <td className="font-medium text-[var(--color-text-primary)]">
                    Bob Johnson
                  </td>
                  <td>
                    <span className="linear-badge linear-badge-error">Offline</span>
                  </td>
                  <td>Designer</td>
                  <td>3 days ago</td>
                </tr>
              </tbody>
            </table>
          </section>

          {/* Color Palette */}
          <section className="linear-card p-8 space-y-6">
            <h2 className="text-2xl font-semibold text-[var(--color-text-primary)] mb-4">
              Color Palette
            </h2>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <div className="h-20 rounded-lg bg-[var(--color-brand-primary)] flex items-center justify-center text-white font-medium text-sm">
                  Primary
                </div>
                <p className="text-xs text-[var(--color-text-tertiary)]">#5e6ad2</p>
              </div>
              
              <div className="space-y-2">
                <div className="h-20 rounded-lg bg-[var(--color-success)] flex items-center justify-center text-white font-medium text-sm">
                  Success
                </div>
                <p className="text-xs text-[var(--color-text-tertiary)]">#00d084</p>
              </div>
              
              <div className="space-y-2">
                <div className="h-20 rounded-lg bg-[var(--color-warning)] flex items-center justify-center text-white font-medium text-sm">
                  Warning
                </div>
                <p className="text-xs text-[var(--color-text-tertiary)]">#ff9500</p>
              </div>
              
              <div className="space-y-2">
                <div className="h-20 rounded-lg bg-[var(--color-error)] flex items-center justify-center text-white font-medium text-sm">
                  Error
                </div>
                <p className="text-xs text-[var(--color-text-tertiary)]">#ff5757</p>
              </div>
            </div>
          </section>

          {/* Footer */}
          <div className="text-center py-12 space-y-4">
            <GradientText className="text-2xl font-semibold">
              Built with precision & care
            </GradientText>
            <p className="text-[var(--color-text-tertiary)]">
              Inspired by Linear's refined aesthetic
            </p>
          </div>

        </div>
      </div>
    </Layout>
  );
}
