# UAT Dashboard - Project Documentation

Welcome to the **User Acceptance Testing (UAT) Dashboard**. This project is a modern, high-performance web application designed for managing projects, users, and UAT feedback entries.

## 🎨 Design & Style Reference
If you want to modify the design, colors, or branding of the application, refers to the following CSS structure:

### Global & Fundamentals
*   **[`public/css/base.css`](file:///c:/Users/Shikhar%20Kapoor/Downloads/uat-dashboard/1%202/public/css/base.css)**: 
    *   Defines the main body background (`#0f0f1a`).
    *   Contains global keyframes for animations (fadeIn, float, pulse).
    *   Sets baseline typography (Inter font).

### UI Components & Colors
*   **[`public/css/components.css`](file:///c:/Users/Shikhar%20Kapoor/Downloads/uat-dashboard/1%202/public/css/components.css)**: 
    *   **Cards**: Background transparency, borders, and shadows.
    *   **Buttons**: Gradients (e.g., Purple to Indigo for `.btn-primary`), hover effects, and size variants.
    *   **Inputs**: Design for textboxes, selects, and textareas.
    *   **Status Badges**: Color coding for "Backlog" (Red), "Pending" (Amber), "In Progress" (Blue), "Solved" (Green).
    *   **Tables**: Responsive layout and horizontal scrolling behavior.

### Layout & Navigation
*   **[`public/css/layout.css`](file:///c:/Users/Shikhar%20Kapoor/Downloads/uat-dashboard/1%202/public/css/layout.css)**: 
    *   **Sidebar**: Width, blur effects, navigation button styles, and the collapsed state.
    *   **Header**: Styling for the theme toggle, notification bell, and mobile responsiveness.

### Appearance Modes
*   **[`public/css/theme.css`](file:///c:/Users/Shikhar%20Kapoor/Downloads/uat-dashboard/1%202/public/css/theme.css)**: 
    *   Contains specific color overrides for **Light Mode**. 
    *   Edit this file to adjust how high-contrast or light versions of the UI appear.
*   **[`public/css/login.css`](file:///c:/Users/Shikhar%20Kapoor/Downloads/uat-dashboard/1%202/public/css/login.css)**: 
    *   Dedicated styling for the authentication/login screen.

---

## 🚀 Getting Started
1.  **Backend**: Run the Node.js server using `node server.js`.
2.  **Frontend**: The static files are located in the `public/` directory.
3.  **Authentication**: Use the Login screen to access the dashboard roles (Admin, Internal, or External Client).

---

## 📁 Technical Overview
*   **HTML**: `public/index.html` (Main structure).
*   **JavaScript**: Logic is segmented into `app.js`, `ui.js`, `auth.js`, `projects.js`, etc.
*   **API**: Backend routes are located in the `api/` directory.
