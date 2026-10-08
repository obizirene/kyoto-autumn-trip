window.openModal = function(id) {
  document.querySelectorAll('.modal-overlay, .lightbox-overlay').forEach(m => m.classList.remove('active'));
  const modal = document.getElementById(id);
  if (modal) modal.classList.add('active');
};

window.closeModal = function(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.remove('active');
};

document.addEventListener('DOMContentLoaded', () => {
  // App State
  let tripData = window.StorageManager.loadData();
  let currentTab = 'flight';
  let currentDay = 1;
  let selectedMapItemId = null;
  let currentItineraryCategory = 'all';
  let currentShoppingLocationCategory = 'all';
  let currentLocationDetailId = null;
  let isCardLimitsExpanded = false;
  let currentCardFilter = 'all';
  let itineraryEditorBaseline = '';
  let itineraryEditorOpen = false;

  function itineraryEditorIsDesktop() {
    return window.matchMedia('(min-width: 1024px)').matches;
  }

  function itineraryFormSignature() {
    const form = document.getElementById('form-add-itinerary');
    if (!form) return '';
    return Array.from(form.elements).map(el => `${el.id}:${el.type === 'checkbox' ? el.checked : el.value}`).join('|');
  }

  function routeItineraryEditor(open) {
    const modal = document.getElementById('modal-itinerary');
    const host = document.getElementById('itinerary-edit-panel-host');
    const sheet = (modal && modal.querySelector('.modal-sheet')) || (host && host.querySelector('.modal-sheet'));
    if (!modal || !sheet || !host) return;
    const mapPane = host.closest('.itinerary-map-pane');
    if (open && itineraryEditorIsDesktop()) {
      host.hidden = false;
      mapPane?.classList.add('itinerary-map-pane--editing');
      host.appendChild(sheet);
      sheet.classList.add('itinerary-edit-panel');
      modal.classList.remove('active');
    } else {
      mapPane?.classList.remove('itinerary-map-pane--editing');
      modal.appendChild(sheet);
      sheet.classList.remove('itinerary-edit-panel');
      host.hidden = true;
      if (open) modal.classList.add('active');
      else modal.classList.remove('active');
    }
    itineraryEditorOpen = open;
  }

  function closeItineraryEditor(discardConfirmed = false) {
    if (!itineraryEditorOpen) {
      window.closeModal('modal-itinerary');
      return true;
    }
    if (!discardConfirmed && itineraryEditorHasChanges() && !window.confirm('目前行程有尚未儲存的變更，確定離開嗎？')) return false;
    routeItineraryEditor(false);
    itineraryEditorBaseline = '';
    return true;
  }
  window.closeItineraryEditor = closeItineraryEditor;

  function itineraryEditorHasChanges() {
    return Boolean(itineraryEditorBaseline && itineraryFormSignature() !== itineraryEditorBaseline);
  }

  function switchItineraryEditorRouteIfNeeded() {
    if (!itineraryEditorOpen) return;
    const desktop = itineraryEditorIsDesktop();
    const inPanel = document.querySelector('#itinerary-edit-panel-host .modal-sheet');
    if (desktop !== Boolean(inPanel)) routeItineraryEditor(true);
  }

  window.addEventListener('resize', switchItineraryEditorRouteIfNeeded);

  // Calendar State
  let calYear = 2026;
  let calMonth = 10; // 0-indexed: 10 = November 2026
  let selCheckIn = '2026-11-20';
  let selCheckOut = '2026-11-29';

  // Days list mapping for 10-day trip (2026/11/20 ~ 11/29)
  const DAYS_LIST = [
    { day: 1, date: '11/20 五' },
    { day: 2, date: '11/21 六' },
    { day: 3, date: '11/22 日' },
    { day: 4, date: '11/23 一' },
    { day: 5, date: '11/24 二' },
    { day: 6, date: '11/25 三' },
    { day: 7, date: '11/26 四' },
    { day: 8, date: '11/27 五' },
    { day: 9, date: '11/28 六' },
    { day: 10, date: '11/29 日' }
  ];

  // Ensure Flight Info Structure exists cleanly
  if (!tripData.flightInfo) {
    tripData.flightInfo = {
      exchangeRate: 0.21,
      outbound: {
        date: "2026-11-20",
        airline: "星宇航空 Starlux",
        code: "JX820",
        depAirport: "台北桃園 (TPE)",
        depTime: "07:40 AM",
        arrAirport: "關西國際機場 (KIX)",
        arrTime: "11:10 AM"
      },
      inbound: {
        date: "2026-11-29",
        airline: "星宇航空 Starlux",
        code: "JX835",
        depAirport: "神戶機場 (UKB)",
        depTime: "11:30 AM",
        arrAirport: "台北桃園 (TPE)",
        arrTime: "13:45 PM"
      }
    };
  }

  // Ensure tripData.hotels array exists
  if (!tripData.hotels) {
    tripData.hotels = [];
  }

  // DOM Elements
  const tabButtons = document.querySelectorAll('.nav-item');
  const tabSections = document.querySelectorAll('.tab-section');

  // Populate Dropdowns from Global Constants
  populateCategoryDropdowns();
  populateCardDropdowns();
  populate10MinTimeDropdowns();

  // Initialize UI & Event Handlers & Firebase Realtime Listener
  initApp();

  function initApp() {
    const itineraryAddButton = document.getElementById('add-itinerary-modal-btn');
    if (itineraryAddButton) itineraryAddButton.innerHTML = itineraryOutlineIcon('add');
    renderAllViews();
    bindEvents();
    initCalendarPicker();
    initLightbox();
    initFirebaseSync();
  }

  function initFirebaseSync() {
    if (window.FirebaseManager) {
      const initialized = window.FirebaseManager.init();
      if (initialized) {
        window.FirebaseManager.subscribeRealtime((cloudData) => {
          if (cloudData) {
            tripData = cloudData;
            localStorage.setItem(window.StorageManager.STORAGE_KEY, JSON.stringify(tripData));
            renderAllViews();
            if (currentLocationDetailId) {
              renderLocationDetailModal(currentLocationDetailId);
            }
          }
        });
      }
    }
  }

  function saveDataAndUpdate() {
    window.StorageManager.saveData(tripData);
    renderAllViews();
    if (currentLocationDetailId) {
      renderLocationDetailModal(currentLocationDetailId);
    }
  }

  function populateCategoryDropdowns() {
    const expCategorySelect = document.getElementById('exp-category');
    const itCategorySelect = document.getElementById('it-category');
    
    if (expCategorySelect) {
      expCategorySelect.innerHTML = window.EXPENSE_CATEGORIES.map(c => `
        <option value="${c.id}">${window.uiCategoryText(c.id, c.label)}</option>
      `).join('');
    }

    if (itCategorySelect) {
      itCategorySelect.innerHTML = window.ITINERARY_CATEGORIES.map(c => `
        <option value="${c.id}">${window.uiCategoryText(c.id, c.label)}</option>
      `).join('');
    }
  }

  function getCardsList() {
    if (!tripData.cards || !Array.isArray(tripData.cards) || tripData.cards.length === 0) {
      tripData.cards = JSON.parse(JSON.stringify(window.DEFAULT_CARDS));
    }
    return tripData.cards;
  }

  function populateCardDropdowns() {
    const cardSelect = document.getElementById('exp-card');
    if (!cardSelect) return;
    const cards = getCardsList();
    cardSelect.innerHTML = cards.map(c => {
      const ownerLabel = c.owner && c.owner !== '通用' ? `${c.owner} ` : '';
      return `<option value="${c.name}">${ownerLabel}${c.name}</option>`;
    }).join('');
  }

  // --- LIGHTBOX PHOTO ZOOM MODULE ---
  function initLightbox() {
    const lightboxModal = document.getElementById('modal-image-lightbox');
    if (lightboxModal) {
      lightboxModal.addEventListener('click', (e) => {
        if (e.target === lightboxModal || e.target.classList.contains('close-lightbox')) {
          lightboxModal.classList.remove('active');
        }
      });
    }
  }

  window.openLightbox = function(src, caption) {
    const lightboxModal = document.getElementById('modal-image-lightbox');
    const imgEl = document.getElementById('lightbox-img-element');
    const captionEl = document.getElementById('lightbox-caption-text');

    if (lightboxModal && imgEl) {
      imgEl.src = src;
      if (captionEl) captionEl.innerText = caption || '';
      lightboxModal.classList.add('active');
    }
  };

  // --- CALENDAR DATE RANGE PICKER COMPONENT ---
  function initCalendarPicker() {
    const prevBtn = document.getElementById('cal-prev-month');
    const nextBtn = document.getElementById('cal-next-month');
    const triggerBtn = document.getElementById('hotel-date-range-trigger');
    const calBox = document.getElementById('hotel-calendar-box');

    if (triggerBtn && calBox) {
      triggerBtn.addEventListener('click', () => {
        calBox.style.display = (calBox.style.display === 'none') ? 'block' : 'none';
      });
    }

    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        calMonth--;
        if (calMonth < 0) {
          calMonth = 11;
          calYear--;
        }
        renderCalendarGrid();
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        calMonth++;
        if (calMonth > 11) {
          calMonth = 0;
          calYear++;
        }
        renderCalendarGrid();
      });
    }

    renderCalendarGrid();
  }

  function renderCalendarGrid() {
    const titleEl = document.getElementById('cal-month-title');
    const gridEl = document.getElementById('cal-days-grid');
    if (!titleEl || !gridEl) return;

    titleEl.innerText = `${calYear} 年 ${calMonth + 1} 月`;

    const firstDayIndex = new Date(calYear, calMonth, 1).getDay();
    const totalDaysInMonth = new Date(calYear, calMonth + 1, 0).getDate();

    let html = '';

    for (let i = 0; i < firstDayIndex; i++) {
      html += `<div class="cal-day empty"></div>`;
    }

    for (let day = 1; day <= totalDaysInMonth; day++) {
      const monthStr = String(calMonth + 1).padStart(2, '0');
      const dayStr = String(day).padStart(2, '0');
      const dateIso = `${calYear}-${monthStr}-${dayStr}`;

      let classes = ['cal-day'];

      const isStart = selCheckIn === dateIso;
      const isEnd = selCheckOut === dateIso;
      const isInRange = selCheckIn && selCheckOut && dateIso > selCheckIn && dateIso < selCheckOut;

      if (isStart && isEnd) {
        classes.push('selected-single');
      } else if (isStart) {
        classes.push('range-start');
      } else if (isEnd) {
        classes.push('range-end');
      } else if (isInRange) {
        classes.push('in-range');
      }

      html += `<div class="${classes.join(' ')}" data-date="${dateIso}">${day}</div>`;
    }

    gridEl.innerHTML = html;

    gridEl.querySelectorAll('.cal-day:not(.empty)').forEach(cell => {
      cell.addEventListener('click', () => {
        const clickedDate = cell.dataset.date;
        handleDateClick(clickedDate);
      });
    });

    updateDateRangeDisplay();
  }

  function handleDateClick(dateIso) {
    if (!selCheckIn || (selCheckIn && selCheckOut)) {
      selCheckIn = dateIso;
      selCheckOut = null;
    } else if (selCheckIn && !selCheckOut) {
      if (dateIso < selCheckIn) {
        selCheckIn = dateIso;
      } else {
        selCheckOut = dateIso;
      }
    }

    document.getElementById('hotel-checkin').value = selCheckIn || '';
    document.getElementById('hotel-checkout').value = selCheckOut || '';

    updateDateRangeDisplay();
    renderCalendarGrid();
  }

  function updateDateRangeDisplay() {
    const labelEl = document.getElementById('display-date-range-label');
    const badgeEl = document.getElementById('display-nights-badge');
    if (!labelEl || !badgeEl) return;

    if (selCheckIn && selCheckOut) {
      labelEl.innerText = `${selCheckIn} ➔ ${selCheckOut}`;
      const d1 = new Date(selCheckIn);
      const d2 = new Date(selCheckOut);
      const diffTime = Math.abs(d2 - d1);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      badgeEl.innerText = `${diffDays} 晚`;
      badgeEl.style.display = 'inline-flex';
    } else if (selCheckIn) {
      labelEl.innerText = `${selCheckIn} ➔ 請點選退房日期`;
      badgeEl.innerText = `選擇中...`;
    } else {
      labelEl.innerText = `請在日曆點選入住與退房日期`;
      badgeEl.innerText = `-`;
    }
  }

  function bindEvents() {
    // 0. Firebase Sync Button Modal
    const firebaseBtn = document.getElementById('firebase-sync-btn');
    if (firebaseBtn) {
      firebaseBtn.addEventListener('click', () => {
        const savedConfig = window.FirebaseManager.getSavedConfig();
        if (savedConfig) {
          document.getElementById('fb-project-id').value = savedConfig.databaseURL || savedConfig.projectId || '';
        }
        const statusMsg = document.getElementById('fb-status-message');
        if (statusMsg) {
          if (window.FirebaseManager.isInitialized) {
            statusMsg.style.color = '#10B981';
            window.uiSetIconText(statusMsg, "check", "已成功連線至 Firebase Realtime DB / Firestore 雲端資料庫 (雙向即時同步中)", "active");
          } else {
            statusMsg.style.color = 'var(--amber-gold)';
            window.uiSetIconText(statusMsg, "warning", "目前為離線本機模式。填寫 Project ID 即可啟用雙機即時同步！", "warning");
          }
        }
        openModal('modal-firebase-config');
      });
    }

    const firebaseForm = document.getElementById('form-firebase-config');
    if (firebaseForm) {
      firebaseForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const pid = document.getElementById('fb-project-id').value.trim();
        if (pid) {
          const config = {
            projectId: "kyoto-trip-2026",
            databaseURL: pid.startsWith('http') ? pid : `https://${pid}-default-rtdb.asia-southeast1.firebasedatabase.app`
          };
          const success = window.FirebaseManager.init(config);
          if (success) {
            alert('🔥 成功連結 Firebase 雲端資料庫！數據將即時同步！');
            initFirebaseSync();
            closeModal('modal-firebase-config');
          } else {
            alert('❌ 連結失敗，請檢查 Project ID 或網路連線！');
          }
        }
      });
    }

    // 1. Navigation Tab Switching
    tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetTab = btn.dataset.tab;
        switchTab(targetTab);
      });
    });

    // 2. Export Data Modal & Action Handlers (CSV & JSON)
    const exportModalBtn = document.getElementById('export-data-modal-btn');
    if (exportModalBtn) {
      exportModalBtn.addEventListener('click', () => openModal('modal-export-data'));
    }

    const btnExpExpensesCSV = document.getElementById('btn-export-expenses-csv');
    if (btnExpExpensesCSV) {
      btnExpExpensesCSV.addEventListener('click', () => {
        window.StorageManager.exportExpensesCSV(tripData);
        closeModal('modal-export-data');
      });
    }

    const btnExpItineraryCSV = document.getElementById('btn-export-itinerary-csv');
    if (btnExpItineraryCSV) {
      btnExpItineraryCSV.addEventListener('click', () => {
        window.StorageManager.exportItineraryCSV(tripData);
        closeModal('modal-export-data');
      });
    }

    const btnExpExpensesJSON = document.getElementById('btn-export-expenses-json');
    if (btnExpExpensesJSON) {
      btnExpExpensesJSON.addEventListener('click', () => {
        window.StorageManager.exportExpensesJSON(tripData);
        closeModal('modal-export-data');
      });
    }

    const btnExpItineraryJSON = document.getElementById('btn-export-itinerary-json');
    if (btnExpItineraryJSON) {
      btnExpItineraryJSON.addEventListener('click', () => {
        window.StorageManager.exportItineraryJSON(tripData);
        closeModal('modal-export-data');
      });
    }

    const btnExpCombined = document.getElementById('btn-export-combined-json');
    if (btnExpCombined) {
      btnExpCombined.addEventListener('click', () => {
        window.StorageManager.exportCombinedJSON(tripData);
        closeModal('modal-export-data');
      });
    }

    // 3. Import Data Modal & Form Handler (CSV & JSON)
    const importModalBtn = document.getElementById('import-data-modal-btn');
    if (importModalBtn) {
      importModalBtn.addEventListener('click', () => {
        document.getElementById('form-import-data').reset();
        openModal('modal-import-data');
      });
    }

    const importForm = document.getElementById('form-import-data');
    if (importForm) {
      importForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const fileInput = document.getElementById('import-file-input');
        const textInput = document.getElementById('import-text-input').value.trim();
        const targetType = document.getElementById('import-type-select').value;
        const mode = document.getElementById('import-mode').value;

        const processContent = (str) => {
          try {
            tripData = window.StorageManager.importData(str, tripData, targetType, mode);
            saveDataAndUpdate();
            closeModal('modal-import-data');
            alert('🎉 成功匯入資料！');
          } catch (err) {
            alert('❌ 匯入失敗：' + err.message);
          }
        };

        if (fileInput.files && fileInput.files[0]) {
          const file = fileInput.files[0];
          const reader = new FileReader();
          reader.onload = (evt) => processContent(evt.target.result);
          reader.readAsText(file);
        } else if (textInput) {
          processContent(textInput);
        } else {
          alert('請選取 CSV / JSON 檔案或貼上內容！');
        }
      });
    }

    // 4. Edit Flight Form Handler
    const flightForm = document.getElementById('form-edit-flight');
    if (flightForm) {
      flightForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const type = document.getElementById('flight-type').value;
        const codeVal = document.getElementById('fl-code').value;
        const flightObj = {
          date: document.getElementById('fl-date').value,
          airline: document.getElementById('fl-airline').value,
          code: codeVal,
          flightNo: codeVal,
          depAirport: document.getElementById('fl-dep-airport').value,
          depTime: document.getElementById('fl-dep-time').value,
          arrAirport: document.getElementById('fl-arr-airport').value,
          arrTime: document.getElementById('fl-arr-time').value
        };

        if (type === 'outbound') {
          tripData.flightInfo.outbound = flightObj;
        } else {
          tripData.flightInfo.inbound = flightObj;
        }

        closeModal('modal-edit-flight');
        saveDataAndUpdate();
      });
    }

    // 5. Add / Edit Hotel Modals
    const addHotelBtn = document.getElementById('add-hotel-btn');
    if (addHotelBtn) {
      addHotelBtn.addEventListener('click', () => {
        window.uiSetIconText(document.getElementById("modal-hotel-title"), "bed", "新增住宿");
        document.getElementById('hotel-id').value = '';
        document.getElementById('form-hotel').reset();
        selCheckIn = '2026-11-20';
        selCheckOut = '2026-11-29';
        renderCalendarGrid();
        openModal('modal-hotel');
      });
    }

    const hotelForm = document.getElementById('form-hotel');
    if (hotelForm) {
      hotelForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const hid = document.getElementById('hotel-id').value;
        const hnameInput = document.getElementById('hotel-name');
        const hname = hnameInput ? hnameInput.value.trim() : '';
        const hmapsInput = document.getElementById('hotel-maps');
        const hmaps = hmapsInput ? hmapsInput.value.trim() : '';
        const hnotesInput = document.getElementById('hotel-notes');
        const hnotes = hnotesInput ? hnotesInput.value.trim() : '';

        const hotelObj = {
          id: hid ? hid : 'ht-' + Date.now(),
          name: hname || '京都住宿',
          checkIn: selCheckIn || '2026-11-20',
          checkOut: selCheckOut || '2026-11-29',
          googleMapsUrl: hmaps ? hmaps : `https://maps.google.com/?q=${encodeURIComponent(hname || '京都飯店')}`,
          notes: hnotes
        };

        if (hid) {
          const idx = tripData.hotels.findIndex(h => h.id === hid);
          if (idx !== -1) tripData.hotels[idx] = hotelObj;
          else tripData.hotels.push(hotelObj);
        } else {
          tripData.hotels.push(hotelObj);
        }

        closeModal('modal-hotel');
        hotelForm.reset();
        saveDataAndUpdate();
      });
    }

    // 6. Smart NLP Expense Input Handling
    const nlpInput = document.getElementById('nlp-expense-input');
    const nlpSubmitBtn = document.getElementById('nlp-submit-btn');

    if (nlpSubmitBtn && nlpInput) {
      const processNLP = () => {
        const text = nlpInput.value;
        if (!text.trim()) return;
        const parsed = window.NLPParser.parse(text);
        if (parsed) {
          showParsedPreview(parsed);
        }
      };

      nlpSubmitBtn.addEventListener('click', processNLP);
      nlpInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') processNLP();
      });
    }

    // Sample NLP Tag clicks
    document.querySelectorAll('.nlp-tag-sample').forEach(tag => {
      tag.addEventListener('click', () => {
        if (nlpInput) {
          nlpInput.value = tag.innerText;
          nlpInput.focus();
        }
      });
    });

    // 7. Manual Add / Edit Expense Modal
    window.openAddExpenseModal = function() {
      const titleEl = document.getElementById('modal-expense-title');
      window.uiSetIconText(titleEl, "wallet", "新增記帳項目");
      const expIdEl = document.getElementById('exp-id');
      if (expIdEl) expIdEl.value = '';
      const form = document.getElementById('form-add-expense');
      if (form) form.reset();
      populateCategoryDropdowns();
      populateCardDropdowns();
      window.openModal('modal-expense');
    };

    window.submitAddExpenseForm = function(e) {
      if (e) { e.preventDefault(); if (e.stopPropagation) e.stopPropagation(); }
      
      const form = document.getElementById('form-add-expense');
      const directTitle = document.getElementById('exp-title');
      const title = directTitle ? directTitle.value.trim() : '';

      const directAmount = document.getElementById('exp-amount');
      const amount = directAmount ? (parseFloat(directAmount.value) || 0) : 0;

      if (!title) {
        alert('請輸入項目名稱！');
        return false;
      }

      const expIdEl = document.getElementById('exp-id');
      const expId = expIdEl ? expIdEl.value : '';
      
      const categorySelect = document.getElementById('exp-category');
      const currencySelect = document.getElementById('exp-currency');
      const payerSelect = document.getElementById('exp-payer');
      const cardSelect = document.getElementById('exp-card');
      const noteInput = document.getElementById('exp-note');

      const expObj = {
        id: expId ? expId : 'exp-' + Date.now(),
        date: new Date().toISOString().slice(0, 10),
        title: title,
        category: categorySelect ? categorySelect.value : '飲食',
        amount: amount,
        currency: currencySelect ? currencySelect.value : 'JPY',
        card: cardSelect ? cardSelect.value : '現金',
        payer: payerSelect ? payerSelect.value : '❤️',
        note: noteInput ? noteInput.value : ''
      };

      if (!tripData.expenses) tripData.expenses = [];

      if (expId) {
        const idx = tripData.expenses.findIndex(item => item.id === expId);
        if (idx !== -1) tripData.expenses[idx] = expObj;
        else tripData.expenses.unshift(expObj);
      } else {
        tripData.expenses.unshift(expObj);
      }

      window.closeModal('modal-expense');
      if (form) form.reset();
      saveDataAndUpdate();
      return false;
    };

    const addExpenseBtn = document.getElementById('add-expense-modal-btn');
    if (addExpenseBtn) {
      window.uiSetIconText(addExpenseBtn, 'plus', '新增記帳');
      addExpenseBtn.addEventListener('click', window.openAddExpenseModal);
    }


    // Itinerary Multi-Row Cost Management Helpers
    window.addItineraryCostRow = function(name = '', amount = '', currency = 'JPY') {
      const container = document.getElementById('it-cost-rows-container');
      if (!container) return;

      const rowDiv = document.createElement('div');
      rowDiv.className = 'it-cost-row';
      rowDiv.style.cssText = 'display:flex; gap:6px; align-items:center; margin-bottom:4px;';

      const cleanName = String(name || '').replace(/"/g, '&quot;');
      const cleanAmount = String(amount || '').replace(/"/g, '&quot;');
      const curVal = (currency === 'TWD' || currency === 'NT' || currency === '$' || cleanAmount.includes('$')) ? 'TWD' : 'JPY';

      rowDiv.innerHTML = `
        <input type="text" class="form-control it-cost-name" placeholder="項目 (例: Haruka / 門票)" value="${cleanName}" style="flex:2; font-size:0.85rem; padding:6px 8px;" />
        <input type="text" class="form-control it-cost-amount" placeholder="金額 (例: 2400*2 或 $406*2)" value="${cleanAmount}" style="flex:2; font-size:0.85rem; padding:6px 8px;" />
        <select class="form-control it-cost-currency" style="flex:1.2; font-size:0.82rem; padding:6px 4px;">
          <option value="JPY" ${curVal === 'JPY' ? 'selected' : ''}>日圓 (¥)</option>
          <option value="TWD" ${curVal === 'TWD' ? 'selected' : ''}>台幣 ($)</option>
        </select>
        <button type="button" onclick="this.parentElement.remove()" style="background:none; border:none; color:#DC2626; cursor:pointer; font-size:1.1rem; padding:2px 6px; flex-shrink:0;" title="刪除此列">${window.uiIcon("x", "danger")}</button>
      `;

      container.appendChild(rowDiv);
    };

    window.populateItineraryCostRows = function(item) {
      const container = document.getElementById('it-cost-rows-container');
      if (!container) return;
      container.innerHTML = '';

      if (item && item.costs && Array.isArray(item.costs) && item.costs.length > 0) {
        item.costs.forEach(c => {
          window.addItineraryCostRow(c.name || '', c.amount !== undefined ? String(c.amount) : '', c.currency || 'JPY');
        });
      } else if (item && (item.costJPY || item.cost)) {
        const rawCost = String(item.costJPY || item.cost).trim();
        const parsedItems = splitMultiCostItems(rawCost);
        if (parsedItems.length > 0) {
          parsedItems.forEach(pi => {
            let currency = 'JPY';
            if (pi.amountStr.includes('$') || pi.amountStr.toUpperCase().includes('NT') || pi.amountStr.toUpperCase().includes('TWD') || pi.amountStr.includes('台幣')) {
              currency = 'TWD';
            }
            const cleanAmount = pi.amountStr.replace(/^[¥$]/, '').trim();
            window.addItineraryCostRow(pi.name, cleanAmount, currency);
          });
        } else {
          window.addItineraryCostRow('', '', 'JPY');
        }
      } else {
        window.addItineraryCostRow('', '', 'JPY');
      }
    };

    window.getItineraryCostsFromForm = function() {
      const container = document.getElementById('it-cost-rows-container');
      if (!container) return [];
      const rows = container.querySelectorAll('.it-cost-row');
      const result = [];
      rows.forEach(row => {
        const nameEl = row.querySelector('.it-cost-name');
        const amountEl = row.querySelector('.it-cost-amount');
        const currencyEl = row.querySelector('.it-cost-currency');

        const name = nameEl ? nameEl.value.trim() : '';
        let amount = amountEl ? amountEl.value.trim() : '';
        let currency = currencyEl ? currencyEl.value : 'JPY';

        if (amount.includes('$') || amount.toUpperCase().includes('NT') || amount.toUpperCase().includes('TWD') || amount.includes('台幣')) {
          currency = 'TWD';
        }

        if (name || amount) {
          result.push({ name, amount, currency });
        }
      });
      return result;
    };

    // 8. Add / Edit Itinerary Modal Handler
    const addItineraryBtn = document.getElementById('add-itinerary-modal-btn');
    if (addItineraryBtn) {
      addItineraryBtn.addEventListener('click', () => {
        if (itineraryEditorOpen && !closeItineraryEditor()) return;
        const titleEl = document.getElementById('modal-itinerary-title');
        window.uiSetIconText(titleEl, "calendar", "新增行程景點");
        document.getElementById('it-id').value = '';
        document.getElementById('form-add-itinerary').reset();
        document.getElementById('it-day').value = currentDay;
        document.getElementById('it-time-start').value = '09:00';
        document.getElementById('it-time-end').value = '11:30';
        window.populateItineraryCostRows(null);
        document.getElementById('itinerary-editor-context').hidden = true;
        itineraryEditorBaseline = itineraryFormSignature();
        routeItineraryEditor(true);
      });
    }

    const itineraryForm = document.getElementById('form-add-itinerary');
    if (itineraryForm) {
      itineraryForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const itId = document.getElementById('it-id').value;
        const dayVal = parseInt(document.getElementById('it-day').value, 10);
        const loc = document.getElementById('it-location').value;
        const pastedUrl = document.getElementById('it-maps-url').value;

        const startTime = document.getElementById('it-time-start').value || '09:00';
        const endTime = document.getElementById('it-time-end').value || '11:30';
        const timeRangeStr = `${startTime}~${endTime}`;

        const costs = window.getItineraryCostsFromForm();
        const costJPYStr = costs.map(c => {
          const prefix = c.name ? `${c.name}: ` : '';
          const symbol = c.currency === 'TWD' ? '$' : '¥';
          return `${prefix}${symbol}${c.amount}`;
        }).join(' | ');

        const itemObj = {
          id: itId ? itId : 'it-' + Date.now(),
          day: dayVal,
          date: `Day ${dayVal}`,
          time: timeRangeStr,
          title: document.getElementById('it-title').value,
          category: document.getElementById('it-category').value,
          location: loc,
          costs: costs,
          costJPY: costJPYStr,
          note: document.getElementById('it-note').value,
          mapsUrl: pastedUrl && pastedUrl.trim() ? pastedUrl.trim() : `https://maps.google.com/?q=${encodeURIComponent(loc)}`
        };

        if (itId) {
          const idx = tripData.itinerary.findIndex(item => String(item.id) === String(itId));
          if (idx !== -1) {
            tripData.itinerary[idx] = itemObj;
          } else {
            tripData.itinerary.push(itemObj);
          }
        } else {
          tripData.itinerary.push(itemObj);
        }

        tripData.itinerary = sortItineraryByStartTime(tripData.itinerary);

        closeItineraryEditor(true);
        itineraryForm.reset();
        saveDataAndUpdate();
      });
    }

    // 9. Packing Checklist Add / Edit Item & Category Modals
    window.openAddPackingItemModal = function(category) {
      if (!tripData.packing.some(cat => cat.category === category)) return;
      window.uiSetIconText(document.getElementById("modal-packing-item-title"), "luggage", "新增行李項目");
      document.getElementById('form-add-packing-item').reset();
      document.getElementById('edit-packing-item-id').value = '';
      const select = document.getElementById('pk-item-category-select');
      select.replaceChildren(...tripData.packing.map(cat => new Option(cat.category, cat.category)));
      select.value = category;
      select.disabled = true;
      document.getElementById('pk-item-category-group').hidden = true;
      document.getElementById('pk-item-context-category').hidden = false;
      document.getElementById('pk-item-context-category-name').textContent = category;
      document.getElementById('pk-item-submit').textContent = '新增';
      openModal('modal-packing-item');
    };
    let packingInlineAdd = null;
    function finishPackingInlineAdd(commit) {
      const state = packingInlineAdd;
      if (!state || state.finished) return;
      state.finished = true;
      packingInlineAdd = null;
      const value = state.input.value.trim();
      state.row.remove();
      if (!commit || !value) return;
      // Reuse the existing form submit handler and its item creation/save flow.
      const form = document.getElementById('form-add-packing-item');
      form.reset();
      document.getElementById('edit-packing-item-id').value = '';
      const select = document.getElementById('pk-item-category-select');
      select.replaceChildren(...tripData.packing.map(cat => new Option(cat.category, cat.category)));
      select.value = state.category;
      document.getElementById('pk-item-name').value = value;
      form.requestSubmit();
    }
    function startPackingInlineAdd(category) {
      if (packingInlineAdd && packingInlineAdd.category === category) {
        packingInlineAdd.input.focus();
        return;
      }
      finishPackingInlineAdd(true);
      const categoryElement = [...document.querySelectorAll('.packing-category')]
        .find(el => el.dataset.category === category);
      if (!categoryElement) return;
      const row = document.createElement('div');
      row.className = 'packing-inline-add-row';
      row.draggable = false;
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'packing-inline-add-input';
      input.placeholder = '輸入行李項目名稱...';
      input.setAttribute('aria-label', '新增行李項目名稱');
      input.setAttribute('enterkeyhint', 'done');
      row.append(input);
      categoryElement.querySelector('.packing-add-item').before(row);
      packingInlineAdd = { category, row, input, finished: false };
      input.addEventListener('keydown', e => {
        if (e.isComposing) return;
        if (e.key === 'Enter' || e.key === 'Escape') {
          e.preventDefault();
          finishPackingInlineAdd(e.key === 'Enter');
        }
      });
      input.addEventListener('blur', () => finishPackingInlineAdd(true));
      input.focus();
      row.scrollIntoView({ block: 'nearest' });
    }
    const packingList = document.getElementById('packing-checklist-container');
    if (packingList) {
      const activate = e => {
        const button = e.target.closest('.packing-add-item');
        if (!button || !packingList.contains(button)) return;
        e.preventDefault();
        e.stopPropagation();
        startPackingInlineAdd(button.closest('.packing-category').dataset.category);
      };
      // Resolve the old input before blur can rerender and detach the clicked button.
      packingList.addEventListener('pointerdown', activate);
      packingList.addEventListener('click', activate);
    }

    const packingItemForm = document.getElementById('form-add-packing-item');
    if (packingItemForm) {
      packingItemForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const itemId = document.getElementById('edit-packing-item-id').value;
        const catName = document.getElementById('pk-item-category-select').value;
        const itemName = document.getElementById('pk-item-name').value;

        if (itemId) {
          tripData.packing.forEach(cat => {
            cat.items.forEach(item => {
              if (item.id === itemId) item.text = itemName;
            });
          });
        } else {
          const cat = tripData.packing.find(c => c.category === catName);
          if (cat) {
            cat.items.push({
              id: 'pk-' + Date.now(),
              text: itemName,
              checked: false
            });
          }
        }

        closeModal('modal-packing-item');
        packingItemForm.reset();
        saveDataAndUpdate();
      });
    }

    const addPackingCatBtn = document.getElementById('add-packing-cat-btn');
    if (addPackingCatBtn) {
      addPackingCatBtn.addEventListener('click', () => {
        window.uiSetIconText(document.getElementById("modal-packing-cat-title"), "folder", "新增行李分類");
        document.getElementById('edit-packing-cat-old-name').value = '';
        document.getElementById('form-add-packing-cat').reset();
        openModal('modal-packing-cat');
      });
    }

    const packingCatForm = document.getElementById('form-add-packing-cat');
    if (packingCatForm) {
      packingCatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const oldName = document.getElementById('edit-packing-cat-old-name').value;
        const newCatName = document.getElementById('pk-cat-name').value;

        if (oldName) {
          const cat = tripData.packing.find(c => c.category === oldName);
          if (cat) cat.category = newCatName;
        } else {
          tripData.packing.push({
            id: 'cat-' + Date.now(),
            category: newCatName,
            items: []
          });
        }
        closeModal('modal-packing-cat');
        packingCatForm.reset();
        saveDataAndUpdate();
      });
    }

  window.populateItinerarySelectForShopping = function(selectedItineraryId) {
    const selectEl = document.getElementById('shop-itinerary-id');
    if (!selectEl) return;

    const items = tripData.itinerary || [];
    let html = '<option value="">-- 不綁定行程 (解除綁定) --</option>';

    items.forEach(it => {
      const isSelected = (selectedItineraryId === it.id) ? 'selected' : '';
      html += `<option value="${it.id}" ${isSelected}>[Day ${it.day}] ${it.title} (${it.location})</option>`;
    });

    selectEl.innerHTML = html;
  };

  // Auto-fill location name when an itinerary is selected
  const shopItinerarySelect = document.getElementById('shop-itinerary-id');
  if (shopItinerarySelect) {
    shopItinerarySelect.addEventListener('change', (e) => {
      const selectedId = e.target.value;
      if (selectedId) {
        const boundIt = (tripData.itinerary || []).find(i => i.id === selectedId);
        if (boundIt) {
          const shopLocInput = document.getElementById('shop-location');
          if (shopLocInput) {
            shopLocInput.value = boundIt.location || boundIt.title || '';
          }
        }
      }
    });
  }

  // 10. Add / Edit Shopping Location Entry
  window.openAddShoppingModal = function() {
    window.uiSetIconText(document.getElementById("modal-shopping-title"), "shoppingBag", "新增購物地點與商品");
    document.getElementById('edit-shop-loc-id').value = '';
    document.getElementById('form-add-shopping').reset();
    if (window.populateItinerarySelectForShopping) window.populateItinerarySelectForShopping('');
    document.getElementById('first-item-fields').style.display = 'block';
    const preview = document.getElementById('shop-img-preview');
    if (preview) preview.style.display = 'none';
    uploadedShopImgBase64 = null;
    window.openModal('modal-shopping');
  };

  const addShoppingBtn = document.getElementById('add-shopping-modal-btn');
  if (addShoppingBtn) {
    addShoppingBtn.addEventListener('click', window.openAddShoppingModal);
  }

  let uploadedShopImgBase64 = null;
  const shopImgInput = document.getElementById('shop-img-file');
  const shopImgPreview = document.getElementById('shop-img-preview');
  if (shopImgInput) {
    shopImgInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = function(evt) {
          uploadedShopImgBase64 = evt.target.result;
          if (shopImgPreview) {
            shopImgPreview.src = uploadedShopImgBase64;
            shopImgPreview.style.display = 'block';
          }
        };
        reader.readAsDataURL(file);
      }
    });
  }

  window.saveShoppingLocationForm = function(e) {
    if (e) {
      e.preventDefault();
      if (e.stopPropagation) e.stopPropagation();
    }

    const editLocIdEl = document.getElementById('edit-shop-loc-id');
    const editLocId = editLocIdEl ? editLocIdEl.value : '';

    const locInput = document.getElementById('shop-location');
    const locName = locInput ? locInput.value.trim() : '';

    if (!locName) {
      alert('請輸入購買地點名稱！');
      if (locInput) locInput.focus();
      return false;
    }

    const catEl = document.getElementById('shop-category');
    const cat = catEl ? catEl.value : '購物';

    const shopItineraryIdEl = document.getElementById('shop-itinerary-id');
    const shopItineraryId = shopItineraryIdEl ? shopItineraryIdEl.value : '';

    const noteEl = document.getElementById('shop-note');
    const note = noteEl ? noteEl.value.trim() : '';

    if (!tripData.shopping) tripData.shopping = [];

    if (editLocId) {
      const locObj = tripData.shopping.find(s => s.id === editLocId);
      if (locObj) {
        locObj.location = locName;
        locObj.category = cat;
        locObj.itineraryId = shopItineraryId;
        locObj.note = note;
      }
    } else {
      const firstItemNameEl = document.getElementById('shop-name');
      const firstItemName = firstItemNameEl ? firstItemNameEl.value.trim() : '';

      const firstPriceEl = document.getElementById('shop-price');
      const firstPrice = firstPriceEl ? (parseInt(firstPriceEl.value, 10) || 0) : 0;

      const newLoc = {
        id: 'shop-loc-' + Date.now(),
        location: locName,
        category: cat,
        itineraryId: shopItineraryId,
        note: note,
        items: [
          {
            id: 'item-' + Date.now(),
            name: firstItemName || '預設商品',
            priceJPY: firstPrice,
            image: uploadedShopImgBase64 || "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=300&auto=format&fit=crop&q=80",
            bought: false,
            note: note
          }
        ]
      };
      tripData.shopping.unshift(newLoc);
    }

    if (editLocIdEl) editLocIdEl.value = '';
    window.closeModal('modal-shopping');

    const formEl = document.getElementById('form-add-shopping');
    if (formEl) formEl.reset();

    uploadedShopImgBase64 = null;
    const shopImgPreview = document.getElementById('shop-img-preview');
    if (shopImgPreview) shopImgPreview.style.display = 'none';

    saveDataAndUpdate();
    return false;
  };

  const shoppingForm = document.getElementById('form-add-shopping');
  if (shoppingForm) {
    shoppingForm.addEventListener('submit', window.saveShoppingLocationForm);
  }

  // 11. Add Subitem to Active Location Modal Handler
  window.openAddSubitemModal = function() {
    const locId = window.currentLocationDetailId;
    if (!locId) return;

    window.closeModal('modal-shopping-detail');

    const formEl = document.getElementById('form-add-item-to-loc');
    if (formEl) formEl.reset();

    const locIdInput = document.getElementById('subitem-loc-id');
    if (locIdInput) locIdInput.value = locId;

    const preview = document.getElementById('subitem-img-preview');
    if (preview) preview.style.display = 'none';

    uploadedSubitemImgBase64 = null;
    window.openModal('modal-add-item-to-loc');
  };

  const addSubitemBtn = document.getElementById('add-item-to-this-loc-btn');
  if (addSubitemBtn) {
    addSubitemBtn.addEventListener('click', window.openAddSubitemModal);
  }

  let uploadedSubitemImgBase64 = null;
  const subitemImgInput = document.getElementById('subitem-img-file');
  const subitemImgPreview = document.getElementById('subitem-img-preview');
  if (subitemImgInput) {
    subitemImgInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = function(evt) {
          uploadedSubitemImgBase64 = evt.target.result;
          if (subitemImgPreview) {
            subitemImgPreview.src = uploadedSubitemImgBase64;
            subitemImgPreview.style.display = 'block';
          }
        };
        reader.readAsDataURL(file);
      }
    });
  }

  window.saveSubitemForm = function(e) {
    if (e) {
      e.preventDefault();
      if (e.stopPropagation) e.stopPropagation();
    }

    const locIdEl = document.getElementById('subitem-loc-id');
    const locId = locIdEl ? locIdEl.value : window.currentLocationDetailId;

    const nameInput = document.getElementById('subitem-name');
    const name = nameInput ? nameInput.value.trim() : '';

    if (!name) {
      alert('請輸入商品名稱！');
      if (nameInput) nameInput.focus();
      return false;
    }

    const priceEl = document.getElementById('subitem-price');
    const priceJPY = priceEl ? (parseInt(priceEl.value, 10) || 0) : 0;

    const noteEl = document.getElementById('subitem-note');
    const note = noteEl ? noteEl.value.trim() : '';

    const locEntry = (tripData.shopping || []).find(s => s.id === locId);
    if (locEntry) {
      if (!locEntry.items) locEntry.items = [];
      const newItem = {
        id: 'item-' + Date.now(),
        name: name,
        priceJPY: priceJPY,
        image: uploadedSubitemImgBase64 || "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=300&auto=format&fit=crop&q=80",
        bought: false,
        note: note
      };
      locEntry.items.push(newItem);
    }

    window.closeModal('modal-add-item-to-loc');

    const formEl = document.getElementById('form-add-item-to-loc');
    if (formEl) formEl.reset();

    uploadedSubitemImgBase64 = null;
    const previewEl = document.getElementById('subitem-img-preview');
    if (previewEl) previewEl.style.display = 'none';

    saveDataAndUpdate();

    if (locId) {
      window.openLocationDetailModal(locId);
    }

    return false;
  };

  const subitemForm = document.getElementById('form-add-item-to-loc');
  if (subitemForm) {
    subitemForm.addEventListener('submit', window.saveSubitemForm);
  }

    // 12. Edit Subitem Modal Handler
    let uploadedEditSubitemImgBase64 = null;
    const editSubitemImgInput = document.getElementById('edit-subitem-img-file');
    const editSubitemImgPreview = document.getElementById('edit-subitem-img-preview');
    if (editSubitemImgInput) {
      editSubitemImgInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = function(evt) {
            uploadedEditSubitemImgBase64 = evt.target.result;
            if (editSubitemImgPreview) {
              editSubitemImgPreview.src = uploadedEditSubitemImgBase64;
              editSubitemImgPreview.style.display = 'block';
            }
          };
          reader.readAsDataURL(file);
        }
      });
    }

    const editSubitemForm = document.getElementById('form-edit-subitem');
    if (editSubitemForm) {
      editSubitemForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const locId = document.getElementById('edit-subitem-loc-id').value;
        const itemId = document.getElementById('edit-subitem-id').value;

        const locEntry = tripData.shopping.find(s => s.id === locId);
        if (locEntry && locEntry.items) {
          const item = locEntry.items.find(i => i.id === itemId);
          if (item) {
            item.name = document.getElementById('edit-subitem-name').value;
            item.priceJPY = parseInt(document.getElementById('edit-subitem-price').value, 10) || 0;
            item.note = document.getElementById('edit-subitem-note').value;
            if (uploadedEditSubitemImgBase64) {
              item.image = uploadedEditSubitemImgBase64;
            }
          }
        }

        closeModal('modal-edit-subitem');
        editSubitemForm.reset();
        uploadedEditSubitemImgBase64 = null;
        saveDataAndUpdate();
      });
    }

    // Modal Close Buttons
    document.querySelectorAll('.close-modal').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.closest('#modal-itinerary') || btn.closest('#itinerary-edit-panel-host')) {
          closeItineraryEditor();
          return;
        }
        const modal = btn.closest('.modal-overlay');
        if (modal) modal.classList.remove('active');
      });
    });
  }

  function switchTab(tabName) {
    if (itineraryEditorOpen && tabName !== 'itinerary') {
      if (!closeItineraryEditor()) return;
    }
    currentTab = tabName;
    tabButtons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    tabSections.forEach(sec => {
      sec.classList.toggle('active', sec.id === `tab-${tabName}`);
    });
  }

  function renderGoogleSheetExpenseControlBar() {
    const container = document.getElementById('google-sheet-expense-control-container');
    if (!container) return;
    container.innerHTML = `
      <button onclick="window.openGoogleSheetExpenseModal()" class="btn-primary accounting-csv-action" style="width:100%; padding:11px 14px; font-size:0.88rem; display:flex; align-items:center; justify-content:center; gap:6px; border-radius:12px;">
        ${window.uiIcon("clipboard", "strong")} 貼上 CSV 同步記帳
      </button>
    `;
  }

  window.openGoogleSheetExpenseModal = function() {
    openModal('modal-google-sheet-expense');
  };

  window.syncGoogleSheetExpense = async function(e) {
    if (e) { e.preventDefault(); if (e.stopPropagation) e.stopPropagation(); }

    const textInput = document.getElementById('gs-expense-csv-text');
    let directText = textInput ? textInput.value.trim() : '';

    if (!directText) {
      alert('請先在 Google 試算表中選取記帳表格（含第1列標題），按 Ctrl+C，然後貼到文字框中！');
      return false;
    }

    const btn = document.querySelector('#form-google-sheet-expense button[type="button"]');
    if (btn) { btn.disabled = true; window.uiSetIconText(btn, "clock", "正在讀取與解析記帳中..."); }


    function parseCSVGrid(text) {
      if (!text) return [];
      const isTabSeparated = text.includes('\t') || !text.includes(',');
      const delimiter = isTabSeparated ? '\t' : ',';
      const rows = [];
      let currentRow = [], currentCell = '', inQuotes = false;
      for (let i = 0; i < text.length; i++) {
        const char = text[i], nextChar = text[i + 1];
        if (char === '"') {
          if (inQuotes && nextChar === '"') { currentCell += '"'; i++; }
          else { inQuotes = !inQuotes; }
        } else if (char === delimiter && !inQuotes) {
          currentRow.push(currentCell.trim()); currentCell = '';
        } else if ((char === '\r' || char === '\n') && !inQuotes) {
          if (char === '\r' && nextChar === '\n') i++;
          currentRow.push(currentCell.trim());
          if (currentRow.some(c => c.length > 0)) rows.push(currentRow);
          currentRow = []; currentCell = '';
        } else { currentCell += char; }
      }
      if (currentCell || currentRow.length > 0) {
        currentRow.push(currentCell.trim());
        if (currentRow.some(c => c.length > 0)) rows.push(currentRow);
      }
      return rows;
    }

    const csvText = directText;

    try {
      const rows = parseCSVGrid(csvText);
      if (rows.length <= 1) {
        alert('❌ 讀取到的記帳內容為空！請確認選取了包含第一列標題的表格！');
        return false;
      }

      const headers = rows[0].map(h => h.toLowerCase().replace(/"/g, ''));
      const importTs = Date.now();
      const parsedExpenses = [];

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i].map(c => c.replace(/^"|"/g, ''));
        if (!row.some(c => c)) continue;

        let date = '2026-11-20', time = '', item = '', costJPY = 0, costTWD = 0, payer = '❤️', category = '飲食', card = '現金', note = '';

        row.forEach((val, idx) => {
          const h = headers[idx] || '', v = (val || '').trim();
          if (h.includes('date') || h.includes('日期')) date = v || '2026-11-20';
          else if (h.includes('time') || h.includes('時間')) time = v;
          else if (h.includes('item') || h.includes('項目') || h.includes('名稱') || h.includes('消費')) item = v;
          else if (h.includes('jpy') || h.includes('日圓') || h.includes('日幣')) costJPY = parseFloat(v.replace(/[^0-9.]/g, '')) || 0;
          else if (h.includes('twd') || h.includes('台幣') || h.includes('新台幣')) costTWD = parseFloat(v.replace(/[^0-9.]/g, '')) || 0;
          else if (h.includes('payer') || h.includes('付款人')) payer = v || '❤️';
          else if (h.includes('category') || h.includes('分類')) category = v || '飲食';
          else if (h.includes('card') || h.includes('支付方式') || h.includes('付款方式')) card = v || '現金';
          else if (h.includes('note') || h.includes('備註') || h.includes('說明')) note = v;
        });

        if (!item) continue;

        const finalAmount = costJPY > 0 ? costJPY : costTWD;
        const finalCurrency = costJPY > 0 ? 'JPY' : (costTWD > 0 ? 'TWD' : 'JPY');

        parsedExpenses.push({
          id: 'exp-gs-' + importTs + '-' + i,
          date: time ? `${date} ${time}` : date,
          time: time,
          title: item,
          amount: finalAmount,
          currency: finalCurrency,
          category: category,
          payer: payer,
          card: card,
          note: note
        });
      }

      if (parsedExpenses.length === 0) {
        alert('⚠️ 未辨識到有效的消費項目！請確認第一列包含「日期, 項目, 日圓, 分類」標題欄位！');
        return false;
      }

      // 完整覆蓋：先清空再設定，避免舊資料殘留
      tripData.expenses = [];
      window.StorageManager.saveData(tripData);
      tripData.expenses = parsedExpenses;
      saveDataAndUpdate();
      if (textInput) textInput.value = '';
      window.closeModal('modal-google-sheet-expense');
      alert(`✅ 成功匯入 ${parsedExpenses.length} 筆記帳項目！`);
      return true;
    } catch (err) {
      console.error('GS Expense Sync Error:', err);
      alert('❌ 解析失敗：' + err.message);
      return false;
    } finally {
      if (btn) { btn.disabled = false; window.uiSetIconText(btn, "download", "一鍵匯入記帳資料"); }
    }
  };

  function renderGoogleSheetItineraryControlBar() {
    const container = document.getElementById('google-sheet-itinerary-control-container');
    if (!container) return;
    container.innerHTML = `
      <button onclick="window.openGoogleSheetItineraryModal()" class="btn-primary" style="width:100%; padding:11px 14px; font-size:0.88rem; display:flex; align-items:center; justify-content:center; gap:6px; border-radius:12px; background:var(--ui-selected); color:var(--ui-accent-text); border:1px solid var(--ui-selected-border); font-weight:500; box-shadow:none;">
        ${window.uiIcon("clipboard", "muted")} 貼上 CSV 同步行程
      </button>
    `;
  }

  window.openGoogleSheetItineraryModal = function() {
    window.openModal('modal-google-sheet-itinerary');
  };


  window.toggleCardLimitsAccordion = function() {
    isCardLimitsExpanded = !isCardLimitsExpanded;
    const container = document.getElementById('exp-card-limits-container');
    const icon = document.getElementById('card-limits-toggle-icon');
    if (container) container.style.display = isCardLimitsExpanded ? 'flex' : 'none';
    if (icon) icon.innerText = isCardLimitsExpanded ? '▲' : '▼';
  };


  window.filterCardModal = function(owner) {
    currentCardFilter = owner;
    ['all', 'me', 'hu'].forEach(k => {
      const btn = document.getElementById(`card-filter-${k}`);
      if (btn) btn.classList.remove('active');
    });
    if (owner === 'all') document.getElementById('card-filter-all')?.classList.add('active');
    else if (owner === '❤️') document.getElementById('card-filter-me')?.classList.add('active');
    else if (owner === '🐷') document.getElementById('card-filter-hu')?.classList.add('active');

    renderCardModalList();
  };

  window.toggleAddCardForm = function(show = true, cardId = '') {
    const box = document.getElementById('card-edit-form-box');
    if (!box) return;
    if (!show) {
      box.style.display = 'none';
      return;
    }
    box.style.display = 'block';

    const cards = getCardsList();
    const existing = cardId ? cards.find(c => c.id === cardId) : null;

    window.uiSetIconText(document.getElementById("card-form-title"), existing ? "pencil" : "plus", existing ? "編輯信用卡" : "新增信用卡");
    document.getElementById('card-edit-id').value = existing ? existing.id : '';
    document.getElementById('card-edit-owner').value = existing ? existing.owner : '❤️';
    document.getElementById('card-edit-name').value = existing ? existing.name : '';
    document.getElementById('card-edit-limit').value = existing ? existing.limit : 0;
  };

  window.saveCardItem = function() {
    const id = document.getElementById('card-edit-id').value;
    const owner = document.getElementById('card-edit-owner').value;
    const name = document.getElementById('card-edit-name').value.trim();
    const limit = parseInt(document.getElementById('card-edit-limit').value, 10) || 0;

    if (!name) {
      alert('請輸入卡片名稱！');
      return;
    }

    const cards = getCardsList();

    if (id) {
      const card = cards.find(c => c.id === id);
      if (card) {
        card.owner = owner;
        card.name = name;
        card.limit = limit;
      }
    } else {
      if (cards.some(c => c.name === name && c.owner === owner)) {
        alert(`已存在卡片名稱為「${name}」且持卡人為 ${owner} 的卡片！`);
        return;
      }
      cards.push({
        id: 'card-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
        name,
        owner,
        limit
      });
    }

    window.CREDIT_CARDS = Array.from(new Set(cards.map(c => c.name)));
    saveDataAndUpdate();
    window.toggleAddCardForm(false);
    renderCardModalList();
    populateCardDropdowns();
  };

  window.deleteCardItem = function(cardId) {
    const cards = getCardsList();
    const card = cards.find(c => c.id === cardId);
    if (!card) return;

    // Protection check against existing expenses
    const expenses = tripData.expenses || [];
    const usedCount = expenses.filter(e => {
      if (e.card !== card.name) return false;
      if (card.owner === '通用') return true;
      if (card.owner === '❤️' && (e.payer === '❤️' || e.payer === '我')) return true;
      if (card.owner === '🐷' && (e.payer === '🐷' || e.payer === '老公')) return true;
      return false;
    }).length;

    if (usedCount > 0) {
      alert(`⚠️ 無法刪除「${card.owner} ${card.name}」！\n\n此卡片目前已在 ${usedCount} 筆記帳明細中使用。請先改用其他卡片，或刪除該筆記帳紀錄後才能刪除卡片！`);
      return;
    }

    if (confirm(`確定要刪除卡片「${card.owner} ${card.name}」嗎？`)) {
      tripData.cards = cards.filter(c => c.id !== cardId);
      window.CREDIT_CARDS = Array.from(new Set(tripData.cards.map(c => c.name)));
      saveDataAndUpdate();
      renderCardModalList();
      populateCardDropdowns();
    }
  };

  function renderCardModalList() {
    const container = document.getElementById('card-limits-inputs-container');
    if (!container) return;

    const cards = getCardsList();
    const filtered = cards.filter(c => {
      if (currentCardFilter === 'all') return true;
      return c.owner === currentCardFilter || c.owner === '通用';
    });

    if (filtered.length === 0) {
      container.innerHTML = '<div style="text-align:center; padding:20px; color:var(--kyoto-muted);">尚無卡片資料，點擊上方「+ 新增卡片」建立！</div>';
      return;
    }

    container.innerHTML = filtered.map(card => {
      const ownerBadge = card.owner === '❤️' ? `<span class="badge badge-spot" style="font-size:0.7rem;">${window.uiIcon("user", "muted")} 我</span>` :
                         card.owner === '🐷' ? `<span class="badge badge-meal" style="font-size:0.7rem;">${window.uiIcon("circleUserRound", "muted")} 老公</span>` :
                         '<span class="badge badge-transport" style="font-size:0.7rem;">通用</span>';
      const limitText = card.limit > 0 ? `NT$ ${card.limit.toLocaleString()}` : '<span style="color:var(--kyoto-muted);">無上限</span>';

      return `
        <div style="display:flex; align-items:center; justify-content:space-between; background:var(--ui-surface); padding:10px 12px; border-radius:10px; border:1px solid var(--ui-border); gap:10px;">
          <div style="display:flex; align-items:center; gap:8px;">
            ${ownerBadge}
            <span style="font-weight:600; font-size:0.88rem; color:var(--ui-text);">${card.name}</span>
          </div>
          <div style="display:flex; align-items:center; gap:10px;">
            <div style="font-size:0.8rem; font-weight:600; color:var(--ui-accent-text); text-align:right;">
              <span style="font-size:0.68rem; color:var(--kyoto-muted); font-weight:normal;">上限:</span> ${limitText}
            </div>
            <button type="button" onclick="window.toggleAddCardForm(true, '${card.id}')" style="background:none; border:none; color:var(--kyoto-muted); cursor:pointer; font-size:0.85rem;" title="編輯">${window.uiIcon("pencil", "muted")}</button>
            <button type="button" onclick="window.deleteCardItem('${card.id}')" style="background:none; border:none; color:#DC2626; cursor:pointer; font-size:0.85rem;" title="刪除">${window.uiIcon("trash", "danger")}</button>
          </div>
        </div>
      `;
    }).join('');
  }

  window.openCardLimitModal = function() {
    window.toggleAddCardForm(false);
    renderCardModalList();
    openModal('modal-card-limits');
  };

  window.syncGoogleSheetItinerary = async function(e) {
    if (e) { e.preventDefault(); if (e.stopPropagation) e.stopPropagation(); }

    const textInput = document.getElementById('gs-itinerary-csv-text');
    let directText = textInput ? textInput.value.trim() : '';

    if (!directText) {
      alert('請先在 Google 試算表中選取行程表格（含第1列標題），按 Ctrl+C，然後貼到文字框中！');
      return false;
    }

    const btn = document.querySelector('#form-google-sheet-itinerary button[type="button"]');
    if (btn) { btn.disabled = true; window.uiSetIconText(btn, "clock", "正在讀取與解析行程中..."); }

    function parseCSVGrid(text) {
      if (!text) return [];
      const isTabSeparated = text.includes('\t') || !text.includes(',');
      const delimiter = isTabSeparated ? '\t' : ',';
      const rows = [];
      let currentRow = [], currentCell = '', inQuotes = false;
      for (let i = 0; i < text.length; i++) {
        const char = text[i], nextChar = text[i + 1];
        if (char === '"') {
          if (inQuotes && nextChar === '"') { currentCell += '"'; i++; }
          else { inQuotes = !inQuotes; }
        } else if (char === delimiter && !inQuotes) {
          currentRow.push(currentCell.trim()); currentCell = '';
        } else if ((char === '\r' || char === '\n') && !inQuotes) {
          if (char === '\r' && nextChar === '\n') i++;
          currentRow.push(currentCell.trim());
          if (currentRow.some(c => c.length > 0)) rows.push(currentRow);
          currentRow = []; currentCell = '';
        } else { currentCell += char; }
      }
      if (currentCell || currentRow.length > 0) {
        currentRow.push(currentCell.trim());
        if (currentRow.some(c => c.length > 0)) rows.push(currentRow);
      }
      return rows;
    }

    function buildCandidateUrls(raw) {
      const trimmed = raw.trim();
      const urls = [];
      // Only match edit-format sheet ID (NOT /d/e/ published links)
      const sheetIdMatch = trimmed.match(/\/d\/(?!e\/)([a-zA-Z0-9-_]{15,})/);
      const gidMatch = trimmed.match(/gid=([0-9]+)/);
      const gid = gidMatch ? gidMatch[1] : '0';
      if (sheetIdMatch && sheetIdMatch[1]) {
        const sid = sheetIdMatch[1];
        urls.push(`https://docs.google.com/spreadsheets/d/${sid}/export?format=csv&gid=${gid}`);
        urls.push(`https://docs.google.com/spreadsheets/d/${sid}/gviz/tq?tqx=out:csv&gid=${gid}`);
      }
      // Handle published-to-web URLs (/d/e/2PACX-...)
      if (trimmed.includes('/e/2PACX-') || trimmed.includes('/pub')) {
        let u = trimmed.replace('/pubhtml', '/pub');
        if (!u.includes('/pub')) u += '/pub';
        if (!u.includes('output=csv')) u += (u.includes('?') ? '&' : '?') + 'output=csv';
        urls.push(u);
      }
      // Always include the original URL as fallback
      if (!urls.includes(trimmed)) urls.push(trimmed);
      return [...new Set(urls)];
    }

    const csvText = directText;

    try {
      const rows = parseCSVGrid(csvText);
      if (rows.length <= 1) {
        alert('❌ 讀取到的行程內容為空！請確認選取了包含第一列標題的表格！');
        return false;
      }
      const headers = rows[0].map(h => h.toLowerCase().replace(/"/g, ''));
      const importTs = Date.now();
      const parsedItinerary = [];

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i].map(c => c.replace(/^"|"$/g, ''));
        if (!row.some(c => c)) continue;
        let day = 1, timeStr = '', title = '', category = '景點', location = '', costJPY = '', note = '', mapsUrl = '';

        row.forEach((val, idx) => {
          const h = headers[idx] || '', v = (val || '').trim();
          if (h.includes('day') || h.includes('天數')) {
            day = Math.min(Math.max(parseInt(v.replace(/[^0-9]/g, '')) || 1, 1), 10);
          } else if (h.includes('time') || h.includes('時間')) {
            timeStr = v;
          } else if (h.includes('title') || h.includes('標題') || h.includes('行程標題') || h.includes('名稱')) {
            title = v;
          } else if (h.includes('category') || h.includes('分類')) {
            if (v.includes('交通') || v.includes('transport')) category = '交通';
            else if (v.includes('正餐') || v.includes('飲食') || v.includes('food') || v.includes('餐廳')) category = '正餐';
            else if (v.includes('點心') || v.includes('甜點') || v.includes('咖啡') || v.includes('cafe')) category = '點心';
            else if (v.includes('購物') || v.includes('shopping')) category = '購物';
            else if (v.includes('住宿') || v.includes('hotel')) category = '住宿';
            else category = v || '景點';
          } else if (h.includes('location') || h.includes('地點')) {
            location = v;
          } else if (h.includes('cost') || h.includes('jpy') || h.includes('預算') || h.includes('日圓')) {
            costJPY = v;
          } else if (h.includes('note') || h.includes('備忘') || h.includes('說明')) {
            note = v;
          } else if (h.includes('map') || h.includes('網址')) {
            mapsUrl = v;
          }
        });

        if (!title) continue;
        parsedItinerary.push({ id: 'it-gs-' + importTs + '-' + i, day, time: timeStr || '09:00', title, category, location: location || title, costJPY, note, mapsUrl });
      }

      if (parsedItinerary.length === 0) {
        alert('⚠️ 未辨識到有效行程項目！請確認第一列包含「天數, 時間, 行程標題, 分類, 地點」標題欄位！');
        return false;
      }

      const dayCounts = {};
      parsedItinerary.forEach(item => { dayCounts[item.day] = (dayCounts[item.day] || 0) + 1; });
      const daySummary = Object.keys(dayCounts).sort((a, b) => +a - +b).map(d => `Day ${d}: ${dayCounts[d]} 筆`).join(', ');

      // 完整覆蓋：先清空再設定，避免舊資料殘留
      tripData.itinerary = [];
      window.StorageManager.saveData(tripData);
      tripData.itinerary = parsedItinerary;
      saveDataAndUpdate();
      if (textInput) textInput.value = '';
      window.closeModal('modal-google-sheet-itinerary');
      alert(`✅ 成功匯入 ${parsedItinerary.length} 筆行程！\n\n📌 各天明細：${daySummary}`);
      return true;
    } catch (err) {
      console.error('GS Itinerary Sync Error:', err);
      alert('❌ 解析失敗：' + err.message);
      return false;
    } finally {
      if (btn) { btn.disabled = false; window.uiSetIconText(btn, "download", "一鍵匯入全 10 天行程"); }
    }
  };

  // --- RENDERING VIEWS ---

  function renderAllViews() {
    renderFlightDisplay();
    renderHotelDisplay();
    renderExpenseTab();
    renderItineraryTab();
    renderPackingTab();
    renderShoppingTab();
  }

  // 1. Render Outbound & Inbound Flights Display (Guaranteed NO undefined text)
  function renderFlightDisplay() {
    const flight = tripData.flightInfo || {};
    const outboundContainer = document.getElementById('outbound-flight-container');
    const inboundContainer = document.getElementById('inbound-flight-container');

    const out = flight.outbound || {
      date: "2026-11-20",
      airline: "星宇航空 Starlux",
      code: "JX820",
      flightNo: "JX820",
      depAirport: "台北桃園 (TPE)",
      depTime: "07:40 AM",
      arrAirport: "關西國際機場 (KIX)",
      arrTime: "11:10 AM"
    };

    const inb = flight.inbound || {
      date: "2026-11-29",
      airline: "星宇航空 Starlux",
      code: "JX835",
      flightNo: "JX835",
      depAirport: "神戶機場 (UKB)",
      depTime: "11:30 AM",
      arrAirport: "台北桃園 (TPE)",
      arrTime: "13:45 PM"
    };

    const outFlightCode = out.code || out.flightNo || "JX820";
    const inbFlightCode = inb.code || inb.flightNo || "JX835";

    if (outboundContainer) {
      outboundContainer.innerHTML = `
        <div class="kyoto-card" onclick="editFlight('outbound')" style="cursor:pointer;" title="點擊編輯去程航班">
          <div class="card-title-row">
            <div class="card-title">${window.uiIcon("plane", "travel")} 去程航班 (${out.date})</div>
          </div>
          <div class="flight-schedule" style="display:flex; justify-content:space-between; align-items:center; margin: 12px 0;">
            <div class="flight-endpoint">
              <div class="flight-time">${out.depTime}</div>
              <div class="flight-airport">${out.depAirport}</div>
            </div>
            <div class="flight-airline" style="text-align:center;">
              <div class="flight-airline-name">${out.airline}</div>
              <div class="flight-direction" style="font-size:1.1rem;">${window.uiIcon("plane", "travel")} ➔</div>
              <div class="flight-number">${outFlightCode}</div>
            </div>
            <div class="flight-endpoint" style="text-align:right;">
              <div class="flight-time">${out.arrTime}</div>
              <div class="flight-airport">${out.arrAirport}</div>
            </div>
          </div>
        </div>
      `;
    }

    if (inboundContainer) {
      inboundContainer.innerHTML = `
        <div class="kyoto-card" onclick="editFlight('inbound')" style="cursor:pointer;" title="點擊編輯回程航班">
          <div class="card-title-row">
            <div class="card-title">${window.uiIcon("plane", "travel")} 回程航班 (${inb.date})</div>
          </div>
          <div class="flight-schedule" style="display:flex; justify-content:space-between; align-items:center; margin: 12px 0;">
            <div class="flight-endpoint">
              <div class="flight-time">${inb.depTime}</div>
              <div class="flight-airport">${inb.depAirport}</div>
            </div>
            <div class="flight-airline" style="text-align:center;">
              <div class="flight-airline-name">${inb.airline}</div>
              <div class="flight-direction" style="font-size:1.1rem;">${window.uiIcon("plane", "travel")} ➔</div>
              <div class="flight-number">${inbFlightCode}</div>
            </div>
            <div class="flight-endpoint" style="text-align:right;">
              <div class="flight-time">${inb.arrTime}</div>
              <div class="flight-airport">${inb.arrAirport}</div>
            </div>
          </div>
        </div>
      `;
    }
  }

  window.editFlight = function(type) {
    const fObj = type === 'outbound' ? tripData.flightInfo.outbound : tripData.flightInfo.inbound;
    if (!fObj) return;

    window.uiSetIconText(document.getElementById("modal-flight-title"), "plane", type === "outbound" ? "編輯去程航班資訊" : "編輯回程航班資訊");
    document.getElementById('flight-type').value = type;
    document.getElementById('fl-date').value = fObj.date || '';
    document.getElementById('fl-airline').value = fObj.airline || '';
    document.getElementById('fl-code').value = fObj.code || fObj.flightNo || '';
    document.getElementById('fl-dep-airport').value = fObj.depAirport || '';
    document.getElementById('fl-dep-time').value = fObj.depTime || '';
    document.getElementById('fl-arr-airport').value = fObj.arrAirport || '';
    document.getElementById('fl-arr-time').value = fObj.arrTime || '';

    openModal('modal-edit-flight');
  };

  // 2. Render Hotels List
  function renderHotelDisplay() {
    const hotels = tripData.hotels || [];
    const hotelContainer = document.getElementById('hotel-list-container');
    if (!hotelContainer) return;

    if (hotels.length === 0) {
      hotelContainer.innerHTML = `<div style="text-align:center; padding:20px; color:var(--kyoto-muted);">目前無住宿資料，點擊右上角「+ 新增住宿」！</div>`;
      return;
    }

    hotelContainer.innerHTML = hotels.map(h => {
      let stayNightsText = '';
      if (h.checkIn && h.checkOut) {
        const d1 = new Date(h.checkIn);
        const d2 = new Date(h.checkOut);
        const diffTime = Math.abs(d2 - d1);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (!isNaN(diffDays) && diffDays > 0) {
          stayNightsText = ` (${diffDays} 晚)`;
        }
      }

      const mapsLink = h.googleMapsUrl && h.googleMapsUrl.trim() ? h.googleMapsUrl : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(h.name)}`;

      return `
        <div class="kyoto-card" onclick="editHotel('${h.id}')" style="cursor:pointer; margin-bottom:14px;" title="點擊編輯住宿資訊">
          <div class="card-title-row">
            <div class="hotel-name" style="font-size:1.05rem;">${h.name}</div>
            <div class="hotel-actions" style="display:flex; gap:8px; align-items:center;">
              <a href="${mapsLink}" target="_blank" onclick="event.stopPropagation();" class="btn-icon-sm" style="text-decoration:none; font-size:1.05rem;" title="開啟 Google 地圖導航">${window.uiIcon("map", "travel")}</a>
              <button onclick="event.stopPropagation(); deleteHotel('${h.id}')" style="background:none; border:none; color:#DC2626; cursor:pointer; font-size:0.85rem;" title="刪除住宿">${window.uiIcon("trash", "danger")}</button>
            </div>
          </div>
          ${h.notes ? `<div class="hotel-note" style="font-size:0.78rem; margin-bottom:10px; padding:6px 10px; border-radius:8px; white-space:pre-wrap;">${window.uiIcon("lightbulb", "muted")} ${h.notes}</div>` : ''}
          <div class="parsed-grid">
            <div class="parsed-item"><span class="parsed-label">入住 Check-in</span><div class="parsed-val">${h.checkIn || '-'}</div></div>
            <div class="parsed-item"><span class="parsed-label">退房 Check-out${stayNightsText}</span><div class="parsed-val">${h.checkOut || '-'}</div></div>
          </div>
        </div>
      `;
    }).join('');
  }

  window.editHotel = function(id) {
    const h = tripData.hotels.find(item => item.id === id);
    if (!h) return;

    window.uiSetIconText(document.getElementById("modal-hotel-title"), "bed", "編輯住宿資訊");
    document.getElementById('hotel-id').value = h.id;
    document.getElementById('hotel-name').value = h.name || '';
    
    selCheckIn = h.checkIn || '2026-11-20';
    selCheckOut = h.checkOut || '2026-11-29';
    
    document.getElementById('hotel-maps').value = h.googleMapsUrl || '';
    document.getElementById('hotel-notes').value = h.notes || '';
    
    updateDateRangeDisplay();
    renderCalendarGrid();
    openModal('modal-hotel');
  };

  window.deleteHotel = function(id) {
    if (confirm('確定刪除此住宿資料嗎？')) {
      tripData.hotels = tripData.hotels.filter(h => h.id !== id);
      saveDataAndUpdate();
    }
  };

  function parseCostExpressionAndCurrency(val) {
    const str = val == null ? '' : String(val).trim();
    const currency = (str.includes('$') || /NT|TWD/i.test(str) || str.includes('台幣')) ? 'TWD' : 'JPY';
    if (typeof val === 'number') return { amount: Number.isFinite(val) ? val : 0, currency: 'JPY', valid: Number.isFinite(val) };
    if (!str) return { amount: 0, currency, valid: true };
    // Strip recognized currency wrappers only; never discard unknown characters.
    let expression = str.replace(/^(?:(?:NT\$|TWD|NT|JPY|[¥￥$]|台幣|日圓|日幣|円)\s*)+/i, '')
      .replace(/\s*(?:TWD|NT|JPY|台幣|日圓|日幣|円|[¥￥$])$/i, '').trim();
    expression = expression.replace(/\d{1,3}(?:,\d{3})+(?:\.\d+)?/g, (number, offset, text) => {
      const before = text[offset - 1], after = text[offset + number.length];
      return (before && /[\d.,]/.test(before)) || (after && /[\d.,]/.test(after)) ? number : number.replace(/,/g, '');
    });
    let position = 0, depth = 0;
    function skipSpace() { while (/\s/.test(expression[position] || '') && position < expression.length) position++; }
    function finite(value) { if (!Number.isFinite(value)) throw Error('Non-finite amount'); return value; }
    function primary() {
      skipSpace();
      if (++depth > 100) throw Error('Expression too deep');
      let value;
      const char = expression[position];
      if (char === '+' || char === '-') {
        position++;
        value = (char === '-' ? -1 : 1) * primary();
      } else if (char === '(') {
        position++;
        value = sum();
        skipSpace();
        if (expression[position++] !== ')') throw Error('Unmatched parenthesis');
      } else {
        const match = /^(?:\d+(?:\.\d*)?|\.\d+)/.exec(expression.slice(position));
        if (!match) throw Error('Missing operand');
        position += match[0].length;
        value = Number(match[0]);
      }
      depth--;
      return finite(value);
    }
    function product() {
      let value = primary();
      while (true) {
        skipSpace();
        const operator = expression[position];
        if (operator !== '*' && operator !== '/') return value;
        position++;
        const right = primary();
        if (operator === '/' && right === 0) throw Error('Division by zero');
        value = finite(operator === '*' ? value * right : value / right);
      }
    }
    function sum() {
      let value = product();
      while (true) {
        skipSpace();
        const operator = expression[position];
        if (operator !== '+' && operator !== '-') return value;
        position++;
        const right = product();
        value = finite(operator === '+' ? value + right : value - right);
      }
    }
    try {
      if (expression.length > 2000) throw Error('Expression too long');
      const amount = sum();
      skipSpace();
      if (position !== expression.length) throw Error('Invalid amount character');
      return { amount, currency, valid: true };
    } catch (error) {
      return { amount: 0, currency, valid: false };
    }
  }

  function splitMultiCostItems(rawStr) {
    if (!rawStr) return [];
    // Existing newline/pipe delimiters separate costs; preserve the full expression.
    return String(rawStr).trim().split(/[\n\r|]+/).map(part => {
      part = part.trim();
      const colon = part.search(/[:：]/);
      return colon < 0 ? { name: '', amountStr: part, rawPart: part } : {
        name: part.slice(0, colon).trim(), amountStr: part.slice(colon + 1).trim(), rawPart: part
      };
    }).filter(part => part.amountStr);
  }

  function getItemBudgetTotals(item) {
    if (!item) return { totalJPY: 0, totalTWD: 0, itemDetails: [] };
    let totalJPY = 0;
    let totalTWD = 0;
    const itemDetails = [];

    if (item.costs && Array.isArray(item.costs) && item.costs.length > 0) {
      item.costs.forEach(c => {
        const { amount, currency } = parseCostExpressionAndCurrency(c.amount);
        const finalCurrency = (c.currency === 'TWD' || currency === 'TWD') ? 'TWD' : 'JPY';
        if (amount > 0) {
          if (finalCurrency === 'TWD') totalTWD += amount;
          else totalJPY += amount;
          itemDetails.push({ name: c.name || '', amount, rawAmount: c.amount, currency: finalCurrency });
        }
      });
    } else if (item.costJPY || item.cost) {
      const raw = String(item.costJPY || item.cost).trim();
      const parsedItems = splitMultiCostItems(raw);
      parsedItems.forEach(pi => {
        const { amount, currency } = parseCostExpressionAndCurrency(pi.amountStr);
        if (amount > 0) {
          if (currency === 'TWD') totalTWD += amount;
          else totalJPY += amount;
          const cleanRaw = pi.amountStr.replace(/^[¥$]/, '').trim();
          itemDetails.push({ name: pi.name, amount, rawAmount: cleanRaw, currency });
        }
      });
    }

    return { totalJPY, totalTWD, itemDetails };
  }

  function formatCostDisplay(item) {
    if (!item) return '';
    const { totalJPY, totalTWD, itemDetails } = getItemBudgetTotals(item);

    if (totalJPY === 0 && totalTWD === 0) return '';

    let parts = [];
    if (totalJPY > 0) parts.push(`¥${totalJPY.toLocaleString()}`);
    if (totalTWD > 0) parts.push(`NT$ ${totalTWD.toLocaleString()}`);

    let summaryText = `預算: ` + parts.join(' + ');

    let detailsHtml = '';
    if (itemDetails.length > 0) {
      detailsHtml = `<div class="itinerary-cost-detail" style="font-size:0.75rem; margin-top:3px; display:flex; flex-direction:column; gap:2px;">` +
        itemDetails.map(i => {
          const label = i.name ? `${i.name}: ` : '';
          const symbol = i.currency === 'TWD' ? '$' : '¥';
          return `<div>• ${label}${symbol}${i.amount.toLocaleString()}</div>`;
        }).join('') +
        `</div>`;
    }

    return `<div><div>${summaryText}</div>${detailsHtml}</div>`;
  }

  // 3. Render Expense Tab & Summary
  function renderExpenseTab() {
    renderGoogleSheetExpenseControlBar();
    const expenses = tripData.expenses || [];
    const rate = (tripData.flightInfo && tripData.flightInfo.exchangeRate) ? tripData.flightInfo.exchangeRate : 0.21;

    let totalJPY = 0;      // sum of JPY expenses (as JPY)
    let totalTWDOnly = 0;  // sum of TWD expenses (as TWD)
    let totalCombinedTWD = 0; // all expenses converted to TWD and summed
    let meSpendTWD = 0;
    let husbandSpendTWD = 0;
    const cardSpend = {}; // { cardName: totalTWD }

    expenses.forEach(exp => {
      const twdVal = exp.currency === 'TWD' ? exp.amount : Math.round(exp.amount * rate);
      const jpyVal = exp.currency === 'JPY' ? exp.amount : 0;
      const twdOnlyVal = exp.currency === 'TWD' ? exp.amount : 0;

      if (jpyVal > 0) totalJPY += jpyVal;
      if (twdOnlyVal > 0) totalTWDOnly += twdOnlyVal;
      totalCombinedTWD += twdVal;

      if (exp.payer === '❤️' || exp.payer === '我') meSpendTWD += twdVal;
      else if (exp.payer === '🐷' || exp.payer === '老公') husbandSpendTWD += twdVal;

      const cardName = exp.card || '現金';
      cardSpend[cardName] = (cardSpend[cardName] || 0) + twdVal;
    });

    // Calculate Itinerary Budget Total split by currency (JPY vs TWD)
    const itinerary = tripData.itinerary || [];
    let totalItineraryJPY = 0;
    let totalItineraryTWDOnly = 0;
    let itineraryItemCount = 0;

    itinerary.forEach(item => {
      const { totalJPY, totalTWD } = getItemBudgetTotals(item);
      if (totalJPY > 0 || totalTWD > 0) {
        totalItineraryJPY += totalJPY;
        totalItineraryTWDOnly += totalTWD;
        itineraryItemCount++;
      }
    });

    const totalItineraryCombinedTWD = Math.round(totalItineraryJPY * rate) + totalItineraryTWDOnly;

    const itBudgetJpyEl = document.getElementById('it-budget-total-jpy');
    const itBudgetTwdOnlyEl = document.getElementById('it-budget-total-twd-only');
    const itBudgetTwdEl = document.getElementById('it-budget-total-twd');
    const itBudgetCountEl = document.getElementById('it-budget-count');

    if (itBudgetJpyEl) itBudgetJpyEl.innerText = `¥ ${totalItineraryJPY.toLocaleString()}`;
    if (itBudgetTwdOnlyEl) itBudgetTwdOnlyEl.innerText = `NT$ ${totalItineraryTWDOnly.toLocaleString()}`;
    if (itBudgetTwdEl) itBudgetTwdEl.innerText = `NT$ ${totalItineraryCombinedTWD.toLocaleString()}`;
    if (itBudgetCountEl) itBudgetCountEl.innerText = `共 ${itineraryItemCount} 筆預估費用`;

    const totalJpyEl = document.getElementById('exp-total-jpy');
    const totalTwdOnlyEl = document.getElementById('exp-total-twd-only');
    const totalTwdEl = document.getElementById('exp-total-twd');
    const meTotalEl = document.getElementById('exp-me-total');
    const husbandTotalEl = document.getElementById('exp-husband-total');

    if (totalJpyEl) totalJpyEl.innerText = totalJPY.toLocaleString();
    if (totalTwdOnlyEl) totalTwdOnlyEl.innerText = totalTWDOnly.toLocaleString();
    if (totalTwdEl) totalTwdEl.innerText = totalCombinedTWD.toLocaleString();
    if (meTotalEl) meTotalEl.innerText = `NT$ ${meSpendTWD.toLocaleString()}`;
    if (husbandTotalEl) husbandTotalEl.innerText = `NT$ ${husbandSpendTWD.toLocaleString()}`;

    // Render card usage & remaining limits
    const cardLimitsContainer = document.getElementById('exp-card-limits-container');
    const toggleIcon = document.getElementById('card-limits-toggle-icon');
    if (cardLimitsContainer) {
      cardLimitsContainer.style.display = isCardLimitsExpanded ? 'flex' : 'none';
      if (toggleIcon) toggleIcon.innerText = isCardLimitsExpanded ? '▲' : '▼';

      const cards = getCardsList();
      const cardRows = cards.map(card => {
        let used = 0;
        expenses.forEach(exp => {
          if (exp.card !== card.name) return;
          const expAmount = exp.currency === 'TWD' ? exp.amount : Math.round(exp.amount * rate);
          if (card.owner === '通用') {
            used += expAmount;
          } else if (card.owner === '❤️' && (exp.payer === '❤️' || exp.payer === '我')) {
            used += expAmount;
          } else if (card.owner === '🐷' && (exp.payer === '🐷' || exp.payer === '老公')) {
            used += expAmount;
          }
        });

        const limit = card.limit || 0;
        if (used === 0 && limit === 0) return null;

        const remaining = limit > 0 ? Math.max(0, limit - used) : null;
        const pct = limit > 0 ? Math.min(100, Math.round(used / limit * 100)) : null;
        const barColor = pct >= 100 ? 'var(--ui-icon-warning)' : pct >= 80 ? 'var(--ui-autumn)' : 'var(--ui-accent)';
        const ownerBadge = card.owner === '❤️' ? window.uiOwnerPresentation('❤️') + ' ' : card.owner === '🐷' ? window.uiOwnerPresentation('🐷') + ' ' : '';

        return `
          <div style="background:var(--ui-background); border-radius:8px; padding:8px 10px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
              <span style="font-size:0.8rem; font-weight:500; color:var(--ui-text);">${window.uiIcon("creditCard", "muted")} ${ownerBadge}${card.name}</span>
              <span style="font-size:0.78rem; color:var(--kyoto-muted);">
                已刷 <b style="color:var(--maple-crimson);">NT$ ${used.toLocaleString()}</b>
                ${limit > 0 ? ` / 上限 NT$ ${limit.toLocaleString()}` : ' (無上限)'}
              </span>
            </div>
            ${limit > 0 ? `
              <div style="background:var(--ui-border); border-radius:4px; height:6px; overflow:hidden;">
                <div style="width:${pct}%; height:100%; background:${barColor}; transition:width 0.4s;"></div>
              </div>
              <div style="font-size:0.72rem; color:${remaining===0?'var(--ui-icon-warning)':'var(--ui-muted)'}; margin-top:3px; text-align:right;">
                ${remaining === 0 ? window.uiIcon("warning", "warning") + " 已達回饋上限" : `剩餘回饋額度 NT$ ${remaining.toLocaleString()}`}
              </div>` : ''}
          </div>`;
      }).filter(Boolean);

      if (cardRows.length === 0) {
        cardLimitsContainer.innerHTML = `<div style="font-size:0.75rem;color:var(--kyoto-muted);">點擊右上方「${window.uiIcon("settings", "muted")} 管理卡片與額度」來設定信用卡！</div>`;
      } else {
        cardLimitsContainer.innerHTML = cardRows.join('');
      }
    }

    const expListContainer = document.getElementById('expense-list-container');
    if (!expListContainer) return;

    if (expenses.length === 0) {
      expListContainer.innerHTML = `<div style="text-align:center; padding:30px; color:var(--kyoto-muted);">尚無記帳紀錄，使用上方自然語言或手動新增！</div>`;
      return;
    }

    expListContainer.innerHTML = expenses.map(exp => {
      const isJPY = exp.currency === 'JPY';
      const displayAmount = isJPY ? `¥ ${exp.amount.toLocaleString()}` : `NT$ ${exp.amount.toLocaleString()}`;
      const equivTWD = isJPY ? `(約 NT$ ${Math.round(exp.amount * rate).toLocaleString()})` : '';
      const payerEmoji = (exp.payer === '🐷' || exp.payer === '老公') ? '🐷' : '❤️';

      return `
        <div class="kyoto-card" onclick="editExpense('${exp.id}')" style="padding:14px 16px; margin-bottom:10px; cursor:pointer;" title="點擊編輯記帳">
          <div class="flex-between" style="margin-bottom:6px; align-items:flex-start; gap:10px;">
            <div class="accounting-history-title" style="font-size:0.92rem; flex:1; min-width:0; word-break:break-word; line-height:1.35;">${exp.title}</div>
            <div class="accounting-amount" style="font-size:1.05rem; white-space:nowrap; flex-shrink:0; text-align:right;">${displayAmount}</div>
          </div>
          <div class="flex-between" style="gap:8px; align-items:center; margin-bottom:6px;">
            <div style="display:flex; gap:6px; align-items:center; flex-wrap:wrap;">
              <span class="badge badge-spot" style="font-size:0.7rem;">${exp.category}</span>
              <span class="badge badge-transport" style="font-size:0.7rem;">${exp.card}</span>
              <span class="badge badge-meal" style="font-size:0.78rem;">${window.uiOwnerPresentation(payerEmoji)}</span>
            </div>
            <div style="font-size:0.72rem; color:var(--kyoto-muted); white-space:nowrap; flex-shrink:0;">${equivTWD}</div>
          </div>
          ${exp.note ? `<div class="expense-note" style="font-size:0.75rem; color:var(--kyoto-muted); margin-bottom:6px; background:var(--ui-background); padding:4px 8px; border-radius:6px; border-left:3px solid var(--ui-autumn);" title="${exp.note.replace(/"/g, '&quot;')}">${window.uiIcon("notebook", "muted")}<span class="expense-note-text">${exp.note}</span></div>` : ''}
          <div class="flex-between" style="font-size:0.72rem; color:var(--kyoto-muted);">
            <div>${exp.date}</div>
            <div style="display:flex; gap:6px; align-items:center;">
              <button onclick="event.stopPropagation(); deleteExpense('${exp.id}')" style="background:none; border:none; color:#DC2626; cursor:pointer; font-size:0.85rem;" title="刪除記帳">${window.uiIcon("trash", "danger")}</button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  window.editExpense = function(id) {
    const exp = tripData.expenses.find(e => e.id === id);
    if (!exp) return;

    window.uiSetIconText(document.getElementById("modal-expense-title"), "wallet", "編輯記帳項目");
    document.getElementById('exp-id').value = exp.id;
    document.getElementById('exp-title').value = exp.title || '';
    document.getElementById('exp-amount').value = exp.amount || '';
    document.getElementById('exp-currency').value = exp.currency || 'JPY';
    document.getElementById('exp-category').value = exp.category || '購物';
    document.getElementById('exp-payer').value = exp.payer || '❤️';
    document.getElementById('exp-card').value = exp.card || '現金';
    document.getElementById('exp-note').value = exp.note || '';

    openModal('modal-expense');
  };

  window.deleteExpense = function(id) {
    if (confirm('確定刪除此筆記帳紀錄嗎？')) {
      tripData.expenses = tripData.expenses.filter(e => e.id !== id);
      saveDataAndUpdate();
    }
  };

  // Parsed Preview Toast with Inline Editing
  function showParsedPreview(parsed) {
    const previewBox = document.getElementById('nlp-parsed-preview');
    if (!previewBox) return;

    const categoryOptions = window.EXPENSE_CATEGORIES.map(c => `
      <option value="${c.id}" ${c.id === parsed.category ? 'selected' : ''}>${c.label}</option>
    `).join('');

    const cardOptions = window.CREDIT_CARDS.map(c => `
      <option value="${c}" ${c === parsed.card ? 'selected' : ''}>${c}</option>
    `).join('');

    previewBox.innerHTML = `
      <div class="parsed-preview-box">
        <div style="font-size:0.85rem; font-weight:500; color:var(--ui-accent-text); margin-bottom:8px;">${window.uiIcon("check", "active")} 辨識成功！您可以即時調整下方欄位：</div>
        
        <div class="form-group" style="margin-bottom:6px;">
          <label class="parsed-label">名稱</label>
          <input type="text" id="edit-nlp-title" class="form-control" style="padding:6px; font-size:0.82rem;" value="${parsed.title}" />
        </div>
        
        <div class="form-row" style="margin-bottom:6px;">
          <div class="form-group" style="flex:1; margin:0;">
            <label class="parsed-label">金額</label>
            <input type="number" id="edit-nlp-amount" class="form-control" style="padding:6px; font-size:0.82rem;" value="${parsed.amount}" />
          </div>
          <div class="form-group" style="flex:1; margin:0;">
            <label class="parsed-label">幣別</label>
            <select id="edit-nlp-currency" class="form-control" style="padding:6px; font-size:0.82rem;">
              <option value="JPY" ${parsed.currency === 'JPY' ? 'selected' : ''}>日圓 JPY</option>
              <option value="TWD" ${parsed.currency === 'TWD' ? 'selected' : ''}>台幣 TWD</option>
            </select>
          </div>
        </div>

        <div class="form-row" style="margin-bottom:6px;">
          <div class="form-group" style="flex:1; margin:0;">
            <label class="parsed-label">類別</label>
            <select id="edit-nlp-category" class="form-control" style="padding:6px; font-size:0.82rem;">
              ${categoryOptions}
            </select>
          </div>
          <div class="form-group" style="flex:1; margin:0;">
            <label class="parsed-label">付款人</label>
            <select id="edit-nlp-payer" class="form-control" style="padding:6px; font-size:0.82rem;">
              <option value="❤️" ${parsed.payer === '❤️' ? 'selected' : ''}>我</option>
              <option value="🐷" ${parsed.payer === '🐷' ? 'selected' : ''}>老公</option>
            </select>
          </div>
        </div>

        <div class="form-group" style="margin-bottom:10px;">
          <label class="parsed-label">支付卡別</label>
          <select id="edit-nlp-card" class="form-control" style="padding:6px; font-size:0.82rem;">
            ${cardOptions}
          </select>
        </div>

        <div class="form-group">
          <label class="parsed-label" for="edit-nlp-note">備註（選填）</label>
          <textarea id="edit-nlp-note" class="form-control" rows="2">${String(parsed.note || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
        </div>

        <div style="display:flex; gap:8px;">
          <button id="confirm-nlp-btn" class="btn-primary" style="padding:8px; font-size:0.82rem;">${window.uiIcon("check", "active")} 一鍵寫入記帳</button>
          <button id="cancel-nlp-btn" class="btn-secondary" style="padding:8px; font-size:0.82rem;">取消</button>
        </div>
      </div>
    `;

    document.getElementById('confirm-nlp-btn').addEventListener('click', () => {
      const finalTitle = document.getElementById('edit-nlp-title').value;
      const finalAmount = parseFloat(document.getElementById('edit-nlp-amount').value) || 0;
      const finalCurrency = document.getElementById('edit-nlp-currency').value;
      const finalCategory = document.getElementById('edit-nlp-category').value;
      const finalPayer = document.getElementById('edit-nlp-payer').value;
      const finalCard = document.getElementById('edit-nlp-card').value;
      const finalNote = document.getElementById('edit-nlp-note').value;

      tripData.expenses.unshift({
        id: 'exp-' + Date.now(),
        date: new Date().toISOString().slice(0, 16).replace('T', ' '),
        title: finalTitle,
        category: finalCategory,
        amount: finalAmount,
        currency: finalCurrency,
        card: finalCard,
        payer: finalPayer,
        note: finalNote
      });
      previewBox.innerHTML = '';
      document.getElementById('nlp-expense-input').value = '';
      saveDataAndUpdate();
    });

    document.getElementById('cancel-nlp-btn').addEventListener('click', () => {
      previewBox.innerHTML = '';
    });
  }

  // 4. Render Day-by-Day Itinerary
  // Keep the map aligned with the selected day and category without changing trip data.

  function itineraryOutlineIcon(name) {
    return window.uiIcon(name === "edit" ? "pencil" : "plus", "inherit", "itinerary-outline-icon");
  }

  function itineraryMapText(value) {
    if (typeof value !== 'string') return '';
    const text = value.trim();
    return text === 'undefined' || text === 'null' ? '' : text;
  }

  function itineraryMapQuery(item) {
    if (!item) return '';
    try {
      const url = new URL(item.mapsUrl);
      if ((url.protocol === 'https:' || url.protocol === 'http:') &&
          /(^|\.)google\.(com|co\.jp)$/.test(url.hostname)) {
        const query = itineraryMapText(url.searchParams.get('q')) || itineraryMapText(url.searchParams.get('query'));
        if (query) return query;
      }
    } catch (_) { /* Invalid URLs fall back to existing place fields. */ }
    return itineraryMapText(item.location) || itineraryMapText(item.locationName) || itineraryMapText(item.title);
  }

  function syncItineraryCardSelection() {
    document.querySelectorAll('#itinerary-timeline-container .timeline-card').forEach(card => {
      card.classList.toggle('is-selected', String(card.dataset.itId) === selectedMapItemId);
    });
  }

  function renderItineraryMap(items) {
    const select = document.getElementById('itinerary-map-select');
    const frame = document.getElementById('itinerary-map-frame');
    const caption = document.getElementById('itinerary-map-caption');
    const link = document.getElementById('itinerary-map-link');
    if (!select || !frame || !caption || !link) return;
    select.replaceChildren();
    items.forEach(item => {
      const option = document.createElement('option');
      option.value = String(item.id);
      option.textContent = `${item.time || ''} ${item.location || item.title || '行程地點'}`.trim();
      select.appendChild(option);
    });
    if (!items.some(item => String(item.id) === selectedMapItemId)) {
      selectedMapItemId = items.length ? String(items[0].id) : null;
    }
    select.disabled = items.length === 0;
    if (!items.length) {
      const option = document.createElement('option');
      option.textContent = '此日尚無符合篩選的行程';
      select.appendChild(option);
    }
    function updateMap() {
      const item = items.find(entry => String(entry.id) === selectedMapItemId);
      const placeQuery = itineraryMapQuery(item);
      const query = placeQuery || '京都 日本';
      let externalUrl = '';
      if (item && item.mapsUrl) {
        try {
          const url = new URL(item.mapsUrl);
          if (url.protocol === 'https:' || url.protocol === 'http:') {
            externalUrl = url.href;

          }
        } catch (_) { /* Use the place name when a stored URL is invalid. */ }
      }
      const src = `https://maps.google.com/maps?q=${encodeURIComponent(query)}&output=embed`;
      if (frame.getAttribute('src') !== src) frame.src = src;
      frame.title = `Google 地圖：${query}`;
      caption.textContent = item ? (placeQuery ? `Day ${currentDay} · ${item.title || query}` : `Day ${currentDay} · 此行程缺少地點資料，先顯示京都地圖。`) : `Day ${currentDay} 尚無符合篩選的行程，先顯示京都地圖。`;
      link.href = externalUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
    }
    select.value = selectedMapItemId || '';
    select.onchange = () => { selectedMapItemId = select.value; updateMap(); syncItineraryCardSelection(); };
    updateMap();
  }
  function renderItineraryTab() {
    renderGoogleSheetItineraryControlBar();

    // Automatic repair for any existing corrupted localStorage itinerary data
    if (tripData.itinerary && Array.isArray(tripData.itinerary)) {
      tripData.itinerary.forEach((item, idx) => {
        if (!item.id) item.id = 'it-' + Date.now() + '-' + idx;
        if (item.locationName && (!item.location || item.location === 'undefined')) item.location = item.locationName;
        if (item.location === 'undefined') item.location = item.title || '';
        if (item.timeStart && (!item.time || item.time === 'undefined')) item.time = item.timeEnd ? `${item.timeStart}~${item.timeEnd}` : item.timeStart;
        if (item.time === 'undefined') item.time = '';
        if (item.notes && (!item.note || item.note === 'undefined')) item.note = item.notes;
        if (item.category === 'transport') item.category = '交通';
        else if (item.category === 'food') item.category = '正餐';
        else if (item.category === 'cafe') item.category = '點心';
        else if (item.category === 'spot') item.category = '景點';
        else if (item.category === 'shopping') item.category = '購物';
        else if (item.category === 'hotel') item.category = '住宿';
      });
    }

    tripData.itinerary = sortItineraryByStartTime(tripData.itinerary || []);
    const itinerary = tripData.itinerary;
    
    // Day Selector Buttons Grid
    const daySelector = document.getElementById('day-selector-container');
    if (daySelector) {
      daySelector.innerHTML = DAYS_LIST.map(d => `
        <button class="day-btn ${currentDay === d.day ? 'active' : ''}" onclick="switchDay(${d.day})">
          <span>Day ${d.day}</span>
          <span class="day-date-sub">${d.date}</span>
        </button>
      `).join('');
    }

    // Category Filter Chips
    const categoryChips = document.getElementById('itinerary-category-chips');
    if (categoryChips) {
      const chipList = [{ id: 'all', label: '全部' }].concat(
        window.ITINERARY_CATEGORIES.map(c => ({ id: c.id, label: c.label }))
      );
      categoryChips.innerHTML = chipList.map(c => `
        <button class="chip-btn ${currentItineraryCategory === c.id ? 'active' : ''}" onclick="filterItineraryCategory('${c.id}')">${window.uiCategoryPresentation(c.id, c.label)}</button>
      `).join('');
    }

    const filtered = itinerary.filter(item => {
      const matchesDay = item.day === currentDay;
      const matchesCat = currentItineraryCategory === 'all' || item.category === currentItineraryCategory;
      return matchesDay && matchesCat;
    });

    renderItineraryMap(filtered);
    const timelineContainer = document.getElementById('itinerary-timeline-container');
    if (!timelineContainer) return;

    const currentDayObj = DAYS_LIST.find(d => d.day === currentDay);
    const dayTitleHeader = `
      <div class="itinerary-section-title" style="font-size:1rem; margin:4px 0 10px 0; display:flex; justify-content:space-between; align-items:center;">
        <span>${window.uiIcon("calendar", "travel")} Day ${currentDay} (${currentDayObj ? currentDayObj.date : ''}) 行程明細</span>
        <span style="font-size:0.75rem; color:var(--kyoto-muted); font-weight:normal;">10 天行程</span>
      </div>
    `;

    if (filtered.length === 0) {
      timelineContainer.innerHTML = dayTitleHeader + `<div style="text-align:center; padding:30px; color:var(--kyoto-muted);">此天尚無符合說明的行程安排，點擊右下角「+」新增！</div>`;
      return;
    }

    timelineContainer.innerHTML = dayTitleHeader + filtered.map(item => {
      let rawTime = (item.time && item.time !== 'undefined') ? String(item.time).trim() : '';
      let displayTime = rawTime ? rawTime.replace(/\s*~\s*/g, '~').replace(/\s*-\s*/g, '~').replace(/\s*➔\s*/g, '~') : '';
      const displayLocation = (item.location && item.location !== 'undefined') ? item.location : '';
      const displayCategory = (item.category && item.category !== 'undefined') ? item.category : '景點';
      const mapsLink = item.mapsUrl || `https://maps.google.com/?q=${encodeURIComponent(displayLocation || item.title)}`;

      let badgeClass = 'badge-spot';
      let badgeIcon = window.uiIcon("leaf", "travel");
      if (displayCategory === '正餐' || displayCategory === 'food') { badgeClass = 'badge-meal'; badgeIcon = window.uiIcon("utensils"); }
      else if (displayCategory === '點心' || displayCategory === 'cafe') { badgeClass = 'badge-cafe'; badgeIcon = window.uiIcon("coffee"); }
      else if (displayCategory === '景點' || displayCategory === 'spot') { badgeClass = 'badge-spot'; badgeIcon = window.uiIcon("leaf", "travel"); }
      else if (displayCategory === '購物' || displayCategory === 'shopping') { badgeClass = 'badge-shop'; badgeIcon = window.uiIcon("shoppingBag"); }
      else if (displayCategory === '交通' || displayCategory === 'transport') { badgeClass = 'badge-transport'; badgeIcon = window.uiIcon("train"); }

      // Only an explicit itineraryId creates an itinerary/shopping association.
      const matchingLocs = (tripData.shopping || []).filter(loc => {
        return Boolean(loc && loc.itineraryId && String(loc.itineraryId) === String(item.id));
      });

      let shoppingBadgesHtml = '';
      if (matchingLocs.length > 0) {
        shoppingBadgesHtml = matchingLocs.map(mLoc => {
          const totalItemsCount = mLoc.items ? mLoc.items.length : 0;
          const unboughtCount = mLoc.items ? mLoc.items.filter(i => !Boolean(i.bought)).length : 0;
          const badgeColor = unboughtCount > 0 ? 'var(--ui-muted)' : 'var(--ui-accent-text)';
          const badgeText = unboughtCount > 0
            ? `${window.uiIcon("shoppingBag", "muted")} 購物提醒：${mLoc.location} (${unboughtCount} 項待買 / 共 ${totalItemsCount} 項)`
            : `${window.uiIcon("shoppingBag", "muted")} 購物連結：${mLoc.location} (全數已買 ${window.uiIcon("check", "active")})`;

          return `
            <div data-no-card-action onclick="event.stopPropagation(); openLocationDetailModal('${mLoc.id}')" class="itinerary-shopping-reminder" style="margin-top:6px; background:var(--ui-surface); border:1px solid var(--ui-border); color:${badgeColor}; font-size:0.75rem; font-weight:400; padding:5px 10px; border-radius:8px; display:flex; align-items:center; justify-content:space-between; cursor:pointer;" title="點擊直接查看此地點的購物清單與照片">
              <span>${badgeText}</span>
              <span style="font-size:0.75rem; font-weight:500;">查看清單 ➔</span>
            </div>
          `;
        }).join('');
      }

      const escapedId = String(item.id || '').replace(/'/g, "\\'");
      const escapedTitle = item.title ? String(item.title).replace(/"/g, '&quot;').replace(/'/g, "\\'") : '';

      return `
        <div class="timeline-item">
          <div class="timeline-time">${displayTime}</div>
          <div class="timeline-card" data-it-id="${escapedId}" tabindex="0" style="cursor:pointer;">
            <div class="flex-between" style="margin-bottom:4px;">
              <div class="itinerary-place-title" style="font-size:0.98rem;">${item.title}</div>
              <div class="itinerary-card-header-actions">
                <span class="badge ${badgeClass}">${badgeIcon} ${displayCategory}</span>
              </div>
            </div>
            ${displayLocation ? `<div class="itinerary-place-metadata" style="font-size:0.8rem; margin-bottom:6px;">${window.uiIcon("mapPin", "travel")} ${displayLocation}</div>` : ''}
            ${(item.note && item.note !== 'undefined') ? `<div class="itinerary-helper" style="font-size:0.78rem; margin-bottom:8px; background:var(--ui-background); padding:6px 10px; border-radius:8px; white-space:pre-wrap; word-break:normal; overflow-wrap:break-word; line-height:1.6;">${window.uiIcon("lightbulb", "muted")} ${item.note}</div>` : ''}
            ${shoppingBadgesHtml}
            <div class="flex-between" style="margin-top:6px;">
              <div class="itinerary-budget" style="font-size:0.75rem;">${formatCostDisplay(item)}</div>
              <div style="display:flex; gap:6px; align-items:center;">
                <button type="button" class="itinerary-outline-button itinerary-edit-button" aria-label="編輯行程" title="編輯行程" onclick="event.stopPropagation(); window.editItinerary(this.closest('.timeline-card'));">${window.uiIcon("pencil", "inherit")}</button>
                <a href="${mapsLink}" target="_blank" onclick="event.stopPropagation();" class="btn-icon-sm itinerary-card-map-action" style="text-decoration:none;" title="開啟地圖導航">${window.uiIcon("map", "travel")}</a>
                <button onclick="event.stopPropagation(); window.deleteItinerary('${escapedId}')" style="background:none; border:none; color:#DC2626; cursor:pointer; font-size:0.85rem;" title="刪除行程">${window.uiIcon("trash", "danger")}</button>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');

    timelineContainer.onclick = function(e) {
      if (!(e.target instanceof Element)) return;
      if (e.target.closest('button, a, input, select, textarea, [data-no-card-action]')) return;
      const card = e.target.closest('.timeline-card');
      if (!card) return;
      if (window.matchMedia('(min-width: 1024px)').matches) {
        if (itineraryEditorOpen) return;
        selectedMapItemId = String(card.dataset.itId);
        renderItineraryMap(filtered);
        syncItineraryCardSelection();
      } else if (window.editItinerary) {
        window.editItinerary(card);
      }
    };
    timelineContainer.onkeydown = function(e) {
      if (!(e.target instanceof Element)) return;
      if (e.target.closest('button, a, input, select, textarea, [data-no-card-action]')) return;
      if (e.target.matches('.timeline-card') && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        e.target.click();
      }
    };
    syncItineraryCardSelection();
  }

  window.switchDay = function(d) {
    currentDay = d;
    renderItineraryTab();
  };

  window.filterItineraryCategory = function(cat) {
    currentItineraryCategory = cat;
    renderItineraryTab();
  };

  function populate10MinTimeDropdowns() {
    const startSelect = document.getElementById('it-time-start');
    const endSelect = document.getElementById('it-time-end');
    if (!startSelect || !endSelect) return;

    let optionsHtml = '';
    for (let h = 0; h < 24; h++) {
      const hStr = String(h).padStart(2, '0');
      for (let m = 0; m < 60; m += 10) {
        const mStr = String(m).padStart(2, '0');
        const timeVal = `${hStr}:${mStr}`;
        optionsHtml += `<option value="${timeVal}">${timeVal}</option>`;
      }
    }

    startSelect.innerHTML = optionsHtml;
    endSelect.innerHTML = optionsHtml;
  }

  function formatTimeToHHMM(rawTime) {
    if (!rawTime) return '10:00';
    let str = String(rawTime).trim().toUpperCase();
    const isPM = str.includes('PM');
    const isAM = str.includes('AM');
    str = str.replace(/AM|PM/g, '').trim();

    const parts = str.split(':');
    if (parts.length >= 2) {
      let hours = parseInt(parts[0], 10);
      let mins = parseInt(parts[1], 10);
      if (isNaN(hours)) hours = 10;
      if (isNaN(mins)) mins = 0;

      if (isPM && hours < 12) hours += 12;
      if (isAM && hours === 12) hours = 0;

      return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
    }
    return '10:00';
  }

  function roundToNearest10Min(rawTime) {
    if (!rawTime) return '09:00';
    const hhmm = formatTimeToHHMM(rawTime);
    const parts = hhmm.split(':');
    let h = parseInt(parts[0], 10);
    let m = parseInt(parts[1], 10);
    if (isNaN(h)) h = 9;
    if (isNaN(m)) m = 0;

    let roundedM = Math.round(m / 10) * 10;
    if (roundedM >= 60) {
      roundedM = 0;
      h = (h + 1) % 24;
    }

    return `${String(h).padStart(2, '0')}:${String(roundedM).padStart(2, '0')}`;
  }

  function parseTimeRangeToHHMM(timeStr) {
    if (!timeStr) return { start: '09:00', end: '11:30' };
    const parts = String(timeStr).split(/~|-|➔/);
    if (parts.length >= 2) {
      return {
        start: roundToNearest10Min(parts[0]),
        end: roundToNearest10Min(parts[1])
      };
    } else {
      const single = roundToNearest10Min(timeStr);
      return { start: single, end: single };
    }
  }

  function sortItineraryByStartTime(items) {
    return (items || []).map((item, originalIndex) => {
      const rawTime = item && item.time != null ? String(item.time).trim() : '';
      const start = rawTime && rawTime !== 'undefined' ? parseTimeRangeToHHMM(rawTime).start : null;
      const startMinutes = start ? Number(start.slice(0, 2)) * 60 + Number(start.slice(3)) : null;
      return { item, originalIndex, day: Number.isFinite(Number(item && item.day)) ? Number(item.day) : Number.MAX_SAFE_INTEGER, startMinutes };
    }).sort((a, b) => {
      if (a.day !== b.day) return a.day - b.day;
      if (a.startMinutes === null && b.startMinutes !== null) return 1;
      if (a.startMinutes !== null && b.startMinutes === null) return -1;
      if (a.startMinutes !== b.startMinutes) return (a.startMinutes ?? 0) - (b.startMinutes ?? 0);
      return a.originalIndex - b.originalIndex;
    }).map(entry => entry.item);
  }

  window.editItinerary = function(arg, fallbackTitle = '') {
    try {
      if (!tripData.itinerary || !Array.isArray(tripData.itinerary)) {
        window.openModal('modal-itinerary');
        return;
      }

      let id = null;
      let title = typeof fallbackTitle === 'string' ? fallbackTitle : '';

      if (arg && typeof arg === 'object' && arg.dataset) {
        id = arg.dataset.itId;
        if (!title && arg.dataset.itTitle) title = arg.dataset.itTitle;
      } else if (typeof arg === 'string' || typeof arg === 'number') {
        id = String(arg);
      }

      let item = null;
      if (id) {
        item = tripData.itinerary.find(i => String(i.id) === String(id));
      }
      if (!item && title) {
        item = tripData.itinerary.find(i => i.title === title);
      }

      if (item && itineraryEditorOpen && itineraryEditorHasChanges()) {
        if (!window.confirm('目前行程有尚未儲存的變更，確定切換編輯項目嗎？')) return;
      }

      if (item) {
        const titleEl = document.getElementById('modal-itinerary-title');
        window.uiSetIconText(titleEl, "calendar", "編輯行程景點");
        const contextEl = document.getElementById('itinerary-editor-context');
        if (contextEl) {
          contextEl.textContent = `Day ${item.day || currentDay} · ${item.title || '未命名行程'}`;
          contextEl.hidden = false;
        }

        const idEl = document.getElementById('it-id');
        if (idEl) idEl.value = item.id || '';

        const dayEl = document.getElementById('it-day');
        if (dayEl) dayEl.value = item.day || currentDay || 1;

        populate10MinTimeDropdowns();
        const range = parseTimeRangeToHHMM(item.time);
        const startEl = document.getElementById('it-time-start');
        const endEl = document.getElementById('it-time-end');
        if (startEl) startEl.value = range.start;
        if (endEl) endEl.value = range.end;

        const titleInput = document.getElementById('it-title');
        if (titleInput) titleInput.value = item.title || '';

        let cat = item.category || '景點';
        if (cat === 'spot') cat = '景點';
        else if (cat === 'food') cat = '正餐';
        else if (cat === 'cafe') cat = '點心';
        else if (cat === 'shopping') cat = '購物';
        else if (cat === 'transport') cat = '交通';
        else if (cat === 'hotel') cat = '住宿';

        const catEl = document.getElementById('it-category');
        if (catEl) catEl.value = cat;

        if (window.populateItineraryCostRows) {
          window.populateItineraryCostRows(item);
        }

        const locEl = document.getElementById('it-location');
        if (locEl) locEl.value = item.location || item.title || '';

        const mapsEl = document.getElementById('it-maps-url');
        if (mapsEl) mapsEl.value = item.mapsUrl || '';

        const noteEl = document.getElementById('it-note');
        if (noteEl) noteEl.value = item.note || '';
      }
      if (item) {
        itineraryEditorBaseline = itineraryFormSignature();
        routeItineraryEditor(true);
      }
    } catch (err) {
      console.error('Error populating edit itinerary editor:', err);
    }
  };

  window.deleteItinerary = function(id) {
    if (confirm('確定刪除此行程嗎？')) {
      tripData.itinerary = tripData.itinerary.filter(i => String(i.id) !== String(id));
      saveDataAndUpdate();
    }
  };

  // 5. Render Editable Packing Checklist
  function renderPackingTab() {
    const packing = tripData.packing || [];
    const container = document.getElementById('packing-checklist-container');
    if (!container) return;

    let totalItems = 0;
    let checkedItems = 0;

    packing.forEach(cat => {
      cat.items.forEach(item => {
        totalItems++;
        if (item.checked) checkedItems++;
      });
    });

    const percent = totalItems ? Math.round((checkedItems / totalItems) * 100) : 0;

    const progressFill = document.getElementById('packing-progress-fill');
    const progressText = document.getElementById('packing-progress-text');
    if (progressFill) progressFill.style.width = `${percent}%`;
    if (progressText) progressText.innerText = `${checkedItems} / ${totalItems} 已打包 (${percent}%)`;

    container.innerHTML = packing.map((cat, catIdx) => `
      <div class="packing-category" data-category="${cat.category}" data-cat-idx="${catIdx}">
        <div class="packing-header" data-cat-idx="${catIdx}">
          <div class="packing-category-heading" style="display:flex; align-items:center; gap:6px;">
            <span class="drag-handle-cat ui-drag-grip" style="cursor:grab; padding:0 4px;" title="長按拖拉調整分類順序">${window.uiIcon("grip", "muted")}</span>
            <span onclick="editPackingCategory('${cat.category}')" style="cursor:pointer;" title="點擊編輯分類">${cat.category}</span>
          </div>
          <div style="display:flex; gap:6px; align-items:center;">
            <span style="font-size:0.78rem; color:var(--kyoto-muted); font-weight:normal; margin-right:4px;">${cat.items.filter(i => i.checked).length}/${cat.items.length}</span>
            <button onclick="deletePackingCategory('${cat.category}')" style="background:none; border:none; color:#DC2626; cursor:pointer; font-size:0.85rem;" title="刪除分類">${window.uiIcon("trash", "danger")}</button>
          </div>
        </div>
        ${cat.items.map(item => `
          <div class="packing-item-row ${item.checked ? 'checked' : ''}" draggable="true" data-item-id="${item.id}" data-cat-name="${cat.category}">
            <div class="checkbox-custom" onclick="togglePackingItem('${item.id}')" title="點擊方框勾選/取消">${item.checked ? '✓' : ''}</div>
            <div class="packing-text" style="flex:1; min-width:0;">
              <input type="text" class="packing-inline-input" value="${item.text.replace(/"/g, '&quot;')}" onblur="updatePackingText('${item.id}', this.value)" onkeydown="if(event.key==='Enter') this.blur();" placeholder="輸入項目名稱..." title="點擊直接修改文字" />
            </div>
            <div style="display:flex; gap:6px; align-items:center;">
              <span class="drag-handle ui-drag-grip" style="cursor:grab; padding:0 4px;" title="長按拖拉移動分類">${window.uiIcon("grip", "muted")}</span>
              <button onclick="deletePackingItem('${item.id}')" style="background:none; border:none; color:#DC2626; cursor:pointer; font-size:0.85rem; padding:4px;" title="刪除">${window.uiIcon("trash", "danger")}</button>
            </div>
          </div>
        `).join('')}
        <button type="button" class="packing-add-item" draggable="false">${window.uiIcon("plus", "inherit")}<span>新增項目</span></button>
      </div>
    `).join('');

    initPackingDragAndDrop();
  }

  window.updatePackingText = function(id, newText) {
    if (!newText.trim()) return;
    let textChanged = false;
    tripData.packing.forEach(cat => {
      cat.items.forEach(item => {
        if (item.id === id && item.text !== newText.trim()) {
          item.text = newText.trim();
          textChanged = true;
        }
      });
    });
    if (textChanged) {
      window.StorageManager.saveData(tripData);
      if (window.FirebaseManager && window.FirebaseManager.isInitialized) {
        window.FirebaseManager.saveDataToCloud(tripData);
      }
    }
  };

  // Hover indexes refer to the array BEFORE removing the dragged source.
  function packingInsertionIndex(sourceIndex, hoveredItemIndex, after, sameArray) {
    const insertionIndex = hoveredItemIndex + (after ? 1 : 0);
    return insertionIndex - (sameArray && sourceIndex < insertionIndex ? 1 : 0);
  }

  function movePackingItemToCategory(itemId, targetCatName, hoveredItemId = null, after = true) {
    const sourceCat = tripData.packing.find(cat => cat.items.some(item => item.id === itemId));
    const targetCat = tripData.packing.find(cat => cat.category === targetCatName);
    if (!sourceCat || !targetCat) return;
    const sourceIndex = sourceCat.items.findIndex(item => item.id === itemId);
    const hoveredItemIndex = hoveredItemId === null ? targetCat.items.length : targetCat.items.findIndex(item => item.id === hoveredItemId);
    if (hoveredItemIndex < 0) return;
    const insertionIndex = packingInsertionIndex(sourceIndex, hoveredItemIndex, hoveredItemId !== null && after, sourceCat === targetCat);
    if (sourceCat === targetCat && insertionIndex === sourceIndex) return;
    const [sourceItem] = sourceCat.items.splice(sourceIndex, 1);
    targetCat.items.splice(insertionIndex, 0, sourceItem);
    saveDataAndUpdate();
  }

  function reorderPackingCategories(sourceIndex, hoveredCategoryIndex, after = false) {
    if (!tripData.packing[sourceIndex] || !tripData.packing[hoveredCategoryIndex]) return;
    const insertionIndex = packingInsertionIndex(sourceIndex, hoveredCategoryIndex, after, true);
    if (insertionIndex === sourceIndex) return;
    const [category] = tripData.packing.splice(sourceIndex, 1);
    tripData.packing.splice(insertionIndex, 0, category);
    saveDataAndUpdate();
  }

  function packingInsertionAt(x, y, source, categorySort) {
    const hit = document.elementFromPoint(x, y);
    if (hit && hit.closest('.packing-add-item, .packing-inline-add-row')) return null;
    const category = hit && hit.closest('.packing-category');
    if (!category) return null;
    let element = categorySort ? category : hit.closest('.packing-item-row');
    if (element === source) return null;
    if (!element && !categorySort) {
      // Category whitespace/empty lists: resolve the nearest actual item boundary.
      const rows = [...category.querySelectorAll('.packing-item-row')].filter(row => row !== source);
      for (const row of rows) {
        const rect = row.getBoundingClientRect();
        if (y < rect.top + rect.height / 2) return { element: row, category, after: false };
      }
      return { element: rows.at(-1) || category, category, after: true };
    }
    const rect = element.getBoundingClientRect();
    return { element, category, after: y >= rect.top + rect.height / 2 };
  }

  function bindDragSort(source, handle, targetSelector, draggingClass, targetClass, commit, resolveInsertion = null) {
    let state = null;
    let suppressClick = false;
    const blocked = 'button, input, select, textarea, a, .checkbox-custom';
    function targetAt(x, y) {
      if (resolveInsertion) return resolveInsertion(x, y);
      const hit = document.elementFromPoint(x, y);
      const target = hit && hit.closest(targetSelector);
      return target && target !== source ? target : null;
    }
    function paint() {
      state.frame = null;
      // Hit-test before visual writes; only change the old/new insertion target.
      const insertion = targetAt(state.x, state.y);
      const target = resolveInsertion ? insertion && insertion.element : insertion;
      const side = resolveInsertion && insertion ? (insertion.after ? 'after' : 'before') : null;
      if (target !== state.target || side !== state.side) {
        if (state.target) state.target.classList.remove(targetClass, 'packing-insert-before', 'packing-insert-after');
        if (target) {
          target.classList.add(targetClass);
          if (side) target.classList.add('packing-insert-' + side);
        }
        state.target = target;
        state.side = side;
      }
      state.ghost.style.transform = `translate3d(${state.x - state.offsetX}px, ${state.y - state.offsetY}px, 0)`;
    }
    function activate() {
      if (!state || !source.isConnected) return finish(false);
      const rect = source.getBoundingClientRect();
      state.offsetX = state.startX - rect.left;
      state.offsetY = state.startY - rect.top;
      const ghost = source.cloneNode(true);
      ghost.removeAttribute('id');
      ghost.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));
      ghost.classList.add('drag-sort-ghost');
      ghost.style.width = rect.width + 'px';
      ghost.style.transform = `translate3d(${rect.left}px, ${rect.top}px, 0)`;
      ghost.setAttribute('aria-hidden', 'true');
      document.body.appendChild(ghost);
      state.ghost = ghost;
      source.classList.add(draggingClass);
      state.active = true;
      suppressClick = true;
    }
    function finish(commitDrop, x, y) {
      if (!state) return;
      const current = state;
      const target = current.active && commitDrop ? targetAt(x ?? current.x, y ?? current.y) : null;
      clearTimeout(current.timer);
      if (current.frame !== null) cancelAnimationFrame(current.frame);
      if (current.target) current.target.classList.remove(targetClass, 'packing-insert-before', 'packing-insert-after');
      source.classList.remove(draggingClass);
      if (current.ghost) current.ghost.remove();
      state = null;
      document.removeEventListener('mousemove', mouseMove);
      document.removeEventListener('mouseup', mouseEnd);
      document.removeEventListener('touchmove', touchMove);
      document.removeEventListener('touchend', touchEnd);
      document.removeEventListener('touchcancel', cancel);
      window.removeEventListener('blur', cancel);
      document.removeEventListener('keydown', escape);
      // Shield the release click even if commit replaces the source DOM.
      const releaseClick = e => { e.preventDefault(); e.stopImmediatePropagation(); };
      if (current.active) document.addEventListener('click', releaseClick, { capture: true, once: true });
      // Cleanup before the existing commit can rebuild this DOM.
      if (target) commit(target);
      if (current.active) setTimeout(() => {
        suppressClick = false;
        document.removeEventListener('click', releaseClick, true);
      }, 400);
    }
    function move(e, x, y) {
      if (!state) return;
      state.x = x; state.y = y;
      if (!state.active) {
        if (Math.hypot(x - state.startX, y - state.startY) < 8) return;
        if (state.touch) return finish(false); // Ordinary touch scroll remains native.
        activate();
      }
      if (!state) return;
      if (e.cancelable) e.preventDefault();
      if (state.frame === null) state.frame = requestAnimationFrame(paint);
    }
    function mouseMove(e) { move(e, e.clientX, e.clientY); }
    function mouseEnd(e) { finish(true, e.clientX, e.clientY); }
    function touchMove(e) {
      if (e.touches.length !== 1) return cancel();
      move(e, e.touches[0].clientX, e.touches[0].clientY);
    }
    function touchEnd(e) {
      const touch = e.changedTouches[0];
      finish(true, touch.clientX, touch.clientY);
    }
    function cancel() { finish(false); }
    function escape(e) { if (e.key === 'Escape') cancel(); }
    function start(e, x, y, touch) {
      if (state || e.target.closest(blocked)) return;
      state = { x, y, startX: x, startY: y, touch, active: false, frame: null, target: null, ghost: null };
      if (touch) {
        state.timer = setTimeout(activate, 300);
        document.addEventListener('touchmove', touchMove, { passive: false });
        document.addEventListener('touchend', touchEnd);
        document.addEventListener('touchcancel', cancel);
      } else {
        document.addEventListener('mousemove', mouseMove);
        document.addEventListener('mouseup', mouseEnd);
      }
      window.addEventListener('blur', cancel);
      document.addEventListener('keydown', escape);
    }
    handle.addEventListener('mousedown', e => {
      if (e.button === 0) start(e, e.clientX, e.clientY, false);
    });
    handle.addEventListener('touchstart', e => {
      if (e.touches.length === 1) start(e, e.touches[0].clientX, e.touches[0].clientY, true);
    }, { passive: true });
    source.addEventListener('dragstart', e => e.preventDefault());
    source.addEventListener('click', e => {
      if (suppressClick) { e.preventDefault(); e.stopImmediatePropagation(); }
    }, true);
  }

  function initPackingDragAndDrop() {
    document.querySelectorAll('.packing-category').forEach(cat => {
      const header = cat.querySelector('.packing-header');
      if (header) bindDragSort(cat, header, '.packing-category', 'dragging-cat', 'packing-insertion-target', insertion => {
        reorderPackingCategories(Number(cat.dataset.catIdx), Number(insertion.category.dataset.catIdx), insertion.after);
      }, (x, y) => packingInsertionAt(x, y, cat, true));
    });
    document.querySelectorAll('.packing-item-row').forEach(row => {
      bindDragSort(row, row, '.packing-item-row', 'dragging', 'packing-insertion-target', insertion => {
        movePackingItemToCategory(row.dataset.itemId, insertion.category.dataset.category, insertion.element.dataset.itemId || null, insertion.after);
      }, (x, y) => packingInsertionAt(x, y, row, false));
    });
  }

  window.togglePackingItem = function(id) {
    tripData.packing.forEach(cat => {
      cat.items.forEach(item => {
        if (item.id === id) item.checked = !item.checked;
      });
    });
    saveDataAndUpdate();
  };

  window.editPackingItem = function(id) {
    let targetItem = null;
    let targetCatName = '';

    tripData.packing.forEach(cat => {
      cat.items.forEach(item => {
        if (item.id === id) {
          targetItem = item;
          targetCatName = cat.category;
        }
      });
    });

    if (!targetItem) return;

    window.uiSetIconText(document.getElementById("modal-packing-item-title"), "luggage", "編輯行李項目");
    document.getElementById('pk-item-category-select').disabled = false;
    document.getElementById('pk-item-category-group').hidden = false;
    document.getElementById('pk-item-context-category').hidden = true;
    document.getElementById('pk-item-submit').textContent = '儲存行李項目';
    document.getElementById('edit-packing-item-id').value = targetItem.id;
    document.getElementById('pk-item-name').value = targetItem.text || '';

    const select = document.getElementById('pk-item-category-select');
    if (select) {
      select.innerHTML = tripData.packing.map(cat => `
        <option value="${cat.category}" ${cat.category === targetCatName ? 'selected' : ''}>${cat.category}</option>
      `).join('');
    }

    openModal('modal-packing-item');
  };

  window.deletePackingItem = function(id) {
    tripData.packing.forEach(cat => {
      cat.items = cat.items.filter(i => i.id !== id);
    });
    saveDataAndUpdate();
  };

  window.editPackingCategory = function(catName) {
    window.uiSetIconText(document.getElementById("modal-packing-cat-title"), "folder", "編輯行李分類名稱");
    document.getElementById('edit-packing-cat-old-name').value = catName;
    document.getElementById('pk-cat-name').value = catName;
    openModal('modal-packing-cat');
  };

  window.deletePackingCategory = function(catName) {
    if (confirm(`確定刪除整分類「${catName}」及其下方所有項目嗎？`)) {
      tripData.packing = tripData.packing.filter(c => c.category !== catName);
      saveDataAndUpdate();
    }
  };

  // 6. Render Shopping Wishlist (With Long-Press Reordering & Clean Frameless Touch UI)
  function renderShoppingTab() {
    const shoppingLocs = tripData.shopping || [];
    
    // Render Category & Day Filter Chips Bar
    const categoryChipsEl = document.getElementById('shopping-location-chips');
    if (categoryChipsEl) {
      const categories = [{ id: 'all', label: '全部' }].concat(
        ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Day 7', 'Day 8', 'Day 9', 'Day 10'].map(d => ({ id: 'day-' + d.replace('Day ', ''), label: d })),
        ['購物', '送禮', '飲食', '其他'].map(c => ({ id: c, label: c }))
      );

      categoryChipsEl.innerHTML = categories.map(c => `
        <button class="chip-btn ${currentShoppingLocationCategory === c.id ? 'active' : ''}" onclick="filterShoppingCategory('${c.id}')">${c.label}</button>
      `).join('');
    }

    const filteredLocs = shoppingLocs.filter(loc => {
      if (currentShoppingLocationCategory === 'all') return true;
      if (currentShoppingLocationCategory.startsWith('day-')) {
        const dayNum = currentShoppingLocationCategory.replace('day-', '');
        return String(loc.day) === String(dayNum);
      }
      return loc.category === currentShoppingLocationCategory;
    });

    const container = document.getElementById('shopping-grid-container');
    if (!container) return;

    if (filteredLocs.length === 0) {
      container.innerHTML = `<div style="text-align:center; padding:30px; color:var(--kyoto-muted);">目前此分類/天數無購物地點，點擊右下角「+」新增地點與商品！</div>`;
      return;
    }

    container.innerHTML = filteredLocs.map((loc, locIdx) => {
      const firstItem = loc.items && loc.items.length > 0 ? loc.items[0] : null;
      const coverImage = firstItem ? firstItem.image : "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=300&auto=format&fit=crop&q=80";
      const totalItemsCount = loc.items ? loc.items.length : 0;
      const boughtItemsCount = loc.items ? loc.items.filter(i => Boolean(i.bought)).length : 0;
      const unboughtItemsCount = totalItemsCount - boughtItemsCount;

      let statusBadgeText = `${window.uiIcon("cart", "muted")} ${totalItemsCount} 項商品`;
      if (totalItemsCount > 0) {
        if (boughtItemsCount === totalItemsCount) {
          statusBadgeText = `${window.uiIcon("cart", "muted")} ${totalItemsCount} 項商品 (全數已買)`;
        } else {
          statusBadgeText = `${window.uiIcon("cart", "muted")} ${totalItemsCount} 項 (已買 ${boughtItemsCount} / 未買 ${unboughtItemsCount})`;
        }
      }

      let itineraryBadge = '';
      if (loc.itineraryId) {
        const boundItinerary = (tripData.itinerary || []).find(i => i.id === loc.itineraryId);
        if (boundItinerary) {
          itineraryBadge = `<span class="badge badge-spot badge-sage" style="font-size:0.68rem; padding:2px 8px;">${window.uiIcon("link", "muted")} [Day ${boundItinerary.day}] ${boundItinerary.title}</span>`;
        }
      }
      const itemNamesPreview = loc.items ? loc.items.map(i => `<span class="shopping-summary-item"><span class="shopping-summary-bullet" aria-hidden="true">•</span>${Boolean(i.bought) ? `<s class="shopping-summary-name" style="opacity:0.5;">${i.name}</s>` : `<span class="shopping-summary-name">${i.name}</span>`}</span>`).join('') : '';

      return `
        <div class="shopping-card" data-loc-id="${loc.id}" data-loc-idx="${locIdx}" draggable="true" style="cursor:pointer;">
          <img src="${coverImage}" class="shopping-img" alt="${loc.location}" title="封面" />
          <div class="shopping-details">
            <div>
              <div class="flex-between shopping-location-header">
                <div class="shopping-name-row" style="display:flex; align-items:center; gap:4px;">
                  <span class="drag-handle-shop ui-drag-grip" style="cursor:grab;" title="長按拖拉移動順序">${window.uiIcon("grip", "muted")}</span>
                  <div class="shopping-title" style="font-size:1.05rem;">${window.uiIcon("mapPin", "travel")} ${loc.location}</div>
                </div>
                <span class="badge badge-shop shopping-category-badge" style="font-size:0.68rem;">${loc.category}</span>
              </div>
              <div style="display:flex; gap:6px; margin:4px 0; flex-wrap:wrap;">
                <span class="badge badge-spot" style="font-size:0.7rem; padding:2px 8px;">${statusBadgeText}</span>
                ${itineraryBadge}
              </div>
              <div class="shopping-items-summary">
                ${itemNamesPreview || '尚無項目'}
              </div>
            </div>
            <div class="flex-between" style="margin-top:8px;">
              <button type="button" onclick="event.stopPropagation(); event.preventDefault(); window.editShoppingLocation('${loc.id}');" class="btn-secondary btn-edit-shop-loc" data-loc-id="${loc.id}" style="padding:4px 12px; font-size:0.75rem; border-radius:6px; position:relative; z-index:100; cursor:pointer;" title="編輯地點資訊">編輯地點</button>
              <div style="display:flex; gap:6px; align-items:center;">
                <button type="button" onclick="event.stopPropagation(); event.preventDefault(); window.deleteShoppingLocation('${loc.id}');" class="btn-delete-shop-loc" data-loc-id="${loc.id}" style="background:none; border:none; color:#DC2626; cursor:pointer; font-size:0.85rem; position:relative; z-index:100;" title="刪除地點">${window.uiIcon("trash", "danger")}</button>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');

    initShoppingDragAndDrop();
  }

  function reorderShoppingLocations(fromIdx, toIdx) {
    if (fromIdx === toIdx || fromIdx < 0 || toIdx < 0) return;
    const moved = tripData.shopping.splice(fromIdx, 1)[0];
    if (moved) {
      tripData.shopping.splice(toIdx, 0, moved);
      saveDataAndUpdate();
    }
  }

  function reorderShoppingSubitems(locId, fromIdx, toIdx) {
    const loc = tripData.shopping.find(s => s.id === locId);
    if (!loc || !loc.items || !Number.isInteger(fromIdx) || !Number.isInteger(toIdx) || fromIdx === toIdx || fromIdx < 0 || toIdx < 0 || fromIdx >= loc.items.length || toIdx >= loc.items.length) return;
    const moved = loc.items.splice(fromIdx, 1)[0];
    loc.items.splice(toIdx, 0, moved);
    saveDataAndUpdate();
    // The detail modal uses window.currentLocationDetailId; refresh its indices after reorder.
    renderLocationDetailModal(locId);
  }

  window.moveShoppingSubitem = function(locId, itemId, direction) {
    const loc = tripData.shopping.find(s => s.id === locId);
    if (!loc || !loc.items || (direction !== -1 && direction !== 1)) return;
    const fromIdx = loc.items.findIndex(item => item.id === itemId);
    if (fromIdx < 0) return;
    reorderShoppingSubitems(locId, fromIdx, fromIdx + direction);
  };

  function initShoppingDragAndDrop() {
    const cards = document.querySelectorAll('.shopping-card[data-loc-idx]');

    cards.forEach(card => {
      // Direct Click Handler for Card Body
      card.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON' || e.target.closest('button')) return;
        const locId = card.dataset.locId;
        if (locId) openLocationDetailModal(locId);
      });

      // Direct Click Handler for Edit Location Button
      const editBtn = card.querySelector('.btn-edit-shop-loc');
      if (editBtn) {
        editBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          e.preventDefault();
          const locId = editBtn.dataset.locId || card.dataset.locId;
          if (locId) editShoppingLocation(locId);
        });
      }

      // Direct Click Handler for Delete Location Button
      const delBtn = card.querySelector('.btn-delete-shop-loc');
      if (delBtn) {
        delBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          e.preventDefault();
          const locId = delBtn.dataset.locId || card.dataset.locId;
          if (locId) deleteShoppingLocation(locId);
        });
      }

      bindDragSort(card, card, '.shopping-card[data-loc-idx]', 'dragging-shop', 'shop-drop-target', target => {
        reorderShoppingLocations(Number(card.dataset.locIdx), Number(target.dataset.locIdx));
      });
    });
  }

  function initSubitemDragAndDrop(locId) {
    document.querySelectorAll('#detail-items-container .subitem-card').forEach(card => {
      const grip = card.querySelector('.drag-handle-subitem');
      if (!grip) return;
      grip.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); });
      bindDragSort(card, grip, '#detail-items-container .subitem-card', 'dragging-shop', 'shop-drop-target', target => {
        reorderShoppingSubitems(locId, Number(card.dataset.itemIdx), Number(target.dataset.itemIdx));
      });
    });
  }

  window.filterShoppingCategory = function(catId) {
    currentShoppingLocationCategory = catId;
    renderShoppingTab();
  };

  window.editShoppingLocation = function(locId) {
    const loc = tripData.shopping.find(s => s.id === locId);
    if (!loc) return;

    closeModal('modal-shopping-detail');

    window.uiSetIconText(document.getElementById("modal-shopping-title"), "shoppingBag", "編輯購物地點資訊");
    document.getElementById('edit-shop-loc-id').value = loc.id;
    document.getElementById('shop-location').value = loc.location || '';
    document.getElementById('shop-category').value = loc.category || '購物';
    
    if (window.populateItinerarySelectForShopping) {
      window.populateItinerarySelectForShopping(loc.itineraryId || '');
    }

    document.getElementById('shop-note').value = loc.note || '';

    const firstItemFields = document.getElementById('first-item-fields');
    if (firstItemFields) firstItemFields.style.display = 'none';

    openModal('modal-shopping');
  };

  window.editCurrentLocationDetail = function() {
    const locId = window.currentLocationDetailId;
    if (locId) {
      window.closeModal('modal-shopping-detail');
      window.editShoppingLocation(locId);
    }
  };

  window.openLocationDetailModal = function(locId) {
    currentLocationDetailId = locId;
    window.currentLocationDetailId = locId;
    renderLocationDetailModal(locId);
    window.openModal('modal-shopping-detail');
  };

  function renderLocationDetailModal(locId) {
    const loc = tripData.shopping.find(s => s.id === locId);
    if (!loc) return;

    currentLocationDetailId = loc.id;
    window.currentLocationDetailId = loc.id;
    window.uiSetIconText(document.getElementById("detail-location-name"), "mapPin", loc.location, "travel");
    window.uiSetIconText(document.getElementById("detail-location-note"), loc.note ? "lightbulb" : null, loc.note || "點擊空白處可編輯，長按可拖拉排序");

    const editHeaderBtn = document.getElementById('detail-header-edit-btn');
    if (editHeaderBtn) {
      editHeaderBtn.onclick = function(e) {
        if (e) { e.stopPropagation(); e.preventDefault(); }
        window.closeModal('modal-shopping-detail');
        window.editShoppingLocation(loc.id);
      };
    }

    const container = document.getElementById('detail-items-container');
    if (!container) return;

    if (!loc.items || loc.items.length === 0) {
      container.innerHTML = `<div style="text-align:center; padding:20px; color:var(--kyoto-muted);">此地點尚無商品項目，點擊下方「+ 新增商品至此地點」！</div>`;
      return;
    }

    container.innerHTML = loc.items.map((item, itemIdx) => {
      const isBought = Boolean(item.bought);

      const titleHtml = isBought
        ? `<s style="opacity:0.55;">${item.name}</s>`
        : `<span style="font-weight:600;">${item.name}</span>`;

      return `
        <div class="shopping-card subitem-card" data-subitem-id="${item.id}" data-item-idx="${itemIdx}" data-loc-id="${loc.id}" draggable="true" style="margin-bottom:12px; display:flex; align-items:center; gap:10px; padding:10px 12px; cursor:pointer; ${isBought ? 'background:var(--ui-selected);' : ''}">
          <!-- Square Checkbox on FAR LEFT -->
          <div class="checkbox-custom ${isBought ? 'checked' : ''}" onclick="event.stopPropagation(); toggleSubitemBought('${loc.id}', '${item.id}')" title="點擊勾選/取消已買" style="cursor:pointer; flex-shrink:0;">${isBought ? '✓' : ''}</div>

          <!-- Product Image -->
          <img src="${item.image}" class="shopping-img" style="width:52px; height:52px; border-radius:10px; object-fit:cover; flex-shrink:0;" alt="${item.name}" onclick="event.stopPropagation(); openLightbox('${item.image}', '${item.name} | ${loc.location}')" title="點擊放大圖片" />

          <!-- Details (Clicking anywhere on blank/text opens edit directly without pencil icon) -->
          <div class="shopping-details" style="flex:1;" onclick="editSubitem('${loc.id}', '${item.id}')" title="點擊編輯商品說明">
            <div class="flex-between shopping-product-heading" style="margin-bottom:2px;">
              <div class="shopping-title">${titleHtml}</div>
              <span class="badge shopping-purchase-status ${isBought ? 'badge-spot' : 'badge-hotel'}" style="${isBought ? 'background:var(--ui-accent-light); color:var(--ui-accent-text);' : 'background:var(--ui-surface); color:var(--ui-muted);'} font-size:0.68rem; padding:2px 6px;">${isBought ? window.uiIcon("check", "active") + " 已買" : window.uiIcon("clock") + " 未買"}</span>
            </div>
            ${item.note ? `<div style="font-size:0.72rem; color:var(--kyoto-muted);">${window.uiIcon("lightbulb", "muted")} ${item.note}</div>` : ''}
            <div class="flex-between" style="margin-top:4px;">
              <div class="shopping-price" style="font-size:0.88rem; font-weight:600; color:var(--ui-accent-text);">¥ ${item.priceJPY.toLocaleString()}</div>
              <div style="display:flex; gap:6px; align-items:center;">
                <span class="drag-handle-subitem ui-drag-grip" style="cursor:grab;" title="長按拖拉移動商品順序">${window.uiIcon("grip", "muted")}</span>
                <button onclick="event.stopPropagation(); deleteSubitem('${loc.id}', '${item.id}')" style="background:none; border:none; color:#DC2626; cursor:pointer; font-size:0.85rem; padding:2px 4px;" title="刪除商品">${window.uiIcon("trash", "danger")}</button>
              </div>
            </div>
            <div class="subitem-reorder-controls" aria-label="商品排序">
              <button type="button" class="btn-secondary" onclick="event.stopPropagation(); moveShoppingSubitem('${loc.id}', '${item.id}', -1)" ${itemIdx === 0 ? 'disabled' : ''} aria-label="上移商品">上移</button>
              <button type="button" class="btn-secondary" onclick="event.stopPropagation(); moveShoppingSubitem('${loc.id}', '${item.id}', 1)" ${itemIdx === loc.items.length - 1 ? 'disabled' : ''} aria-label="下移商品">下移</button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    initSubitemDragAndDrop(locId);
  }

  window.toggleSubitemBought = function(locId, itemId) {
    const loc = tripData.shopping.find(s => s.id === locId);
    if (loc && loc.items) {
      const item = loc.items.find(i => i.id === itemId);
      if (item) {
        item.bought = !Boolean(item.bought);
        saveDataAndUpdate();
      }
    }
  };

  window.editSubitem = function(locId, itemId) {
    const loc = tripData.shopping.find(s => s.id === locId);
    if (!loc || !loc.items) return;

    const item = loc.items.find(i => i.id === itemId);
    if (!item) return;

    document.getElementById('edit-subitem-loc-id').value = locId;
    document.getElementById('edit-subitem-id').value = itemId;
    document.getElementById('edit-subitem-name').value = item.name || '';
    document.getElementById('edit-subitem-price').value = item.priceJPY || '';
    document.getElementById('edit-subitem-note').value = item.note || '';

    const preview = document.getElementById('edit-subitem-img-preview');
    if (preview) {
      preview.src = item.image;
      preview.style.display = 'block';
    }

    openModal('modal-edit-subitem');
  };

  window.deleteSubitem = function(locId, itemId) {
    const loc = tripData.shopping.find(s => s.id === locId);
    if (loc && loc.items) {
      loc.items = loc.items.filter(i => i.id !== itemId);
      saveDataAndUpdate();
    }
  };

  window.deleteShoppingLocation = function(locId) {
    if (confirm('確定刪除此購物地點及其下方所有商品與圖片嗎？')) {
      tripData.shopping = tripData.shopping.filter(s => s.id !== locId);
      saveDataAndUpdate();
    }
  };

  // Helper Modal Open / Close
  window.openModal = function(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.add('active');
  };

  window.closeModal = function(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.remove('active');
  };

  function openModal(id) { window.openModal(id); }
  function closeModal(id) { window.closeModal(id); }
});


