# INVOMECH Inventory Management — Frontend Guide

This document describes the frontend implementation of the INVOMECH Inventory Management System.

The frontend is a React and TypeScript application built with Vite. It provides a responsive inventory dashboard with INVOMECH branding, light and dark themes, role-aware navigation, dashboard visualizations, authentication screens, and API integration.

## Frontend goals

The frontend is designed to provide:

- A professional industrial-business interface
- Fast access to inventory and procurement information
- Clear low-stock visibility
- Responsive desktop, tablet, and mobile layouts
- Accessible actions and readable data tables
- Consistent INR-only financial formatting
- A visual language based on the supplied dashboard reference
- Clear separation between presentation, API communication, and backend persistence

## Technology stack

- React
- TypeScript
- Vite
- React Router dependency for route expansion
- TanStack Query dependency for server-state expansion
- Recharts for dashboard charts
- Framer Motion dependency for animation expansion
- Lucide React for interface icons
- Tailwind CSS configuration
- Custom CSS variables for the current design system

## Frontend entry points

```text
src/
├── main.tsx       # React application entry point
├── App.tsx        # Main application shell and dashboard UI
├── api.ts         # Typed frontend API helpers
├── App.css        # Application component and layout styles
├── index.css      # Global styles and typography
└── assets/        # Static source assets
```

The company logo is stored in:

```text
public/invomech-logo.png
```

## Application entry point

`src/main.tsx` creates the React root and renders `App` inside `StrictMode`.

The global stylesheet is loaded before the application:

```tsx
import './index.css'
import App from './App.tsx'
```

## Main application shell

The main UI is implemented in `src/App.tsx`.

The shell contains:

1. A collapsible sidebar
2. A top navigation bar
3. Global search
4. Theme toggle
5. Notifications popover
6. User profile menu
7. Page heading and contextual actions
8. Dashboard content
9. Modal dialogs
10. Login and loading states

## Navigation

The sidebar currently contains these workspace sections:

- Dashboard
- Inventory
- Stock Movements
- Suppliers
- Purchase Orders
- Goods Received
- Reports
- Audit Log
- User Management
- Settings

Navigation entries are defined in the `navItems` collection in `src/App.tsx`.

Admin-only entries are marked with `adminOnly: true` and filtered based on the authenticated user's role.

Frontend visibility is only a usability feature. Authorization must continue to be enforced by the backend API.

## Dashboard

The dashboard displays live API data when an authenticated session is available.

### KPI cards

The KPI row displays:

- Total products
- Stock value
- Low-stock item count
- Open purchase-order count

The stock value is formatted using Indian currency conventions:

```text
₹18,55,000
```

The formatter is defined in `src/App.tsx` using `Intl.NumberFormat` with:

```text
locale: en-IN
currency: INR
```

### Inventory activity chart

The activity chart uses Recharts and displays:

- Sales activity
- Purchase activity
- Monthly values
- Responsive chart sizing
- Theme-aware grid and tooltip colors

The chart receives its data from the dashboard API response.

### Low-stock alerts

The alert panel displays products whose status is not `In Stock`.

Each alert includes:

- Product name
- SKU
- Current quantity
- Minimum quantity
- Visual severity styling

### Recent inventory table

The inventory table displays:

- Product name
- SKU
- Category
- Current quantity
- Minimum quantity
- Stock status

The table supports horizontal scrolling on narrow screens.

## Authentication UI

The frontend provides:

- Login screen
- Email and password fields
- Submission state
- Error message display
- Session restoration on refresh
- Server-backed logout

The current login screen uses the development account email and password as convenient local-development defaults in the form. Production deployments must replace development credentials and must not expose them in application code or documentation intended for users.

When the application starts, it calls the session endpoint to determine whether the user is authenticated.

The UI shows:

- A loading state while the session is checked
- The login screen when no active session exists
- The dashboard after the session and dashboard data load successfully

## API client

Typed API helpers are defined in:

```text
src/api.ts
```

The shared request helper:

- Uses the `/api` path
- Sends browser credentials
- Sets the JSON content type
- Parses JSON responses
- Converts API errors into JavaScript `Error` objects
- Supports `204 No Content` responses

Available frontend API operations currently include:

```text
getCsrfToken()
getCurrentUser()
login(email, password)
logout()
getDashboard()
```

## Authentication request flow

State-changing requests use the following browser flow:

1. Request a CSRF token from `/api/auth/csrf`.
2. Submit the login request with the CSRF token.
3. Allow the browser to retain the HTTP-only session cookie.
4. Request the current user and dashboard data.
5. Send credentials on future API requests.

The Vite development server proxies API requests:

```text
/api/* → http://localhost:4000
```

This proxy is configured in `vite.config.ts`.

## Search behavior

The global search field filters the currently loaded dashboard products by:

- Product name
- SKU
- Category

Search matching is case-insensitive.

