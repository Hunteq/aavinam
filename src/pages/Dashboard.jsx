import React, { useEffect, useState } from 'react';
import { useBranch } from '../context/BranchContext';
import { db } from '../db/db';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { useLanguage } from '../context/LanguageContext';
import { Users, Droplets, TrendingUp, IndianRupee, PlusSquare, UserPlus, FileText, Send, ArrowRight, Clock, ShieldAlert, Receipt } from 'lucide-react';
import { format } from 'date-fns';


const Dashboard = () => {
  const { currentBranch, addBranch } = useBranch();
  const { user, isFarmer } = useUser();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [stats, setStats] = useState({
    farmers: 0,
    todayLiters: 0,
    avgFat: 0,
    avgSnf: 0,
    totalToday: 0
  });

  const [societyName, setSocietyName] = useState('');

  const [recentEntries, setRecentEntries] = useState([]);
  const [farmers, setFarmers] = useState([]);

  useEffect(() => {
    loadSocietyName();
    if (currentBranch) {
      loadStats();
      loadRecentEntries();
    }
  }, [currentBranch]);

  const loadSocietyName = async () => {
    const globalSettings = await db.settings.get('global');
    if (globalSettings && globalSettings.societyName) {
      setSocietyName(globalSettings.societyName);
    }
  };

  const loadStats = async () => {
    if (!currentBranch) return;

    try {
      const farmerCount = await db.farmers.where('branchId').equals(currentBranch.id).count();

      // Get today's date in local format YYYY-MM-DD
      const today = format(new Date(), 'yyyy-MM-dd');

      // Fetch today's entries using optimized WHERE clause
      const query = { branchId: currentBranch.id, date: today };
      if (isFarmer) query.farmerId = user.id;

      const todayEntries = await db.entries
        .where(query)
        .toArray();

      const totalLiters = todayEntries.reduce((sum, e) => sum + Number(e.quantity || 0), 0);
      const totalAmount = todayEntries.reduce((sum, e) => sum + Number(e.amount || 0), 0);

      // Calculate weighted averages
      let totalFatProduct = 0;
      let totalSnfProduct = 0;

      todayEntries.forEach(e => {
        totalFatProduct += Number(e.fat || 0) * Number(e.quantity || 0);
        totalSnfProduct += Number(e.snf || 0) * Number(e.quantity || 0);
      });

      const avgFat = totalLiters > 0 ? totalFatProduct / totalLiters : 0;
      const avgSnf = totalLiters > 0 ? totalSnfProduct / totalLiters : 0;

      setStats({
        farmers: farmerCount,
        todayLiters: totalLiters,
        avgFat: avgFat,
        avgSnf: avgSnf,
        totalToday: totalAmount
      });
    } catch (error) {
      console.error("Error loading dashboard stats:", error);
    }
  };

  const loadRecentEntries = async () => {
    const query = { branchId: currentBranch.id };
    if (isFarmer) query.farmerId = user.id;

    const entries = await db.entries
      .where(query)
      .reverse()
      .limit(5)
      .toArray();

    const farmersList = await db.farmers.where('branchId').equals(currentBranch.id).toArray();

    setRecentEntries(entries);
    setFarmers(farmersList);
  };

  if (!currentBranch) {
    return (
      <div className="empty-state card" style={{ maxWidth: '600px', margin: '40px auto', textAlign: 'center' }}>
        <h2>{t('onboarding.welcome')}</h2>
        <p>{t('onboarding.startCreatingBranch') || "Start by creating your first Milk Society or Shop branch."}</p>

        <form onSubmit={async (e) => {
          e.preventDefault();
          const name = e.target.branchName.value;
          const type = e.target.branchType.value;
          const memberName = e.target.memberName.value;
          const memberMobile = e.target.memberMobile.value;
          const location = e.target.location.value;

          try {
            await addBranch({
              name,
              type,
              memberName,
              memberMobile,
              location,
              createdAt: new Date()
            });

            alert('Branch created successfully!');
          } catch (err) {
            console.error(err);
            alert('Failed to create branch: ' + err.message);
          }
        }} style={{ marginTop: '24px', textAlign: 'left' }}>

          <div className="form-grid-2">
            <div className="form-group">
              <label>{t('onboarding.branchName') || "Branch Name"}</label>
              <input name="branchName" type="text" className="rural-input" placeholder="e.g. Main Milk Society" required />
            </div>
            <div className="form-group">
              <label>{t('onboarding.branchType') || "Branch Type"}</label>
              <select name="branchType" className="rural-input">
                <option value="society">🏫 Milk Society</option>
                <option value="shop">🏪 Milk Shop</option>
              </select>
            </div>
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label>Branch Member Name</label>
              <input name="memberName" type="text" className="rural-input" placeholder="Manager Name" required />
            </div>
            <div className="form-group">
              <label>Member Mobile Number</label>
              <input name="memberMobile" type="tel" className="rural-input" placeholder="Mobile Number" required />
            </div>
          </div>

          <div className="form-group">
            <label>Location</label>
            <input name="location" type="text" className="rural-input" placeholder="e.g. Salem West" required />
          </div>


          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '10px' }}>
            Create Branch & Get Started
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <div className="header-section">
        <h1 style={{ color: 'var(--primary)', marginBottom: '4px' }}>
          {societyName || 'Milk App'}
        </h1>
        <div className="branch-meta" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', color: '#64748b', fontSize: '0.95rem', fontWeight: '600' }}>
          <span className="branch-badge" style={{ background: '#eff6ff', color: '#2563eb', padding: '2px 8px', borderRadius: '6px', fontSize: '0.8rem', textTransform: 'uppercase' }}>
            {currentBranch.name}
          </span>
          <span>•</span>
          <span>📍 {currentBranch.location}</span>
          <span>•</span>
          <span>👤 {currentBranch.memberName} ({currentBranch.memberMobile})</span>
        </div>
      </div>



      <div className="stats-grid">
        {!isFarmer && <StatCard icon={<Users color="#2d6a4f" />} label={t('dashboard.activeFarmers')} value={stats.farmers} color="#ecfdf5" />}
        <StatCard icon={<Droplets color="#2563eb" />} label={isFarmer ? t('dashboard.myMilkToday') : t('dashboard.todaysLitres')} value={`${stats.todayLiters.toFixed(1)} L`} color="#eff6ff" />
        <StatCard icon={<TrendingUp color="#ea580c" />} label={isFarmer ? t('dashboard.myAvgFatSnf') : t('dashboard.avgFatSnf')} value={`${stats.avgFat.toFixed(1)} / ${stats.avgSnf.toFixed(1)}`} color="#fff7ed" />
        <StatCard icon={<IndianRupee color="#16a34a" />} label={isFarmer ? t('dashboard.myEarningToday') : t('dashboard.todaysAmount')} value={`₹${stats.totalToday.toFixed(0)}`} color="#f0fdf4" />
      </div>

      <div className="dashboard-sections">
        <div className="card">
          <h3>{t('dashboard.quickActions')}</h3>
          <div className="action-grid">
            <button className="action-btn" onClick={() => navigate('/entries')}>
              <div className="action-icon-wrapper" style={{ background: '#eff6ff' }}><PlusSquare color="#2563eb" size={24} /></div>
              <span>{isFarmer ? t('dashboard.myEntries') : t('dashboard.newEntry')}</span>
            </button>
            {!isFarmer && (
              <button className="action-btn" onClick={() => navigate('/farmers')}>
                <div className="action-icon-wrapper" style={{ background: '#ecfdf5' }}><UserPlus color="#16a34a" size={24} /></div>
                <span>{t('dashboard.addFarmer')}</span>
              </button>
            )}
            <button className="action-btn" onClick={() => navigate(isFarmer ? '/reports' : '/billing')}>
              <div className="action-icon-wrapper" style={{ background: '#fef3c7' }}>
                {isFarmer ? <FileText color="#d97706" size={24} /> : <Receipt color="#d97706" size={24} />}
              </div>
              <span>{isFarmer ? t('common.reports') : t('common.billing')}</span>
            </button>
            {!isFarmer && (
              <button className="action-btn" onClick={() => navigate('/notifications')}>
                <div className="action-icon-wrapper" style={{ background: '#f5f3ff' }}><Send color="#7c3aed" size={24} /></div>
                <span>{t('dashboard.sendAlert')}</span>
              </button>
            )}
            {isFarmer && (
              <button className="action-btn" onClick={() => navigate('/products')}>
                <div className="action-icon-wrapper" style={{ background: '#f5f3ff' }}><TrendingUp color="#7c3aed" size={24} /></div>
                <span>{t('common.products')}</span>
              </button>
            )}
          </div>
        </div>

        <div className="card recent-entries-card">
          <div className="card-header-flex" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3><Clock size={20} /> {t('dashboard.recentCollections')}</h3>
            <button
              className="btn btn-ghost"
              onClick={() => navigate('/reports')}
              style={{
                fontSize: '0.8rem',
                padding: '4px 8px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontWeight: '600',
                color: 'var(--primary)'
              }}
            >
              {t('common.viewAll')} <ArrowRight size={14} />
            </button>
          </div>

          {recentEntries.length > 0 ? (
            <div className="recent-list">
              {recentEntries.map(entry => {
                const farmer = farmers.find(f => f.id === entry.farmerId);
                return (
                  <div key={entry.id} className="recent-item">
                    <div className="recent-info">
                      <span className="farmer-name">{farmer?.name || 'Unknown'}</span>
                      <span className="entry-meta">
                        {format(new Date(entry.date), 'dd MMM')} • {entry.shift} • {entry.milkType}
                      </span>
                    </div>
                    <div className="recent-values">
                      <span className="qty">{entry.quantity.toFixed(1)} L</span>
                      <span className="amt">₹{entry.amount.toFixed(0)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="empty-recent">{t('dashboard.noEntries')}</div>
          )}
        </div>

      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
        .dashboard {
          display: flex;
          flex-direction: column;
          gap: 32px;
        }

        .header-section h1 {
          font-size: 2rem;
          margin-bottom: 4px;
        }

        .subtitle {
          color: var(--text-muted);
          font-weight: 500;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 20px;
        }

        .stat-card {
          padding: 24px;
          border-radius: var(--radius-lg);
          display: flex;
          flex-direction: column;
          gap: 12px;
          box-shadow: var(--shadow);
          background: white;
          border: 1px solid var(--border);
        }

        .stat-icon {
          width: 48px;
          height: 48px;
          border-radius: var(--radius-md);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .stat-info .label {
          color: var(--text-muted);
          font-size: 0.9rem;
          font-weight: 600;
        }

        .stat-info .value {
          font-size: 1.5rem;
          font-weight: 800;
          color: var(--secondary);
        }

        .dashboard-sections {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
        }

        @media (max-width: 900px) {
          .dashboard-sections {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 768px) {
          .dashboard {
            gap: 20px;
          }

          .header-section h1 {
            font-size: 1.5rem;
          }

          .branch-meta {
            font-size: 0.85rem !important;
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 8px !important;
          }
          .branch-meta span:nth-child(even) { display: none; }

          .stats-grid {
            grid-template-columns: 1fr;
            gap: 12px;
          }

          .stat-card {
            padding: 16px;
            flex-direction: row;
            align-items: center;
            gap: 16px;
          }

          .stat-icon {
            width: 44px;
            height: 44px;
            flex-shrink: 0;
          }

          .stat-info {
            display: flex;
            flex-direction: row;
            justify-content: space-between;
            align-items: center;
            flex: 1;
          }

          .stat-info .value {
            font-size: 1.2rem;
          }

          .dashboard-sections {
            gap: 16px;
          }

          .action-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 12px;
          }

          .action-btn {
            padding: 16px 12px;
          }

          .action-btn span {
            font-size: 0.85rem;
          }

          .recent-list { gap: 10px; }
          .recent-item {
            display: flex;
            flex-direction: row;
            justify-content: space-between;
            align-items: center;
            padding: 14px;
            gap: 12px;
            border-radius: 12px;
          }

          .recent-info { gap: 2px; flex: 1; }
          .farmer-name { font-size: 0.95rem; }
          .entry-meta { font-size: 0.75rem; }

          .recent-values {
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            gap: 2px;
            min-width: 80px;
          }
          .recent-values .qty { font-size: 0.85rem; }
          .recent-values .amt { font-size: 1rem; }
        }

        @media (max-width: 480px) {
          .action-grid {
            grid-template-columns: 1fr;
          }
        }

        .action-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
          gap: 16px;
          margin-top: 20px;
        }

        .action-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          padding: 20px;
          background: #f8fafc;
          border: 1px dashed #cbd5e1;
          border-radius: var(--radius-md);
          cursor: pointer;
          transition: all 0.2s;
        }

        .action-btn:hover {
          background: #f1f5f9;
          border-color: var(--primary);
          transform: translateY(-2px);
        }

        .action-icon-wrapper {
          width: 50px;
          height: 50px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.2s;
        }

        .action-btn:hover .action-icon-wrapper {
          transform: scale(1.1);
        }

        .action-btn span {
          font-weight: 600;
          font-size: 0.9rem;
          color: var(--secondary);
        }

        .recent-entries-card h3 {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .recent-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-top: 16px;
        }

        .recent-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px;
          background: #f8fafc;
          border-radius: 10px;
          border: 1px solid var(--border);
          transition: all 0.2s;
        }

        .recent-item:hover {
          background: #f1f5f9;
          border-color: var(--primary);
        }

        .recent-info {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .farmer-name {
          font-weight: 700;
          color: var(--secondary);
          font-size: 0.9rem;
        }

        .entry-meta {
          font-size: 0.75rem;
          color: #64748b;
          font-weight: 600;
        }

        .recent-values {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 2px;
        }

        .recent-values .qty {
          font-weight: 700;
          color: var(--secondary);
          font-size: 0.85rem;
        }

        .recent-values .amt {
          font-weight: 800;
          color: var(--primary);
          font-size: 0.9rem;
        }

        .empty-recent {
          text-align: center;
          padding: 40px 20px;
          color: #94a3b8;
          font-weight: 600;
          font-size: 0.9rem;
        }

      `}} />
    </div>
  );
};

const StatCard = ({ icon, label, value, color }) => (
  <div className="stat-card">
    <div className="stat-icon" style={{ backgroundColor: color }}>
      {icon}
    </div>
    <div className="stat-info">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
    </div>
  </div>
);

export default Dashboard;
