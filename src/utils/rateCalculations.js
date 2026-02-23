/**
 * Rate Calculation Logic for Milk Society
 */

/**
 * Main calculation entry point
 * @param {Object} params 
 * @returns {Object} { rate, amount }
 */
export const calculateMilkBill = ({ method, fat, snf, quantity, config, milkType }) => {
    let pricePerLitre = 0;
    const f = parseFloat(fat) || 0;
    const s = parseFloat(snf) || 0;
    const q = parseFloat(quantity) || 0;

    const isBuffalo = milkType === 'Buffalo';

    switch (method) {
        case 'CHART':
            // Both Cow and Buffalo use exact match (Fat/SNF)
            const chartMatch = (config.chart || []).find(row =>
                parseFloat(row.fat) === f && parseFloat(row.snf) === s
            );
            pricePerLitre = chartMatch ? parseFloat(chartMatch.rate) : 0;
            break;

        case 'FAT':
            // Match Fat in table
            const fatMatch = (config.fatTable || []).find(row => parseFloat(row.fat) === f);
            pricePerLitre = fatMatch ? parseFloat(fatMatch.rate) : 0;
            break;

        case 'TS':
            // Cow: Rate = (FAT + SNF) * TS_Price / 100
            // Buffalo: Rate = FAT * TS_Price / 100
            const tsMatch = (config.tsTable || []).find(row => {
                const fatIn = f >= parseFloat(row.minFat) && f <= parseFloat(row.maxFat);
                if (isBuffalo) return fatIn;
                const snfIn = s >= parseFloat(row.minSnf) && s <= parseFloat(row.maxSnf);
                return fatIn && snfIn;
            });

            const tsMultiplier = tsMatch ? parseFloat(tsMatch.fatRate) : 0;

            if (isBuffalo) {
                pricePerLitre = (f * tsMultiplier) / 100;
            } else {
                pricePerLitre = ((f + s) * tsMultiplier) / 100;
            }
            break;

        case 'TS_NEW':
            // Cow: Rate = (FAT + SNF) * TS_Price / 100 + Incentive
            // Buffalo: Rate = FAT * TS_Price / 100 + Incentive
            const cowTsTotal = f + s;
            const buffaloTsTotal = f; // User request says Buffalo is just FAT

            const activeTs = isBuffalo ? buffaloTsTotal : cowTsTotal;

            const tsNewMatch = (config.tsNewTable || []).find(row =>
                activeTs >= parseFloat(row.tsFrom) && activeTs <= parseFloat(row.tsTo)
            );

            if (tsNewMatch) {
                const baseTsPrice = parseFloat(tsNewMatch.rate);
                const incentive = parseFloat(tsNewMatch.incentive) || 0;
                pricePerLitre = ((activeTs * baseTsPrice) / 100) + incentive;
            }
            break;

        default:
            pricePerLitre = 0;
    }

    return {
        rate: parseFloat(pricePerLitre.toFixed(2)),
        amount: parseFloat((pricePerLitre * q).toFixed(2))
    };
};


