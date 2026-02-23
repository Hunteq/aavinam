import React, { useState, useEffect, useMemo } from 'react';
import { useBranch } from '../context/BranchContext';
import { useUser } from '../context/UserContext';
import { db } from '../db/db';
import { filterEntries } from '../utils/billingUtils';
import { format, subDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from 'date-fns';
import {
    TrendingUp,
    Droplet,
    IndianRupee,
    Sun,
    Moon,
    Milk,
    LayoutGrid,
    Clock
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

const Reports = () => {
    const { currentBranch } = useBranch();
    const { user, isFarmer } = useUser();
    const { t } = useLanguage();

    // State
    const [dateRange, setDateRange] = useState({
        startDate: format(new Date(), 'yyyy-MM-dd'),
        endDate: format(new Date(), 'yyyy-MM-dd')
    });
    const [period, setPeriod] = useState('daily');
    const [selectedShift, setSelectedShift] = useState('all');

    const [entries, setEntries] = useState([]);
    const [farmers, setFarmers] = useState([]);
    const [loading, setLoading] = useState(false);

    // Load Data
    useEffect(() => {
        if (currentBranch) {
            loadData();
        }
    }, [currentBranch, dateRange, selectedShift]);

    // Quick Date Filters
    const handlePeriodChange = (newPeriod) => {
        setPeriod(newPeriod);
        const today = new Date();
        let start = today;
        let end = today;

        if (newPeriod === 'daily') {
            start = today;
            end = today;
        } else if (newPeriod === 'weekly') {
            start = startOfWeek(today, { weekStartsOn: 1 });
            end = endOfWeek(today, { weekStartsOn: 1 });
        } else if (newPeriod === 'monthly') {
            start = startOfMonth(today);
            end = endOfMonth(today);
        }
        // custom keeps current range

        setDateRange({
            startDate: format(start, 'yyyy-MM-dd'),
            endDate: format(end, 'yyyy-MM-dd')
        });
    };

    const loadData = async () => {
        setLoading(true);
        try {
            const [allFarmers, allEntries] = await Promise.all([
                db.farmers.where({ branchId: currentBranch.id }).toArray(),
                db.entries.toArray()
            ]);

            let filtered = filterEntries(allEntries, dateRange, currentBranch.id, selectedShift);

            // Role-based filtering
            if (isFarmer) {
                filtered = filtered.filter(e => e.farmerId === user.id);
            }

            // Sort by date descending (newest first)
            filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

            setFarmers(allFarmers);
            setEntries(filtered);
        } catch (error) {
            console.error("Error loading report data:", error);
        } finally {
            setLoading(false);
        }
    };

    // --- Statistics ---
    const stats = useMemo(() => {
        const s = {
            totalLiters: 0,
            totalAmount: 0,
            avgFat: 0,
            avgSnf: 0,
            cow: { quantity: 0, amount: 0, count: 0 },
            buffalo: { quantity: 0, amount: 0, count: 0 },
            morning: { quantity: 0, amount: 0, count: 0 },
            evening: { quantity: 0, amount: 0, count: 0 }
        };

        let fatSum = 0, snfSum = 0;

        entries.forEach(e => {
            const qty = Number(e.quantity);
            const amt = Number(e.amount);

            s.totalLiters += qty;
            s.totalAmount += amt;

            fatSum += Number(e.fat);
            snfSum += Number(e.snf);

            // Type
            const type = e.milkType?.toLowerCase().includes('buffalo') ? 'buffalo' : 'cow';
            s[type].quantity += qty;
            s[type].amount += amt;
            s[type].count += 1;

            // Shift
            const shift = e.shift?.toLowerCase() || 'morning';
            if (s[shift]) {
                s[shift].quantity += qty;
                s[shift].amount += amt;
                s[shift].count += 1;
            }

            // Farmer Stats
            if (!s.farmerStats) s.farmerStats = {};
            if (!s.farmerStats[e.farmerId]) {
                const farmer = farmers.find(f => f.id === e.farmerId);
                s.farmerStats[e.farmerId] = {
                    name: farmer ? farmer.name : `Farmer #${e.farmerId}`,
                    type: e.milkType,
                    quantity: 0,
                    amount: 0,
                    fatSum: 0,
                    count: 0
                };
            }
            s.farmerStats[e.farmerId].quantity += qty;
            s.farmerStats[e.farmerId].amount += amt;
            s.farmerStats[e.farmerId].fatSum += Number(e.fat);
            s.farmerStats[e.farmerId].count += 1;
        });

        // Finalize Farmer Averages
        if (s.farmerStats) {
            Object.values(s.farmerStats).forEach(f => {
                f.avgFat = f.count > 0 ? f.fatSum / f.count : 0;
            });
        }

        if (entries.length > 0) {
            s.avgFat = fatSum / entries.length;
            s.avgSnf = snfSum / entries.length;
        }

        return s;
    }, [entries]);

    // --- Render ---
    return (
        <div className="reports-page">
            <div className="page-header hide-on-print">
                <div className="header-content">
                    <h1>{t('reports.title')}</h1>
                    <p className="subtitle">{currentBranch?.name} • {t('reports.subtitle')}</p>
                </div>

                <div className="controls-area">
                    <div className="period-selector">
                        <button className={period === 'daily' ? 'active' : ''} onClick={() => handlePeriodChange('daily')}>{t('reports.daily')}</button>
                        <button className={period === 'weekly' ? 'active' : ''} onClick={() => handlePeriodChange('weekly')}>{t('reports.weekly')}</button>
                        <button className={period === 'monthly' ? 'active' : ''} onClick={() => handlePeriodChange('monthly')}>{t('reports.monthly')}</button>
                    </div>

                    <div className="date-inputs">
                        <input type="date" value={dateRange.startDate} onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })} />
                        <span>to</span>
                        <input type="date" value={dateRange.endDate} onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })} />
                    </div>

                    <div className="shift-selector">
                        <select value={selectedShift} onChange={(e) => setSelectedShift(e.target.value)}>
                            <option value="all">{t('reports.allShifts')}</option>
                            <option value="morning">{t('common.morning')}</option>
                            <option value="evening">{t('common.evening')}</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Main Stats Cards */}
            <div className="stats-grid">
                <div className="stat-card primary">
                    <div className="icon-box"><Droplet size={24} /></div>
                    <div className="info">
                        <span className="label">{t('reports.totalLiters')}</span>
                        <span className="value">{stats.totalLiters.toFixed(2)} L</span>
                    </div>
                </div>
                <div className="stat-card success">
                    <div className="icon-box"><IndianRupee size={24} /></div>
                    <div className="info">
                        <span className="label">{t('reports.totalAmount')}</span>
                        <span className="value">₹ {stats.totalAmount.toFixed(2)}</span>
                    </div>
                </div>
                <div className="stat-card info">
                    <div className="icon-box"><TrendingUp size={24} /></div>
                    <div className="info">
                        <span className="label">{t('reports.avgFatSnf')}</span>
                        <span className="value">{stats.avgFat.toFixed(1)} / {stats.avgSnf.toFixed(1)}</span>
                    </div>
                </div>
            </div>

            <div className="breakdown-grid">
                {/* Milk Type Breakdown */}
                <div className="report-card">
                    <div className="card-header">
                        <h3>{t('reports.milkTypeAnalysis')}</h3>
                        <Milk size={20} className="text-gray-400" />
                    </div>
                    <div className="type-row">
                        <div className="type-item cow">
                            <span className="t-name">🐄 {t('reports.cowMilk')}</span>
                            <div className="t-stats">
                                <strong className="qty">{stats.cow.quantity.toFixed(1)} L</strong>
                                <span className="amt">₹ {stats.cow.amount.toFixed(0)}</span>
                            </div>
                            <div className="progress-bar">
                                <div className="fill" style={{ width: `${(stats.cow.quantity / (stats.totalLiters || 1)) * 100}%` }}></div>
                            </div>
                        </div>
                        <div className="type-item buffalo">
                            <span className="t-name">🐃 {t('reports.buffaloMilk')}</span>
                            <div className="t-stats">
                                <strong className="qty">{stats.buffalo.quantity.toFixed(1)} L</strong>
                                <span className="amt">₹ {stats.buffalo.amount.toFixed(0)}</span>
                            </div>
                            <div className="progress-bar">
                                <div className="fill" style={{ width: `${(stats.buffalo.quantity / (stats.totalLiters || 1)) * 100}%` }}></div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Shift Breakdown */}
                <div className="report-card">
                    <div className="card-header">
                        <h3>{t('reports.shiftPerformance')}</h3>
                        <Sun size={20} className="text-gray-400" />
                    </div>
                    <div className="shift-row">
                        <div className="shift-box">
                            <div className="s-icon sun"><Sun size={24} /></div>
                            <div className="s-info">
                                <span className="s-label">{t('common.morning')}</span>
                                <span className="s-val">{stats.morning.quantity.toFixed(1)} L</span>
                                <span className="s-sub">₹ {stats.morning.amount.toFixed(0)}</span>
                            </div>
                        </div>
                        <div className="shift-box">
                            <div className="s-icon moon"><Moon size={24} /></div>
                            <div className="s-info">
                                <span className="s-label">{t('common.evening')}</span>
                                <span className="s-val">{stats.evening.quantity.toFixed(1)} L</span>
                                <span className="s-sub">₹ {stats.evening.amount.toFixed(0)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Recent Collections Table */}
            <div className="report-card full-width">
                <div className="card-header">
                    <h3>{t('reports.recentCollections')}</h3>
                    <Clock size={20} className="text-gray-400" />
                </div>
                <div className="table-wrapper">
                    <table className="mini-table">
                        <thead>
                            <tr>
                                <th>{t('common.date')}</th>
                                <th>{t('collection.farmer')}</th>
                                <th>{t('collection.shift')}</th>
                                <th>{t('collection.milkType')}</th>
                                <th>{t('collection.quantity')}</th>
                                <th>{t('collection.fat')}</th>
                                <th>{t('collection.snf')}</th>
                                <th>{t('collection.rate')}</th>
                                <th>{t('collection.amount')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {entries.length > 0 ? (
                                entries.map((entry, i) => {
                                    const farmer = farmers.find(f => f.id === entry.farmerId);
                                    return (
                                        <tr key={i}>
                                            <td>{format(new Date(entry.date), 'dd MMM yyyy')}</td>
                                            <td><span className="fw-600">{farmer?.name || `Farmer #${entry.farmerId}`}</span></td>
                                            <td style={{ textTransform: 'capitalize' }}>{entry.shift}</td>
                                            <td>{entry.milkType}</td>
                                            <td>{Number(entry.quantity).toFixed(2)}</td>
                                            <td>{Number(entry.fat).toFixed(1)}</td>
                                            <td>{Number(entry.snf).toFixed(1)}</td>
                                            <td>₹{Number(entry.rate).toFixed(2)}</td>
                                            <td className="text-primary fw-600">₹{Number(entry.amount).toFixed(2)}</td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan="9" className="text-center">{t('reports.noEntries')}</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>


            <style dangerouslySetInnerHTML={{
                __html: `
          .reports-page { display: flex; flex-direction: column; gap: 24px; padding-bottom: 40px; }
          .page-header { display: flex; justify-content: space-between; align-items: flex-end; padding: 20px; background: white; border-radius: 12px; border: 1px solid #e2e8f0; flex-wrap: wrap; gap: 16px; }
          .header-content h1 { font-size: 1.5rem; margin: 0; color: #1e293b; }
          .subtitle { color: #64748b; margin: 4px 0 0 0; font-size: 0.9rem; }
          
          .controls-area { display: flex; gap: 16px; align-items: center; flex-wrap: wrap; }
          .period-selector { display: flex; background: #f1f5f9; padding: 4px; border-radius: 8px; border: 1px solid #cbd5e1; }
          .period-selector button { padding: 6px 12px; border: none; background: transparent; border-radius: 6px; font-weight: 600; color: #64748b; cursor: pointer; transition: all 0.2s; }
          .period-selector button.active { background: white; color: #3b82f6; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
          
          .shift-selector select { padding: 8px; border: 1px solid #cbd5e1; border-radius: 6px; color: #334155; font-weight: 500; background: white; }

          .date-inputs { display: flex; align-items: center; gap: 8px; font-weight: 500; }
          .date-inputs input { padding: 8px; border: 1px solid #cbd5e1; border-radius: 6px; color: #334155; }

          .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; }
          .stat-card { background: white; padding: 20px; border-radius: 16px; border: 1px solid var(--border); display: flex; align-items: center; gap: 16px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
          .stat-card .icon-box { width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; background: #f8fafc; color: var(--secondary); }
          .stat-card.primary .icon-box { background: #eff6ff; color: #3b82f6; }
          .stat-card.success .icon-box { background: #f0fdf4; color: #22c55e; }
          .stat-card.info .icon-box { background: #f5f3ff; color: #8b5cf6; }

          .stat-card .info { display: flex; flex-direction: column; }
          .stat-card .label { font-size: 0.85rem; color: #64748b; font-weight: 600; }
          .stat-card .value { font-size: 1.5rem; font-weight: 800; color: var(--secondary); }

          .breakdown-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 24px; }
          .report-card { background: white; border-radius: 16px; border: 1px solid var(--border); padding: 20px; display: flex; flex-direction: column; gap: 16px; }
          .card-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #f1f5f9; padding-bottom: 12px; margin-bottom: 4px; }
          .card-header h3 { margin: 0; font-size: 1.1rem; color: var(--secondary); }

          .type-row { display: flex; flex-direction: column; gap: 16px; }
          .type-item { display: flex; flex-direction: column; gap: 8px; }
          .t-name { font-size: 0.9rem; font-weight: 700; color: #475569; }
          .t-stats { display: flex; justify-content: space-between; align-items: baseline; }
          .t-stats .qty { font-size: 1.25rem; color: var(--secondary); }
          .t-stats .amt { font-weight: 600; color: var(--primary); }
          
          .progress-bar { height: 8px; background: #f1f5f9; border-radius: 4px; overflow: hidden; }
          .type-item.cow .fill { background: #4ade80; height: 100%; border-radius: 4px; }
          .type-item.buffalo .fill { background: #60a5fa; height: 100%; border-radius: 4px; }

          .shift-row { display: flex; gap: 16px; }
          .shift-box { flex: 1; background: #f8fafc; padding: 16px; border-radius: 12px; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 10px; }
          .s-icon { width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
          .s-icon.sun { background: #fff7ed; color: #f97316; }
          .s-icon.moon { background: #f5f3ff; color: #6366f1; }
          
          .s-info { display: flex; flex-direction: column; gap: 2px; }
          .s-label { font-size: 0.8rem; font-weight: 700; color: #64748b; text-transform: uppercase; }
          .s-val { font-size: 1.2rem; font-weight: 800; color: var(--secondary); }
          .s-sub { font-size: 0.9rem; font-weight: 600; color: var(--primary); }

          .full-width { grid-column: 1 / -1; }
          .table-wrapper { overflow-x: auto; }
          .mini-table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
          .mini-table th { text-align: left; padding: 12px; color: #64748b; font-weight: 600; border-bottom: 2px solid #e2e8f0; }
          .mini-table td { padding: 12px; border-bottom: 1px solid #f1f5f9; color: #334155; }
          .text-center { text-align: center; }
          .text-primary { color: var(--primary); }
          .fw-600 { font-weight: 600; }

          @media (max-width: 768px) {
              .reports-page { gap: 16px; }
              .page-header { flex-direction: column; align-items: stretch; }
              .controls-area { flex-direction: column; width: 100%; }
              .period-selector { width: 100%; }
              .date-inputs { flex-direction: column; width: 100%; }
              .date-inputs input { width: 100%; }
              .stats-grid { grid-template-columns: 1fr; gap: 12px; }
              .breakdown-grid { grid-template-columns: 1fr; gap: 16px; }
              .shift-row { flex-direction: column; }
              .table-wrapper { overflow-x: auto; -webkit-overflow-scrolling: touch; }
              .mini-table th, .mini-table td { padding: 8px 6px; font-size: 0.8rem; }
          }
        `
            }} />
        </div>
    );
};

export default Reports;
