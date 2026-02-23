import { format, parseISO, startOfDay, endOfDay, isWithinInterval } from 'date-fns';

/**
 * Filter entries by date range and branch
 * @param {Array} entries - List of entry objects
 * @param {Object} dateRange - { startDate, endDate }
 * @param {Number} branchId - ID of the current branch
 * @returns {Array} Filtered entries
 */
export const filterEntries = (entries, dateRange, branchId, shift = 'all') => {
    if (!entries || !dateRange?.startDate || !dateRange?.endDate) return [];

    const start = startOfDay(new Date(dateRange.startDate));
    const end = endOfDay(new Date(dateRange.endDate));

    return entries.filter(entry => {
        // Check branch
        if (branchId && entry.branchId !== branchId) return false;

        // Check date
        const entryDate = new Date(entry.date);
        if (!isWithinInterval(entryDate, { start, end })) return false;

        // Check shift
        if (shift !== 'all') {
            const entryShift = entry.shift?.toLowerCase();
            if (entryShift !== shift.toLowerCase()) return false;
        }

        return true;
    });
};

/**
 * Group entries by farmer
 * @param {Array} entries - List of entries
 * @param {Array} farmers - List of farmer objects (to get names)
 * @returns {Object} Map of farmerId -> { farmer, entries, totals }
 */
export const groupEntriesByFarmer = (entries, farmers) => {
    const grouped = {};
    const farmerMap = new Map(farmers.map(f => [f.id, f]));

    entries.forEach(entry => {
        const farmerId = entry.farmerId;
        if (!grouped[farmerId]) {
            grouped[farmerId] = {
                farmer: farmerMap.get(farmerId) || { name: 'Unknown', id: farmerId },
                entries: [],
                totals: {
                    cow: { quantity: 0, amount: 0, fat: 0, snf: 0, count: 0 },
                    buffalo: { quantity: 0, amount: 0, fat: 0, snf: 0, count: 0 },
                    total: { quantity: 0, amount: 0 }
                }
            };
        }

        grouped[farmerId].entries.push(entry);

        // Update Totals
        const type = entry.milkType?.toLowerCase() || 'cow'; // Default to cow if undefined
        const category = type.includes('buffalo') ? 'buffalo' : 'cow';

        const target = grouped[farmerId].totals[category];
        target.quantity += Number(entry.quantity || 0);
        target.amount += Number(entry.amount || 0);
        target.fat += Number(entry.fat || 0);
        target.snf += Number(entry.snf || 0);
        target.count += 1;

        grouped[farmerId].totals.total.quantity += Number(entry.quantity || 0);
        grouped[farmerId].totals.total.amount += Number(entry.amount || 0);
    });

    // Calculate Averages
    Object.values(grouped).forEach(group => {
        ['cow', 'buffalo'].forEach(type => {
            if (group.totals[type].count > 0) {
                group.totals[type].avgFat = group.totals[type].fat / group.totals[type].count;
                group.totals[type].avgSnf = group.totals[type].snf / group.totals[type].count;
            }
        });
    });

    return Object.values(grouped);
};

/**
 * Calculate totals for a set of entries
 * @param {Array} entries 
 */
export const calculateTotals = (entries) => {
    return entries.reduce((acc, entry) => {
        acc.quantity += Number(entry.quantity || 0);
        acc.amount += Number(entry.amount || 0);
        return acc;
    }, { quantity: 0, amount: 0 });
};

/**
 * Get aggregated data for reports (Shift-wise, etc.)
 */
export const getReportData = (entries) => {
    const shiftWise = {
        morning: { quantity: 0, amount: 0, count: 0 },
        evening: { quantity: 0, amount: 0, count: 0 }
    };

    entries.forEach(entry => {
        const shift = entry.shift?.toLowerCase() || 'morning';
        if (shiftWise[shift]) {
            shiftWise[shift].quantity += Number(entry.quantity || 0);
            shiftWise[shift].amount += Number(entry.amount || 0);
            shiftWise[shift].count += 1;
        }
    });

    return { shiftWise };
};
