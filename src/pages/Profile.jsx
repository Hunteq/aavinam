import React, { useState, useEffect } from 'react';
import { useBranch } from '../context/BranchContext';
import { db, exportDatabase, importDatabase } from '../db/db';
import { Save, Globe, Lock, User, Download, Upload, CheckCircle, Building2, ClipboardList, Trash2 } from 'lucide-react';
import { useUser } from '../context/UserContext';
import { useLanguage } from '../context/LanguageContext';
import DeleteAccountModal from '../components/DeleteAccountModal';

const Profile = () => {
    const { currentBranch, updateBranch } = useBranch();
    const { user, isFarmer, isOwner, isMember, logout } = useUser();
    const { language, changeLanguage, t } = useLanguage();
    const [profile, setProfile] = useState({
        memberName: '',
        memberMobile: '',
        contactNumber: '',
        pin: ''
    });
    const [society, setSociety] = useState({
        name: '',
        location: '',
        owners: [{ name: '', mobile: '' }]
    });
    const [showStatus, setShowStatus] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        loadData();
    }, [currentBranch]);

    const loadData = async () => {
        const globalSettings = await db.settings.get('global');

        if (currentBranch) {
            setProfile({
                memberName: currentBranch.memberName || '',
                memberMobile: currentBranch.memberMobile || '',
                contactNumber: currentBranch.contactNumber || '',
                pin: globalSettings?.pin || ''
            });
        }

        if (globalSettings) {
            setSociety({
                name: globalSettings.societyName || '',
                location: globalSettings.location || '',
                owners: globalSettings.owners || [{ name: '', mobile: '' }]
            });
        }
    };

    const handleOwnerChange = (index, field, value) => {
        const newOwners = [...society.owners];
        newOwners[index][field] = value;
        setSociety({ ...society, owners: newOwners });
    };

    const addOwner = () => {
        if (society.owners.length < 3) {
            setSociety({ ...society, owners: [...society.owners, { name: '', mobile: '' }] });
        }
    };

    const removeOwner = (index) => {
        if (society.owners.length > 1) {
            const newOwners = society.owners.filter((_, i) => i !== index);
            setSociety({ ...society, owners: newOwners });
        }
    };

    const handleSave = async () => {
        if (!currentBranch) return;

        // Update branch details (Manager/Member info)
        await updateBranch(currentBranch.id, {
            memberName: profile.memberName,
            memberMobile: profile.memberMobile,
            contactNumber: profile.contactNumber,
        });

        // Save global society settings
        await db.settings.put({
            id: 'global',
            language: language,
            societyName: society.name,
            location: society.location,
            owners: society.owners,
            ownerMobile: society.owners[0]?.mobile || '',
            pin: profile.pin
        });

        setShowStatus(true);
        setTimeout(() => setShowStatus(false), 3000);
    };

    const handleExport = async () => {
        const data = await exportDatabase();
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `milk-app-backup-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleImport = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            const result = await importDatabase(event.target.result);
            if (result.success) {
                alert('Data restored successfully! The app will now reload.');
                window.location.reload();
            } else {
                alert('Failed to restore data: ' + result.error);
            }
        };
        reader.readAsText(file);
    };

    const handleDeleteAccount = async () => {
        setIsDeleting(true);
        try {
            // Delete all data from all tables
            await db.branches.clear();
            await db.farmers.clear();
            await db.entries.clear();
            await db.rates.clear();
            await db.products.clear();
            await db.notifications.clear();
            await db.settings.clear();

            // Close modal and logout
            setShowDeleteModal(false);
            alert('Account and all data have been successfully deleted. You will be logged out.');

            // Logout user
            setTimeout(() => {
                logout();
            }, 500);
        } catch (error) {
            console.error('Error deleting account:', error);
            alert('Failed to delete account. Please try again.');
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div className="profile-page">
            <div className="page-header">
                <div className="title-area">
                    <h1>{t('common.settings')} & {t('common.profile')}</h1>
                    {showStatus && <span className="status-badge"><CheckCircle size={14} /> {t('common.saved')}</span>}
                </div>
                <button className="btn btn-primary" onClick={handleSave}>
                    <Save size={20} /> {t('common.save')}
                </button>
            </div>

            <div className="settings-grid">
                <div className="card">
                    <div className="card-header-flex">
                        <Globe size={24} color="var(--primary)" />
                        <h3>{t('settings.languageSettings')}</h3>
                    </div>
                    <div className="lang-selector">
                        <button className={`lang-btn ${language === 'en' ? 'active' : ''}`} onClick={() => changeLanguage('en')}>English</button>
                        <button className={`lang-btn ${language === 'ta' ? 'active' : ''}`} onClick={() => changeLanguage('ta')}>தமிழ் (Tamil)</button>
                        <button className={`lang-btn ${language === 'hi' ? 'active' : ''}`} onClick={() => changeLanguage('hi')}>हिन्दी (Hindi)</button>
                    </div>
                </div>

                {!isFarmer && (
                    <>
                        <div className="card full-width">
                            <div className="card-header-flex">
                                <Building2 size={24} color="var(--primary)" />
                                <h3>{t('settings.societyProfile')}</h3>
                            </div>
                            <div className="form-grid-2">
                                <div className="form-group">
                                    <label>{t('settings.societyName')}</label>
                                    <input type="text" className="rural-input" value={society.name} onChange={(e) => setSociety({ ...society, name: e.target.value })} placeholder="e.g. Green Valley Milk Federation" />
                                </div>
                                <div className="form-group">
                                    <label>{t('settings.societyLocation')}</label>
                                    <input type="text" className="rural-input" value={society.location} onChange={(e) => setSociety({ ...society, location: e.target.value })} placeholder="e.g. Coimbatore, Tamil Nadu" />
                                </div>
                            </div>

                            <div className="owners-section" style={{ marginTop: '24px' }}>
                                <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                    <h4 style={{ margin: 0 }}>{t('settings.societyOwners')}</h4>
                                    {society.owners.length < 3 && (
                                        <button className="btn btn-secondary btn-sm" onClick={addOwner}>+ {t('common.add')} {t('onboarding.owner')}</button>
                                    )}
                                </div>
                                <div className="owners-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                                    {society.owners.map((owner, idx) => (
                                        <div key={idx} className="owner-card" style={{ padding: '16px', border: '1px solid var(--border)', borderRadius: '10px', position: 'relative' }}>
                                            {society.owners.length > 1 && (
                                                <button
                                                    onClick={() => removeOwner(idx)}
                                                    style={{ position: 'absolute', top: '10px', right: '10px', border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer', fontWeight: 'bold' }}
                                                >✕</button>
                                            )}
                                            <h5 style={{ marginTop: 0, marginBottom: '12px', color: '#64748b' }}>{t('onboarding.owner')} {idx + 1}</h5>
                                            <div className="form-group" style={{ marginBottom: '12px' }}>
                                                <label>{t('farmers.name')}</label>
                                                <input
                                                    type="text"
                                                    className="rural-input"
                                                    value={owner.name}
                                                    onChange={(e) => handleOwnerChange(idx, 'name', e.target.value)}
                                                    placeholder={t('common.enterName')}
                                                />
                                            </div>
                                            <div className="form-group">
                                                <label>{t('farmers.mobile')}</label>
                                                <input
                                                    type="tel"
                                                    className="rural-input"
                                                    value={owner.mobile}
                                                    onChange={(e) => handleOwnerChange(idx, 'mobile', e.target.value)}
                                                    placeholder={t('common.enterMobile')}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="card">
                            <div className="card-header-flex">
                                <Lock size={24} color="#ea580c" />
                                <h3>{t('onboarding.enterPin').split(' ')[3] || 'Security PIN'}</h3>
                            </div>
                            <p className="desc">{t('onboarding.enterPin')}</p>
                            <div className="pin-input-group" style={{ marginTop: '20px' }}>
                                <input
                                    type="password"
                                    maxLength="4"
                                    className="rural-input pin-field"
                                    placeholder="• • • •"
                                    value={profile.pin}
                                    onChange={(e) => setProfile({ ...profile, pin: e.target.value.replace(/\D/g, '') })}
                                />
                            </div>
                        </div>

                        <div className="card">
                            <div className="card-header-flex">
                                <Building2 size={24} color="var(--primary)" />
                                <h3>{t('common.branches')}</h3>
                            </div>
                            <p className="desc">{t('settings.manageBranches')}</p>
                            <div style={{ marginTop: '24px' }}>
                                <button
                                    className="btn btn-primary"
                                    style={{ width: '100%', justifyContent: 'center' }}
                                    onClick={() => window.location.href = '/branches'}
                                >
                                    {t('settings.manageBranches')}
                                </button>
                            </div>
                        </div>

                        <div className="card">
                            <div className="card-header-flex">
                                <ClipboardList size={24} color="#ea580c" />
                                <h3>{t('common.rates')}</h3>
                            </div>
                            <p className="desc">{t('settings.configureRates')}</p>
                            <div style={{ marginTop: '24px' }}>
                                <button
                                    className="btn btn-secondary"
                                    style={{ width: '100%', justifyContent: 'center' }}
                                    onClick={() => window.location.href = '/rates'}
                                >
                                    {t('settings.configureRates')}
                                </button>
                            </div>
                        </div>

                        <div className="card">
                            <div className="card-header-flex">
                                <Download size={24} color="#2563eb" />
                                <h3>{t('settings.dataManagement')}</h3>
                            </div>

                            <p className="desc">{t('settings.backupDesc')}</p>
                            <div className="data-actions" style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <button className="btn btn-secondary" onClick={handleExport} style={{ width: '100%', justifyContent: 'center' }}>
                                    <Download size={18} /> {t('settings.exportData')}
                                </button>
                                <div className="import-wrapper">
                                    <label className="btn btn-accent" style={{ cursor: 'pointer', width: '100%', justifyContent: 'center' }}>
                                        <Upload size={18} /> {t('settings.importData')}
                                        <input type="file" accept=".json" onChange={handleImport} style={{ display: 'none' }} />
                                    </label>
                                </div>
                            </div>
                        </div>

                        <div className="card delete-account-card">
                            <div className="card-header-flex">
                                <Trash2 size={24} color="#dc2626" />
                                <h3 style={{ color: '#dc2626' }}>{t('settings.deleteAccount')}</h3>
                            </div>
                            <p className="desc">{t('settings.deleteDesc')}</p>
                            <div style={{ marginTop: '24px' }}>
                                <button
                                    className="btn btn-danger-outline"
                                    style={{ width: '100%', justifyContent: 'center' }}
                                    onClick={() => setShowDeleteModal(true)}
                                >
                                    <Trash2 size={18} /> {t('settings.deleteAccount')}
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>

            <DeleteAccountModal
                isOpen={showDeleteModal}
                societyName={society.name}
                onConfirm={handleDeleteAccount}
                onCancel={() => setShowDeleteModal(false)}
                isLoading={isDeleting}
            />

            <style dangerouslySetInnerHTML={{
                __html: `
        .profile-page { display: flex; flex-direction: column; gap: 24px; }
        .settings-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 24px; }
        .card.full-width { grid-column: 1 / -1; }
        
        .title-area { display: flex; align-items: center; gap: 16px; }
        .status-badge { background: #dcfce7; color: #166534; padding: 4px 12px; border-radius: 100px; font-size: 0.85rem; font-weight: 600; display: flex; align-items: center; gap: 6px; }

        .card-header-flex { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
        .card-header-flex h3 { margin: 0; }

        .lang-selector { display: flex; flex-direction: column; gap: 10px; }
        .lang-btn { 
          padding: 14px; text-align: left; border: 2px solid var(--border); border-radius: var(--radius-md); 
          background: white; cursor: pointer; font-weight: 600; font-size: 1rem; transition: all 0.2s;
        }
        .lang-btn:hover { border-color: var(--primary-light); }
        .lang-btn.active { border-color: var(--primary); background: #f0fdf4; color: var(--primary); }

        .desc { color: var(--text-muted); font-size: 0.9rem; margin-top: 4px; }
        .pin-field { text-align: center; font-size: 2rem; letter-spacing: 12px; width: 180px; margin: 0 auto; display: block; }
        
        .checkbox-group { display: flex; align-items: center; gap: 10px; }
        .checkbox-group input { width: 20px; height: 20px; }

        .delete-account-card { border-left: 4px solid #dc2626; }
        .btn-danger-outline { 
          background: white; 
          color: #dc2626; 
          border: 2px solid #dc2626; 
          padding: 10px 20px;
          border-radius: 6px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .btn-danger-outline:hover { 
          background: #fef2f2; 
          border-color: #b91c1c;
          color: #b91c1c;
        }

        @media (max-width: 768px) {
            .profile-page { gap: 16px; }
            .settings-grid { grid-template-columns: 1fr; gap: 16px; }
            .title-area { flex-direction: column; align-items: flex-start; gap: 8px; }
            .pin-field { width: 140px; font-size: 1.5rem; letter-spacing: 8px; }
            .lang-btn { padding: 12px; font-size: 0.9rem; }
        }
      `}} />
        </div >
    );
};

export default Profile;
