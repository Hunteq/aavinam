import React, { useState, useEffect } from 'react';
import { useBranch } from '../context/BranchContext';
import { db } from '../db/db';
import { calculateMilkBill } from '../utils/rateCalculations';
import { Plus, History, Calendar, Sun, Moon, Search, Save, Trash2, Edit2, RotateCcw, AlertTriangle, User, TrendingUp, ShieldAlert } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { useUser } from '../context/UserContext';
import { useLanguage } from '../context/LanguageContext';

const Entries = () => {
    const { currentBranch } = useBranch();
    const { user, isFarmer, isOwner, isMember } = useUser();
    const { t } = useLanguage();
    const [farmers, setFarmers] = useState([]);
    const [activeRates, setActiveRates] = useState([]); // Store active configs for Cow & Buffalo
    const [entries, setEntries] = useState([]);
    const [shift, setShift] = useState(new Date().getHours() < 12 ? 'Morning' : 'Evening');
    const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [editingEntry, setEditingEntry] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);

    const [formData, setFormData] = useState({
        farmerId: '',
        quantity: '',
        fat: '',
        snf: '',
        milkType: 'Cow',
        qualityNote: ''
    });

    const [farmerHistory, setFarmerHistory] = useState([]);

    const [currentCalc, setCurrentCalc] = useState({ rate: 0, amount: 0 });

    useEffect(() => {
        if (currentBranch) {
            loadInitialData();
        }
    }, [currentBranch, date, shift]);

    const loadInitialData = async () => {
        const [farmersList, ratesList, todayEntries] = await Promise.all([
            db.farmers.where('branchId').equals(currentBranch.id).toArray(),
            db.rates.where({ branchId: currentBranch.id, isActive: 1 }).toArray(),
            isFarmer
                ? db.entries.where({ branchId: currentBranch.id, farmerId: user.farmerId, date, shift }).toArray()
                : db.entries.where({ branchId: currentBranch.id, date, shift }).toArray()
        ]);

        setFarmers(farmersList);
        setActiveRates(ratesList);
        setEntries(todayEntries);
    };

    const handleFarmerChange = async (id) => {
        const farmer = farmers.find(f => f.id === parseInt(id));
        if (farmer) {
            setFormData(prev => ({ ...prev, farmerId: id, milkType: farmer.milkType }));

            // Load last 5 entries for this farmer
            const history = await db.entries
                .where('farmerId')
                .equals(parseInt(id))
                .reverse()
                .limit(5)
                .toArray();
            setFarmerHistory(history);
        } else {
            setFormData(prev => ({ ...prev, farmerId: id }));
            setFarmerHistory([]);
        }
    };

    // Real-time calculation
    useEffect(() => {
        if (formData.quantity && formData.fat) {
            const activeRateRule = activeRates.find(r => r.milkType === formData.milkType);

            if (activeRateRule) {
                const calc = calculateMilkBill({
                    method: activeRateRule.method,
                    fat: parseFloat(formData.fat),
                    snf: parseFloat(formData.snf) || 0,
                    quantity: parseFloat(formData.quantity),
                    config: activeRateRule.config,
                    milkType: formData.milkType
                });
                setCurrentCalc(calc);
            } else {
                setCurrentCalc({ rate: 0, amount: 0 });
            }
        } else {
            setCurrentCalc({ rate: 0, amount: 0 });
        }
    }, [formData, activeRates]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!currentBranch) return;

        const entryData = {
            branchId: currentBranch.id,
            date,
            shift,
            farmerId: parseInt(formData.farmerId),
            milkType: formData.milkType,
            quantity: parseFloat(formData.quantity),
            fat: parseFloat(formData.fat),
            snf: parseFloat(formData.snf) || 0,
            rate: currentCalc.rate,
            amount: currentCalc.amount,
            qualityNote: formData.qualityNote,
            timestamp: new Date()
        };

        try {
            if (editingEntry) {
                await db.entries.update(editingEntry.id, entryData);
                setEditingEntry(null);
            } else {
                await db.entries.add(entryData);
            }
            setFormData({ farmerId: '', quantity: '', fat: '', snf: '', milkType: 'Cow', qualityNote: '' });
            setSearchQuery('');
            loadInitialData();
        } catch (err) {
            alert('Error saving entry: ' + err.message);
        }
    };

    const handleDelete = async (id) => {
        if (confirm('Delete this collection entry?')) {
            await db.entries.delete(id);
            loadInitialData();
        }
    };

    const handleEdit = (entry) => {
        setEditingEntry(entry);
        setFormData({
            farmerId: entry.farmerId.toString(),
            quantity: entry.quantity.toString(),
            fat: entry.fat.toString(),
            snf: entry.snf.toString(),
            milkType: entry.milkType,
            qualityNote: entry.qualityNote || ''
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // Filtering
    const filteredFarmers = farmers.filter(f =>
        f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (f.manualId && f.manualId.toString().includes(searchQuery)) ||
        f.id.toString().includes(searchQuery)
    );

    // Totals
    const totals = entries.reduce((acc, curr) => ({
        liters: acc.liters + curr.quantity,
        amount: acc.amount + curr.amount,
        avgFat: acc.avgFat + (curr.fat * curr.quantity)
    }), { liters: 0, amount: 0, avgFat: 0 });

    const avgFat = totals.liters > 0 ? (totals.avgFat / totals.liters).toFixed(1) : '0.0';

    return (
        <div className="entries-page">
            <div className="page-header">
                <div>
                    <h1>{t('common.entries') || 'Milk Collection'}</h1>
                    <p>{t('entries.registerMilkSupply') || 'Register daily milk supply'} {date}</p>
                </div>
                <div className="collection-meta">
                    <div className="meta-item">
                        <Calendar size={18} />
                        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                    </div>
                    <div className="shift-toggle">
                        <button className={`shift-btn ${shift === 'Morning' ? 'active' : ''}`} onClick={() => setShift('Morning')}>
                            <Sun size={18} /> {t('common.morning')}
                        </button>
                        <button className={`shift-btn ${shift === 'Evening' ? 'active' : ''}`} onClick={() => setShift('Evening')}>
                            <Moon size={18} /> {t('common.evening')}
                        </button>
                    </div>
                </div>
            </div>

            <div className="stats-row">
                <div className="mini-stat">
                    <span className="label">{t('entries.totalLiters')}</span>
                    <span className="value">{totals.liters.toFixed(1)} L</span>
                </div>
                <div className="mini-stat">
                    <span className="label">{t('entries.avgFat')}</span>
                    <span className="value">{avgFat}%</span>
                </div>
                <div className="mini-stat">
                    <span className="label">{t('entries.totalAmount')}</span>
                    <span className="value">₹{totals.amount.toFixed(2)}</span>
                </div>
            </div>

            <div className="entry-grid">
                {/* Form Section - Hidden for Farmers */}
                {!isFarmer && (
                    <div className="card entry-form-card">
                        <div className="card-header-flex">
                            <h3>{editingEntry ? t('entries.editEntry') : t('dashboard.newEntry')}</h3>
                            {editingEntry && (
                                <button className="btn btn-secondary btn-sm" onClick={() => {
                                    setEditingEntry(null);
                                    setFormData({ farmerId: '', quantity: '', fat: '', snf: '', milkType: 'Cow', qualityNote: '' });
                                }}>{t('common.cancel')}</button>
                            )}
                        </div>

                        <form onSubmit={handleSubmit} className="entry-form">
                            <div className="form-group">
                                <label>{t('entries.farmerLabel')}</label>
                                <div className="search-select">
                                    <div className="input-with-icon">
                                        <User size={18} className="input-icon" />
                                        <input
                                            type="text"
                                            className="rural-input"
                                            placeholder={t('entries.farmerPlaceholder')}
                                            value={searchQuery}
                                            onFocus={() => setIsDropdownOpen(true)}
                                            onChange={(e) => {
                                                setSearchQuery(e.target.value);
                                                setIsDropdownOpen(true);
                                            }}
                                        />
                                        {isDropdownOpen && <div className="dropdown-overlay" onClick={() => setIsDropdownOpen(false)} />}
                                    </div>
                                    {isDropdownOpen && (
                                        <div className="farmer-dropdown">
                                            {filteredFarmers.length > 0 ? (
                                                filteredFarmers.slice(0, 10).map(f => (
                                                    <div key={f.id} className={`farmer-opt ${formData.farmerId === f.id.toString() ? 'selected' : ''}`} onClick={() => {
                                                        handleFarmerChange(f.id.toString());
                                                        setSearchQuery(`${f.name} (#${f.manualId || f.id})`);
                                                        setIsDropdownOpen(false);
                                                    }}>
                                                        <div className="opt-main">
                                                            <span className="name">{f.name}</span>
                                                            <span className="type-tag">{f.milkType[0]}</span>
                                                        </div>
                                                        <span className="id">Code: #{f.manualId || f.id}</span>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="no-res">{t('farmers.noFarmers')}</div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label>{t('entries.quantity')}</label>
                                    <input type="number" step="0.1" className="rural-input large" required value={formData.quantity} onChange={(e) => setFormData({ ...formData, quantity: e.target.value })} placeholder="0.0" />
                                </div>
                                <div className="form-group">
                                    <label>{t('farmers.cattleType')}</label>
                                    <div className={`type-badge-static ${formData.milkType === 'Cow' ? 'cow' : 'buffalo'}`}>
                                        {formData.milkType === 'Cow' ? `🐄 ${t('farmers.cow')}` : `🐃 ${t('farmers.buffalo')}`}
                                    </div>
                                </div>
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label>{t('entries.fat')}</label>
                                    <input type="number" step="0.1" className="rural-input" required value={formData.fat} onChange={(e) => setFormData({ ...formData, fat: e.target.value })} placeholder="0.0" />
                                </div>
                                <div className="form-group">
                                    <label>{t('entries.snf')}</label>
                                    <input type="number" step="0.1" className="rural-input" value={formData.snf} onChange={(e) => setFormData({ ...formData, snf: e.target.value })} placeholder="0.0" />
                                </div>
                            </div>

                            <div className="form-group">
                                <label>{t('entries.qualityNote')}</label>
                                <input type="text" className="rural-input" value={formData.qualityNote} onChange={(e) => setFormData({ ...formData, qualityNote: e.target.value })} placeholder="e.g. Sour, Fresh, Late..." />
                            </div>

                            {farmerHistory.length > 0 && (
                                <div className="farmer-history-mini">
                                    <p className="history-title">{t('entries.recentHistory')}</p>
                                    <div className="history-list">
                                        {farmerHistory.map(h => (
                                            <div key={h.id} className="history-item">
                                                <span>{format(new Date(h.date), 'dd MMM')}</span>
                                                <span className="qty">{h.quantity}L</span>
                                                <span className="fat">{h.fat}%</span>
                                                <span className="amt">₹{h.amount}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="calc-summary">
                                <div className="calc-item">
                                    <span className="label">{t('entries.applicableRate')}</span>
                                    <span className="value">₹{currentCalc.rate}/L</span>
                                </div>
                                <div className="calc-item total">
                                    <span className="label">{t('entries.totalAmount')}</span>
                                    <span className="value">₹{currentCalc.amount.toFixed(2)}</span>
                                </div>
                            </div>

                            {!activeRates.find(r => r.milkType === formData.milkType) && formData.farmerId && (
                                <div className="alert-banner error">
                                    <AlertTriangle size={18} />
                                    <span>{t('entries.noRateFound')}</span>
                                </div>
                            )}

                            <button
                                type="submit"
                                className="btn btn-primary btn-large"
                                disabled={!formData.farmerId || !activeRates.find(r => r.milkType === formData.milkType)}
                            >
                                <Save size={20} />
                                <span>{editingEntry ? t('entries.updateEntry') : t('entries.saveCollection')}</span>
                            </button>
                        </form>
                    </div>
                )}

                {isFarmer && (
                    <div className="card farmer-info-card" style={{ background: 'var(--primary)', color: 'white' }}>
                        <div className="card-header-flex">
                            <h3>{t('entries.yourCollection')}</h3>
                            <User size={24} />
                        </div>
                        <p>{t('onboarding.welcome')}, <strong>{user.name}</strong>!</p>
                        <p style={{ opacity: 0.9, fontSize: '0.9rem' }}>Showing your entries for {shift} shift on {date}.</p>
                        <div className="farmer-badge" style={{ marginTop: '16px' }}>{t('onboarding.farmer')}</div>
                    </div>
                )}

                {/* List Section */}
                <div className="card list-card">
                    <div className="card-header-flex">
                        <h3>{shift === 'Morning' ? t('common.morning') : t('common.evening')} {t('common.entries')}</h3>
                        <span className="count-badge">{entries.length} {t('common.total')}</span>
                    </div>
                    <div className="table-responsive">
                        <table className="collection-table">
                            <thead>
                                <tr>
                                    <th>{t('entries.farmerLabel')}</th>
                                    <th>{t('entries.quantity')}</th>
                                    <th>FAT/SNF</th>
                                    <th>{t('entries.applicableRate')}</th>
                                    <th>{t('entries.totalAmount')}</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {entries.map(entry => {
                                    const f = farmers.find(farm => farm.id === entry.farmerId);
                                    return (
                                        <tr key={entry.id}>
                                            <td data-label={t('entries.farmerLabel')}>
                                                <div className="farmer-cell">
                                                    <span className="name">{f?.name || 'Unknown'}</span>
                                                    <span className="sub">#{f?.manualId || entry.farmerId} • {entry.milkType}</span>
                                                </div>
                                            </td>
                                            <td data-label={t('entries.quantity')} className="bold">{entry.quantity} L</td>
                                            <td data-label="FAT/SNF">{entry.fat} / {entry.snf}</td>
                                            <td data-label={t('entries.applicableRate')}>₹{entry.rate}</td>
                                            <td data-label={t('entries.totalAmount')} className="amount">₹{entry.amount.toFixed(2)}</td>
                                            {!isFarmer ? (
                                                <td>
                                                    <div className="action-row">
                                                        <button className="icon-btn" onClick={() => handleEdit(entry)}><Edit2 size={14} /></button>
                                                        <button className="icon-btn delete" onClick={() => handleDelete(entry.id)}><Trash2 size={14} /></button>
                                                    </div>
                                                </td>
                                            ) : <td></td>}
                                        </tr>
                                    );
                                })}
                                {entries.length === 0 && (
                                    <tr><td colSpan="6" className="empty-state">{t('entries.noEntries')}</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                .entries-page { display: flex; flex-direction: column; gap: 24px; padding-bottom: 60px; }
                
                .collection-meta { display: flex; gap: 12px; align-items: center; }
                .meta-item { display: flex; align-items: center; gap: 8px; background: white; padding: 10px 16px; border-radius: 12px; border: 1.5px solid var(--border); }
                .meta-item input { border: none; font-weight: 700; color: var(--secondary); outline: none; }

                .shift-toggle { display: flex; background: #e2e8f0; padding: 4px; border-radius: 12px; }
                .shift-btn { display: flex; align-items: center; gap: 6px; padding: 8px 16px; border-radius: 9px; border: none; background: transparent; cursor: pointer; font-weight: 700; color: #64748b; transition: all 0.2s; }
                .shift-btn.active { background: white; color: var(--primary); box-shadow: 0 4px 6px rgba(0,0,0,0.05); }

                .stats-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; }
                .mini-stat { background: white; padding: 20px; border-radius: 16px; border: 1.5px solid var(--border); display: flex; flex-direction: column; gap: 6px; }
                .mini-stat .label { font-size: 0.75rem; color: #64748b; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; }
                .mini-stat .label { font-size: 0.75rem; color: #64748b; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; }
                .mini-stat .value { font-size: 1.5rem; font-weight: 900; color: var(--secondary); }

                .entry-grid { display: grid; grid-template-columns: 1fr 1.8fr; gap: 24px; align-items: start; }
                @media (max-width: 1024px) { .entry-grid { grid-template-columns: 1fr; } }

                .entry-form { display: flex; flex-direction: column; gap: 20px; margin-top: 10px; }
                .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
                .search-select { position: relative; }
                .input-with-icon { position: relative; }
                .input-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #94a3b8; pointer-events: none; }
                .input-with-icon .rural-input { padding-left: 40px; }

                .dropdown-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 40; }

                .farmer-dropdown { position: absolute; top: 100%; left: 0; right: 0; background: white; border: 1.5px solid var(--border); border-radius: 12px; z-index: 50; box-shadow: 0 10px 25px rgba(0,0,0,0.1); margin-top: 4px; max-height: 250px; overflow-y: auto; }
                .farmer-opt { padding: 10px 16px; border-bottom: 1px solid var(--border); cursor: pointer; display: flex; flex-direction: column; gap: 2px; }
                .farmer-opt:hover { background: #f8fafc; }
                .farmer-opt.selected { background: #eff6ff; border-left: 4px solid var(--primary); }
                .opt-main { display: flex; justify-content: space-between; align-items: center; }
                .farmer-opt .name { font-weight: 800; color: var(--secondary); }
                .type-tag { font-size: 0.65rem; background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-weight: 900; color: #475569; }
                .farmer-opt .id { font-size: 0.75rem; color: #64748b; font-weight: 600; }
                .no-res { padding: 20px; text-align: center; color: #94a3b8; font-size: 0.9rem; font-weight: 600; }

                .type-badge-static { padding: 12px; border-radius: 12px; font-weight: 800; text-align: center; }
                .type-badge-static.cow { background: #dcfce7; color: #166534; }
                .type-badge-static.buffalo { background: #dbeafe; color: #1e40af; }

                .calc-summary { background: #f8fafc; border: 2px dashed #cbd5e1; border-radius: 16px; padding: 20px; display: flex; flex-direction: column; gap: 12px; }
                .calc-item { display: flex; justify-content: space-between; align-items: center; }
                .calc-item .label { color: #64748b; font-weight: 700; }
                .calc-item .value { font-weight: 800; color: #1e293b; font-size: 1.1rem; }
                .calc-item.total .value { color: var(--primary); font-size: 1.6rem; font-weight: 900; }

                .alert-banner { display: flex; align-items: center; gap: 10px; padding: 12px; border-radius: 12px; font-size: 0.85rem; font-weight: 700; }
                .alert-banner.error { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }

                .farmer-history-mini { margin: 10px 0; background: #f1f5f9; padding: 12px; border-radius: 12px; }
                .history-title { font-size: 0.7rem; font-weight: 800; color: #475569; text-transform: uppercase; margin-bottom: 8px; margin-top: 0; }
                .history-list { display: flex; flex-direction: column; gap: 4px; }
                .history-item { display: flex; justify-content: space-between; font-size: 0.8rem; font-weight: 600; color: #1e293b; border-bottom: 1px dashed #cbd5e1; padding-bottom: 4px; }
                .history-item .qty { color: var(--secondary); }
                .history-item .fat { color: #64748b; }
                .history-item .amt { font-weight: 800; color: var(--primary); }

                .btn-large { padding: 16px; border-radius: 16px; font-size: 1.1rem; }
                .count-badge { background: #f1f5f9; color: #475569; padding: 4px 12px; border-radius: 20px; font-size: 0.75rem; font-weight: 800; }

                .collection-table { width: 100%; border-collapse: separate; border-spacing: 0 8px; }
                .collection-table th { text-align: left; padding: 12px 16px; color: #64748b; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 1px; }
                .collection-table tr { box-shadow: 0 1px 3px rgba(0,0,0,0.02); }
                .collection-table td { padding: 16px; background: white; transition: all 0.2s; border-top: 1.5px solid var(--border); border-bottom: 1.5px solid var(--border); }
                .collection-table td:first-child { border-left: 1.5px solid var(--border); border-radius: 16px 0 0 16px; }
                .collection-table td:last-child { border-right: 1.5px solid var(--border); border-radius: 0 16px 16px 0; }
                
                .farmer-cell { display: flex; flex-direction: column; gap: 2px; }
                .farmer-cell .name { font-weight: 800; color: var(--secondary); }
                .farmer-cell .sub { font-size: 0.7rem; color: #64748b; font-weight: 600; }
                .bold { font-weight: 800; color: var(--secondary); }
                .amount { font-weight: 900; color: var(--primary); font-size: 1.1rem; }

                .action-row { display: flex; gap: 8px; }
                .empty-state { text-align: center; padding: 40px !important; color: #94a3b8; font-weight: 600; border: none !important; background: transparent !important; }

                @media (max-width: 768px) {
                    .entries-page { gap: 16px; padding: 12px; padding-bottom: 80px; }
                    .page-header { flex-direction: column; align-items: stretch; gap: 16px; }
                    .collection-meta { flex-direction: column; width: 100%; }
                    .meta-item { width: 100%; justify-content: space-between; }
                    .shift-toggle { width: 100%; }
                    .shift-btn { flex: 1; justify-content: center; }

                    .stats-row { grid-template-columns: 1fr; gap: 10px; }
                    .mini-stat { padding: 16px; flex-direction: row; justify-content: space-between; align-items: center; }
                    .mini-stat .value { font-size: 1.25rem; }

                    .entry-grid { gap: 16px; }
                    .form-row { grid-template-columns: 1fr; gap: 12px; }
                    
                    .list-card .card-header-flex { margin-bottom: 12px; }
                    .table-responsive { border: none; }
                    
                    /* Card-based layout for mobile */
                    .collection-table { display: block; }
                    .collection-table thead { display: none; }
                    .collection-table tbody { display: grid; grid-template-columns: 1fr; gap: 12px; }
                    .collection-table tr { 
                        display: flex; 
                        flex-direction: column; 
                        gap: 12px; 
                        padding: 16px; 
                        background: white; 
                        border: 1.5px solid var(--border); 
                        border-radius: 16px;
                        position: relative;
                    }
                    .collection-table td { 
                        display: flex; 
                        justify-content: space-between; 
                        align-items: center; 
                        padding: 0; 
                        border: none; 
                        background: transparent;
                    }
                    .collection-table td:first-child, .collection-table td:last-child { border: none; border-radius: 0; }
                    
                    .collection-table td::before {
                        content: attr(data-label);
                        font-size: 0.75rem;
                        font-weight: 800;
                        color: #64748b;
                        text-transform: uppercase;
                    }

                    .collection-table td:first-child { 
                        order: -1; 
                        border-bottom: 1px solid var(--border);
                        padding-bottom: 10px;
                        margin-bottom: 4px;
                    }
                    .collection-table td:first-child::before { display: none; }
                    .collection-table td:last-child {
                        position: absolute;
                        top: 16px;
                        right: 16px;
                    }
                    .collection-table td:last-child::before { display: none; }

                    .farmer-cell { width: 100%; }
                    .amount { font-size: 1.25rem; }

                    .calc-summary { padding: 16px; }
                    .calc-item.total .value { font-size: 1.3rem; }
                    .btn-large { padding: 14px; font-size: 1rem; }
                }
            ` }} />
        </div >
    );
};

export default Entries;
