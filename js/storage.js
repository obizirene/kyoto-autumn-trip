/**
 * Kyoto Autumn Trip Local & Cloud Storage Manager
 * Handles LocalStorage, Firebase Firestore synchronization, and flexible Export/Import modules (JSON & CSV for Excel / Google Sheets).
 */

window.StorageManager = {
  STORAGE_KEY: 'kyoto_autumn_trip_app_v1',

  loadData: function() {
    try {
      const dataStr = localStorage.getItem(this.STORAGE_KEY);
      if (dataStr) {
        return JSON.parse(dataStr);
      }
    } catch (e) {
      console.error('Failed to load local storage:', e);
    }
    return window.DEFAULT_TRIP_DATA;
  },

  saveData: function(data) {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
      // Async push to Firebase Firestore / Realtime DB if connected
      if (window.FirebaseManager && window.FirebaseManager.isInitialized) {
        window.FirebaseManager.saveDataToCloud(data);
      }
      return true;
    } catch (e) {
      console.error('Failed to save data:', e);
      return false;
    }
  },

  resetToDefault: function() {
    const defaultData = window.DEFAULT_TRIP_DATA;
    this.saveData(defaultData);
    return defaultData;
  },

  // --- DOWNLOAD FILE HELPERS ---

  downloadFile: function(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  downloadJSONFile: function(jsonObject, filename) {
    const jsonStr = JSON.stringify(jsonObject, null, 2);
    this.downloadFile(jsonStr, filename, 'application/json;charset=utf-8;');
  },

  downloadCSVFile: function(csvText, filename) {
    // Add UTF-8 BOM (\uFEFF) so Excel & Google Sheets display Traditional Chinese & Emojis perfectly!
    const bomCsv = '\uFEFF' + csvText;
    this.downloadFile(bomCsv, filename, 'text/csv;charset=utf-8;');
  },

  // --- EXPORT MODULES (CSV & JSON) ---

  // Export Full APP JSON
  exportFullJSON: function(data) {
    this.downloadJSONFile(data, `kyoto_trip_full_backup_${new Date().toISOString().slice(0, 10)}.json`);
  },

  // Export Expenses Only (JSON)
  exportExpensesJSON: function(data) {
    const exportObj = {
      type: 'kyoto_trip_expenses',
      exportDate: new Date().toISOString(),
      expenses: data.expenses || []
    };
    this.downloadJSONFile(exportObj, `kyoto_trip_expenses_${new Date().toISOString().slice(0, 10)}.json`);
  },

  // Export Expenses Only (CSV for Excel / Google Sheets)
  exportExpensesCSV: function(data) {
    const expenses = data.expenses || [];
    const headers = ['日期', '項目名稱', '金額', '幣別', '消費類別', '付款人', '信用卡/支付方式', '備註'];

    const rows = expenses.map(exp => [
      exp.date || '',
      exp.title || '',
      exp.amount || 0,
      exp.currency || 'JPY',
      exp.category || '',
      exp.payer || '❤️',
      exp.card || '現金',
      exp.note || ''
    ]);

    const csvLines = [headers.map(this.escapeCSVField).join(',')];
    rows.forEach(r => csvLines.push(r.map(this.escapeCSVField).join(',')));

    this.downloadCSVFile(csvLines.join('\r\n'), `kyoto_expenses_${new Date().toISOString().slice(0, 10)}.csv`);
  },

  // Export Itinerary Only (JSON)
  exportItineraryJSON: function(data) {
    const exportObj = {
      type: 'kyoto_trip_itinerary',
      exportDate: new Date().toISOString(),
      itinerary: data.itinerary || []
    };
    this.downloadJSONFile(exportObj, `kyoto_trip_itinerary_${new Date().toISOString().slice(0, 10)}.json`);
  },

  // Export Itinerary Only (CSV for Excel / Google Sheets)
  exportItineraryCSV: function(data) {
    const itinerary = data.itinerary || [];
    const headers = ['第幾天(Day)', '時間', '行程標題', '分類', '地點名稱', '預估費用(JPY)', 'Google地圖連結', '備忘貼士'];

    const rows = itinerary.map(item => [
      item.day || 1,
      item.time || '',
      item.title || '',
      item.category || '景點',
      item.location || '',
      item.costJPY || 0,
      item.mapsUrl || '',
      item.note || ''
    ]);

    const csvLines = [headers.map(this.escapeCSVField).join(',')];
    rows.forEach(r => csvLines.push(r.map(this.escapeCSVField).join(',')));

    this.downloadCSVFile(csvLines.join('\r\n'), `kyoto_itinerary_${new Date().toISOString().slice(0, 10)}.csv`);
  },

  // Export Combined Expenses & Itinerary JSON
  exportCombinedJSON: function(data) {
    const exportObj = {
      type: 'kyoto_trip_expenses_itinerary',
      exportDate: new Date().toISOString(),
      expenses: data.expenses || [],
      itinerary: data.itinerary || []
    };
    this.downloadJSONFile(exportObj, `kyoto_trip_expenses_and_itinerary_${new Date().toISOString().slice(0, 10)}.json`);
  },

  escapeCSVField: function(field) {
    if (field === null || field === undefined) return '""';
    const str = String(field);
    return `"${str.replace(/"/g, '""')}"`;
  },

  // --- IMPORT MODULES (CSV & JSON) ---

  importData: function(inputString, currentData, targetType = 'auto', mode = 'merge') {
    const str = inputString.trim();
    if (!str) throw new Error('輸入內容為空！');

    // Attempt 1: Try parsing as JSON first
    if (str.startsWith('{') || str.startsWith('[')) {
      try {
        const parsedJSON = JSON.parse(str);
        return this.importJSONData(parsedJSON, currentData, mode);
      } catch (e) {
        console.warn('JSON parse failed, attempting CSV parse...', e);
      }
    }

    // Attempt 2: Parse as CSV
    return this.importCSVData(str, currentData, targetType, mode);
  },

  importJSONData: function(parsedObj, currentData, mode = 'merge') {
    if (!parsedObj || typeof parsedObj !== 'object') {
      throw new Error('無效的 JSON 資料格式！');
    }

    const updatedData = { ...currentData };

    // Case 1: Full App Backup JSON
    if (parsedObj.expenses && parsedObj.itinerary && parsedObj.flightInfo) {
      if (mode === 'replace') {
        return parsedObj;
      } else {
        const existingExpIds = new Set((updatedData.expenses || []).map(e => e.id));
        (parsedObj.expenses || []).forEach(e => {
          if (!existingExpIds.has(e.id)) updatedData.expenses.unshift(e);
        });

        const existingItIds = new Set((updatedData.itinerary || []).map(i => i.id));
        (parsedObj.itinerary || []).forEach(i => {
          if (!existingItIds.has(i.id)) updatedData.itinerary.push(i);
        });

        if (parsedObj.shopping) {
          const existingShopIds = new Set((updatedData.shopping || []).map(s => s.id));
          parsedObj.shopping.forEach(s => {
            if (!existingShopIds.has(s.id)) updatedData.shopping.push(s);
          });
        }
        return updatedData;
      }
    }

    // Case 2: Expenses only
    if (Array.isArray(parsedObj.expenses) || parsedObj.type === 'kyoto_trip_expenses') {
      const newExpenses = parsedObj.expenses || (Array.isArray(parsedObj) ? parsedObj : []);
      if (mode === 'replace') {
        updatedData.expenses = newExpenses;
      } else {
        const existingExpIds = new Set((updatedData.expenses || []).map(e => e.id));
        newExpenses.forEach(e => {
          if (!existingExpIds.has(e.id)) updatedData.expenses.unshift(e);
        });
      }
    }

    // Case 3: Itinerary only
    if (Array.isArray(parsedObj.itinerary) || parsedObj.type === 'kyoto_trip_itinerary') {
      const newItinerary = parsedObj.itinerary || (Array.isArray(parsedObj) ? parsedObj : []);
      if (mode === 'replace') {
        updatedData.itinerary = newItinerary;
      } else {
        const existingItIds = new Set((updatedData.itinerary || []).map(i => i.id));
        newItinerary.forEach(i => {
          if (!existingItIds.has(i.id)) updatedData.itinerary.push(i);
        });
      }
    }

    return updatedData;
  },

  importCSVData: function(csvText, currentData, targetType = 'auto', mode = 'merge') {
    const lines = this.parseCSVTextToMatrix(csvText);
    if (!lines || lines.length < 2) {
      throw new Error('CSV 格式錯誤或無效資料列！');
    }

    const headers = lines[0].map(h => h.trim().toLowerCase());
    const dataRows = lines.slice(1);

    // Auto-detect type if set to auto
    let isExpense = targetType === 'expense';
    let isItinerary = targetType === 'itinerary';

    if (targetType === 'auto') {
      const headerStr = headers.join(',');
      if (headerStr.includes('付款人') || headerStr.includes('金額') || headerStr.includes('卡別')) {
        isExpense = true;
      } else if (headerStr.includes('第幾天') || headerStr.includes('時間') || headerStr.includes('地點')) {
        isItinerary = true;
      } else {
        // Default to expense if ambiguous
        isExpense = true;
      }
    }

    const updatedData = { ...currentData };

    if (isExpense) {
      const parsedExpenses = dataRows.map((row, idx) => {
        return {
          id: 'exp-csv-' + Date.now() + '-' + idx,
          date: row[0] || new Date().toISOString().slice(0, 16).replace('T', ' '),
          title: row[1] || '記帳項目',
          amount: parseFloat(row[2]) || 0,
          currency: row[3] || 'JPY',
          category: row[4] || '購物',
          payer: row[5] || '❤️',
          card: row[6] || '現金',
          note: row[7] || ''
        };
      });

      if (mode === 'replace') {
        updatedData.expenses = parsedExpenses;
      } else {
        updatedData.expenses = parsedExpenses.concat(updatedData.expenses || []);
      }
    } else if (isItinerary) {
      const parsedItinerary = dataRows.map((row, idx) => {
        const dayNum = parseInt(row[0], 10) || 1;
        const loc = row[4] || row[2] || '';
        return {
          id: 'it-csv-' + Date.now() + '-' + idx,
          day: dayNum,
          date: `Day ${dayNum}`,
          time: row[1] || '12:00',
          title: row[2] || '行程',
          category: row[3] || '景點',
          location: loc,
          costJPY: parseInt(row[5], 10) || 0,
          mapsUrl: row[6] || `https://maps.google.com/?q=${encodeURIComponent(loc)}`,
          note: row[7] || ''
        };
      });

      if (mode === 'replace') {
        updatedData.itinerary = parsedItinerary;
      } else {
        updatedData.itinerary = updatedData.itinerary.concat(parsedItinerary);
      }
    }

    return updatedData;
  },

  // Robust CSV Line/Cell Parser
  parseCSVTextToMatrix: function(csvText) {
    // Remove BOM if present
    let text = csvText.replace(/^\uFEFF/, '');
    const rows = [];
    let currentRow = [];
    let currentCell = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          currentCell += '"';
          i++; // Skip escaped quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        currentRow.push(currentCell.trim());
        currentCell = '';
      } else if ((char === '\r' || char === '\n') && !inQuotes) {
        if (char === '\r' && nextChar === '\n') i++; // Skip \n
        currentRow.push(currentCell.trim());
        if (currentRow.some(c => c.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentCell = '';
      } else {
        currentCell += char;
      }
    }

    if (currentCell || currentRow.length > 0) {
      currentRow.push(currentCell.trim());
      if (currentRow.some(c => c.length > 0)) {
        rows.push(currentRow);
      }
    }

    return rows;
  }
};


