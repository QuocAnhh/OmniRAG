# OmniRAG Frontend

React + TypeScript + Vite frontend application for OmniRAG intelligent chatbot platform.

## 🚀 Tech Stack

- **React 19.2** - Latest React with modern hooks
- **TypeScript 5.9** - Type-safe development
- **Vite (Rolldown)** - Lightning-fast build tool
- **Tailwind CSS 3.x** - Utility-first CSS framework
- **React Router v6** - Client-side routing
- **Zustand** - Lightweight state management
- **Axios** - HTTP client with interceptors
- **TanStack Query** - Server state management (ready to use)

## 📦 Project Structure

```
src/
├── api/               # API service layer
│   ├── client.ts      # Axios instance with JWT interceptor
│   ├── auth.ts        # Authentication endpoints
│   ├── bots.ts        # Bot management endpoints
│   ├── documents.ts   # Document upload/management
│   └── chat.ts        # RAG chat endpoints
├── components/
│   ├── Layout/        # Layout components
│   │   ├── Layout.tsx       # Main layout wrapper
│   │   ├── Sidebar.tsx      # Navigation sidebar
│   │   └── TopHeader.tsx    # Top header with search/notifications
│   ├── ui/            # Reusable UI components
│   │   └── Button.tsx       # Button with variants
│   └── forms/         # Form components
│       └── Input.tsx        # Form input with label/error
├── pages/             # Page components
│   ├── LandingPage.tsx      # Public landing page
│   ├── AuthPage.tsx         # Login/Register page
│   ├── DashboardPage.tsx    # Main dashboard
│   ├── BotsPage.tsx         # Bot list/management
│   ├── DocumentsPage.tsx    # Knowledge base management
│   ├── IntegrationsPage.tsx # Channel integrations
│   ├── AnalyticsPage.tsx    # Analytics & insights
│   └── SettingsPage.tsx     # User settings
├── store/             # State management
│   └── authStore.ts         # Auth state with persistence
├── types/             # TypeScript definitions
│   └── api.ts               # API type definitions
├── utils/             # Utility functions
│   └── constants.ts         # App constants
├── hooks/             # Custom React hooks (empty - ready for use)
├── App.tsx            # Root component with routing
├── main.tsx           # Entry point
└── index.css          # Global styles + Tailwind imports
```

## 🎨 Design System

### Colors
- **Primary**: `#6467f2` (Indigo) - Main brand color
- **Admin**: `#2b2eee` - Admin features
- **Background Light**: `#f8f8fc`
- **Background Dark**: `#0d0e1b`
- **Surface Light**: `#ffffff`
- **Surface Dark**: `#1a1b2e`

### Typography
- **Font**: Inter (300-900 weights)
- **Icons**: Material Symbols Outlined

### Components
All components use Tailwind CSS with dark mode support via `dark:` prefix.

## 🔧 Setup & Development

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Backend API running on `http://localhost:8000`

### Installation
```bash
cd frontend
npm install
```

### Development Server
```bash
npm run dev
```
Opens at `http://localhost:5173`

### Build for Production
```bash
npm run build
```

### Preview Production Build
```bash
npm run preview
```

## 🔐 Authentication Flow

1. User visits `/auth` page
2. Can toggle between Login and Signup modes
3. On success:
   - JWT token stored in Zustand store
   - Persisted to localStorage
   - Auto-attached to all API requests via Axios interceptor
4. Protected routes check token presence
5. Logout clears token and redirects to landing

## 📡 API Integration

### API Client Setup
All API calls go through `src/api/client.ts` which:
- Sets base URL from environment variable or defaults to `http://localhost:8000`
- Automatically attaches JWT token to `Authorization: Bearer <token>`
- Handles 401 errors by clearing auth and redirecting to login

### Example API Usage
```typescript
import { botsApi } from '../api/bots';

// List all bots
const bots = await botsApi.list();

// Create a bot
const newBot = await botsApi.create({
  name: 'Support Bot',
  description: 'Customer support assistant',
  model: 'gpt-4',
  temperature: 0.7
});

// Update a bot
await botsApi.update(botId, { name: 'New Name' });

// Delete a bot
await botsApi.delete(botId);
```

## 🎯 Key Features Implemented

### ✅ Completed Pages
1. **Landing Page** - Hero, features, CTA sections
2. **Auth Page** - Login/Signup with toggle, Google OAuth button
3. **Dashboard** - Stats cards, activity timeline, charts, quick actions
4. **Bots Page** - Grid view of bots with create/edit/delete
5. **Documents Page** - Drag-drop upload, documents table with status
6. **Integrations Page** - Channel integration cards
7. **Analytics Page** - Stats, charts placeholder, conversations table
8. **Settings Page** - Profile settings, API key management

### 🔄 In Progress
- Bot Config Editor (split-pane, tabs, color picker)
- Real-time chat interface
- Admin pages (dashboard, user management)
- Subscription/billing page

### 🧩 Components Library
- `<Layout>` - Wraps all authenticated pages with Sidebar + TopHeader
- `<Button variant="primary|secondary|danger|ghost" isLoading>` - Consistent buttons
- `<Input label error helperText>` - Form inputs with validation display
- More components can be added to `components/ui/` as needed

## 🌍 Environment Variables

Create `.env` file:
```bash
VITE_API_BASE_URL=http://localhost:8000
```

Access in code:
```typescript
const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
```

## 🎨 Styling Guidelines

### Tailwind Conventions
- Use semantic color names: `bg-primary`, `text-slate-900 dark:text-white`
- Always include dark mode: `bg-white dark:bg-slate-800`
- Consistent spacing: `p-6`, `gap-4`, `mb-8`
- Responsive design: `md:grid-cols-2 lg:grid-cols-3`

### Dark Mode
Dark mode is class-based. Add `class="dark"` to `<html>` to enable globally.
Toggle can be implemented in TopHeader component.

## 🚧 TODO: Remaining Features

### High Priority
- [ ] Bot Config Editor page (split-pane layout, tabs)
- [ ] Chat interface with message history
- [ ] Real-time document processing status (WebSocket)
- [ ] Form validation with react-hook-form
- [ ] Charts integration (Chart.js or Recharts)

### Medium Priority
- [ ] Subscription/pricing page
- [ ] Admin dashboard
- [ ] Admin user management
- [ ] Dark mode toggle button
- [ ] Search functionality in TopHeader
- [ ] Notifications dropdown

### Low Priority
- [ ] Internationalization (i18n)
- [ ] Keyboard shortcuts
- [ ] Accessibility improvements
- [ ] Unit tests (Vitest)
- [ ] E2E tests (Playwright)

## 🐛 Known Issues

1. **Tailwind Dynamic Classes**: Avoid dynamic color classes like `bg-${color}-500`. Use static classes or inline styles.
2. **Material Icons Loading**: Icons load from CDN. Add fallback for offline mode.
3. **API Error Handling**: Basic alert() used - should implement toast notifications.

## 📚 Additional Resources

- [React Router Docs](https://reactrouter.com/en/main)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [Zustand Docs](https://zustand-demo.pmnd.rs/)
- [Vite Docs](https://vite.dev/)
- [Material Symbols](https://fonts.google.com/icons)

## 🤝 Contributing

1. Create feature branch: `git checkout -b feature/new-page`
2. Make changes with TypeScript types
3. Test dark mode support
4. Ensure responsive design (mobile, tablet, desktop)
5. Submit PR with description

## 📄 License

Same as backend - check root LICENSE file.
