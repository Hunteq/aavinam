import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { useLanguage } from '../context/LanguageContext';
import { db } from '../db/db';
import { User, Users, Shield, Search, MapPin, Phone, ArrowLeft, LogOut, Lock, Globe } from 'lucide-react';

const Onboarding = () => {
    const { login } = useUser();
    const { language, changeLanguage, t, languages } = useLanguage();
    const navigate = useNavigate();

    // State
    const [step, setStep] = useState('role'); // 'role', 'search', 'create-society', 'pin'
    const [selectedRole, setSelectedRole] = useState(null);
    const [selectedEntity, setSelectedEntity] = useState(null);
    const [pin, setPin] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [error, setError] = useState('');
    const [storedPin, setStoredPin] = useState('1234');

    // Form Data for Create Society
    const [formData, setFormData] = useState({
        societyName: '',
        location: '',
        ownerMobile: '',
        pin: '',
        confirmPin: ''
    });

    useEffect(() => {
        const loadSettings = async () => {
            const settings = await db.settings.get('global');
            if (settings) {
                if (settings.pin) setStoredPin(settings.pin);
                // If language is already set, we could potentially skip language step,
                // but user requested explicit language selection for onboarding.
            }
        };
        loadSettings();
    }, []);

    const roles = [
        { id: 'owner', title: t('onboarding.owner'), icon: Shield, description: t('onboarding.ownerDesc') },
        { id: 'member', title: t('onboarding.member'), icon: User, description: t('onboarding.memberDesc') },
        { id: 'farmer', title: t('onboarding.farmer'), icon: Users, description: t('onboarding.farmerDesc') },
    ];

    // Handlers
    const handleLanguageSelect = (langId) => {
        changeLanguage(langId);
        setStep('role');
    };

    const handleRoleSelect = (roleId) => {
        setSelectedRole(roleId);
        setStep('search');
        setSearchQuery('');
        setSearchResults([]);
    };

    const handleSearch = async (e) => {
        const query = e.target.value;
        setSearchQuery(query);

        if (query.length < 3) {
            setSearchResults([]);
            return;
        }

        let results = [];
        const lowerQuery = query.toLowerCase();

        if (selectedRole === 'owner') {
            // Search for Society (Settings)
            // Assuming we are searching LOCAL database for established profile
            const settings = await db.settings.get('global');
            if (settings && (settings.societyName?.toLowerCase().includes(lowerQuery) || settings.ownerMobile?.includes(query))) {
                results.push({
                    id: settings.id,
                    type: 'society',
                    name: settings.societyName,
                    location: settings.location,
                    ownerMobile: settings.ownerMobile,
                    pin: settings.pin
                });
            }
        } else if (selectedRole === 'member') {
            // Search Branches
            const branches = await db.branches.toArray();
            results = branches.filter(b =>
                b.name.toLowerCase().includes(lowerQuery) ||
                b.location?.toLowerCase().includes(lowerQuery) ||
                b.memberMobile?.includes(query)
            ).map(b => ({ ...b, type: 'branch', societyName: 'Milk Society' })); // Mock society name if not linked
        } else if (selectedRole === 'farmer') {
            // Search Farmers
            const farmers = await db.farmers.toArray();
            const branches = await db.branches.toArray();
            results = farmers.filter(f =>
                f.name.toLowerCase().includes(lowerQuery) ||
                f.phone?.includes(query) ||
                f.manualId?.toLowerCase().includes(lowerQuery)
            ).map(f => {
                const branch = branches.find(b => b.id === f.branchId);
                return { ...f, type: 'farmer', branch: branch };
            });
        }

        setSearchResults(results);
    };

    const handleEntitySelect = (item) => {
        setSelectedEntity(item);

        if (selectedRole === 'farmer') {
            login('farmer', {
                id: item.id,
                name: item.name,
                role: 'farmer',
                branchId: item.branchId
            });
            navigate('/dashboard');
            return;
        }

        setStep('pin');
        setPin('');
        setError('');
    };

    const handlePinSubmit = async () => {
        // Validation logic
        if (selectedRole === 'owner') {
            // Check against global pin
            const settings = await db.settings.get('global');
            if (settings && pin === settings.pin) {
                login('owner', { id: 'owner', name: settings.societyName, role: 'owner' });
                navigate('/dashboard');
            } else {
                setError('Invalid PIN');
            }
        } else {
            // For Member/Farmer, currently simplified to just check if PIN is 1234 or verify against something?
            // The original logic was likely verifying against a stored PIN or just simulating login for now.
            // Let's use the stored global PIN for simplicity or assume 1234 if not set.
            const settings = await db.settings.get('global');
            const validPin = settings?.pin || '1234';

            if (pin === validPin) {
                login(selectedRole, {
                    id: selectedEntity?.id || 'user',
                    name: selectedEntity?.name || 'User',
                    role: selectedRole,
                    branchId: selectedEntity?.branchId || selectedEntity?.id // dependent on type
                });
                navigate('/dashboard');
            } else {
                setError('Invalid PIN');
            }
        }
    };

    const handleCreateSociety = async (e) => {
        e.preventDefault();
        if (formData.pin !== formData.confirmPin) {
            setError(t('onboarding.pinError') || "PINs do not match");
            return;
        }

        try {
            await db.settings.put({
                id: 'global',
                societyName: formData.societyName,
                location: formData.location,
                ownerMobile: formData.ownerMobile,
                pin: formData.pin,
                language: language,
                createdAt: new Date(),
                updatedAt: new Date()
            });

            login('owner', { id: 'owner', name: formData.societyName, role: 'owner' });
            navigate('/dashboard');
        } catch (err) {
            console.error("Error creating society:", err);
            setError("Failed to create society profile");
        }
    };

    return (
        <div className="onboarding-page">
            <div className="onboarding-container">
                <div className="onboarding-header">
                    <div className="logo">🥛</div>
                    <h1>{t('onboarding.welcome')}</h1>
                    <p>{t('onboarding.selectProfile')}</p>

                    {(
                        <div className="language-switcher">
                            <div className="lang-dropdown">
                                <Globe size={18} />
                                <select
                                    value={language}
                                    onChange={(e) => changeLanguage(e.target.value)}
                                    className="lang-select"
                                >
                                    {languages.map(lang => (
                                        <option key={lang.id} value={lang.id}>
                                            {lang.native} ({lang.name})
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    )}
                </div>



                {step === 'role' && (
                    <div className="role-grid">

                        {roles.map((role) => (
                            <div key={role.id} className="role-card" onClick={() => handleRoleSelect(role.id)}>
                                <div className="role-icon">
                                    <role.icon size={32} />
                                </div>
                                <h3>{role.title}</h3>
                                <p>{role.description}</p>
                            </div>
                        ))}
                    </div>
                )}

                {step === 'search' && (
                    <div className="search-container card">
                        <div className="search-header">
                            <button className="btn-icon" onClick={() => setStep('role')}>
                                <ArrowLeft size={18} />
                            </button>
                            <h3>
                                {selectedRole === 'owner' ? t('onboarding.findSociety') :
                                    (selectedRole === 'member' ? t('onboarding.findBranch') : t('onboarding.findProfile'))}
                            </h3>
                        </div>

                        <div className="search-input-wrapper">
                            <Search size={20} className="search-icon" />
                            <input
                                type="text"
                                className="rural-input"
                                placeholder={
                                    selectedRole === 'owner' ? t('onboarding.searchPlaceholderOwner') :
                                        (selectedRole === 'member' ? t('onboarding.searchPlaceholderMember') : t('onboarding.searchPlaceholderFarmer'))
                                }
                                value={searchQuery}
                                onChange={handleSearch}
                                autoFocus
                            />
                        </div>

                        <div className="results-list">
                            {searchResults.map((item, idx) => (
                                <div key={item.id || idx} className="farmer-result-item" onClick={() => handleEntitySelect(item)}>
                                    <div className="farmer-info">
                                        <strong>{item.name || item.societyName}</strong>
                                        {item.type === 'society' && <span><Phone size={12} /> {item.ownerMobile}</span>}
                                        {item.type === 'branch' && <span><User size={12} /> {item.memberName}</span>}
                                        {item.type === 'farmer' && <span><Phone size={12} /> {item.phone}</span>}
                                    </div>
                                    <div className="branch-info">
                                        <span><MapPin size={12} /> {item.location || item.branch?.location}</span>
                                        {item.type === 'branch' && <small>{item.societyName}</small>}
                                        {item.type === 'farmer' && <small>{item.branch?.name}</small>}
                                    </div>
                                </div>
                            ))}
                            {searchQuery.length >= 3 && searchResults.length === 0 && (
                                <div className="empty-results">{t('farmers.noFarmers')}</div>
                            )}
                            {searchQuery.length < 3 && (
                                <div className="search-hint">{t('common.search')}...</div>
                            )}
                        </div>

                        {selectedRole === 'owner' && (
                            <div className="search-footer">
                                <p>{t('onboarding.cantFindSociety')}</p>
                                <button className="btn btn-primary btn-sm" onClick={() => setStep('create-society')}>
                                    {t('onboarding.createSociety')}
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {step === 'create-society' && (
                    <div className="create-container card">
                        <div className="search-header">
                            <button className="btn-icon" onClick={() => setStep('search')}>
                                <ArrowLeft size={18} />
                            </button>
                            <h3>{t('onboarding.registerSociety')}</h3>
                        </div>

                        <form onSubmit={handleCreateSociety} className="registration-form">
                            <div className="form-group">
                                <label>{t('onboarding.searchPlaceholderOwner')?.split(' ')[0] || 'Society'} Name</label>
                                <input
                                    type="text"
                                    className="rural-input"
                                    required
                                    value={formData.societyName}
                                    onChange={(e) => setFormData({ ...formData, societyName: e.target.value })}
                                    placeholder="e.g. Krishna Dairy Society"
                                />
                            </div>

                            <div className="form-group">
                                <label>Location</label>
                                <input
                                    type="text"
                                    className="rural-input"
                                    required
                                    value={formData.location}
                                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                                    placeholder="Village or Town Name"
                                />
                            </div>

                            <div className="form-group">
                                <label>{t('farmers.mobile')}</label>
                                <input
                                    type="tel"
                                    className="rural-input"
                                    required
                                    value={formData.ownerMobile}
                                    onChange={(e) => setFormData({ ...formData, ownerMobile: e.target.value })}
                                    placeholder="10-digit mobile number"
                                />
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label>Security PIN (4 Digits)</label>
                                    <input
                                        type="password"
                                        maxLength="4"
                                        className="rural-input"
                                        required
                                        value={formData.pin}
                                        onChange={(e) => setFormData({ ...formData, pin: e.target.value.replace(/\D/g, '') })}
                                        placeholder="●●●●"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Confirm PIN</label>
                                    <input
                                        type="password"
                                        maxLength="4"
                                        className="rural-input"
                                        required
                                        value={formData.confirmPin}
                                        onChange={(e) => setFormData({ ...formData, confirmPin: e.target.value.replace(/\D/g, '') })}
                                        placeholder="●●●●"
                                    />
                                </div>
                            </div>

                            {error && <p className="error-text">{error}</p>}

                            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '16px' }}>
                                {t('onboarding.registerStart')}
                            </button>
                        </form>
                    </div>
                )}

                {step === 'pin' && (
                    <div className="pin-container card">
                        <div className="pin-header-alert">
                            <Lock size={16} />
                            <span>{t('onboarding.enterPin')}</span>
                        </div>

                        <div className="form-group">
                            <label>{t('onboarding.enterPin')}</label>
                            <input
                                type="password"
                                maxLength="4"
                                className="rural-input pin-input"
                                placeholder="● ● ● ●"
                                value={pin}
                                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                                autoFocus
                            />
                        </div>

                        {error && <p className="error-text">{error === 'Invalid PIN. Please try again.' ? t('onboarding.pinError') : error}</p>}

                        <div className="pin-actions">
                            <button className="btn btn-outline" onClick={() => setStep('search')}>
                                <ArrowLeft size={18} /> {t('common.back')}
                            </button>
                            <button className="btn btn-primary" onClick={handlePinSubmit} disabled={pin.length !== 4}>
                                {t('common.submit')}
                            </button>
                        </div>

                        <button className="btn btn-ghost logout-preview" onClick={() => setStep('role')}>
                            <LogOut size={16} /> {t('common.logout')}
                        </button>
                    </div>
                )}
                <style dangerouslySetInnerHTML={{
                    __html: `
                .onboarding-page {
                    min-height: 100vh;
                    background: #f1f5f9;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 20px;
                }
                .onboarding-container {
                    max-width: 500px;
                    width: 100%;
                }
                .onboarding-header {
                    text-align: center;
                    margin-bottom: 40px;
                }
                .onboarding-header .logo { font-size: 3rem; margin-bottom: 10px; }
                .onboarding-header h1 { color: #1e293b; margin-bottom: 8px; }
                .onboarding-header p { color: #64748b; margin-bottom: 20px; }
                
                .language-switcher {
                    display: flex;
                    justify-content: center;
                    margin-top: 10px;
                }
                .lang-dropdown {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    background: white;
                    padding: 6px 12px;
                    border-radius: 20px;
                    border: 1px solid #e2e8f0;
                    color: #64748b;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.05);
                    transition: all 0.2s;
                }
                .lang-dropdown:hover {
                    border-color: #2d6a4f;
                    color: #2d6a4f;
                }
                .lang-select {
                    border: none;
                    outline: none;
                    background: transparent;
                    font-size: 0.9rem;
                    font-weight: 600;
                    color: inherit;
                    cursor: pointer;
                }

                .language-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr 1fr;
                    gap: 12px;
                    margin-bottom: 30px;
                }
                .language-card {
                    background: white;
                    padding: 20px 10px;
                    border-radius: 12px;
                    text-align: center;
                    cursor: pointer;
                    border: 2px solid transparent;
                    box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
                    transition: all 0.2s;
                }
                .language-card:hover {
                    transform: translateY(-4px);
                    border-color: #2d6a4f;
                }
                .language-card.active {
                    border-color: #2d6a4f;
                    background: #f0fdf4;
                }
                .lang-icon {
                    width: 40px;
                    height: 40px;
                    background: #e2e8f0;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin: 0 auto 10px;
                    font-weight: bold;
                    color: #475569;
                    font-size: 1.2rem;
                }
                .language-card.active .lang-icon {
                    background: #2d6a4f;
                    color: white;
                }
                .language-card h3 { font-size: 1rem; margin-bottom: 4px; color: #1e293b; }
                .language-card p { font-size: 0.8rem; color: #64748b; }

                .role-grid { display: grid; gap: 16px; }
                .role-card {
                    background: white;
                    padding: 24px;
                    border-radius: 16px;
                    display: flex;
                    align-items: center;
                    gap: 16px;
                    cursor: pointer;
                    transition: all 0.2s;
                    border: 2px solid transparent;
                    box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
                }
                .role-card:hover { transform: translateY(-4px); border-color: #2d6a4f; }
                .role-icon {
                    width: 60px;
                    height: 60px;
                    background: #f0fdf4;
                    color: #2d6a4f;
                    border-radius: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .role-card h3 { margin-bottom: 4px; color: #1e293b; }
                .role-card p { color: #64748b; font-size: 0.9rem; }

                .pin-header-alert {
                    background: #fef3c7;
                    color: #92400e;
                    padding: 12px;
                    border-radius: 8px;
                    font-size: 0.85rem;
                    margin-bottom: 24px;
                    display: flex;
                    gap: 8px;
                    align-items: flex-start;
                    border: 1px solid #fde68a;
                    line-height: 1.4;
                }
                .pin-input {
                    font-size: 2rem;
                    text-align: center;
                    letter-spacing: 1rem;
                    height: 60px;
                }
                .pin-actions { display: grid; grid-template-columns: 1fr 2fr; gap: 12px; margin-top: 24px; }
                .logout-preview { margin-top: 16px; width: 100%; color: #ef4444 !important; }

                .search-header { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
                .search-input-wrapper { position: relative; margin-bottom: 20px; }
                .search-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #64748b; }
                .search-input-wrapper input { padding-left: 44px; }

                .results-list { max-height: 350px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; }
                .farmer-result-item {
                    background: #f8fafc;
                    padding: 12px 16px;
                    border-radius: 10px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    cursor: pointer;
                    transition: 0.2s;
                    border: 1px solid #e2e8f0;
                }
                .farmer-result-item:hover { background: #f0fdf4; border-color: #2d6a4f; }
                .farmer-info { display: flex; flex-direction: column; }
                .farmer-info strong { color: #1e293b; }
                .farmer-info span { font-size: 0.8rem; color: #64748b; display: flex; align-items: center; gap: 4px; }
                .branch-info { text-align: right; display: flex; flex-direction: column; }
                .branch-info span { font-size: 0.8rem; color: #2d6a4f; font-weight: 700; display: flex; align-items: center; gap: 4px; justify-content: flex-end; }
                .branch-info small { font-size: 0.7rem; color: #94a3b8; }

                .search-footer {
                    margin-top: 24px;
                    padding-top: 20px;
                    border-top: 1px dashed #e2e8f0;
                    text-align: center;
                }
                .search-footer p {
                    font-size: 0.9rem;
                    color: #64748b;
                    margin-bottom: 12px;
                }
                .btn-sm {
                    padding: 8px 16px;
                    font-size: 0.85rem;
                }
                .registration-form {
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                    margin-top: 20px;
                }
                .form-row {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 16px;
                }
                @media (max-width: 480px) {
                    .form-row {
                        grid-template-columns: 1fr;
                    }
                }
                .error-text { color: #ef4444; font-size: 0.85rem; margin-top: 8px; text-align: center; }
                .search-hint, .empty-results { text-align: center; color: #94a3b8; padding: 20px; font-size: 0.9rem; }

                @media (max-width: 768px) {
                    .onboarding-page {
                        padding: 12px;
                    }
                    .onboarding-header {
                        margin-bottom: 24px;
                    }
                    .onboarding-header .logo {
                        font-size: 2.5rem;
                    }
                    .onboarding-header h1 {
                        font-size: 1.5rem;
                    }
                    .role-grid, .language-grid {
                        grid-template-columns: 1fr;
                        gap: 10px;
                    }
                    .role-card, .language-card {
                        padding: 16px;
                    }
                    .search-results {
                        max-height: 50vh;
                    }
                    .pin-input {
                        font-size: 1.5rem;
                    }
                }
                `
                }} />
            </div>
        </div>
    );
};

export default Onboarding;
