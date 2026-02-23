import React, { useState } from 'react';
import { useBranch } from '../context/BranchContext';
import { useUser } from '../context/UserContext';
import {
    Building2,
    MapPin,
    User,
    Phone,
    Trash2,
    Edit3,
    Plus,
    Landmark,
    Store,
    CheckCircle2,
    XCircle,
    AlertTriangle,
    ShieldAlert
} from 'lucide-react';
import DeleteBranchModal from '../components/DeleteBranchModal';
import { useLanguage } from '../context/LanguageContext';

const Branches = () => {
    const { branches, addBranch, updateBranch, deleteBranch, currentBranch } = useBranch();
    const { isFarmer } = useUser();
    const { t } = useLanguage();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingBranch, setEditingBranch] = useState(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [branchToDelete, setBranchToDelete] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const [formData, setFormData] = useState({
        name: '',
        location: '',
        memberName: '',
        memberMobile: '',
        type: 'society'
    });

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (isFarmer) return;
        try {
            if (editingBranch) {
                await updateBranch(editingBranch.id, formData);
            } else {
                await addBranch(formData);
            }
            closeModal();
        } catch (error) {
            alert(error.message);
        }
    };

    const openModal = (branch = null) => {
        if (isFarmer) return;
        if (branch) {
            setEditingBranch(branch);
            setFormData({
                name: branch.name,
                location: branch.location,
                memberName: branch.memberName,
                memberMobile: branch.memberMobile,
                type: branch.type
            });
        } else {
            setEditingBranch(null);
            setFormData({
                name: '',
                location: '',
                memberName: '',
                memberMobile: '',
                type: 'society'
            });
        }
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingBranch(null);
    };

    const handleDelete = async (id, name) => {
        if (isFarmer) return;
        setBranchToDelete({ id, name });
        setShowDeleteModal(true);
    };

    const handleConfirmDelete = async () => {
        if (!branchToDelete) return;
        setIsDeleting(true);
        try {
            await deleteBranch(branchToDelete.id);
            setShowDeleteModal(false);
            setBranchToDelete(null);
        } catch (error) {
            alert(error.message);
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div className="branches-page">
            <div className="page-header">
                <div>
                    <h1>{t('branches.title')}</h1>
                    <p>{t('branches.subtitle')}</p>
                </div>
                {!isFarmer && (
                    <button className="btn btn-primary" onClick={() => openModal()}>
                        <Plus size={20} /> {t('branches.addNew')}
                    </button>
                )}
            </div>

            {isFarmer && (
                <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '12px', background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '24px' }}>
                    <ShieldAlert size={24} color="#64748b" />
                    <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem', fontWeight: '600' }}>
                        {t('branches.readOnly')}
                    </p>
                </div>
            )}

            <div className="branch-grid">
                {branches.map((branch) => (
                    <div key={branch.id} className={`branch-card ${currentBranch?.id === branch.id ? 'active' : ''}`}>
                        {currentBranch?.id === branch.id && (
                            <div className="active-badge">
                                <CheckCircle2 size={14} /> {t('branches.active')}
                            </div>
                        )}

                        <div className="branch-type">
                            {branch.type === 'society' ? (
                                <div className="type-icon society">
                                    <Landmark size={24} />
                                    <span>{t('branches.milkSociety')}</span>
                                </div>
                            ) : (
                                <div className="type-icon shop">
                                    <Store size={24} />
                                    <span>{t('branches.milkShop')}</span>
                                </div>
                            )}
                        </div>

                        <h3 className="branch-name">{branch.name}</h3>

                        <div className="branch-details">
                            <div className="detail">
                                <MapPin size={16} />
                                <span className={!branch.location ? 'text-gray-400 italic' : ''}>{branch.location || t('branches.location')}</span>
                            </div>
                            <div className="detail">
                                <User size={16} />
                                <span className={!branch.memberName ? 'text-gray-400 italic' : ''}>{branch.memberName || t('branches.memberName')}</span>
                            </div>
                            <div className="detail">
                                <Phone size={16} />
                                <span className={!branch.memberMobile ? 'text-gray-400 italic' : ''}>{branch.memberMobile || t('branches.memberMobile')}</span>
                            </div>
                        </div>

                        {!isFarmer && (
                            <div className="branch-footer">
                                <button className="btn-icon edit" onClick={() => openModal(branch)}>
                                    <Edit3 size={18} />
                                </button>
                                <button
                                    className="btn-icon delete"
                                    onClick={() => handleDelete(branch.id, branch.name)}
                                    disabled={branches.length <= 1}
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {isModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h2>{editingBranch ? t('branches.editBranch') : t('branches.addNew')}</h2>
                            <button className="close-btn" onClick={closeModal}><XCircle size={24} /></button>
                        </div>

                        <form onSubmit={handleSubmit}>
                            <div className="form-group">
                                <label>{t('branches.branchName')}</label>
                                <input
                                    type="text"
                                    className="rural-input"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="e.g. Arul Milk Society"
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label>{t('branches.location')}</label>
                                <input
                                    type="text"
                                    className="rural-input"
                                    value={formData.location}
                                    onChange={e => setFormData({ ...formData, location: e.target.value })}
                                    placeholder="e.g. Salem West"
                                    required
                                />
                            </div>

                            <div className="form-grid">
                                <div className="form-group">
                                    <label>{t('branches.memberName')}</label>
                                    <input
                                        type="text"
                                        className="rural-input"
                                        value={formData.memberName}
                                        onChange={e => setFormData({ ...formData, memberName: e.target.value })}
                                        placeholder={t('branches.inChargePerson')}
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label>{t('branches.memberMobile')}</label>
                                    <input
                                        type="tel"
                                        className="rural-input"
                                        value={formData.memberMobile}
                                        onChange={e => setFormData({ ...formData, memberMobile: e.target.value })}
                                        placeholder="9876543210"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <label>{t('branches.branchType')}</label>
                                <div className="type-toggle">
                                    <button
                                        type="button"
                                        className={`toggle-option ${formData.type === 'society' ? 'active' : ''}`}
                                        onClick={() => setFormData({ ...formData, type: 'society' })}
                                    >
                                        <Landmark size={18} /> {t('branches.society')}
                                    </button>
                                    <button
                                        type="button"
                                        className={`toggle-option ${formData.type === 'shop' ? 'active' : ''}`}
                                        onClick={() => setFormData({ ...formData, type: 'shop' })}
                                    >
                                        <Store size={18} /> {t('branches.shop')}
                                    </button>
                                </div>
                            </div>

                            <div className="form-actions">
                                <button type="button" className="btn btn-secondary" onClick={closeModal}>{t('branches.cancel')}</button>
                                <button type="submit" className="btn btn-primary">
                                    {editingBranch ? t('branches.saveChanges') : t('branches.createBranch')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <DeleteBranchModal
                isOpen={showDeleteModal}
                branchName={branchToDelete?.name}
                onConfirm={handleConfirmDelete}
                onCancel={() => {
                    setShowDeleteModal(false);
                    setBranchToDelete(null);
                }}
                isLoading={isDeleting}
            />

            <style dangerouslySetInnerHTML={{
                __html: `
        .branches-page { padding: 4px; }
        .branch-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 24px;
          margin-top: 30px;
        }

        .branch-card {
          background: white;
          border-radius: var(--radius-lg);
          padding: 24px;
          border: 1px solid var(--border);
          position: relative;
          transition: all 0.3s;
        }

        .branch-card.active {
          border-color: var(--primary);
          box-shadow: 0 10px 25px -5px rgba(16, 185, 129, 0.1);
        }

        .active-badge {
          position: absolute;
          top: 16px;
          right: 16px;
          background: #ecfdf5;
          color: #059669;
          font-size: 0.7rem;
          font-weight: 800;
          padding: 4px 10px;
          border-radius: 20px;
          display: flex;
          align-items: center;
          gap: 4px;
          border: 1px solid #d1fae5;
        }

        .type-icon {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          border-radius: 8px;
          width: fit-content;
          margin-bottom: 20px;
        }

        .type-icon.society { background: #eff6ff; color: #2563eb; }
        .type-icon.shop { background: #fef2f2; color: #dc2626; }
        .type-icon span { font-weight: 700; font-size: 0.8rem; text-transform: uppercase; }

        .branch-name { font-size: 1.4rem; font-weight: 800; color: var(--secondary); margin-bottom: 20px; }
        
        .branch-details { display: flex; flex-direction: column; gap: 12px; margin-bottom: 24px; }
        .detail { display: flex; align-items: center; gap: 10px; color: #64748b; font-size: 0.95rem; }

        .branch-footer {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          padding-top: 20px;
          border-top: 1px solid var(--border);
        }

        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.6);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 2000;
          padding: 20px;
        }

        .modal-content {
          background: white;
          border-radius: var(--radius-lg);
          width: 100%;
          max-width: 500px;
          padding: 32px;
          box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);
        }

        .modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 24px;
        }

        .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }

        .type-toggle {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          background: #f1f5f9;
          padding: 6px;
          border-radius: 12px;
        }

        .toggle-option {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 12px;
          border: none;
          background: transparent;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 700;
          color: #64748b;
          transition: all 0.2s;
        }

        .toggle-option.active {
          background: white;
          color: var(--primary);
          box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
        }

        .form-actions {
          margin-top: 32px;
          display: flex;
          justify-content: flex-end;
          gap: 12px;
        }

        @media (max-width: 768px) {
            .branches-page { padding: 2px; }
            .branch-grid { grid-template-columns: 1fr; gap: 16px; margin-top: 20px; }
            .branch-card { padding: 16px; }
            .branch-name { font-size: 1.2rem; }
            .form-actions { flex-direction: column-reverse; }
            .form-actions .btn { width: 100%; }
        }
      `}} />
        </div>
    );
};

export default Branches;
