import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useBranch } from '../context/BranchContext';
import { db } from '../db/db';
import { useUser } from '../context/UserContext';
import { MessageSquare, Send, Bell, Phone, AlertTriangle, Users, Clock, CheckCircle, X, ChevronDown, ExternalLink, Trash2, ShieldAlert } from 'lucide-react';
import { format } from 'date-fns';
import { useLanguage } from '../context/LanguageContext';

const Notifications = () => {
    const { currentBranch } = useBranch();
    const { isFarmer } = useUser();
    const { t } = useLanguage();
    const location = useLocation();
    const [activeTab, setActiveTab] = useState(location.state?.tab || 'emergency');
    const [farmers, setFarmers] = useState([]);
    const [showFarmerDropdown, setShowFarmerDropdown] = useState(false);
    const [showNoMilkDropdown, setShowNoMilkDropdown] = useState(false);


    // Emergency Request State
    const [emergencyData, setEmergencyData] = useState({
        liters: '',
        shift: 'Morning',
        selectedFarmers: [],
        recipientType: 'farmers',
        customNumbers: ''
    });

    // No Milk Alert State
    const [noMilkData, setNoMilkData] = useState({
        shift: 'Morning',
        selectedFarmers: [],
        recipientType: 'farmers',
        customNumbers: '',
        eligibleFarmers: []
    });

    useEffect(() => {
        if (currentBranch) {
            loadFarmers();
        }
    }, [currentBranch]);

    useEffect(() => {
        if (currentBranch && noMilkData.shift) {
            loadEligibleFarmersForNoMilk();
        }
    }, [currentBranch, noMilkData.shift]);

    const loadFarmers = async () => {
        const farmersList = await db.farmers.where('branchId').equals(currentBranch.id).toArray();
        setFarmers(farmersList);
    };

    const loadEligibleFarmersForNoMilk = async () => {
        const today = format(new Date(), 'yyyy-MM-dd');

        // Get all farmers
        const allFarmers = await db.farmers.where('branchId').equals(currentBranch.id).toArray();

        // Get today's entries for the selected shift using SQL-level filtering
        const todayEntries = await db.entries
            .where({ branchId: currentBranch.id, date: today, shift: noMilkData.shift })
            .toArray();

        const farmerIdsWithEntries = new Set(todayEntries.map(e => e.farmerId));

        // Filter farmers who DON'T have entries for this shift
        const eligible = allFarmers.filter(f => !farmerIdsWithEntries.has(f.id));

        setNoMilkData(prev => ({ ...prev, eligibleFarmers: eligible, selectedFarmers: [] }));
    };


    const normalizePhone = (phone) => {
        if (!phone) return '';
        let clean = phone.replace(/\D/g, '');
        if (clean.length === 10) return `91${clean}`;
        return clean;
    };

    const toggleFarmerSelection = (farmerId, isEmergency = true) => {
        if (isEmergency) {
            setEmergencyData(prev => ({
                ...prev,
                selectedFarmers: prev.selectedFarmers.includes(farmerId)
                    ? prev.selectedFarmers.filter(id => id !== farmerId)
                    : [...prev.selectedFarmers, farmerId]
            }));
        } else {
            setNoMilkData(prev => ({
                ...prev,
                selectedFarmers: prev.selectedFarmers.includes(farmerId)
                    ? prev.selectedFarmers.filter(id => id !== farmerId)
                    : [...prev.selectedFarmers, farmerId]
            }));
        }
    };

    const sendEmergencyRequest = async (channel) => {
        if (!emergencyData.liters || emergencyData.liters <= 0) {
            alert(t('notifications.enterLiters'));
            return;
        }

        const rawRecipients = emergencyData.recipientType === 'farmers'
            ? emergencyData.selectedFarmers.map(id => {
                const f = farmers.find(farm => farm.id === id);
                return { name: f?.name, phone: f?.phone };
            }).filter(r => r.phone)
            : emergencyData.customNumbers.split(',').map(n => ({ name: 'Custom', phone: n.trim() })).filter(r => r.phone);

        if (rawRecipients.length === 0) {
            alert(t('notifications.selectRecipients'));
            return;
        }

        const shiftLabel = emergencyData.shift === 'Morning' ? t('common.morning') : t('common.evening');
        const message = `🥛 *${t('notifications.emergencyMessage')}*\n${t('notifications.need')} ${emergencyData.liters} L\n${t('notifications.shift')} ${shiftLabel}\nPlease confirm.\n\n- ${currentBranch.name}\n📍 ${currentBranch.location}\n📞 ${currentBranch.memberMobile || ''}`;

        if (channel === 'whatsapp') {
            for (const r of rawRecipients) {
                const phone = normalizePhone(r.phone);
                const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
                alert(`${t('notifications.sendTo')}: ${r.name} (${r.phone})`);
                window.open(url, '_blank');
            }
        } else {
            const phones = rawRecipients.map(r => r.phone);
            const smsLink = `sms:${phones.join(',')}?body=${encodeURIComponent(message)}`;
            window.location.href = smsLink;
        }
    };

    const sendNoMilkAlert = async (channel) => {
        const rawRecipients = noMilkData.recipientType === 'farmers'
            ? noMilkData.selectedFarmers.map(id => {
                const f = noMilkData.eligibleFarmers.find(farm => farm.id === id);
                return { name: f?.name, phone: f?.phone };
            }).filter(r => r.phone)
            : noMilkData.customNumbers.split(',').map(n => ({ name: 'Custom', phone: n.trim() })).filter(r => r.phone);

        if (rawRecipients.length === 0) {
            alert(t('notifications.selectRecipients'));
            return;
        }

        const shiftLabel = noMilkData.shift === 'Morning' ? t('common.morning') : t('common.evening');
        const message = `❌ *${t('notifications.noMilkMessage')}*\n${t('notifications.today')} ${shiftLabel} ${t('notifications.shift')}\n\n- ${currentBranch.name}\n📍 ${currentBranch.location}\n📞 ${currentBranch.memberMobile || ''}`;

        if (channel === 'whatsapp') {
            for (const r of rawRecipients) {
                const phone = normalizePhone(r.phone);
                const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
                alert(`${t('notifications.sendTo')}: ${r.name} (${r.phone})`);
                window.open(url, '_blank');
            }
        } else {
            const phones = rawRecipients.map(r => r.phone);
            const smsLink = `sms:${phones.join(',')}?body=${encodeURIComponent(message)}`;
            window.location.href = smsLink;
        }
    };



    return (
        <div className="notifications-page">
            <div className="page-header">
                <h1>{t('notifications.title')}</h1>
                <p>{t('notifications.subtitle')}</p>
            </div>

            {isFarmer ? (
                <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
                    <ShieldAlert size={48} color="#ef4444" style={{ margin: '0 auto 20px' }} />
                    <h2>{t('notifications.accessRestricted')}</h2>
                    <p>{t('notifications.restrictedMessage')}</p>
                </div>
            ) : (
                <>
                    <div className="notification-tabs">
                        <button
                            className={`tab ${activeTab === 'emergency' ? 'active' : ''}`}
                            onClick={() => setActiveTab('emergency')}
                        >
                            <AlertTriangle size={18} /> {t('notifications.emergency')}
                        </button>
                        <button
                            className={`tab ${activeTab === 'no-milk' ? 'active' : ''}`}
                            onClick={() => setActiveTab('no-milk')}
                        >
                            <Bell size={18} /> {t('notifications.noMilk')}
                        </button>
                    </div>

                    {activeTab === 'emergency' && (
                        <div className="card notification-form">
                            <h3><AlertTriangle size={20} /> {t('notifications.emergencyRequest')}</h3>
                            <div className="form-grid">
                                <div className="form-group">
                                    <label>{t('notifications.litersNeeded')}</label>
                                    <input
                                        type="number"
                                        className="rural-input"
                                        placeholder="e.g. 100"
                                        value={emergencyData.liters}
                                        onChange={(e) => setEmergencyData({ ...emergencyData, liters: e.target.value })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>{t('notifications.shift')}</label>
                                    <select
                                        className="rural-input"
                                        value={emergencyData.shift}
                                        onChange={(e) => setEmergencyData({ ...emergencyData, shift: e.target.value })}
                                    >
                                        <option value="Morning">{t('common.morning')}</option>
                                        <option value="Evening">{t('common.evening')}</option>
                                    </select>
                                </div>
                            </div>

                            <div className="form-group">
                                <label>{t('notifications.sendTo')}</label>
                                <div className="recipient-toggle">
                                    <button
                                        className={`toggle-btn ${emergencyData.recipientType === 'farmers' ? 'active' : ''}`}
                                        onClick={() => setEmergencyData({ ...emergencyData, recipientType: 'farmers' })}
                                    >
                                        <Users size={16} /> {t('notifications.selectFarmers')}
                                    </button>
                                    <button
                                        className={`toggle-btn ${emergencyData.recipientType === 'custom' ? 'active' : ''}`}
                                        onClick={() => setEmergencyData({ ...emergencyData, recipientType: 'custom' })}
                                    >
                                        <Phone size={16} /> {t('notifications.customNumbers')}
                                    </button>
                                </div>
                            </div>

                            {emergencyData.recipientType === 'farmers' && (
                                <div className="form-group">
                                    <label>{t('notifications.selectFarmers')}</label>
                                    <div className="custom-dropdown">
                                        <button
                                            className="dropdown-trigger"
                                            onClick={() => setShowFarmerDropdown(!showFarmerDropdown)}
                                        >
                                            <span>
                                                {emergencyData.selectedFarmers.length === 0
                                                    ? t('notifications.selectFarmers') + '...'
                                                    : `${emergencyData.selectedFarmers.length} ${t('common.farmer')}(s) selected`}
                                            </span>
                                            <ChevronDown size={18} />
                                        </button>
                                        {showFarmerDropdown && (
                                            <div className="dropdown-menu">
                                                {farmers.map(farmer => (
                                                    <label key={farmer.id} className="dropdown-item">
                                                        <input
                                                            type="checkbox"
                                                            checked={emergencyData.selectedFarmers.includes(farmer.id)}
                                                            onChange={() => toggleFarmerSelection(farmer.id, true)}
                                                        />
                                                        <span>{farmer.name}</span>
                                                        <span className="phone-hint">{farmer.phone}</span>
                                                    </label>
                                                ))}
                                                {farmers.length === 0 && <div className="empty-dropdown">{t('farmers.noFarmers')}</div>}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {emergencyData.recipientType === 'custom' && (
                                <div className="form-group">
                                    <label>{t('notifications.phoneNumbers')}</label>
                                    <textarea
                                        className="rural-input"
                                        placeholder="9876543210, 9876543211"
                                        value={emergencyData.customNumbers}
                                        onChange={(e) => setEmergencyData({ ...emergencyData, customNumbers: e.target.value })}
                                        rows="2"
                                    />
                                </div>
                            )}

                            <div className="message-preview">
                                <strong>{t('notifications.preview')}:</strong>
                                <p>🥛 {t('notifications.emergencyMessage')}<br />{t('notifications.need')} {emergencyData.liters || '___'} L • {emergencyData.shift === 'Morning' ? t('common.morning') : t('common.evening')}<br />- {currentBranch?.name}</p>
                            </div>

                            <div className="action-buttons">
                                <button className="btn btn-accent" onClick={() => sendEmergencyRequest('whatsapp')}>
                                    <Send size={18} /> {t('notifications.sendWhatsapp')}
                                </button>
                                <button className="btn btn-secondary" onClick={() => sendEmergencyRequest('sms')}>
                                    <Phone size={18} /> {t('notifications.sendSms')}
                                </button>
                            </div>
                        </div>
                    )}

                    {activeTab === 'no-milk' && (
                        <div className="card notification-form">
                            <h3><Bell size={20} /> {t('notifications.noMilkAlert')}</h3>
                            <div className="form-group">
                                <label>{t('notifications.shift')}</label>
                                <select
                                    className="rural-input"
                                    value={noMilkData.shift}
                                    onChange={(e) => setNoMilkData({ ...noMilkData, shift: e.target.value })}
                                >
                                    <option value="Morning">{t('common.morning')}</option>
                                    <option value="Evening">{t('common.evening')}</option>
                                </select>
                                <small className="hint">{t('notifications.hintEntries')}</small>
                            </div>

                            <div className="form-group">
                                <label>{t('notifications.sendTo')}</label>
                                <div className="recipient-toggle">
                                    <button
                                        className={`toggle-btn ${noMilkData.recipientType === 'farmers' ? 'active' : ''}`}
                                        onClick={() => setNoMilkData({ ...noMilkData, recipientType: 'farmers' })}
                                    >
                                        <Users size={16} /> {t('notifications.selectFarmers')}
                                    </button>
                                    <button
                                        className={`toggle-btn ${noMilkData.recipientType === 'custom' ? 'active' : ''}`}
                                        onClick={() => setNoMilkData({ ...noMilkData, recipientType: 'custom' })}
                                    >
                                        <Phone size={16} /> {t('notifications.customNumbers')}
                                    </button>
                                </div>
                            </div>

                            {noMilkData.recipientType === 'farmers' && (
                                <div className="form-group">
                                    <label>{t('notifications.selectFarmers')} ({noMilkData.eligibleFarmers.length} eligible)</label>
                                    <div className="custom-dropdown">
                                        <button
                                            className="dropdown-trigger"
                                            onClick={() => setShowNoMilkDropdown(!showNoMilkDropdown)}
                                        >
                                            <span>
                                                {noMilkData.selectedFarmers.length === 0
                                                    ? `${t('notifications.selectFarmers')}...`
                                                    : `${noMilkData.selectedFarmers.length} selected`}
                                            </span>
                                            <ChevronDown size={18} />
                                        </button>
                                        {showNoMilkDropdown && (
                                            <div className="dropdown-menu">
                                                {noMilkData.eligibleFarmers.map(farmer => (
                                                    <label key={farmer.id} className="dropdown-item">
                                                        <input
                                                            type="checkbox"
                                                            checked={noMilkData.selectedFarmers.includes(farmer.id)}
                                                            onChange={() => toggleFarmerSelection(farmer.id, false)}
                                                        />
                                                        <span>{farmer.name}</span>
                                                        <span className="phone-hint">{farmer.phone}</span>
                                                    </label>
                                                ))}
                                                {noMilkData.eligibleFarmers.length === 0 && <div className="empty-dropdown">{t('farmers.noFarmers')}</div>}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {noMilkData.recipientType === 'custom' && (
                                <div className="form-group">
                                    <label>{t('notifications.phoneNumbers')}</label>
                                    <textarea
                                        className="rural-input"
                                        placeholder="9876543210, 9876543211"
                                        value={noMilkData.customNumbers}
                                        onChange={(e) => setNoMilkData({ ...noMilkData, customNumbers: e.target.value })}
                                        rows="2"
                                    />
                                </div>
                            )}

                            <div className="message-preview">
                                <strong>{t('notifications.preview')}:</strong>
                                <p>❌ {t('notifications.noMilkMessage')}<br />{t('notifications.today')} {noMilkData.shift === 'Morning' ? t('common.morning') : t('common.evening')} {t('notifications.shift')}<br />- {currentBranch?.name}</p>
                            </div>

                            <div className="action-buttons">
                                <button className="btn btn-accent" onClick={() => sendNoMilkAlert('whatsapp')}>
                                    <Send size={18} /> {t('notifications.sendWhatsapp')}
                                </button>
                                <button className="btn btn-secondary" onClick={() => sendNoMilkAlert('sms')}>
                                    <Phone size={18} /> {t('notifications.sendSms')}
                                </button>
                            </div>
                        </div>
                    )}


                    <style dangerouslySetInnerHTML={{
                        __html: `
                .notifications-page { display: flex; flex-direction: column; gap: 24px; max-width: 800px; padding-bottom: 40px; }
                .page-header h1 { color: var(--primary); font-size: 1.75rem; }
                
                .notification-tabs { display: flex; gap: 12px; background: #f1f5f9; padding: 6px; border-radius: 12px; overflow-x: auto; scrollbar-width: none; }
                .tab { display: flex; align-items: center; justify-content: center; gap: 10px; padding: 12px 20px; border-radius: 8px; border: none; background: transparent; cursor: pointer; font-weight: 700; color: #64748b; transition: 0.2s; white-space: nowrap; font-size: 0.95rem; flex: 1; }
                .tab.active { background: white; color: var(--primary); box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
                .queue-badge { position: absolute; top: -5px; right: -5px; background: #ef4444; color: white; width: 18px; height: 18px; border-radius: 50%; font-size: 0.7rem; display: flex; align-items: center; justify-content: center; }
                .notification-form h3 { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; font-size: 1.1rem; }
                .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
                .recipient-toggle { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 8px; }
                .toggle-btn { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 10px; background: #fff; border: 2px solid #e2e8f0; border-radius: 10px; cursor: pointer; font-weight: 700; color: #64748b; transition: 0.2s; font-size: 0.85rem; }
                .toggle-btn.active { background: #f0fdf4; border-color: var(--primary); color: var(--primary); }
                .custom-dropdown { position: relative; }
                .dropdown-trigger { width: 100%; display: flex; justify-content: space-between; align-items: center; padding: 10px 16px; background: white; border: 1px solid var(--border); border-radius: 10px; cursor: pointer; font-size: 0.9rem; color: var(--secondary); }
                .dropdown-menu { position: absolute; top: 100%; left: 0; right: 0; margin-top: 8px; background: white; border: 1px solid var(--border); border-radius: 10px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); max-height: 250px; overflow-y: auto; z-index: 100; }
                .dropdown-item { display: flex; align-items: center; gap: 12px; padding: 10px 16px; cursor: pointer; border-bottom: 1px solid #f1f5f9; }
                .dropdown-item:hover { background: #f8fafc; }
                .phone-hint { font-size: 0.7rem; color: #94a3b8; margin-left: auto; }
                .message-preview { background: #f8fafc; padding: 12px; border-radius: 10px; border: 1px solid var(--border); margin: 16px 0; }
                .message-preview strong { font-size: 0.8rem; color: #64748b; }
                .message-preview p { font-family: monospace; font-size: 0.85rem; margin-top: 4px; white-space: pre-line; }
                .action-buttons { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
                .card-header-flex { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
                .queue-hint { font-size: 0.85rem; color: #64748b; margin-bottom: 20px; padding: 10px; background: #fffbeb; border-radius: 8px; border: 1px solid #fef3c7; color: #92400e; }
                .queue-list { display: flex; flex-direction: column; gap: 10px; }
                .queue-item { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: white; border: 1px solid var(--border); border-radius: 12px; transition: 0.2s; }
                .queue-item.sent { opacity: 0.6; background: #f8fafc; }
                .queue-info { display: flex; flex-direction: column; }
                .q-name { font-weight: 700; color: var(--secondary); font-size: 0.95rem; }
                .q-phone { font-size: 0.8rem; color: #64748b; }
                .q-status { color: #16a34a; font-weight: 700; display: flex; align-items: center; gap: 6px; font-size: 0.9rem; }
                .btn-sm { padding: 6px 12px; font-size: 0.8rem; height: auto; }
                @media (max-width: 600px) {
                    .notifications-page { gap: 16px; max-width: 100%; }
                    .form-grid { grid-template-columns: 1fr; }
                    .recipient-toggle { grid-template-columns: 1fr; }
                    .action-buttons { grid-template-columns: 1fr; }
                    .notification-tabs { padding: 4px; }
                    .tab { padding: 8px 12px; font-size: 0.85rem; }
                    .queue-item { flex-direction: column; align-items: flex-start; gap: 8px; }
                }
                `
                    }} />
                </>
            )}
        </div>
    );
};

export default Notifications;