The search state is maintained in the main application shell and passed into dashboard views through filtered data.

## Theme system

The application supports:

- Light theme
- Dark theme

The selected theme is persisted using:

```text
localStorage["invomech-theme"]
```

Supported values:

```text
light
dark
```

The application reads the saved value during initial state creation and applies the `dark` class to the application shell.

### Theme variables

The design system is based on CSS variables in `src/App.css`:

```css
--bg
--card
--text
--muted
--border
--blue
--blue-soft
--shadow
```

When adding a new component, use these variables instead of hardcoded colors wherever possible.

Every new surface should be checked in both themes, including:

- Cards
- Tables
- Inputs
- Select controls
- Dropdowns
- Dialogs
- Charts
- Tooltips
- Alerts
- Empty states

## Responsive behavior

Responsive breakpoints are implemented in `src/App.css`.

### Desktop

- Persistent sidebar
- Expanded navigation labels
- Full search field
- Profile name and role
- Multi-column KPI grid
- Side-by-side chart and alert panels

### Tablet

- Reduced page padding
- Two-column KPI layout
- Single-column dashboard panels where required

### Mobile

- Sidebar becomes a drawer
- Mobile menu button is shown
- Search expands into available topbar space
- Profile text is hidden to preserve room
- Dashboard cards stack vertically
- Tables scroll horizontally
- Heading actions remain usable on narrow screens

## Modal behavior

The add-record modal currently provides the frontend interaction shell for creating an inventory item.

It includes:

- Product name
- SKU
- Category
- Cancel action
- Create item action
- Backdrop click handling
- Close button

The modal should be connected to the inventory creation API in a future UI iteration. It must not be treated as persisted until the API request and success response are implemented.

## Styling and typography

Global typography is defined in `src/index.css`.

The application uses:

- DM Sans for interface text
- Manrope for prominent headings
- Cool-grey application backgrounds
- White cards in the light theme
- Dark elevated cards in the dark theme
- Blue primary actions
- Muted secondary labels
- Restrained borders and shadows

The interface intentionally uses compact font sizes for data-dense inventory views while maintaining readable labels and accessible controls.

## Branding

The supplied INVOMECH logo must remain the source of truth for application branding.

Current usage:

- Sidebar logo
- Login screen logo
- Public asset path for future printable or document views

Do not replace the supplied logo with a generated alternative. Preserve its aspect ratio and original colors.

## Frontend commands

Run these commands from the project directory.

### Install dependencies

```powershell
npm install
```

### Start the Vite development server

```powershell
npm run dev
```

The frontend is available at:

```text
http://localhost:5173
```

### Build the frontend

```powershell
npm run build
```

### Preview the production build

```powershell
npm run preview
```

### Run frontend linting

```powershell
npm run lint
```

### Run the configured tests

```powershell
npm test
```

## Frontend validation checklist

Before considering a frontend change complete, verify:

- `npm run build` succeeds
- `npm run lint` succeeds
- `npm test` succeeds
- The light theme remains readable
- The dark theme remains readable
- The layout works at mobile width
- The sidebar drawer opens and closes
- Search filters visible data
- Authenticated and unauthenticated states are clear
- Loading and error states are understandable
- Buttons have visible hover and disabled states
- INR values remain INR-formatted
- The supplied logo remains clear and correctly proportioned

## Adding a new page

When implementing a new workspace page:

1. Add the navigation item to `navItems`.
2. Mark admin-only items with `adminOnly: true`.
3. Add a dedicated page component rather than growing the main JSX block indefinitely.
4. Add a typed API method in `src/api.ts`.
5. Add loading, empty, success, and error states.
6. Preserve role-aware access behavior.
7. Reuse existing card, table, button, status, and modal styles.
8. Test the page in both themes.
9. Test desktop and mobile layouts.
10. Connect destructive or state-changing actions to the backend rather than only changing local state.

## Adding a new API response

When adding a new API response:

1. Define a TypeScript response type in `src/api.ts`.
2. Add a typed request helper.
3. Use `credentials: 'include'` for session-aware requests.
4. Handle non-success responses through the shared request helper.
5. Add loading and error UI.
6. Avoid duplicating request logic inside components.

## Current frontend limitations

- The dashboard is connected to the dashboard API.
- Several non-dashboard workspace sections still use lightweight workspace views.
- The add-inventory modal is not yet connected to the inventory creation endpoint.
- The current automated test coverage is primarily service-rule coverage rather than browser-level UI coverage.
- Playwright browser tests should be added for authentication, navigation, themes, dashboard loading, search, and modal behavior.

## Frontend design principles

New frontend work should preserve:

- INVOMECH branding
- Clean industrial-business presentation
- Blue primary actions
- Clear stock severity indicators
- INR-only monetary display
- Role-aware navigation
- Accessible contrast
- Responsive layouts
- Explicit loading and error states
- Minimal, purposeful animation
- API-backed persistence for data-changing actions
