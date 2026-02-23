import jsPDF from 'jspdf';
import 'jspdf-autotable'; // Import strictly for side effects
import * as XLSX from 'xlsx';
import { format } from 'date-fns';

/**
 * Export Single Farmer Bill to PDF
 * @param {Object} data - { farmer, entries, dateRange, totals, societyInfo }
 */
export const exportSingleFarmerPDF = (data) => {
    const doc = new jsPDF();
    const { farmer, entries, dateRange, totals, societyInfo } = data;

    // --- Header ---
    doc.setFontSize(18);
    doc.text(societyInfo?.societyName || '', 105, 15, { align: 'center' });

    doc.setFontSize(10);
    doc.text(`${societyInfo?.branchName || ''} - ${societyInfo?.branchLocation || ''}`, 105, 22, { align: 'center' });
    if (dateRange.startDate === dateRange.endDate) {
        doc.text(`Date: ${format(new Date(dateRange.startDate), 'dd/MM/yyyy')}`, 105, 28, { align: 'center' });
    } else {
        doc.text(`Bill Period: ${format(new Date(dateRange.startDate), 'dd/MM/yyyy')} - ${format(new Date(dateRange.endDate), 'dd/MM/yyyy')}`, 105, 28, { align: 'center' });
    }

    // --- Farmer Info ---
    doc.setLineWidth(0.5);
    doc.line(14, 32, 196, 32);

    doc.setFontSize(11);
    doc.text(`Farmer: ${farmer.name} (${farmer.manualId || farmer.id})`, 14, 40);
    doc.text(`Mobile: ${farmer.phone || 'N/A'}`, 140, 40);

    // --- Totals Summary ---
    const startY = 45;
    doc.autoTable({
        startY: startY,
        head: [['Total Liters', 'Avg Fat', 'Avg SNF', 'Total Amount']],
        body: [[
            totals.total.quantity.toFixed(2),
            totals.cow.count > 0 ? totals.cow.avgFat.toFixed(1) : (totals.buffalo.count > 0 ? totals.buffalo.avgFat.toFixed(1) : '-'),
            totals.cow.count > 0 ? totals.cow.avgSnf.toFixed(1) : (totals.buffalo.count > 0 ? totals.buffalo.avgSnf.toFixed(1) : '-'),
            `₹ ${totals.total.amount.toFixed(2)}`
        ]],
        theme: 'plain',
        styles: { fontSize: 10, cellPadding: 2 },
        headStyles: { fillColor: [220, 220, 220], textColor: 0, fontStyle: 'bold' }
    });

    // --- Detailed Table ---
    doc.autoTable({
        startY: doc.lastAutoTable.finalY + 5,
        head: [['Date', 'Shift', 'Type', 'Qty', 'Fat', 'SNF', 'Rate', 'Amount']],
        body: entries.map(e => [
            format(new Date(e.date), 'dd/MM/yy'),
            e.shift,
            e.milkType,
            Number(e.quantity).toFixed(2),
            Number(e.fat).toFixed(1),
            Number(e.snf).toFixed(1),
            Number(e.rate).toFixed(2),
            Number(e.amount).toFixed(2)
        ]),
        theme: 'grid',
        styles: { fontSize: 9, cellPadding: 2 },
        headStyles: { fillColor: [41, 128, 185], textColor: 255 },
        foot: [['Total', '', '', totals.total.quantity.toFixed(2), '', '', '', totals.total.amount.toFixed(2)]],
        footStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: 'bold' }
    });

    // --- Footer ---
    const finalY = doc.lastAutoTable.finalY + 20;
    doc.text('Authorized Signature', 150, finalY);
    doc.setLineWidth(0.2);
    doc.line(140, finalY - 5, 190, finalY - 5);

    doc.save(`Bill_${farmer.name}_${format(new Date(), 'yyyyMMdd')}.pdf`);
};

/**
 * Export All Farmers Summary to PDF
 */
/**
 * Export All Farmers Summary to PDF
 */
export const exportAllFarmersPDF = ({ summaryData, dateRange, societyInfo, shiftTotals }) => {
    const doc = new jsPDF();

    // --- Header ---
    doc.setFontSize(18);
    doc.text(societyInfo?.societyName || '', 105, 15, { align: 'center' });
    doc.setFontSize(10);
    doc.text(`${societyInfo?.branchName || ''} - ${societyInfo?.branchLocation || ''}`, 105, 20, { align: 'center' });
    if (dateRange.startDate === dateRange.endDate) {
        doc.text(`All Farmers Summary: ${format(new Date(dateRange.startDate), 'dd/MM/yyyy')}`, 105, 25, { align: 'center' });
    } else {
        doc.text(`All Farmers Summary: ${format(new Date(dateRange.startDate), 'dd/MM/yyyy')} - ${format(new Date(dateRange.endDate), 'dd/MM/yyyy')}`, 105, 25, { align: 'center' });
    }

    // --- Shift Summary (If provided) ---
    if (shiftTotals) {
        doc.autoTable({
            startY: 30,
            head: [['Shift', 'Total Liters', 'Total Amount']],
            body: [
                ['Morning', shiftTotals.morning.quantity.toFixed(2), shiftTotals.morning.amount.toFixed(2)],
                ['Evening', shiftTotals.evening.quantity.toFixed(2), shiftTotals.evening.amount.toFixed(2)],
                ['Total', (shiftTotals.morning.quantity + shiftTotals.evening.quantity).toFixed(2), (shiftTotals.morning.amount + shiftTotals.evening.amount).toFixed(2)]
            ],
            theme: 'plain',
            styles: { fontSize: 9, cellPadding: 2 },
            headStyles: { fillColor: [220, 220, 220], textColor: 0, fontStyle: 'bold' },
            margin: { left: 14, right: 100 } // Keep it narrow
        });
    }

    // --- Table ---
    doc.autoTable({
        startY: shiftTotals ? doc.lastAutoTable.finalY + 10 : 35,
        head: [['ID', 'Name', 'Total Liters', 'Avg Fat', 'Avg SNF', 'Amount']],
        body: summaryData.map(d => [
            d.farmer?.manualId || d.farmer?.id,
            d.farmer?.name,
            d.totals.total.quantity.toFixed(2),
            (d.totals.cow.count > 0 ? d.totals.cow.avgFat : d.totals.buffalo.avgFat)?.toFixed(1) || '-',
            (d.totals.cow.count > 0 ? d.totals.cow.avgSnf : d.totals.buffalo.avgSnf)?.toFixed(1) || '-',
            d.totals.total.amount.toFixed(2)
        ]),
        theme: 'grid',
        headStyles: { fillColor: [41, 128, 185] },
    });

    doc.save(`Summary_${format(new Date(), 'yyyyMMdd')}.pdf`);
};

/**
 * Export Data to Excel
 */
export const exportToExcel = (data, fileName) => {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    XLSX.writeFile(wb, `${fileName}.xlsx`);
};
