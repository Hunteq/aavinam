import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  Settings,
  Store,
  History,
  Menu,
  X,
  PlusCircle,
  Bell,
  Building2,
  Receipt,
  BarChart3,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

import BranchSelector from './BranchSelector';
import { useBranch } from '../context/BranchContext';
import { useUser } from '../context/UserContext';
import { useLanguage } from '../context/LanguageContext';
import { LogOut } from 'lucide-react';

const Layout = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const { currentBranch } = useBranch();
  const { user, isFarmer, isOwner, isMember, logout } = useUser();
  const { t } = useLanguage();

  // Handle window resize for responsiveness
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const navItems = [
    { name: t('common.dashboard'), path: '/', icon: LayoutDashboard, roles: ['owner', 'member', 'farmer'] },
    { name: t('common.farmers'), path: '/farmers', icon: Users, roles: ['owner', 'member', 'farmer'] },
    { name: t('common.entries'), path: '/entries', icon: ClipboardList, roles: ['owner', 'member', 'farmer'] },
    { name: t('common.billing'), path: '/billing', icon: Receipt, roles: ['owner', 'member'] },
    { name: t('common.reports'), path: '/reports', icon: BarChart3, roles: ['owner', 'member', 'farmer'] },
    { name: t('common.products'), path: '/products', icon: Store, roles: ['owner', 'member', 'farmer'] },
    { name: t('common.branches'), path: '/branches', icon: Building2, roles: ['farmer'] },
    { name: t('common.notifications'), path: '/notifications', icon: Bell, roles: ['owner', 'member'] },
    // { name: t('common.rates'), path: '/rates', icon: Settings, roles: ['owner', 'member'] },
    { name: t('common.settings'), path: '/profile', icon: Settings, roles: ['owner', 'member', 'farmer'] },
  ].filter(item => item.roles.includes(user?.userType));

  return (
    <div className="layout-container">
      {/* Desktop Sidebar (visible only on desktop/laptop) */}
      {!isMobile && (
        <aside className={`sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`}>
          <div className="sidebar-header">
            <div className="logo">
              <span className="logo-icon">🥛</span>
              {!isSidebarCollapsed && <span className="logo-text">Milk App</span>}
            </div>
            <button
              className="collapse-btn"
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              title={isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            >
              {isSidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            </button>
          </div>

          <nav className="nav-menu">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                title={isSidebarCollapsed ? item.name : ""}
              >
                <div className="icon-wrapper">
                  <item.icon size={22} strokeWidth={2.5} />
                </div>
                {!isSidebarCollapsed && <span className="nav-text">{item.name}</span>}
              </NavLink>
            ))}
          </nav>

          <div className="sidebar-footer">
            <button className="logout-btn" onClick={logout}>
              <LogOut size={18} />
              {!isSidebarCollapsed && <span>{t('common.logout')}</span>}
            </button>
            {!isSidebarCollapsed && <div className="version">v1.0.0 Alpha</div>}
          </div>
        </aside>
      )}

      {/* Mobile Bottom Navigation (visible only on mobile) */}
      {isMobile && (
        <nav className="mobile-bottom-nav">
          <div className="bottom-nav-grid">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => `bottom-nav-link ${isActive ? 'active' : ''}`}
              >
                <item.icon size={22} />
                <span className="bottom-nav-text">{item.name}</span>
              </NavLink>
            ))}
          </div>
        </nav>
      )}

      {/* Main Content Area */}
      <main className={`main-content ${!isMobile ? (isSidebarCollapsed ? 'sidebar-min' : 'sidebar-max') : 'mobile-view'}`}>
        <header className="top-bar">
          <div className="top-bar-left">
            {!isFarmer && <BranchSelector />}
            {isFarmer && <div className="farmer-badge">{t('onboarding.farmer')}: {user?.name}</div>}
          </div>
          <div className="top-bar-right">
            {!isFarmer && (
              <button className="btn-icon" onClick={() => navigate('/notifications')}>
                <Bell size={20} />
              </button>
            )}
            {isMobile && (
              <button className="btn-icon logout-mobile" onClick={logout}>
                <LogOut size={20} />
              </button>
            )}
          </div>
        </header>

        <div className="content-area">
          {children}
        </div>
      </main>

      <style dangerouslySetInnerHTML={{
        __html: `
        :root {
          --sidebar-width-expanded: 260px;
          --sidebar-width-collapsed: 80px;
          --sidebar-bg: #1b4332;
          --sidebar-hover: rgba(255, 255, 255, 0.08);
          --primary-color: #2d6a4f;
          --transition-speed: 0.3s;
        }

        .layout-container {
          display: flex;
          min-height: 100vh;
          background: #f8fafc;
        }

        /* Sidebar Styles */
        .sidebar {
          width: var(--sidebar-width-expanded);
          background: var(--sidebar-bg);
          color: white;
          display: flex;
          flex-direction: column;
          position: fixed;
          left: 0;
          top: 0;
          bottom: 0;
          z-index: 1000;
          transition: width var(--transition-speed) cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 4px 0 15px rgba(0, 0, 0, 0.1);
          overflow: hidden;
        }

        .sidebar.collapsed {
          width: var(--sidebar-width-collapsed);
        }

        .sidebar-header {
          height: 70px;
          padding: 0 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .logo {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 1.25rem;
          font-weight: 800;
          white-space: nowrap;
        }

        .logo-icon {
          font-size: 1.5rem;
        }

        .collapse-btn {
          background: rgba(255, 255, 255, 0.1);
          border: none;
          color: white;
          width: 32px;
          height: 32px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s;
        }

        .collapse-btn:hover {
          background: rgba(255, 255, 255, 0.2);
          transform: scale(1.05);
        }

        .nav-menu {
          padding: 24px 12px;
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 8px;
          overflow-y: auto;
          scrollbar-width: none;
        }

        .nav-menu::-webkit-scrollbar {
          display: none;
        }

        .nav-link {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 12px 14px;
          color: rgba(255, 255, 255, 0.75);
          text-decoration: none;
          border-radius: 12px;
          transition: all 0.25s ease;
          position: relative;
          white-space: nowrap;
        }

        .nav-link:hover {
          background: var(--sidebar-hover);
          color: white;
          transform: translateX(4px);
        }

        .sidebar.collapsed .nav-link:hover {
          transform: none;
          background: rgba(255, 255, 255, 0.15);
        }

        .nav-link.active {
          background: white;
          color: var(--sidebar-bg);
          font-weight: 700;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }

        .nav-link.active .icon-wrapper {
          transform: scale(1.1);
        }

        .icon-wrapper {
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.2s;
          min-width: 24px;
        }

        .nav-link:hover .icon-wrapper {
          transform: scale(1.15);
        }

        .sidebar.collapsed .nav-link {
          justify-content: center;
          padding: 12px 0;
        }

        .sidebar-footer {
          padding: 20px 12px;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
          font-size: 0.75rem;
          color: rgba(255, 255, 255, 0.5);
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .logout-btn {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px;
          background: rgba(239, 68, 68, 0.1);
          color: #fca5a5;
          border: 1px solid rgba(239, 68, 68, 0.2);
          border-radius: 8px;
          cursor: pointer;
          transition: 0.2s;
          width: 100%;
          font-weight: 600;
        }

        .logout-btn:hover {
          background: rgba(239, 68, 68, 0.2);
          color: white;
        }

        .sidebar.collapsed .logout-btn {
          justify-content: center;
          padding: 10px 0;
        }

        .farmer-badge {
          background: #f0fdf4;
          color: #166534;
          padding: 6px 12px;
          border-radius: 8px;
          font-weight: 700;
          font-size: 0.9rem;
          border: 1px solid #bbf7d0;
        }

        .logout-mobile {
          color: #ef4444 !important;
          border-color: #fee2e2 !important;
          background: #fef2f2 !important;
        }

        /* Main Content Styles */
        .main-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-width: 0;
          transition: margin-left var(--transition-speed) cubic-bezier(0.4, 0, 0.2, 1);
        }

        .main-content.sidebar-max {
          margin-left: var(--sidebar-width-expanded);
        }

        .main-content.sidebar-min {
          margin-left: var(--sidebar-width-collapsed);
        }

        .main-content.mobile-view {
          margin-left: 0;
          margin-bottom: 70px; /* Space for bottom nav */
        }

        .top-bar {
          height: 70px;
          background: white;
          border-bottom: 1px solid #e2e8f0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 24px;
          position: sticky;
          top: 0;
          z-index: 900;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
        }

        .top-bar-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .top-bar-right {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .content-area {
          padding: 24px;
          flex: 1;
        }

        @media (max-width: 768px) {
          .content-area {
            padding: 16px;
          }
        }

        /* Mobile Bottom Nav Styles */
        .mobile-bottom-nav {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          height: 70px;
          background: white;
          border-top: 1px solid #e2e8f0;
          box-shadow: 0 -4px 15px rgba(0, 0, 0, 0.05);
          z-index: 1100;
          display: flex;
          align-items: center;
          padding: 0 8px;
        }

        .bottom-nav-grid {
          display: flex;
          justify-content: space-around;
          align-items: center;
          width: 100%;
          gap: 2px;
        }

        .bottom-nav-link {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 4px;
          color: #64748b;
          text-decoration: none;
          font-size: 0.6rem;
          font-weight: 600;
          transition: all 0.2s;
          padding: 6px 4px;
          border-radius: 12px;
          flex: 1;
          min-width: 0;
        }

        .bottom-nav-link.active {
          color: var(--primary-color);
          background: #f0fdf4;
        }

        .bottom-nav-link.active svg {
          stroke-width: 3px;
          transform: translateY(-2px);
        }

        .bottom-nav-text {
          text-align: center;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          width: 100%;
          display: none; /* Hide text on very small screens or keep it minimal */
        }

        @media (min-width: 480px) {
          .bottom-nav-text {
            display: block;
          }
        }

        .btn-icon {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          border: 1px solid #e2e8f0;
          background: white;
          color: #64748b;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-icon:hover {
          background: #f8fafc;
          border-color: var(--primary-color);
          color: var(--primary-color);
        }
      `}} />
    </div>
  );
};

export default Layout;
