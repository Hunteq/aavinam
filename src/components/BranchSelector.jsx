import React, { useState } from 'react';
import { ChevronDown, Plus, Landmark, Store, CheckCircle2 } from 'lucide-react';
import { useBranch } from '../context/BranchContext';
import { useNavigate } from 'react-router-dom';

const BranchSelector = () => {
  const { currentBranch, branches, switchBranch } = useBranch();
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="branch-selector-container">
      <button className="branch-trigger" onClick={() => setIsOpen(!isOpen)}>
        <span className="location-pin">📍</span>
        <div className="branch-info">
          <span className="label">Current Branch</span>
          <span className="branch-name">
            {currentBranch ? currentBranch.name : 'Select Branch'}
          </span>
        </div>
        <ChevronDown size={14} className={`arrow ${isOpen ? 'up' : ''}`} />
      </button>

      {isOpen && (
        <div className="branch-dropdown shadow-lg">
          <div className="dropdown-header">Available Branches</div>
          <div className="branch-list">
            {branches.map((branch) => (
              <button
                key={branch.id}
                className={`branch-item ${currentBranch?.id === branch.id ? 'active' : ''}`}
                onClick={() => {
                  switchBranch(branch.id);
                  setIsOpen(false);
                }}
              >
                {branch.type === 'society' ? <Landmark size={14} /> : <Store size={14} />}
                <div className="item-txt">
                  <span className="name">{branch.name}</span>
                  <span className="loc">{branch.location}</span>
                </div>
                {currentBranch?.id === branch.id && <CheckCircle2 size={14} className="check" />}
              </button>
            ))}
          </div>
          <div className="dropdown-footer">
            <button className="manage-btn" onClick={() => {
              navigate('/branches');
              setIsOpen(false);
            }}>
              <Plus size={16} />
              <span>Manage Branches</span>
            </button>
          </div>
        </div>
      )}


      <style dangerouslySetInnerHTML={{
        __html: `
        .branch-selector-container {
          position: relative;
        }

        .branch-trigger {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 6px 14px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s;
          text-align: left;
        }

        .branch-trigger:hover {
          background: white;
          border-color: var(--primary);
          box-shadow: 0 4px 12px rgba(0,0,0,0.05);
        }

        .location-pin { font-size: 1.1rem; }
        
        .branch-info { display: flex; flex-direction: column; line-height: 1.2; }
        .branch-info .label { font-size: 0.65rem; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; }
        .branch-info .branch-name { font-size: 0.95rem; font-weight: 800; color: var(--secondary); max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

        .arrow { color: #94a3b8; transition: transform 0.2s; }
        .arrow.up { transform: rotate(180deg); }

        .branch-dropdown {
          position: absolute;
          top: 115%;
          left: 0;
          width: 250px;
          background: white;
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          z-index: 1100;
          overflow: hidden;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
        }

        .dropdown-header {
          padding: 14px 16px;
          font-size: 0.7rem;
          font-weight: 800;
          color: #94a3b8;
          text-transform: uppercase;
          background: #f8fafc;
          border-bottom: 1px solid #f1f5f9;
        }

        .branch-list { max-height: 300px; overflow-y: auto; }

        .branch-item {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 16px;
          border: none;
          background: none;
          cursor: pointer;
          transition: all 0.2s;
          border-bottom: 1px solid #f8fafc;
        }

        .branch-item:hover { background: #f1f5f9; }
        
        .branch-item.active { background: #ecfdf5; border-left: 3px solid var(--primary); }
        .branch-item.active .name { color: var(--primary); font-weight: 700; }
        
        .item-txt { display: flex; flex-direction: column; flex: 1; text-align: left; }
        .item-txt .name { font-size: 0.9rem; font-weight: 600; color: var(--secondary); }
        .item-txt .loc { font-size: 0.75rem; color: #94a3b8; }

        .check { color: var(--primary); }

        .dropdown-footer { padding: 8px; background: #f8fafc; border-top: 1px solid #f1f5f9; }

        .manage-btn {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 10px;
          border: none;
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          cursor: pointer;
          color: var(--primary);
          font-weight: 700;
          font-size: 0.85rem;
          transition: all 0.2s;
        }

        .manage-btn:hover { background: var(--primary); color: white; border-color: var(--primary); }
      `}} />
    </div>
  );
};

export default BranchSelector;
