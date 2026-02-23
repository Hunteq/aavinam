import React, { createContext, useContext, useState, useEffect } from 'react';
import { db } from '../db/db';

const BranchContext = createContext();

export const BranchProvider = ({ children }) => {
    const [currentBranch, setCurrentBranch] = useState(null);
    const [branches, setBranches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [dbError, setDbError] = useState(null);

    useEffect(() => {
        const initBranches = async () => {
            try {
                // Ensure DB is open
                await db.open();
                const allBranches = await db.branches.toArray();
                setBranches(allBranches);

                const lastBranchId = localStorage.getItem('lastBranchId');
                if (lastBranchId && allBranches.some(b => b.id === parseInt(lastBranchId))) {
                    setCurrentBranch(allBranches.find(b => b.id === parseInt(lastBranchId)));
                } else if (allBranches.length > 0) {
                    setCurrentBranch(allBranches[0]);
                }
            } catch (error) {
                console.error("Failed to initialize database:", error);
                setDbError(error.message);
            } finally {
                setLoading(false);
            }
        };
        initBranches();
    }, []);


    const switchBranch = (branchId) => {
        const branch = branches.find(b => b.id === branchId);
        if (branch) {
            setCurrentBranch(branch);
            localStorage.setItem('lastBranchId', branchId);
            // Reload to clear all memory states and ensure total isolation
            window.location.reload();
        }
    };

    const addBranch = async (branchData) => {
        const id = await db.branches.add(branchData);
        const newBranch = { ...branchData, id };
        setBranches([...branches, newBranch]);
        if (!currentBranch) {
            setCurrentBranch(newBranch);
            localStorage.setItem('lastBranchId', id);
        }
        return id;
    };

    const updateBranch = async (id, updatedData) => {
        await db.branches.update(id, updatedData);
        const updatedBranches = branches.map(b => b.id === id ? { ...b, ...updatedData } : b);
        setBranches(updatedBranches);
        if (currentBranch && currentBranch.id === id) {
            setCurrentBranch({ ...currentBranch, ...updatedData });
        }
    };

    const deleteBranch = async (id) => {
        if (branches.length <= 1) {
            throw new Error("You must have at least one branch.");
        }

        // 1. Delete all related data for this branch
        await db.transaction('rw', [db.branches, db.farmers, db.entries, db.rates, db.products, db.notifications], async () => {
            await db.farmers.where('branchId').equals(id).delete();
            await db.entries.where('branchId').equals(id).delete();
            await db.rates.where('branchId').equals(id).delete();
            await db.products.where('branchId').equals(id).delete();
            await db.notifications.where('branchId').equals(id).delete();
            await db.branches.delete(id);
        });

        // 2. Update state
        const remainingBranches = branches.filter(b => b.id !== id);
        setBranches(remainingBranches);

        // 3. Handle current branch if it was the one deleted
        if (currentBranch && currentBranch.id === id) {
            const nextBranch = remainingBranches[0];
            setCurrentBranch(nextBranch);
            localStorage.setItem('lastBranchId', nextBranch.id);
            window.location.reload();
        }
    };

    return (
        <BranchContext.Provider value={{
            currentBranch,
            branches,
            switchBranch,
            addBranch,
            updateBranch,
            deleteBranch,
            loading,
            dbError
        }}>
            {children}
        </BranchContext.Provider>
    );

};

export const useBranch = () => {
    const context = useContext(BranchContext);
    if (!context) {
        throw new Error('useBranch must be used within a BranchProvider');
    }
    return context;
};
