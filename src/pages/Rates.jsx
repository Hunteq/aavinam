import React, { useState, useEffect } from 'react';
import { useBranch } from '../context/BranchContext';
import { db } from '../db/db';
import { Save, Plus, Trash2, CheckCircle2, Info, ArrowRight, ShieldAlert } from 'lucide-react';
import { useUser } from '../context/UserContext';
import { useLanguage } from '../context/LanguageContext';

const Rates = () => {
    const { currentBranch } = useBranch();
    const { isOwner } = useUser();
    const { t } = useLanguage();
    const [milkType, setMilkType] = useState('Cow'); // Cow | Buffalo
    const [activeMethod, setActiveMethod] = useState(''); // The method that is currently "live"
    const [viewMethod, setViewMethod] = useState('CHART'); // The method currently being edited

    const [config, setConfig] = useState({
        chart: [],
        fatTable: [],
        tsTable: [],
        tsNewTable: []
    });

    useEffect(() => {
        if (currentBranch) {
            loadRateConfigs();
        }
    }, [currentBranch, milkType]);

    const loadRateConfigs = async () => {
        // Load the currently active rate for this milk type
        const activeRate = await db.rates
            .where({ branchId: currentBranch.id, milkType, isActive: 1 })
            .first();

        if (activeRate) {
            setActiveMethod(activeRate.method);
            setViewMethod(activeRate.method);
        } else {
            setActiveMethod('');
        }

        // Load specific config for the selected viewMethod
        const existing = await db.rates
            .where({ branchId: currentBranch.id, milkType })
            .toArray();

        // Construct config object from all stored method records
        const newConfig = { chart: [], fatTable: [], tsTable: [], tsNewTable: [] };
        existing.forEach(r => {
            if (r.method === 'CHART') newConfig.chart = r.config.chart || [];
            if (r.method === 'FAT') newConfig.fatTable = r.config.fatTable || [];
            if (r.method === 'TS') newConfig.tsTable = r.config.tsTable || [];
            if (r.method === 'TS_NEW') newConfig.tsNewTable = r.config.tsNewTable || [];
        });
        setConfig(newConfig);
    };

    const handleSaveAndActivate = async (methodToActivate) => {
        if (!currentBranch) return;

        try {
            // 1. Deactivate all existing rates for this milkType in this branch
            const existingRates = await db.rates
                .where({ branchId: currentBranch.id, milkType })
                .toArray();

            for (const r of existingRates) {
                await db.rates.update(r.id, { isActive: 0 });
            }

            // 2. Prepare the data for the method being saved/activated
            const methodConfig = {};
            if (methodToActivate === 'CHART') methodConfig.chart = config.chart;
            if (methodToActivate === 'FAT') methodConfig.fatTable = config.fatTable;
            if (methodToActivate === 'TS') methodConfig.tsTable = config.tsTable;
            if (methodToActivate === 'TS_NEW') methodConfig.tsNewTable = config.tsNewTable;

            const existingRecord = existingRates.find(r => r.method === methodToActivate);

            const recordData = {
                branchId: currentBranch.id,
                milkType,
                method: methodToActivate,
                config: methodConfig,
                isActive: 1,
                updatedAt: new Date()
            };

            if (existingRecord) {
                await db.rates.update(existingRecord.id, recordData);
            } else {
                await db.rates.add(recordData);
            }

            setActiveMethod(methodToActivate);
            alert(`${milkType === 'Cow' ? t('rates.cowMilk') : t('rates.buffaloMilk')} ${methodToActivate} ${t('rates.activatedSuccess')}`);
        } catch (err) {
            console.error(err);
            alert(`${t('rates.activationFailed')} ${err.message}`);
        }
    };

    const handleQuickSave = async () => {
        // Just save without activating
        if (!currentBranch) return;

        const methodToSave = viewMethod;
        const existingRates = await db.rates
            .where({ branchId: currentBranch.id, milkType })
            .toArray();
        const existingRecord = existingRates.find(r => r.method === methodToSave);

        const methodConfig = {};
        if (methodToSave === 'CHART') methodConfig.chart = config.chart;
        if (methodToSave === 'FAT') methodConfig.fatTable = config.fatTable;
        if (methodToSave === 'TS') methodConfig.tsTable = config.tsTable;
        if (methodToSave === 'TS_NEW') methodConfig.tsNewTable = config.tsNewTable;

        const recordData = {
            branchId: currentBranch.id,
            milkType,
            method: methodToSave,
            config: methodConfig,
            isActive: existingRecord ? existingRecord.isActive : 0,
            updatedAt: new Date()
        };

        if (existingRecord) {
            await db.rates.update(existingRecord.id, recordData);
        } else {
            await db.rates.add(recordData);
        }
        alert(`${milkType === 'Cow' ? t('rates.cowMilk') : t('rates.buffaloMilk')} ${methodToSave} ${t('rates.savedNotActivated')}`);
    };

    const addRow = (key, template) => {
        setConfig(prev => ({ ...prev, [key]: [...(prev[key] || []), { ...template }] }));
    };

    const deleteRow = (key, index) => {
        setConfig(prev => ({ ...prev, [key]: prev[key].filter((_, i) => i !== index) }));
    };

    const handleInputChange = (key, index, field, value) => {
        const newList = [...config[key]];
        newList[index][field] = value;
        setConfig(prev => ({ ...prev, [key]: newList }));
    };

    return (
        <div className="rates-page">
            <div className="page-header">
                <div>
                    <h1>{t('rates.title')}</h1>
                    <p>{t('rates.subtitle')} {currentBranch?.name}</p>
                </div>
                <div className="header-actions">
                    <button className="btn btn-secondary" onClick={handleQuickSave} disabled={!isOwner}>
                        <Save size={18} /> {t('rates.saveProgress')}
                    </button>
                    <button className="btn btn-primary" onClick={() => handleSaveAndActivate(viewMethod)} disabled={!isOwner}>
                        <CheckCircle2 size={18} /> {t('rates.activate')} {viewMethod}
                    </button>
                </div>
            </div>

            {!isOwner && (
                <div className="info-banner warning" style={{ marginBottom: '20px', background: '#fff7ed', border: '1px solid #fdba74', color: '#9a3412' }}>
                    <ShieldAlert size={20} />
                    <span>{t('rates.ownerOnly')}</span>
                </div>
            )}

            <div className="type-toggle-bar">
                <button className={`type-btn ${milkType === 'Cow' ? 'active cow' : ''}`} onClick={() => setMilkType('Cow')}>🐄 {t('rates.cowMilk')}</button>
                <button className={`type-btn ${milkType === 'Buffalo' ? 'active buffalo' : ''}`} onClick={() => setMilkType('Buffalo')}>🐃 {t('rates.buffaloMilk')}</button>
            </div>

            <div className="rate-selector card">
                <div className="card-header-flex">
                    <h3>{t('rates.selectMethod')}</h3>
                    {activeMethod && (
                        <div className="active-badge">
                            <CheckCircle2 size={14} /> {t('rates.active')}: {activeMethod}
                        </div>
                    )}
                </div>
                <div className="method-grid">
                    {[
                        { id: 'CHART', title: t('rates.methodChart'), desc: t('rates.descChart') },
                        { id: 'FAT', title: t('rates.methodFat'), desc: t('rates.descFat') },
                        { id: 'TS', title: t('rates.methodTs'), desc: milkType === 'Cow' ? t('rates.descTsCow') : t('rates.descTsBuffalo') },
                        { id: 'TS_NEW', title: t('rates.methodTsNew'), desc: t('rates.descTsNew') }
                    ].map(meth => (
                        <button key={meth.id} className={`method-card ${viewMethod === meth.id ? 'viewing' : ''} ${activeMethod === meth.id ? 'active' : ''}`} onClick={() => setViewMethod(meth.id)}>
                            <span className="title">{meth.title}</span>
                            <span className="desc">{meth.desc}</span>
                            {activeMethod === meth.id && <div className="status-label">{t('rates.active')}</div>}
                        </button>
                    ))}
                </div>
            </div>

            <div className="config-sections">
                {viewMethod === 'CHART' && (
                    <div className="card">
                        <div className="card-header-flex">
                            <h3>{t('rates.matrixTitle')} ({milkType === 'Cow' ? t('rates.cowMilk') : t('rates.buffaloMilk')})</h3>
                            <button className="btn btn-secondary btn-sm" onClick={() => addRow('chart', { fat: '', snf: '', rate: '' })} disabled={!isOwner}>
                                <Plus size={16} /> {t('rates.addRow')}
                            </button>
                        </div>
                        <div className="table-responsive">
                            <table className="rate-table">
                                <thead><tr><th>{t('rates.fatPercent')}</th><th>{t('rates.snfPercent')}</th><th>{t('rates.rateRs')}</th><th>{t('rates.action')}</th></tr></thead>
                                <tbody>
                                    {config.chart.map((row, i) => (
                                        <tr key={i}>
                                            <td><input type="number" step="0.1" className="rural-input sm" value={row.fat} onChange={e => handleInputChange('chart', i, 'fat', e.target.value)} disabled={!isOwner} /></td>
                                            <td><input type="number" step="0.1" className="rural-input sm" value={row.snf} onChange={e => handleInputChange('chart', i, 'snf', e.target.value)} disabled={!isOwner} /></td>
                                            <td><input type="number" step="0.1" className="rural-input sm" value={row.rate} onChange={e => handleInputChange('chart', i, 'rate', e.target.value)} disabled={!isOwner} /></td>
                                            <td><button className="icon-btn delete sm" onClick={() => deleteRow('chart', i)} disabled={!isOwner}><Trash2 size={14} /></button></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {viewMethod === 'FAT' && (
                    <div className="card">
                        <div className="card-header-flex">
                            <h3>{t('rates.fatTableTitle')} ({milkType === 'Cow' ? t('rates.cowMilk') : t('rates.buffaloMilk')})</h3>
                            <button className="btn btn-secondary btn-sm" onClick={() => addRow('fatTable', { code: '', fat: '', rate: '' })} disabled={!isOwner}>
                                <Plus size={16} /> {t('rates.addRow')}
                            </button>
                        </div>
                        <div className="table-responsive">
                            <table className="rate-table">
                                <thead><tr><th>{t('rates.code')}</th><th>{t('rates.fatPercent')}</th><th>{t('rates.rateRs')}</th><th>{t('rates.action')}</th></tr></thead>
                                <tbody>
                                    {config.fatTable.map((row, i) => (
                                        <tr key={i}>
                                            <td><input type="text" className="rural-input sm" value={row.code} onChange={e => handleInputChange('fatTable', i, 'code', e.target.value)} disabled={!isOwner} /></td>
                                            <td><input type="number" step="0.1" className="rural-input sm" value={row.fat} onChange={e => handleInputChange('fatTable', i, 'fat', e.target.value)} disabled={!isOwner} /></td>
                                            <td><input type="number" step="0.1" className="rural-input sm" value={row.rate} onChange={e => handleInputChange('fatTable', i, 'rate', e.target.value)} disabled={!isOwner} /></td>
                                            <td><button className="icon-btn delete sm" onClick={() => deleteRow('fatTable', i)} disabled={!isOwner}><Trash2 size={14} /></button></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {viewMethod === 'TS' && (
                    <div className="card">
                        <div className="card-header-flex">
                            <h3>{t('rates.tsConfiguration')} ({milkType === 'Cow' ? t('rates.cowMilk') : t('rates.buffaloMilk')})</h3>
                            <button className="btn btn-secondary btn-sm" onClick={() => addRow('tsTable', { code: '', minFat: '', maxFat: '', fatRate: '', minSnf: '', maxSnf: '', snfRate: '' })} disabled={!isOwner}>
                                <Plus size={16} /> {t('rates.addRow')}
                            </button>
                        </div>
                        <div className="table-responsive">
                            <table className="rate-table">
                                <thead>
                                    <tr>
                                        {milkType === 'Buffalo' && <th>{t('rates.code')}</th>}
                                        <th>{t('rates.minFat')}</th><th>{t('rates.maxFat')}</th><th>{t('rates.tsMultiplier')}</th>
                                        {milkType === 'Cow' && (
                                            <>
                                                <th>{t('rates.minSnf')}</th><th>{t('rates.maxSnf')}</th>
                                            </>
                                        )}
                                        <th>{t('rates.action')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {config.tsTable.map((row, i) => (
                                        <tr key={i}>
                                            {milkType === 'Buffalo' && <td><input type="text" className="rural-input sm" value={row.code} onChange={e => handleInputChange('tsTable', i, 'code', e.target.value)} disabled={!isOwner} /></td>}
                                            <td><input type="number" step="0.1" className="rural-input sm" value={row.minFat} onChange={e => handleInputChange('tsTable', i, 'minFat', e.target.value)} disabled={!isOwner} /></td>
                                            <td><input type="number" step="0.1" className="rural-input sm" value={row.maxFat} onChange={e => handleInputChange('tsTable', i, 'maxFat', e.target.value)} disabled={!isOwner} /></td>
                                            <td><input type="number" step="0.1" className="rural-input sm" value={row.fatRate} onChange={e => handleInputChange('tsTable', i, 'fatRate', e.target.value)} disabled={!isOwner} /></td>
                                            {milkType === 'Cow' && (
                                                <>
                                                    <td><input type="number" step="0.1" className="rural-input sm" value={row.minSnf} onChange={e => handleInputChange('tsTable', i, 'minSnf', e.target.value)} disabled={!isOwner} /></td>
                                                    <td><input type="number" step="0.1" className="rural-input sm" value={row.maxSnf} onChange={e => handleInputChange('tsTable', i, 'maxSnf', e.target.value)} disabled={!isOwner} /></td>
                                                </>
                                            )}
                                            <td><button className="icon-btn delete sm" onClick={() => deleteRow('tsTable', i)} disabled={!isOwner}><Trash2 size={14} /></button></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="info-banner" style={{ marginTop: '16px' }}>
                            <Info size={16} />
                            <span>{milkType === 'Cow' ? t('rates.formulaCow') : t('rates.formulaBuffalo')}</span>
                        </div>
                    </div>
                )}

                {viewMethod === 'TS_NEW' && (
                    <div className="card">
                        <div className="card-header-flex">
                            <h3>{t('rates.tsNewSetup')} ({milkType === 'Cow' ? t('rates.cowMilk') : t('rates.buffaloMilk')})</h3>
                            <button className="btn btn-secondary btn-sm" onClick={() => addRow('tsNewTable', { code: '', tsFrom: '', tsTo: '', rate: '', incentive: '' })} disabled={!isOwner}>
                                <Plus size={16} /> {t('rates.addRow')}
                            </button>
                        </div>
                        <div className="table-responsive">
                            <table className="rate-table">
                                <thead><tr><th>{t('rates.code')}</th><th>{t('rates.tsFrom')}</th><th>{t('rates.tsTo')}</th><th>{t('rates.tsRate')}</th><th>{t('rates.incentive')}</th><th>{t('rates.action')}</th></tr></thead>
                                <tbody>
                                    {config.tsNewTable.map((row, i) => (
                                        <tr key={i}>
                                            <td><input type="text" className="rural-input sm" value={row.code} onChange={e => handleInputChange('tsNewTable', i, 'code', e.target.value)} disabled={!isOwner} /></td>
                                            <td><input type="number" step="0.1" className="rural-input sm" value={row.tsFrom} onChange={e => handleInputChange('tsNewTable', i, 'tsFrom', e.target.value)} disabled={!isOwner} /></td>
                                            <td><input type="number" step="0.1" className="rural-input sm" value={row.tsTo} onChange={e => handleInputChange('tsNewTable', i, 'tsTo', e.target.value)} disabled={!isOwner} /></td>
                                            <td><input type="number" step="0.1" className="rural-input sm" value={row.rate} onChange={e => handleInputChange('tsNewTable', i, 'rate', e.target.value)} disabled={!isOwner} /></td>
                                            <td><input type="number" step="0.1" className="rural-input sm" value={row.incentive} onChange={e => handleInputChange('tsNewTable', i, 'incentive', e.target.value)} disabled={!isOwner} /></td>
                                            <td><button className="icon-btn delete sm" onClick={() => deleteRow('tsNewTable', i)} disabled={!isOwner}><Trash2 size={14} /></button></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                .rates-page { display: flex; flex-direction: column; gap: 24px; padding-bottom: 40px; }
                .page-header { display: flex; justify-content: space-between; align-items: center; }
                .header-actions { display: flex; gap: 12px; }

                .type-toggle-bar { display: flex; gap: 12px; }
                .type-btn { flex: 1; padding: 14px; border-radius: 12px; border: 2px solid var(--border); background: white; font-weight: 700; cursor: pointer; transition: all 0.2s; font-size: 1rem; }
                .type-btn.active.cow { background: #dcfce7; border-color: #22c55e; color: #166534; box-shadow: 0 4px 12px rgba(34, 197, 94, 0.1); }
                .type-btn.active.buffalo { background: #dbeafe; border-color: #3b82f6; color: #1e40af; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.1); }

                .card-header-flex { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
                .active-badge { display: flex; align-items: center; gap: 6px; padding: 4px 12px; background: #f0fdf4; color: #166534; border-radius: 20px; font-size: 0.8rem; font-weight: 700; border: 1px solid #bbf7d0; }

                .method-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; }
                .method-card { padding: 16px; border-radius: 12px; border: 2px solid var(--border); background: white; cursor: pointer; text-align: left; position: relative; transition: all 0.2s; }
                .method-card:hover { border-color: var(--primary-light); background: #fafafa; }
                .method-card.viewing { border-color: var(--primary); transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
                .method-card.active { background: #f0fdf4; border-color: #22c55e; }
                
                .method-card .title { display: block; font-weight: 700; color: var(--secondary); margin-bottom: 2px; }
                .method-card .desc { font-size: 0.75rem; color: var(--text-muted); }
                .method-card .status-label { position: absolute; top: 8px; right: 8px; font-size: 0.65rem; font-weight: 800; background: #22c55e; color: white; padding: 2px 6px; border-radius: 4px; }

                .rate-table { width: 100%; border-collapse: collapse; }
                .rate-table th { text-align: left; padding: 12px; border-bottom: 2px solid var(--border); font-size: 0.8rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; }
                .rate-table td { padding: 8px; border-bottom: 1px solid var(--border); }
                .rural-input.sm { padding: 8px 12px; font-size: 0.9rem; width: 100%; font-weight: 600; }

                .info-banner { display: flex; align-items: center; gap: 8px; padding: 12px; background: #f8fafc; border-radius: 8px; color: #64748b; font-size: 0.85rem; font-weight: 600; }

                @media (max-width: 768px) {
                    .rates-page { gap: 16px; }
                    .page-header { flex-direction: column; align-items: stretch; gap: 12px; }
                    .header-actions { flex-direction: column; width: 100%; }
                    .header-actions .btn { width: 100%; }
                    .type-toggle-bar { flex-direction: column; }
                    .method-grid { grid-template-columns: 1fr; gap: 12px; }
                    .rate-table { display: block; overflow-x: auto; -webkit-overflow-scrolling: touch; }
                    .rate-table th, .rate-table td { padding: 8px 6px; font-size: 0.75rem; }
                }
            ` }} />
        </div>
    );
};

export default Rates;
