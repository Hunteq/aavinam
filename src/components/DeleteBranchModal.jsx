import React, { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

const DeleteBranchModal = ({ isOpen, branchName, onConfirm, onCancel, isLoading = false }) => {
    const { t } = useLanguage();
    const [confirmText, setConfirmText] = useState('');
    const [isValid, setIsValid] = useState(false);

    const requiredText = 'DELETE';

    const handleConfirmTextChange = (e) => {
        const value = e.target.value;
        setConfirmText(value);
        setIsValid(value === requiredText);
    };

    const handleConfirm = () => {
        if (isValid && !isLoading) {
            onConfirm();
            setConfirmText('');
            setIsValid(false);
        }
    };

    const handleCancel = () => {
        setConfirmText('');
        setIsValid(false);
        onCancel();
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay">
            <div className="modal-dialog delete-branch-modal">
                <div className="modal-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <AlertTriangle size={28} color="#dc2626" />
                        <h2 style={{ margin: 0 }}>{t('branches.deleteBranch')}</h2>
                    </div>
                    <button
                        className="modal-close"
                        onClick={handleCancel}
                        disabled={isLoading}
                    >
                        <X size={24} />
                    </button>
                </div>

                <div className="modal-content">
                    <div className="warning-box">
                        <h3>⚠️ {t('branches.criticalWarning')}</h3>
                        <p>
                            {t('branches.deleteConfirmation')} <strong>"{branchName}"</strong>.
                        </p>
                        <p style={{ marginBottom: '12px' }}>
                            {t('branches.deleteWarning')}
                        </p>
                        <ul style={{ margin: '0 0 12px 0', paddingLeft: '20px', color: '#991b1b' }}>
                            <li>{t('branches.warningFarmer')}</li>
                            <li>{t('branches.warningCollection')}</li>
                            <li>{t('branches.warningBilling')}</li>
                            <li>{t('branches.warningRates')}</li>
                        </ul>
                        <p style={{ marginBottom: 0, fontWeight: 'bold', color: '#dc2626' }}>
                            {t('branches.undoWarning')}
                        </p>
                    </div>

                    <div style={{ marginTop: '24px' }}>
                        <p style={{ fontSize: '0.9rem', color: '#666', marginBottom: '12px' }}>
                            {t('branches.typeToConfirm')}
                        </p>
                        <div className="confirm-text-display">
                            {requiredText}
                        </div>
                        <input
                            type="text"
                            className="rural-input confirm-input"
                            placeholder={t('branches.typeWord')}
                            value={confirmText}
                            onChange={handleConfirmTextChange}
                            disabled={isLoading}
                            autoFocus
                        />
                        {confirmText && !isValid && (
                            <p style={{ color: '#dc2626', fontSize: '0.85rem', marginTop: '8px' }}>
                                ❌ {t('branches.textMismatch')}
                            </p>
                        )}
                        {isValid && (
                            <p style={{ color: '#22c55e', fontSize: '0.85rem', marginTop: '8px' }}>
                                ✓ {t('branches.confirmed')}
                            </p>
                        )}
                    </div>
                </div>

                <div className="modal-footer">
                    <button
                        className="btn btn-secondary"
                        onClick={handleCancel}
                        disabled={isLoading}
                    >
                        {t('branches.cancel')}
                    </button>
                    <button
                        className="btn btn-danger"
                        onClick={handleConfirm}
                        disabled={!isValid || isLoading}
                    >
                        {isLoading ? t('branches.deleting') : t('branches.deleteBranch')}
                    </button>
                </div>

                <style dangerouslySetInnerHTML={{
                    __html: `
                    .modal-overlay {
                        position: fixed;
                        top: 0;
                        left: 0;
                        right: 0;
                        bottom: 0;
                        background: rgba(0, 0, 0, 0.5);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        z-index: 1000;
                    }

                    .modal-dialog {
                        background: white;
                        border-radius: 12px;
                        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
                        max-width: 500px;
                        width: 90%;
                        max-height: 90vh;
                        overflow-y: auto;
                        display: flex;
                        flex-direction: column;
                    }

                    .delete-branch-modal {
                        border-left: 4px solid #dc2626;
                    }

                    .modal-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: flex-start;
                        padding: 24px;
                        border-bottom: 1px solid #e5e7eb;
                    }

                    .modal-header h2 {
                        color: #dc2626;
                    }

                    .modal-close {
                        background: none;
                        border: none;
                        cursor: pointer;
                        color: #6b7280;
                        padding: 0;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    }

                    .modal-close:hover {
                        color: #111;
                    }

                    .modal-close:disabled {
                        opacity: 0.5;
                        cursor: not-allowed;
                    }

                    .modal-content {
                        padding: 24px;
                        flex: 1;
                    }

                    .warning-box {
                        background: #fef2f2;
                        border: 1px solid #fecaca;
                        border-radius: 8px;
                        padding: 16px;
                        color: #991b1b;
                    }

                    .warning-box h3 {
                        margin-top: 0;
                        margin-bottom: 12px;
                        color: #dc2626;
                    }

                    .warning-box p {
                        margin: 8px 0;
                        font-size: 0.95rem;
                        line-height: 1.5;
                    }

                    .warning-box ul {
                        list-style-type: disc;
                    }

                    .warning-box li {
                        margin-bottom: 6px;
                    }

                    .confirm-text-display {
                        background: #f3f4f6;
                        border: 2px solid #d1d5db;
                        border-radius: 6px;
                        padding: 12px 16px;
                        font-family: 'Courier New', monospace;
                        font-weight: bold;
                        color: #1f2937;
                        margin-bottom: 12px;
                        text-align: center;
                        letter-spacing: 2px;
                        font-size: 1.1rem;
                    }

                    .confirm-input {
                        width: 100%;
                        padding: 12px 16px;
                        border: 2px solid #d1d5db;
                        border-radius: 6px;
                        font-size: 0.95rem;
                        font-family: 'Courier New', monospace;
                        letter-spacing: 1px;
                    }

                    .confirm-input:focus {
                        outline: none;
                        border-color: #dc2626;
                        box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.1);
                    }

                    .confirm-input:disabled {
                        background: #f9fafb;
                        color: #9ca3af;
                        cursor: not-allowed;
                    }

                    .modal-footer {
                        display: flex;
                        gap: 12px;
                        padding: 24px;
                        border-top: 1px solid #e5e7eb;
                        justify-content: flex-end;
                    }

                    .btn-danger {
                        background: #dc2626;
                        color: white;
                        padding: 10px 20px;
                        border: none;
                        border-radius: 6px;
                        font-weight: 600;
                        cursor: pointer;
                        transition: background 0.2s;
                    }

                    .btn-danger:hover:not(:disabled) {
                        background: #b91c1c;
                    }

                    .btn-danger:disabled {
                        background: #fca5a5;
                        cursor: not-allowed;
                    }
                `}}
                />
            </div>
        </div>
    );
};

export default DeleteBranchModal;
