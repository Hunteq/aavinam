import React, { useState, useEffect, useMemo } from 'react';
import { useBranch } from '../context/BranchContext';
import { db } from '../db/db';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { filterEntries } from '../utils/billingUtils';
import {
    FileText,
    Download,
    Printer,
    Share2,

    Users,
    Droplet,
    IndianRupee,
    Calendar,
    MessageSquare,
    Phone,
    X
} from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { useLanguage } from '../context/LanguageContext';

const Billing = () => {
    const { currentBranch } = useBranch();
    const { t } = useLanguage();

    // -- State --
    const [period, setPeriod] = useState('daily'); // daily, weekly, monthly, custom
    const [dateRange, setDateRange] = useState({
        startDate: format(new Date(), 'yyyy-MM-dd'),
        endDate: format(new Date(), 'yyyy-MM-dd')
    });
    const [shift, setShift] = useState('all'); // 'all', 'morning', 'evening'

    const [viewMode, setViewMode] = useState('all'); // 'all', 'single'
    const [selectedFarmerId, setSelectedFarmerId] = useState(null);

    const [loading, setLoading] = useState(false);
    const [entries, setEntries] = useState([]);
    const [farmers, setFarmers] = useState([]);
    const [settings, setSettings] = useState(null);

    // -- Share Modal State --
    const [showShareModal, setShowShareModal] = useState(false);
    const [shareMode, setShareMode] = useState('whatsapp'); // 'whatsapp' or 'sms'
    const [customNumber, setCustomNumber] = useState('');
    const [useCustomNumber, setUseCustomNumber] = useState(false);


    // -- Load Initial Data (Farmers, Settings) --
    useEffect(() => {
        if (!currentBranch) return;

        const loadBasics = async () => {
            try {
                const [allFarmers, appSettings] = await Promise.all([
                    db.farmers.where({ branchId: currentBranch.id }).toArray(),
                    db.settings.get('global') // Assuming global settings ID
                ]);
                setFarmers(allFarmers);
                setSettings(appSettings || { societyName: 'Milk Society' });
            } catch (err) {
                console.error("Error loading basics:", err);
            }
        };
        loadBasics();
    }, [currentBranch]);

    // -- Load Entries on filter change --
    useEffect(() => {
        if (!currentBranch) return;
        loadEntries();
    }, [currentBranch, dateRange, period, shift]);

    const loadEntries = async () => {
        setLoading(true);
        try {
            // Fetch all entries for this branch
            // Ensure branchId is a number for strict matching
            const branchId = Number(currentBranch.id);
            const allEntries = await db.entries.where({ branchId }).toArray();

            // Use shared utility for robust date/branch/shift filtering
            // We pass null for branchId here because we already filtered by branch in the DB query
            // but passing it again is safe and double-checks.
            const filtered = filterEntries(allEntries, dateRange, branchId, shift);

            // Sort by date descending (newest first) -> actually UI usually wants oldest first for bills??
            // Reverting to oldest first (Jan 1, Jan 2...) for bill generation logic usually.
            // But let's keep consistent with existing: "Sort by date/shift"
            filtered.sort((a, b) => new Date(a.date) - new Date(b.date));

            setEntries(filtered);
        } catch (err) {
            console.error("Error loading entries:", err);
        } finally {
            setLoading(false);
        }
    };

    // -- Handlers --

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

    const toggleView = (mode, farmerId = null) => {
        setViewMode(mode);
        setSelectedFarmerId(farmerId);
    };

    // -- Derived Data / Calculations --

    const farmerAggregates = useMemo(() => {
        const aggs = {};

        entries.forEach(entry => {
            if (!aggs[entry.farmerId]) {
                const farmer = farmers.find(f => f.id === entry.farmerId);
                aggs[entry.farmerId] = {
                    farmerId: entry.farmerId,
                    manualId: farmer?.manualId || entry.farmerId,
                    name: farmer?.name || 'Unknown',

                    // Totals
                    totalLiters: 0,
                    totalAmount: 0,

                    // Cow specific
                    cowLiters: 0,
                    cowAmount: 0,
                    cowFatSum: 0,
                    cowSnfSum: 0,
                    cowCount: 0,

                    // Buffalo specific
                    buffaloLiters: 0,
                    buffaloAmount: 0,
                    buffaloFatSum: 0,
                    buffaloSnfSum: 0,
                    buffaloCount: 0,

                    entries: []
                };
            }

            const rec = aggs[entry.farmerId];
            const qty = Number(entry.quantity) || 0;
            const amt = Number(entry.amount) || 0;
            const fat = Number(entry.fat) || 0;
            const snf = Number(entry.snf) || 0;

            rec.totalLiters += qty;
            rec.totalAmount += amt;
            rec.entries.push(entry);

            if (entry.milkType === 'Cow') {
                rec.cowLiters += qty;
                rec.cowAmount += amt;
                rec.cowFatSum += fat * qty;
                rec.cowSnfSum += snf * qty;
                rec.cowCount += 1;
            } else if (entry.milkType === 'Buffalo') {
                rec.buffaloLiters += qty;
                rec.buffaloAmount += amt;
                rec.buffaloFatSum += fat * qty;
                rec.buffaloSnfSum += snf * qty;
                rec.buffaloCount += 1;
            }
        });

        return Object.values(aggs).map(rec => ({
            ...rec,
            // Cow Averages
            avgCowFat: rec.cowLiters > 0 ? (rec.cowFatSum / rec.cowLiters).toFixed(2) : '0.00',
            avgCowSnf: rec.cowLiters > 0 ? (rec.cowSnfSum / rec.cowLiters).toFixed(2) : '0.00',

            // Buffalo Averages
            avgBuffaloFat: rec.buffaloLiters > 0 ? (rec.buffaloFatSum / rec.buffaloLiters).toFixed(2) : '0.00',
            avgBuffaloSnf: rec.buffaloLiters > 0 ? (rec.buffaloSnfSum / rec.buffaloLiters).toFixed(2) : '0.00',

            // Overall Averages (if needed) - Keeping for consistency if used elsewhere, but not displayed in split view
            avgFat: rec.totalLiters > 0 ? ((rec.cowFatSum + rec.buffaloFatSum) / rec.totalLiters).toFixed(2) : 0,
            avgSnf: rec.totalLiters > 0 ? ((rec.cowSnfSum + rec.buffaloSnfSum) / rec.totalLiters).toFixed(2) : 0
        }));
    }, [entries, farmers]);

    const overallStats = useMemo(() => {
        return farmerAggregates.reduce((acc, curr) => ({
            farmers: acc.farmers + 1,
            liters: acc.liters + curr.totalLiters,
            amount: acc.amount + curr.totalAmount,
            cowLiters: acc.cowLiters + curr.cowLiters,
            buffaloLiters: acc.buffaloLiters + curr.buffaloLiters
        }), { farmers: 0, liters: 0, amount: 0, cowLiters: 0, buffaloLiters: 0 });
    }, [farmerAggregates]);

    const shiftStats = useMemo(() => {
        const stats = {
            morning: { liters: 0, amount: 0 },
            evening: { liters: 0, amount: 0 }
        };
        entries.forEach(e => {
            const shiftVal = e.shift?.toLowerCase();
            if (shiftVal === 'morning' || shiftVal === 'evening') {
                stats[shiftVal].liters += Number(e.quantity) || 0;
                stats[shiftVal].amount += Number(e.amount) || 0;
            }
        });
        return stats;
    }, [entries]);

    const selectedFarmerData = useMemo(() => {
        if (!selectedFarmerId) return null;
        const agg = farmerAggregates.find(a => a.farmerId === selectedFarmerId);
        if (!agg) return null;

        // Group entries by Date + Shift usually, but requirement says "Shift-wise liters" with Date.
        // List entries directly for "Day & Date" breakdown.
        return { ...agg, entries: agg.entries.sort((a, b) => new Date(a.date) - new Date(b.date)) };
    }, [selectedFarmerId, farmerAggregates]);


    // -- Export Functions --

    const exportPDF = () => {
        const doc = new jsPDF();

        // Header
        doc.setFontSize(18);
        doc.text(settings?.societyName || 'Milk Society', 14, 15);
        doc.setFontSize(12);
        doc.text(t('billing.billSummary'), 14, 22);
        doc.setFontSize(10);
        doc.text(`Branch: ${currentBranch?.name} (${currentBranch?.location || ''})`, 14, 28);
        doc.text(`${t('common.shift')}: ${shift === 'all' ? t('billing.allShifts') : (shift === 'morning' ? t('common.morning') : t('common.evening'))}`, 14, 34);
        doc.text(`${t('billing.period')}: ${format(parseISO(dateRange.startDate), 'dd MMM yyyy')} to ${format(parseISO(dateRange.endDate), 'dd MMM yyyy')}`, 14, 40);

        if (viewMode === 'all') {
            const tableColumn = [t('common.farmerId'), t('farmers.name'), `${t('common.cow')} (L)`, `${t('common.buffalo')} (L)`, `${t('entries.totalLiters')} (L)`, t('entries.avgFat'), "Avg SNF", t('common.amount')];
            const tableRows = farmerAggregates.map(row => [
                row.manualId,
                row.name,
                row.cowLiters.toFixed(2),
                row.buffaloLiters.toFixed(2),
                row.totalLiters.toFixed(2),
                row.avgFat,
                row.avgSnf,
                row.totalAmount.toFixed(2)
            ]);

            doc.autoTable({
                head: [tableColumn],
                body: tableRows,
                startY: 45,
            });

            // Totals
            const finalY = doc.lastAutoTable.finalY + 10;
            doc.text(`${t('entries.totalLiters')}: ${overallStats.liters.toFixed(2)} L`, 14, finalY);
            doc.text(`${t('entries.totalAmount')}: ₹${overallStats.amount.toFixed(2)}`, 14, finalY + 6);

            doc.save(`All_Farmers_Bill_${dateRange.startDate}.pdf`);

        } else if (viewMode === 'single' && selectedFarmerData) {
            doc.text(`${t('common.farmer')}: ${selectedFarmerData.name} (ID: ${selectedFarmerData.manualId})`, 14, 40);

            const tableColumn = [t('common.date'), t('common.shift'), t('collection.milkType'), t('entries.quantity'), t('entries.fat'), t('entries.snf'), t('collection.rate'), t('collection.amount')];
            const tableRows = selectedFarmerData.entries.map(e => [
                format(parseISO(e.date), 'dd/MM/yyyy'),
                e.shift,
                e.milkType,
                Number(e.quantity).toFixed(2),
                Number(e.fat).toFixed(1),
                Number(e.snf).toFixed(1),
                Number(e.rate).toFixed(2),
                Number(e.amount).toFixed(2)
            ]);

            doc.autoTable({
                head: [tableColumn],
                body: tableRows,
                startY: 45,
            });

            const finalY = doc.lastAutoTable.finalY + 10;
            doc.text(`${t('entries.totalLiters')}: ${selectedFarmerData.totalLiters.toFixed(2)}`, 14, finalY);
            doc.text(`${t('entries.avgFat')}: ${selectedFarmerData.avgFat} | Avg SNF: ${selectedFarmerData.avgSnf}`, 80, finalY);
            doc.text(`${t('entries.totalAmount')}: ₹${selectedFarmerData.totalAmount.toFixed(2)}`, 150, finalY);

            doc.save(`Bill_${selectedFarmerData.name}_${dateRange.startDate}.pdf`);
        }
    };

    const exportExcel = () => {
        let data = [];
        let fileName = '';

        if (viewMode === 'all') {
            data = farmerAggregates.map(f => ({
                [t('common.farmerId')]: f.manualId,
                [t('farmers.name')]: f.name,
                [`${t('common.cow')} (L)`]: f.cowLiters,
                [`${t('common.buffalo')} (L)`]: f.buffaloLiters,
                [`${t('entries.totalLiters')} (L)`]: f.totalLiters,
                [t('entries.avgFat')]: f.avgFat,
                "Avg SNF": f.avgSnf,
                [t('common.amount')]: f.totalAmount,
                "Branch ID": currentBranch?.id
            }));
            fileName = `All_Farmers_Bill_${dateRange.startDate}.xlsx`;
        } else if (viewMode === 'single' && selectedFarmerData) {
            data = selectedFarmerData.entries.map(e => ({
                "Date": e.date,
                "Shift": e.shift,
                "Milk Type": e.milkType,
                "Quantity": e.quantity,
                "Fat": e.fat,
                "SNF": e.snf,
                "Rate": e.rate,
                "Amount": e.amount,
                "Branch ID": currentBranch?.id,
                [t('common.farmerId')]: selectedFarmerData.manualId
            }));
            fileName = `Bill_${selectedFarmerData.name}_${dateRange.startDate}.xlsx`;
        }

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Bill");
        XLSX.writeFile(wb, fileName);
    };

    const generateShareMessage = () => {
        const branchHeader = `${settings?.societyName || 'Milk Society'}\n${currentBranch?.name}${currentBranch?.location ? ', ' + currentBranch.location : ''}\n${t('common.shift')}: ${shift === 'all' ? t('billing.allShifts') : (shift === 'morning' ? t('common.morning') : t('common.evening'))}\n\n${t('billing.period')}: ${format(new Date(dateRange.startDate), 'dd MMM yyyy')} - ${format(new Date(dateRange.endDate), 'dd MMM yyyy')}\n\n`;

        if (viewMode === 'all') {
            let text = branchHeader;
            text += `${t('billing.totalFarmers')}\n${overallStats.farmers}\n`;
            text += `${t('entries.totalLiters')}\n${t('common.cow')}: ${overallStats.cowLiters.toFixed(1)}\n${t('common.buffalo')}: ${overallStats.buffaloLiters.toFixed(1)}\nMorn: ${shiftStats.morning.liters.toFixed(1)}\nEve: ${shiftStats.evening.liters.toFixed(1)}\n${overallStats.liters.toFixed(1)} L\n\n`;
            text += `${t('entries.totalAmount')}\nMorn: ₹${shiftStats.morning.amount.toFixed(2)}\nEve: ₹${shiftStats.evening.amount.toFixed(2)}\n₹ ${overallStats.amount.toFixed(2)}\n\n`;

            const cowFarmers = farmerAggregates.filter(f => f.cowLiters > 0);
            if (cowFarmers.length > 0) {
                text += `🐄 ${t('billing.cowSummary')}\n${t('common.farmerId')}\t${t('farmers.name')}\t${t('common.cow')} (L)\t${t('common.total')} (L)\t${t('entries.avgFat')}\tAvg SNF\t${t('common.actions')} (₹)\n`;
                cowFarmers.forEach(f => {
                    text += `${f.manualId}\t${f.name}\t${f.cowLiters.toFixed(2)}\t${f.cowLiters.toFixed(2)}\t${f.avgCowFat}\t${f.avgCowSnf}\t${f.cowAmount.toFixed(2)}\n`;
                });
                text += `\n`;
            }

            const buffFarmers = farmerAggregates.filter(f => f.buffaloLiters > 0);
            if (buffFarmers.length > 0) {
                text += `🐃 ${t('billing.buffSummary')}\n${t('common.farmerId')}\t${t('farmers.name')}\t${t('common.buffalo')} (L)\t${t('common.total')} (L)\t${t('entries.avgFat')}\tAvg SNF\t${t('common.actions')} (₹)\n`;
                buffFarmers.forEach(f => {
                    text += `${f.manualId}\t${f.name}\t${f.buffaloLiters.toFixed(2)}\t${f.buffaloLiters.toFixed(2)}\t${f.avgBuffaloFat}\t${f.avgBuffaloSnf}\t${f.buffaloAmount.toFixed(2)}\n`;
                });
            }
            return text;
        } else if (viewMode === 'single' && selectedFarmerData) {
            let text = branchHeader;
            text += `${selectedFarmerData.name}\n${t('common.farmerId')}: ${selectedFarmerData.manualId}\n\n`;
            text += `${t('common.date')}\t${t('common.shift')}\t${t('collection.milkType')}\tQty (L)\tFAT\tSNF\tRate\tAmount\n`;
            selectedFarmerData.entries.forEach(e => {
                text += `${format(new Date(e.date), 'dd/MM/yy')}\t${e.shift}\t${e.milkType}\t${Number(e.quantity).toFixed(2)}\t${Number(e.fat).toFixed(1)}\t${Number(e.snf).toFixed(1)}\t${Number(e.rate).toFixed(2)}\t${Number(e.amount).toFixed(2)}\n`;
            });
            text += `Total\t${selectedFarmerData.totalLiters.toFixed(2)}\t${selectedFarmerData.avgFat}\t${selectedFarmerData.avgSnf}\t-\t₹ ${selectedFarmerData.totalAmount.toFixed(2)}`;
            return text;
        }
        return '';
    };

    const shareWhatsApp = () => {
        setShareMode('whatsapp');
        if (viewMode === 'single' && selectedFarmerData) {
            const farmer = farmers.find(f => f.id === selectedFarmerId);
            setCustomNumber(farmer?.phone || '');
            setUseCustomNumber(!farmer?.phone);
        } else {
            setCustomNumber('');
            setUseCustomNumber(true);
        }
        setShowShareModal(true);
    };

    const shareSMS = () => {
        setShareMode('sms');
        if (viewMode === 'single' && selectedFarmerData) {
            const farmer = farmers.find(f => f.id === selectedFarmerId);
            setCustomNumber(farmer?.phone || '');
            setUseCustomNumber(!farmer?.phone);
        } else {
            setCustomNumber('');
            setUseCustomNumber(true);
        }
        setShowShareModal(true);
    };

    const executeShare = () => {
        const text = generateShareMessage();
        let url = '';
        const phone = useCustomNumber ? customNumber : (farmers.find(f => f.id === selectedFarmerId)?.phone || '');

        if (shareMode === 'whatsapp') {
            url = `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;
        } else {
            url = `sms:${phone}?body=${encodeURIComponent(text)}`;
        }
        window.open(url, '_blank');
        setShowShareModal(false);
    };

    const printBill = () => {
        window.print();
    };


    // -- UI Renders --

    return (
        <div className="billing-page">
            {/* Header & Controls */}
            <div className="page-header hide-on-print">
                <div className="header-content">
                    <h1>{t('billing.title')}</h1>
                    <p className="subtitle">
                        {settings?.societyName} • {currentBranch?.name}
                        {shift !== 'all' && ` • ${shift === 'morning' ? t('common.morning') : t('common.evening')}`}
                    </p>
                </div>

                <div className="controls-area">
                    <div className="period-selector">
                        <button className={period === 'daily' ? 'active' : ''} onClick={() => handlePeriodChange('daily')}>{t('billing.daily')}</button>
                        <button className={period === 'weekly' ? 'active' : ''} onClick={() => handlePeriodChange('weekly')}>{t('billing.weekly')}</button>
                        <button className={period === 'monthly' ? 'active' : ''} onClick={() => handlePeriodChange('monthly')}>{t('billing.monthly')}</button>
                    </div>

                    <div className="date-inputs">
                        <input type="date" value={dateRange.startDate} onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })} />
                        <span>to</span>
                        <input type="date" value={dateRange.endDate} onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })} />
                    </div>

                    <div className="shift-selector">
                        <select value={shift} onChange={(e) => setShift(e.target.value)}>
                            <option value="all">{t('billing.allShifts')}</option>
                            <option value="morning">{t('common.morning')}</option>
                            <option value="evening">{t('common.evening')}</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Action Bar */}
            <div className="action-bar hide-on-print">
                <div className="left-actions">
                    {/* View Toggle */}
                    <div className="view-toggle">
                        <button
                            className={viewMode === 'all' ? 'active' : ''}
                            onClick={() => toggleView('all')}
                        >
                            <Users size={16} /> {t('billing.allFarmers')}
                        </button>
                        <button
                            className={viewMode === 'single' ? 'active' : ''}
                            onClick={() => toggleView('single', selectedFarmerId)}
                        >
                            <Users size={16} /> {t('billing.singleFarmer')}
                        </button>
                    </div>



                    {viewMode === 'single' && (
                        <div className="farmer-select">
                            <select
                                value={selectedFarmerId || ''}
                                onChange={(e) => setSelectedFarmerId(Number(e.target.value))}
                                className="farmer-dropdown"
                            >
                                <option value="" disabled>{t('billing.selectFarmer')}</option>
                                {farmers.map(f => (
                                    <option key={f.id} value={f.id}>{f.name} ({t('farmers.id')}: {f.manualId || f.id})</option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>

                <div className="export-actions">
                    {/* <button onClick={exportPDF} title="Download PDF"><FileText size={18} /></button> */}
                    <button onClick={exportExcel} title={t('billing.exportExcel')}><Download size={18} /></button>
                    <button onClick={() => {
                        if (viewMode === 'single' && Number(selectedFarmerId)) {
                            const farmer = farmers.find(f => f.id === selectedFarmerId);
                            setCustomNumber(farmer?.phone || '');
                            setUseCustomNumber(!farmer?.phone);
                        } else {
                            setCustomNumber('');
                            setUseCustomNumber(true);
                        }
                        setShowShareModal(true);
                    }} title={t('billing.shareSummary')}><Share2 size={18} /></button>
                    <button onClick={printBill} title={t('billing.print')}><Printer size={18} /></button>
                </div>
            </div>

            {/* Content Area */}
            <div className="content-area printable-area">

                {viewMode === 'all' && (
                    <div className="all-farmers-view">
                        {/* Printable Header for All Farmers */}
                        <div className="bill-header" style={{ marginBottom: '20px' }}>
                            <div className="society-info">
                                <h2>{settings?.societyName || 'Milk Society'}</h2>
                                <p style={{ margin: '4px 0', color: '#475569' }}>
                                    {currentBranch?.name}
                                    {currentBranch?.location ? `, ${currentBranch.location}` : ''}
                                    {` • ${shift === 'all' ? t('billing.allShifts') : (shift === 'morning' ? t('common.morning') : t('common.evening'))}`}
                                </p>
                                <p style={{ fontSize: '0.9rem', color: '#64748b' }}>
                                    {t('billing.period')}: {format(new Date(dateRange.startDate), 'dd MMM yyyy')} - {format(new Date(dateRange.endDate), 'dd MMM yyyy')}
                                </p>
                            </div>
                        </div>

                        {/* Summary Cards */}
                        <div className="summary-cards">
                            <div className="card">
                                <span className="label">{t('billing.totalFarmers')}</span>
                                <span className="value">{overallStats.farmers}</span>
                            </div>
                            <div className="card">
                                <span className="label">{t('entries.totalLiters')}</span>
                                <div className="sub-values">
                                    <span>{t('common.cow')}: {overallStats.cowLiters.toFixed(1)}</span>
                                    <span>{t('common.buffalo')}: {overallStats.buffaloLiters.toFixed(1)}</span>
                                </div>
                                <div className="sub-values" style={{ marginTop: '4px', borderTop: '1px dashed #cbd5e1', paddingTop: '4px' }}>
                                    <span>Morn: {shiftStats.morning.liters.toFixed(1)}</span>
                                    <span>Eve: {shiftStats.evening.liters.toFixed(1)}</span>
                                </div>
                                <span className="value highlight" style={{ marginTop: '8px' }}>{overallStats.liters.toFixed(1)} L</span>
                            </div>
                            <div className="card">
                                <span className="label">{t('entries.totalAmount')}</span>
                                <div className="sub-values">
                                    <span>Morn: ₹{shiftStats.morning.amount.toFixed(2)}</span>
                                    <span>Eve: ₹{shiftStats.evening.amount.toFixed(2)}</span>
                                </div>
                                <span className="value highlight" style={{ marginTop: '8px' }}>₹ {overallStats.amount.toFixed(2)}</span>
                            </div>
                        </div>

                        {/* Cow Milk Table */}
                        <div className="table-section" style={{ marginBottom: '30px' }}>
                            <h3 style={{ fontSize: '1.2rem', color: '#10b981', marginBottom: '10px' }}>🐄 {t('billing.cowSummary')}</h3>
                            <div className="table-container">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>{t('common.farmerId')}</th>
                                            <th>{t('farmers.name')}</th>
                                            <th>{t('common.cow')} (L)</th>
                                            <th>{t('common.total')} (L)</th>
                                            <th>{t('entries.avgFat')}</th>
                                            <th>Avg SNF</th>
                                            <th>{t('collection.amount')} (₹)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {farmerAggregates
                                            .filter(f => f.cowLiters > 0)
                                            .map(f => (
                                                <tr key={f.farmerId} onClick={() => toggleView('single', f.farmerId)} className="clickable-row">
                                                    <td>{f.manualId}</td>
                                                    <td>{f.name}</td>
                                                    <td>{f.cowLiters.toFixed(2)}</td>
                                                    <td><strong>{f.cowLiters.toFixed(2)}</strong></td>
                                                    <td>{f.avgCowFat}</td>
                                                    <td>{f.avgCowSnf}</td>
                                                    <td className="amount">₹ {f.cowAmount.toFixed(2)}</td>
                                                </tr>
                                            ))}
                                        {farmerAggregates.filter(f => f.cowLiters > 0).length === 0 && (
                                            <tr><td colSpan="7" style={{ textAlign: 'center', color: '#94a3b8' }}>{t('farmers.noFarmers')}</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Buffalo Milk Table */}
                        <div className="table-section">
                            <h3 style={{ fontSize: '1.2rem', color: '#3b82f6', marginBottom: '10px' }}>🐃 {t('billing.buffSummary')}</h3>
                            <div className="table-container">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>{t('common.farmerId')}</th>
                                            <th>{t('farmers.name')}</th>
                                            <th>{t('common.buffalo')} (L)</th>
                                            <th>{t('common.total')} (L)</th>
                                            <th>{t('entries.avgFat')}</th>
                                            <th>Avg SNF</th>
                                            <th>{t('collection.amount')} (₹)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {farmerAggregates
                                            .filter(f => f.buffaloLiters > 0)
                                            .map(f => (
                                                <tr key={f.farmerId} onClick={() => toggleView('single', f.farmerId)} className="clickable-row">
                                                    <td>{f.manualId}</td>
                                                    <td>{f.name}</td>
                                                    <td>{f.buffaloLiters.toFixed(2)}</td>
                                                    <td><strong>{f.buffaloLiters.toFixed(2)}</strong></td>
                                                    <td>{f.avgBuffaloFat}</td>
                                                    <td>{f.avgBuffaloSnf}</td>
                                                    <td className="amount">₹ {f.buffaloAmount.toFixed(2)}</td>
                                                </tr>
                                            ))}
                                        {farmerAggregates.filter(f => f.buffaloLiters > 0).length === 0 && (
                                            <tr><td colSpan="7" style={{ textAlign: 'center', color: '#94a3b8' }}>{t('farmers.noFarmers')}</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {viewMode === 'single' && (
                    <>
                        {selectedFarmerData ? (
                            <div className="single-farmer-view">
                                <div className="bill-header">
                                    <div className="society-info">
                                        <h2>{settings?.societyName || 'Milk Society'}</h2>
                                        <p style={{ margin: '4px 0', color: '#475569' }}>
                                            {currentBranch?.name}
                                            {currentBranch?.location ? `, ${currentBranch.location}` : ''}
                                            {` • ${shift === 'all' ? t('billing.allShifts') : (shift === 'morning' ? t('common.morning') : t('common.evening'))}`}
                                        </p>
                                        <p style={{ fontSize: '0.9rem', color: '#64748b' }}>
                                            {t('billing.period')}: {format(new Date(dateRange.startDate), 'dd MMM yyyy')} - {format(new Date(dateRange.endDate), 'dd MMM yyyy')}
                                        </p>
                                    </div>
                                    <div className="farmer-info">
                                        <h3>{selectedFarmerData.name}</h3>
                                        <p>{t('common.farmerId')}: {selectedFarmerData.manualId}</p>
                                    </div>
                                </div>

                                <div className="bill-table-container">
                                    <table className="bill-table">
                                        <thead>
                                            <tr>
                                                <th>{t('common.date')}</th>
                                                <th>{t('common.shift')}</th>
                                                <th>{t('collection.milkType')}</th>
                                                <th>Qty (L)</th>
                                                <th>FAT</th>
                                                <th>SNF</th>
                                                <th>{t('collection.rate')}</th>
                                                <th>{t('collection.amount')}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {selectedFarmerData.entries.map((e, idx) => {
                                                // Safe date parsing
                                                let dateStr = 'Invalid Date';
                                                try {
                                                    dateStr = format(new Date(e.date), 'dd/MM/yy');
                                                } catch (err) {
                                                    console.error("Date error:", err);
                                                }

                                                return (
                                                    <tr key={idx}>
                                                        <td>{dateStr}</td>
                                                        <td style={{ textTransform: 'capitalize' }}>{e.shift}</td>
                                                        <td>{e.milkType}</td>
                                                        <td>{Number(e.quantity).toFixed(2)}</td>
                                                        <td>{Number(e.fat).toFixed(1)}</td>
                                                        <td>{Number(e.snf).toFixed(1)}</td>
                                                        <td>{Number(e.rate).toFixed(2)}</td>
                                                        <td className="amount">{Number(e.amount).toFixed(2)}</td>
                                                    </tr>
                                                )
                                            })}
                                        </tbody>
                                        <tfoot>
                                            <tr>
                                                <td colSpan="3"><strong>{t('common.total')}</strong></td>
                                                <td><strong>{selectedFarmerData.totalLiters.toFixed(2)}</strong></td>
                                                <td><strong>{selectedFarmerData.avgFat}</strong></td>
                                                <td><strong>{selectedFarmerData.avgSnf}</strong></td>
                                                <td>-</td>
                                                <td className="amount"><strong>₹ {selectedFarmerData.totalAmount.toFixed(2)}</strong></td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            </div>
                        ) : (
                            <div className="empty-state">
                                <div style={{ fontSize: '1.2rem', marginBottom: '8px' }}>{t('billing.noDetails')}</div>
                                <div style={{ fontSize: '0.9rem' }}>{t('billing.selectFarmer')}</div>
                            </div>
                        )}
                    </>
                )}
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
        .billing-page { display: flex; flex-direction: column; gap: 20px; padding-bottom: 40px; }
        
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
        
        .action-bar { display: flex; justify-content: space-between; padding: 0 4px; align-items: center; margin-bottom: 24px; flex-wrap: wrap; gap: 12px; }
        .left-actions { display: flex; gap: 12px; align-items: center; }
        
        .view-toggle { display: flex; background: #f1f5f9; padding: 4px; border-radius: 8px; border: 1px solid #cbd5e1; gap: 4px; }
        .view-toggle button { border: none; background: transparent; padding: 6px 12px; border-radius: 6px; font-size: 0.85rem; font-weight: 600; color: #64748b; cursor: pointer; display: flex; align-items: center; gap: 6px; transition: all 0.2s; }
        .view-toggle button.active { background: white; color: #3b82f6; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }

        .basic-search { display: flex; align-items: center; gap: 8px; background: white; padding: 8px 12px; border-radius: 8px; border: 1px solid #e2e8f0; width: 250px; }
        .basic-search input { border: none; outline: none; width: 100%; font-size: 0.9rem; }

        .farmer-select select { padding: 8px 12px; border-radius: 8px; border: 1px solid #cbd5e1; outline: none; font-size: 0.9rem; color: #334155; background: white; min-width: 200px; }

        .search-box { display: flex; align-items: center; gap: 8px; background: white; padding: 8px 12px; border-radius: 8px; border: 1px solid #e2e8f0; width: 250px; }
        .search-box input { border: none; outline: none; width: 100%; font-size: 0.9rem; }
        
        .export-actions { display: flex; gap: 8px; }
        .export-actions button { width: 40px; height: 40px; border-radius: 8px; border: 1px solid #e2e8f0; background: white; color: #64748b; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s; }
        .export-actions button:hover { background: #f8fafc; color: #3b82f6; border-color: #3b82f6; }
        
        .content-area { background: white; border-radius: 16px; border: 1px solid #e2e8f0; min-height: 400px; padding: 24px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }

        .empty-state { text-align: center; padding: 40px; color: #64748b; }
        
        .summary-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 24px; }
        .card { padding: 16px; background: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0; display: flex; flex-direction: column; gap: 8px; }
        .card .label { font-size: 0.8rem; color: #64748b; font-weight: 600; text-transform: uppercase; }
        .card .value { font-size: 1.5rem; font-weight: 800; color: #1e293b; }
        .card .value.highlight { color: #3b82f6; }
        .sub-values { display: flex; gap: 10px; font-size: 0.85rem; color: #64748b; font-weight: 500; }
        
        .table-container { overflow-x: auto; }
        table { width: 100%; border-collapse: collapse; font-size: 0.95rem; }
        th { text-align: left; padding: 12px; background: #f8fafc; color: #64748b; font-weight: 600; border-bottom: 2px solid #e2e8f0; }
        td { padding: 12px; border-bottom: 1px solid #f1f5f9; color: #334155; }
        .clickable-row { cursor: pointer; transition: background 0.1s; }
        .clickable-row:hover { background: #f8fafc; }
        .amount { font-weight: 700; color: #059669; }
        .view-btn { padding: 4px 10px; font-size: 0.8rem; border: 1px solid #cbd5e1; background: white; border-radius: 4px; color: #475569; cursor: pointer; }
        
        /* Bill Styles */
        .bill-header { display: flex; justify-content: space-between; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 20px; }
        .society-info h2 { margin: 0 0 4px 0; color: #3b82f6; }
        .farmer-info { text-align: right; }
        .farmer-info h3 { margin: 0 0 4px 0; }
        
        .bill-table th { background: #3b82f6; color: white; }
        .bill-table tfoot td { border-top: 2px solid #cbd5e1; border-bottom: none; font-size: 1rem; padding: 16px 12px; }

        @media print {
          body * { visibility: hidden; }
          .printable-area, .printable-area * { visibility: visible; }
          .printable-area { position: absolute; left: 0; top: 0; width: 100%; margin: 0; padding: 20px; background: white; }
          
          .hide-on-print { display: none !important; }
          .billing-page { padding: 0; margin: 0; }
          
          .bill-table th { background: #eee !important; color: black !important; -webkit-print-color-adjust: exact; }
          .card { border: 1px solid #ccc; break-inside: avoid; page-break-inside: avoid; }
          .table-section { break-inside: avoid; page-break-inside: avoid; }
          
          /* Ensure headers print nicely */
          .bill-header { margin-bottom: 20px; border-bottom: 2px solid #000; }
        }

        /* Share Modal Styles */
        .share-modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 20px; }
        .share-modal { background: white; border-radius: 16px; width: 100%; max-width: 500px; max-height: 90vh; overflow-y: auto; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1); }
        .modal-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid #e2e8f0; }
        .modal-header h2 { margin: 0; font-size: 1.25rem; color: #1e293b; }
        .modal-header button { background: none; border: none; color: #64748b; cursor: pointer; padding: 4px; }
        .modal-body { padding: 20px; display: flex; flex-direction: column; gap: 20px; }
        
        .share-method-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 8px; }
        .method-card { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; padding: 20px; border: 2px solid #e2e8f0; border-radius: 12px; background: white; cursor: pointer; transition: all 0.2s; }
        .method-card:hover { border-color: #3b82f6; background: #f8fafc; }
        .method-card.active { border-color: #3b82f6; background: #eff6ff; }
        .method-card span { font-weight: 600; color: #1e293b; font-size: 0.95rem; }
        
        .icon-circle { width: 48px; height: 48px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; }
        .icon-circle.whatsapp { background: #25d366; }
        .icon-circle.sms { background: #3b82f6; }

        .number-toggle { display: flex; flex-direction: column; gap: 10px; }
        .number-toggle label { display: flex; align-items: center; gap: 8px; font-size: 0.95rem; color: #334155; cursor: pointer; }
        .custom-number-input { display: flex; flex-direction: column; gap: 8px; }
        .custom-number-input label { font-size: 0.9rem; font-weight: 600; color: #64748b; }
        .input-with-icon { position: relative; display: flex; align-items: center; }
        .input-with-icon svg { position: absolute; left: 12px; color: #94a3b8; }
        .input-with-icon input { width: 100%; padding: 10px 10px 10px 40px; border: 1px solid #cbd5e1; border-radius: 8px; outline: none; }
        .message-preview { display: flex; flex-direction: column; gap: 8px; }
        .message-preview label { font-size: 0.9rem; font-weight: 600; color: #64748b; }
        .message-preview pre { background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0; font-size: 0.85rem; white-space: pre-wrap; color: #334155; max-height: 200px; overflow-y: auto; text-align: left; }
        .modal-footer { padding: 16px 20px; border-top: 1px solid #e2e8f0; display: flex; justify-content: flex-end; gap: 12px; }
        .cancel-btn { padding: 10px 20px; border-radius: 8px; border: 1px solid #cbd5e1; background: white; color: #64748b; font-weight: 600; cursor: pointer; }
        .send-btn { padding: 10px 20px; border-radius: 8px; border: none; background: #3b82f6; color: white; font-weight: 600; cursor: pointer; }
        .send-btn:hover { background: #2563eb; }

        @media (max-width: 768px) {
            .billing-page { gap: 16px; }
            .page-header { flex-direction: column; align-items: stretch; }
            .controls-area { flex-direction: column; width: 100%; }
            .period-selector { width: 100%; }
            .date-inputs { flex-direction: column; width: 100%; }
            .date-inputs input { width: 100%; }
            .action-bar { flex-direction: column; align-items: stretch; }
            .left-actions { flex-direction: column; width: 100%; }
            .view-toggle { width: 100%; }
            .farmer-select select { width: 100%; min-width: auto; }
            .basic-search, .search-box { width: 100%; }
            .export-actions { width: 100%; justify-content: space-between; }
            .export-actions button { flex: 1; }
            .summary-cards { grid-template-columns: 1fr; gap: 12px; }
            .content-area { padding: 16px; }
            .table-container { overflow-x: auto; -webkit-overflow-scrolling: touch; }
            table th, table td { padding: 8px 6px; font-size: 0.8rem; }
            .share-method-grid { grid-template-columns: 1fr; }
            .modal-footer { flex-direction: column-reverse; }
            .modal-footer button { width: 100%; }
        }
      `}} />

            {/* Share Modal */}
            {showShareModal && (
                <div className="share-modal-overlay hide-on-print">
                    <div className="share-modal">
                        <div className="modal-header">
                            <h2>{t('billing.shareSummary')}</h2>
                            <button onClick={() => setShowShareModal(false)}><X size={20} /></button>
                        </div>
                        <div className="modal-body">
                            <div className="share-method-grid">
                                <button
                                    className={`method-card ${shareMode === 'whatsapp' ? 'active' : ''}`}
                                    onClick={() => setShareMode('whatsapp')}
                                >
                                    <div className="icon-circle whatsapp">
                                        <Share2 size={24} />
                                    </div>
                                    <span>{t('billing.whatsapp')}</span>
                                </button>
                                <button
                                    className={`method-card ${shareMode === 'sms' ? 'active' : ''}`}
                                    onClick={() => setShareMode('sms')}
                                >
                                    <div className="icon-circle sms">
                                        <MessageSquare size={24} />
                                    </div>
                                    <span>{t('billing.sms')}</span>
                                </button>
                            </div>

                            {viewMode === 'single' && (
                                <div className="number-toggle">
                                    <label>
                                        <input
                                            type="radio"
                                            name="numberSource"
                                            checked={!useCustomNumber}
                                            onChange={() => setUseCustomNumber(false)}
                                        />
                                        {t('billing.farmerNumber')} ({farmers.find(f => f.id === selectedFarmerId)?.phone || 'None'}, ID: {farmers.find(f => f.id === selectedFarmerId)?.manualId || 'N/A'})
                                    </label>
                                    <label>
                                        <input
                                            type="radio"
                                            name="numberSource"
                                            checked={useCustomNumber}
                                            onChange={() => setUseCustomNumber(true)}
                                        />
                                        {t('billing.customNumber')}
                                    </label>
                                </div>
                            )}

                            {(useCustomNumber || viewMode === 'all') && (
                                <div className="custom-number-input">
                                    <label>{t('billing.mobileNumber')}</label>
                                    <div className="input-with-icon">
                                        <Phone size={16} />
                                        <input
                                            type="tel"
                                            value={customNumber}
                                            onChange={(e) => setCustomNumber(e.target.value)}
                                            placeholder={t('common.enterMobile')}
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="message-preview">
                                <label>{t('billing.messagePreview')}</label>
                                <pre>{generateShareMessage()}</pre>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="cancel-btn" onClick={() => setShowShareModal(false)}>{t('common.cancel')}</button>
                            <button className="send-btn" onClick={executeShare}>
                                {shareMode === 'whatsapp' ? t('billing.openWhatsapp') : t('billing.sendSms')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Billing;
