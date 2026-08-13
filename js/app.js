window.openModal = function(id) {
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
  let currentItineraryCategory = 'all';
  let currentShoppingLocationCategory = 'all';
  let currentLocationDetailId = null;
  let isCardLimitsExpanded = false;
  let currentCardFilter = 'all';

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
        <option value="${c.id}">${c.label}</option>
      `).join('');
    }

    if (itCategorySelect) {
      itCategorySelect.innerHTML = window.ITINERARY_CATEGORIES.map(c => `
        <option value="${c.id}">${c.label}</option>
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
            statusMsg.innerText = '🟢 已成功連線至 Firebase Realtime DB / Firestore 雲端資料庫 (雙向即時同步中)';
          } else {
            statusMsg.style.color = 'var(--amber-gold)';
            statusMsg.innerText = '🟡 目前為離線本機模式。填寫 Project ID 即可啟用雙機即時同步！';
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
        document.getElementById('modal-hotel-title').innerText = '🏨 新增住宿';
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
      if (titleEl) titleEl.innerText = '💰 新增記帳項目';
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
      addExpenseBtn.addEventListener('click', window.openAddExpenseModal);
    }


    // 8. Add / Edit Itinerary Modal Handler
    const addItineraryBtn = document.getElementById('add-itinerary-modal-btn');
    if (addItineraryBtn) {
      addItineraryBtn.addEventListener('click', () => {
        const titleEl = document.getElementById('modal-itinerary-title');
        if (titleEl) titleEl.innerText = '🗓️ 新增行程景點';
        document.getElementById('it-id').value = '';
        document.getElementById('form-add-itinerary').reset();
        document.getElementById('it-day').value = currentDay;
        document.getElementById('it-time-start').value = '09:00';
        document.getElementById('it-time-end').value = '11:30';
        openModal('modal-itinerary');
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
        const timeRangeStr = `${startTime} ~ ${endTime}`;

        const itemObj = {
          id: itId ? itId : 'it-' + Date.now(),
          day: dayVal,
          date: `Day ${dayVal}`,
          time: timeRangeStr,
          title: document.getElementById('it-title').value,
          category: document.getElementById('it-category').value,
          location: loc,
          costJPY: parseInt(document.getElementById('it-cost').value, 10) || 0,
          note: document.getElementById('it-note').value,
          mapsUrl: pastedUrl && pastedUrl.trim() ? pastedUrl.trim() : `https://maps.google.com/?q=${encodeURIComponent(loc)}`
        };

        if (itId) {
          const idx = tripData.itinerary.findIndex(item => item.id === itId);
          if (idx !== -1) tripData.itinerary[idx] = itemObj;
        } else {
          tripData.itinerary.push(itemObj);
        }

        closeModal('modal-itinerary');
        itineraryForm.reset();
        saveDataAndUpdate();
      });
    }

    // 9. Packing Checklist Add / Edit Item & Category Modals
    const addPackingItemBtn = document.getElementById('add-packing-item-btn');
    if (addPackingItemBtn) {
      addPackingItemBtn.addEventListener('click', () => {
        document.getElementById('modal-packing-item-title').innerText = '🎒 新增行李項目';
        document.getElementById('edit-packing-item-id').value = '';
        document.getElementById('form-add-packing-item').reset();

        const select = document.getElementById('pk-item-category-select');
        if (select) {
          select.innerHTML = tripData.packing.map(cat => `
            <option value="${cat.category}">${cat.category}</option>
          `).join('');
        }
        openModal('modal-packing-item');
      });
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
        document.getElementById('modal-packing-cat-title').innerText = '📁 新增行李分類';
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
      html += `<option value="${it.id}" ${isSelected}>[Day ${it.day}] ${it.title} (📍 ${it.location})</option>`;
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
    document.getElementById('modal-shopping-title').innerText = '🛍️ 新增購物地點與商品';
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
        const modal = btn.closest('.modal-overlay');
        if (modal) modal.classList.remove('active');
      });
    });
  }

  function switchTab(tabName) {
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
      <button onclick="window.openGoogleSheetExpenseModal()" class="btn-primary" style="width:100%; padding:11px 14px; font-size:0.88rem; display:flex; align-items:center; justify-content:center; gap:6px; border-radius:12px; background:#10B981; font-weight:800; box-shadow:0 4px 12px rgba(16, 185, 129, 0.25);">
        📋 貼上 CSV 同步記帳
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
    if (btn) { btn.disabled = true; btn.innerHTML = '⏳ 正在讀取與解析記帳中...'; }


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
      if (btn) { btn.disabled = false; btn.innerHTML = '⚡ 一鍵匯入記帳資料'; }
    }
  };

  function renderGoogleSheetItineraryControlBar() {
    const container = document.getElementById('google-sheet-itinerary-control-container');
    if (!container) return;
    container.innerHTML = `
      <button onclick="window.openGoogleSheetItineraryModal()" class="btn-primary" style="width:100%; padding:11px 14px; font-size:0.88rem; display:flex; align-items:center; justify-content:center; gap:6px; border-radius:12px; background:#10B981; font-weight:800; box-shadow:0 4px 12px rgba(16,185,129,0.25);">
        📋 貼上 CSV 同步行程
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

    document.getElementById('card-form-title').innerText = existing ? '✏️ 編輯信用卡' : '➕ 新增信用卡';
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
      const ownerBadge = card.owner === '❤️' ? '<span class="badge badge-spot" style="font-size:0.7rem;">❤️ 我</span>' :
                         card.owner === '🐷' ? '<span class="badge badge-meal" style="font-size:0.7rem;">🐷 老公</span>' :
                         '<span class="badge badge-transport" style="font-size:0.7rem;">通用</span>';
      const limitText = card.limit > 0 ? `NT$ ${card.limit.toLocaleString()}` : '<span style="color:var(--kyoto-muted);">無上限</span>';

      return `
        <div style="display:flex; align-items:center; justify-content:space-between; background:#FFF; padding:10px 12px; border-radius:10px; border:1px solid rgba(0,0,0,0.06); gap:10px;">
          <div style="display:flex; align-items:center; gap:8px;">
            ${ownerBadge}
            <span style="font-weight:700; font-size:0.88rem; color:var(--kyoto-dark);">${card.name}</span>
          </div>
          <div style="display:flex; align-items:center; gap:10px;">
            <div style="font-size:0.8rem; font-weight:700; color:var(--maple-crimson); text-align:right;">
              <span style="font-size:0.68rem; color:var(--kyoto-muted); font-weight:normal;">上限:</span> ${limitText}
            </div>
            <button type="button" onclick="window.toggleAddCardForm(true, '${card.id}')" style="background:none; border:none; color:var(--kyoto-muted); cursor:pointer; font-size:0.85rem;" title="編輯">✏️</button>
            <button type="button" onclick="window.deleteCardItem('${card.id}')" style="background:none; border:none; color:#DC2626; cursor:pointer; font-size:0.85rem;" title="刪除">🗑️</button>
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
    if (btn) { btn.disabled = true; btn.innerHTML = '⏳ 正在讀取與解析行程中...'; }

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
        let day = 1, timeStr = '', title = '', category = '景點', location = '', costJPY = 0, note = '', mapsUrl = '';

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
            costJPY = parseFloat(v.replace(/[^0-9.]/g, '')) || 0;
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
      if (btn) { btn.disabled = false; btn.innerHTML = '⚡ 一鍵匯入全 10 天行程'; }
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
            <div class="card-title">✈️ 去程航班 (${out.date})</div>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center; margin: 12px 0;">
            <div>
              <div style="font-size:1.3rem; font-weight:800; color:var(--maple-crimson);">${out.depTime}</div>
              <div style="font-size:0.85rem; font-weight:700;">${out.depAirport}</div>
            </div>
            <div style="text-align:center; color:var(--amber-gold);">
              <div style="font-size:0.75rem; font-weight:700;">${out.airline}</div>
              <div style="font-size:1.1rem;">✈️ ➔</div>
              <div style="font-size:0.78rem; font-weight:800;">${outFlightCode}</div>
            </div>
            <div style="text-align:right;">
              <div style="font-size:1.3rem; font-weight:800; color:var(--maple-crimson);">${out.arrTime}</div>
              <div style="font-size:0.85rem; font-weight:700;">${out.arrAirport}</div>
            </div>
          </div>
        </div>
      `;
    }

    if (inboundContainer) {
      inboundContainer.innerHTML = `
        <div class="kyoto-card" onclick="editFlight('inbound')" style="cursor:pointer;" title="點擊編輯回程航班">
          <div class="card-title-row">
            <div class="card-title">🛬 回程航班 (${inb.date})</div>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center; margin: 12px 0;">
            <div>
              <div style="font-size:1.3rem; font-weight:800; color:var(--kyoto-dark);">${inb.depTime}</div>
              <div style="font-size:0.85rem; font-weight:700;">${inb.depAirport}</div>
            </div>
            <div style="text-align:center; color:var(--amber-gold);">
              <div style="font-size:0.75rem; font-weight:700;">${inb.airline}</div>
              <div style="font-size:1.1rem;">✈️ ➔</div>
              <div style="font-size:0.78rem; font-weight:800;">${inbFlightCode}</div>
            </div>
            <div style="text-align:right;">
              <div style="font-size:1.3rem; font-weight:800; color:var(--kyoto-dark);">${inb.arrTime}</div>
              <div style="font-size:0.85rem; font-weight:700;">${inb.arrAirport}</div>
            </div>
          </div>
        </div>
      `;
    }
  }

  window.editFlight = function(type) {
    const fObj = type === 'outbound' ? tripData.flightInfo.outbound : tripData.flightInfo.inbound;
    if (!fObj) return;

    document.getElementById('modal-flight-title').innerText = type === 'outbound' ? '✈️ 編輯去程航班資訊' : '🛬 編輯回程航班資訊';
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
            <div style="font-size:1.05rem; font-weight:800; color:var(--kyoto-dark);">${h.name}</div>
            <div style="display:flex; gap:8px; align-items:center;">
              <a href="${mapsLink}" target="_blank" onclick="event.stopPropagation();" class="btn-icon-sm" style="text-decoration:none; font-size:1.05rem;" title="開啟 Google 地圖導航">🗺️</a>
              <button onclick="event.stopPropagation(); deleteHotel('${h.id}')" style="background:none; border:none; color:#DC2626; cursor:pointer; font-size:0.85rem;" title="刪除住宿">🗑️</button>
            </div>
          </div>
          ${h.notes ? `<div style="font-size:0.78rem; color:var(--amber-gold); margin-bottom:10px; background:var(--washi-bg); padding:6px 10px; border-radius:8px;">💡 ${h.notes}</div>` : ''}
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

    document.getElementById('modal-hotel-title').innerText = '🏨 編輯住宿資訊';
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
        const barColor = pct >= 100 ? '#DC2626' : pct >= 80 ? '#F59E0B' : '#10B981';
        const ownerBadge = card.owner === '❤️' ? '❤️ ' : card.owner === '🐷' ? '🐷 ' : '';

        return `
          <div style="background:#F8FAF8; border-radius:8px; padding:8px 10px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
              <span style="font-size:0.8rem; font-weight:700; color:var(--kyoto-dark);">💳 ${ownerBadge}${card.name}</span>
              <span style="font-size:0.78rem; color:var(--kyoto-muted);">
                已刷 <b style="color:var(--maple-crimson);">NT$ ${used.toLocaleString()}</b>
                ${limit > 0 ? ` / 上限 NT$ ${limit.toLocaleString()}` : ' (無上限)'}
              </span>
            </div>
            ${limit > 0 ? `
              <div style="background:#E5E7EB; border-radius:4px; height:6px; overflow:hidden;">
                <div style="width:${pct}%; height:100%; background:${barColor}; transition:width 0.4s;"></div>
              </div>
              <div style="font-size:0.72rem; color:${remaining===0?'#DC2626':'#059669'}; margin-top:3px; text-align:right;">
                ${remaining === 0 ? '⚠️ 已達回饋上限' : `剩餘回饋額度 NT$ ${remaining.toLocaleString()}`}
              </div>` : ''}
          </div>`;
      }).filter(Boolean);

      if (cardRows.length === 0) {
        cardLimitsContainer.innerHTML = '<div style="font-size:0.75rem;color:var(--kyoto-muted);">點擊右上方「⚙️ 管理卡片與額度」來設定信用卡！</div>';
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
            <div style="font-weight:700; font-size:0.92rem; color:var(--kyoto-dark); flex:1; min-width:0; word-break:break-word; line-height:1.35;">${exp.title}</div>
            <div style="font-weight:800; font-size:1.05rem; color:var(--maple-crimson); white-space:nowrap; flex-shrink:0; text-align:right;">${displayAmount}</div>
          </div>
          <div class="flex-between" style="gap:8px; align-items:center; margin-bottom:6px;">
            <div style="display:flex; gap:6px; align-items:center; flex-wrap:wrap;">
              <span class="badge badge-spot" style="font-size:0.7rem;">${exp.category}</span>
              <span class="badge badge-transport" style="font-size:0.7rem;">${exp.card}</span>
              <span class="badge badge-meal" style="font-size:0.78rem;">${payerEmoji}</span>
            </div>
            <div style="font-size:0.72rem; color:var(--kyoto-muted); white-space:nowrap; flex-shrink:0;">${equivTWD}</div>
          </div>
          ${exp.note ? `
            <div style="font-size:0.75rem; color:var(--kyoto-muted); margin-bottom:6px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; background:rgba(0,0,0,0.03); padding:4px 8px; border-radius:6px; border-left:3px solid var(--amber-gold);" title="${exp.note.replace(/"/g, '&quot;')}">
              📝 ${exp.note}
            </div>
          ` : ''}
          <div class="flex-between" style="font-size:0.72rem; color:var(--kyoto-muted);">
            <div>${exp.date}</div>
            <div style="display:flex; gap:6px; align-items:center;">
              <button onclick="event.stopPropagation(); deleteExpense('${exp.id}')" style="background:none; border:none; color:#DC2626; cursor:pointer; font-size:0.85rem;" title="刪除記帳">🗑️</button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  window.editExpense = function(id) {
    const exp = tripData.expenses.find(e => e.id === id);
    if (!exp) return;

    document.getElementById('modal-expense-title').innerText = '💰 編輯記帳項目';
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
        <div style="font-size:0.85rem; font-weight:800; color:var(--maple-crimson); margin-bottom:8px;">✨ 辨識成功！您可以即時調整下方欄位：</div>
        
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
              <option value="❤️" ${parsed.payer === '❤️' ? 'selected' : ''}>❤️ 我</option>
              <option value="🐷" ${parsed.payer === '🐷' ? 'selected' : ''}>🐷 老公</option>
            </select>
          </div>
        </div>

        <div class="form-group" style="margin-bottom:10px;">
          <label class="parsed-label">支付卡別</label>
          <select id="edit-nlp-card" class="form-control" style="padding:6px; font-size:0.82rem;">
            ${cardOptions}
          </select>
        </div>

        <div style="display:flex; gap:8px;">
          <button id="confirm-nlp-btn" class="btn-primary" style="padding:8px; font-size:0.82rem;">✅ 一鍵寫入記帳</button>
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

      tripData.expenses.unshift({
        id: 'exp-' + Date.now(),
        date: new Date().toISOString().slice(0, 16).replace('T', ' '),
        title: finalTitle,
        category: finalCategory,
        amount: finalAmount,
        currency: finalCurrency,
        card: finalCard,
        payer: finalPayer,
        note: '自然語言記入'
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
  function renderItineraryTab() {
    renderGoogleSheetItineraryControlBar();

    // Automatic repair for any existing corrupted localStorage itinerary data
    if (tripData.itinerary && Array.isArray(tripData.itinerary)) {
      tripData.itinerary.forEach(item => {
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

    const itinerary = tripData.itinerary || [];
    
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
        <button class="chip-btn ${currentItineraryCategory === c.id ? 'active' : ''}" onclick="filterItineraryCategory('${c.id}')">${c.label}</button>
      `).join('');
    }

    const filtered = itinerary.filter(item => {
      const matchesDay = item.day === currentDay;
      const matchesCat = currentItineraryCategory === 'all' || item.category === currentItineraryCategory;
      return matchesDay && matchesCat;
    });

    const timelineContainer = document.getElementById('itinerary-timeline-container');
    if (!timelineContainer) return;

    const currentDayObj = DAYS_LIST.find(d => d.day === currentDay);
    const dayTitleHeader = `
      <div style="font-weight:800; font-size:1rem; color:var(--maple-crimson); margin:4px 0 10px 0; display:flex; justify-content:space-between; align-items:center;">
        <span>📅 Day ${currentDay} (${currentDayObj ? currentDayObj.date : ''}) 行程明細</span>
        <span style="font-size:0.75rem; color:var(--kyoto-muted); font-weight:normal;">10 天行程</span>
      </div>
    `;

    if (filtered.length === 0) {
      timelineContainer.innerHTML = dayTitleHeader + `<div style="text-align:center; padding:30px; color:var(--kyoto-muted);">此天尚無符合說明的行程安排，點擊右下角「+」新增！</div>`;
      return;
    }

    timelineContainer.innerHTML = dayTitleHeader + filtered.map(item => {
      const displayTime = (item.time && item.time !== 'undefined') ? item.time : '';
      const displayLocation = (item.location && item.location !== 'undefined') ? item.location : '';
      const displayCategory = (item.category && item.category !== 'undefined') ? item.category : '景點';
      const mapsLink = item.mapsUrl || `https://maps.google.com/?q=${encodeURIComponent(displayLocation || item.title)}`;

      let badgeClass = 'badge-spot';
      let badgeIcon = '🍁';
      if (displayCategory === '正餐' || displayCategory === 'food') { badgeClass = 'badge-meal'; badgeIcon = '🍱'; }
      else if (displayCategory === '點心' || displayCategory === 'cafe') { badgeClass = 'badge-cafe'; badgeIcon = '🍡'; }
      else if (displayCategory === '景點' || displayCategory === 'spot') { badgeClass = 'badge-spot'; badgeIcon = '🍁'; }
      else if (displayCategory === '購物' || displayCategory === 'shopping') { badgeClass = 'badge-shop'; badgeIcon = '🛍️'; }
      else if (displayCategory === '交通' || displayCategory === 'transport') { badgeClass = 'badge-transport'; badgeIcon = '🚃'; }

      // Match with Shopping Wishlist locations by name, location, or day!
      const matchingLocs = (tripData.shopping || []).filter(loc => {
        if (!loc || !loc.location) return false;
        const locMatch = displayLocation && (displayLocation.toLowerCase().includes(loc.location.toLowerCase()) || loc.location.toLowerCase().includes(displayLocation.toLowerCase()));
        const titleMatch = item.title && (item.title.toLowerCase().includes(loc.location.toLowerCase()) || loc.location.toLowerCase().includes(item.title.toLowerCase()));
        const dayMatch = loc.day && String(loc.day) === String(item.day);
        return locMatch || titleMatch || dayMatch;
      });

      let shoppingBadgesHtml = '';
      if (matchingLocs.length > 0) {
        shoppingBadgesHtml = matchingLocs.map(mLoc => {
          const totalItemsCount = mLoc.items ? mLoc.items.length : 0;
          const unboughtCount = mLoc.items ? mLoc.items.filter(i => !Boolean(i.bought)).length : 0;
          const badgeColor = unboughtCount > 0 ? 'var(--amber-gold)' : '#10B981';
          const badgeText = unboughtCount > 0
            ? `🛍️ 購物提醒：${mLoc.location} (${unboughtCount} 項待買 / 共 ${totalItemsCount} 項)`
            : `🛍️ 購物連結：${mLoc.location} (全數已買 ✅)`;

          return `
            <div onclick="event.stopPropagation(); openLocationDetailModal('${mLoc.id}')" style="margin-top:6px; background:rgba(211, 84, 0, 0.07); border:1px solid rgba(211, 84, 0, 0.2); color:${badgeColor}; font-size:0.75rem; font-weight:700; padding:5px 10px; border-radius:8px; display:flex; align-items:center; justify-content:space-between; cursor:pointer;" title="點擊直接查看此地點的購物清單與照片">
              <span>${badgeText}</span>
              <span style="font-size:0.75rem; font-weight:800;">查看清單 ➔</span>
            </div>
          `;
        }).join('');
      }

      return `
        <div class="timeline-item">
          <div class="timeline-time">${displayTime}</div>
          <div class="timeline-card" onclick="editItinerary('${item.id}')" style="cursor:pointer;" title="點擊編輯行程資訊">
            <div class="flex-between" style="margin-bottom:4px;">
              <div style="font-weight:800; font-size:0.98rem; color:var(--kyoto-dark);">${item.title}</div>
              <span class="badge ${badgeClass}">${badgeIcon} ${displayCategory}</span>
            </div>
            ${displayLocation ? `<div style="font-size:0.8rem; color:var(--amber-gold); margin-bottom:6px;">📍 ${displayLocation}</div>` : ''}
            ${(item.note && item.note !== 'undefined') ? `<div style="font-size:0.78rem; color:var(--kyoto-muted); margin-bottom:8px; background:var(--washi-bg); padding:6px 10px; border-radius:8px;">💡 ${item.note}</div>` : ''}
            ${shoppingBadgesHtml}
            <div class="flex-between" style="margin-top:6px;">
              <div style="font-size:0.75rem; font-weight:700; color:var(--maple-crimson);">${item.costJPY ? `預算: ¥${item.costJPY.toLocaleString()}` : ''}</div>
              <div style="display:flex; gap:6px; align-items:center;">
                <a href="${mapsLink}" target="_blank" onclick="event.stopPropagation();" class="btn-icon-sm" style="text-decoration:none;" title="開啟地圖導航">🗺️</a>
                <button onclick="event.stopPropagation(); deleteItinerary('${item.id}')" style="background:none; border:none; color:#DC2626; cursor:pointer; font-size:0.85rem;" title="刪除行程">🗑️</button>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');
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

  window.editItinerary = function(id) {
    const item = tripData.itinerary.find(i => i.id === id);
    if (!item) return;

    const titleEl = document.getElementById('modal-itinerary-title');
    if (titleEl) titleEl.innerText = '🗓️ 編輯行程景點';

    document.getElementById('it-id').value = item.id;
    document.getElementById('it-day').value = item.day;

    const range = parseTimeRangeToHHMM(item.time);
    document.getElementById('it-time-start').value = range.start;
    document.getElementById('it-time-end').value = range.end;

    document.getElementById('it-title').value = item.title || '';
    document.getElementById('it-category').value = item.category || '景點';
    document.getElementById('it-cost').value = item.costJPY || '';
    document.getElementById('it-location').value = item.location || '';
    document.getElementById('it-maps-url').value = item.mapsUrl || '';
    document.getElementById('it-note').value = item.note || '';

    openModal('modal-itinerary');
  };

  window.deleteItinerary = function(id) {
    if (confirm('確定刪除此行程嗎？')) {
      tripData.itinerary = tripData.itinerary.filter(i => i.id !== id);
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
          <div style="display:flex; align-items:center; gap:6px;">
            <span class="drag-handle-cat" style="font-size:0.85rem; opacity:0.4; cursor:grab; padding:0 4px;" title="長按拖拉調整分類順序">≡</span>
            <span onclick="editPackingCategory('${cat.category}')" style="cursor:pointer;" title="點擊編輯分類">${cat.category}</span>
          </div>
          <div style="display:flex; gap:6px; align-items:center;">
            <span style="font-size:0.78rem; color:var(--kyoto-muted); font-weight:normal; margin-right:4px;">${cat.items.filter(i => i.checked).length}/${cat.items.length}</span>
            <button onclick="deletePackingCategory('${cat.category}')" style="background:none; border:none; color:#DC2626; cursor:pointer; font-size:0.85rem;" title="刪除分類">🗑️</button>
          </div>
        </div>
        ${cat.items.map(item => `
          <div class="packing-item-row ${item.checked ? 'checked' : ''}" draggable="true" data-item-id="${item.id}" data-cat-name="${cat.category}">
            <div class="checkbox-custom" onclick="togglePackingItem('${item.id}')" title="點擊方框勾選/取消">${item.checked ? '✓' : ''}</div>
            <div class="packing-text" style="flex:1;">
              <input type="text" class="packing-inline-input" value="${item.text.replace(/"/g, '&quot;')}" onblur="updatePackingText('${item.id}', this.value)" onkeydown="if(event.key==='Enter') this.blur();" placeholder="輸入項目名稱..." title="點擊直接修改文字" />
            </div>
            <div style="display:flex; gap:6px; align-items:center;">
              <span class="drag-handle" style="font-size:0.85rem; opacity:0.35; cursor:grab; padding:0 4px;" title="長按拖拉移動分類">≡</span>
              <button onclick="deletePackingItem('${item.id}')" style="background:none; border:none; color:#DC2626; cursor:pointer; font-size:0.85rem; padding:4px;" title="刪除">🗑️</button>
            </div>
          </div>
        `).join('')}
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

  function movePackingItemToCategory(itemId, targetCatName) {
    let sourceItem = null;

    tripData.packing.forEach(cat => {
      const idx = cat.items.findIndex(i => i.id === itemId);
      if (idx !== -1) {
        sourceItem = cat.items.splice(idx, 1)[0];
      }
    });

    if (sourceItem) {
      const targetCat = tripData.packing.find(c => c.category === targetCatName);
      if (targetCat) {
        targetCat.items.push(sourceItem);
      } else {
        tripData.packing.push({
          id: 'cat-' + Date.now(),
          category: targetCatName,
          items: [sourceItem]
        });
      }
      saveDataAndUpdate();
    }
  }

  function reorderPackingCategories(fromIndex, toIndex) {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return;
    const movedCat = tripData.packing.splice(fromIndex, 1)[0];
    if (movedCat) {
      tripData.packing.splice(toIndex, 0, movedCat);
      saveDataAndUpdate();
    }
  }

  function initPackingDragAndDrop() {
    const itemRows = document.querySelectorAll('.packing-item-row');
    const categories = document.querySelectorAll('.packing-category');

    let draggedItemId = null;
    let longPressTimer = null;
    let touchGhostEl = null;

    let draggedCatIdx = null;
    let catLongPressTimer = null;
    let catTouchGhostEl = null;

    // --- A. CATEGORY REORDERING (Mobile Touch & Desktop) ---
    categories.forEach(cat => {
      const header = cat.querySelector('.packing-header');
      if (!header) return;

      // Mobile Touch Long-Press on Category Header
      header.addEventListener('touchstart', (e) => {
        // If clicking on title text or delete button, ignore long press
        if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT') return;

        const catIdx = parseInt(header.dataset.catIdx, 10);
        catLongPressTimer = setTimeout(() => {
          draggedCatIdx = catIdx;
          if (navigator.vibrate) navigator.vibrate(60);
          cat.classList.add('dragging-cat');

          catTouchGhostEl = cat.cloneNode(true);
          catTouchGhostEl.style.position = 'fixed';
          catTouchGhostEl.style.pointerEvents = 'none';
          catTouchGhostEl.style.zIndex = '9999';
          catTouchGhostEl.style.opacity = '0.9';
          catTouchGhostEl.style.boxShadow = '0 12px 30px rgba(0,0,0,0.25)';
          catTouchGhostEl.style.width = cat.offsetWidth + 'px';
          document.body.appendChild(catTouchGhostEl);
        }, 300);
      }, { passive: true });

      header.addEventListener('touchmove', (e) => {
        const touch = e.touches[0];
        if (catTouchGhostEl) {
          e.preventDefault();
          catTouchGhostEl.style.left = (touch.clientX - 40) + 'px';
          catTouchGhostEl.style.top = (touch.clientY - 20) + 'px';

          const targetEl = document.elementFromPoint(touch.clientX, touch.clientY);
          const targetCat = targetEl ? targetEl.closest('.packing-category') : null;

          categories.forEach(c => c.classList.remove('cat-drop-target'));
          if (targetCat && targetCat !== cat) {
            targetCat.classList.add('cat-drop-target');
          }
        } else {
          clearTimeout(catLongPressTimer);
        }
      }, { passive: false });

      header.addEventListener('touchend', (e) => {
        clearTimeout(catLongPressTimer);
        if (draggedCatIdx !== null && catTouchGhostEl) {
          const touch = e.changedTouches[0];
          const targetEl = document.elementFromPoint(touch.clientX, touch.clientY);
          const targetCat = targetEl ? targetEl.closest('.packing-category') : null;

          if (targetCat) {
            const targetIdx = parseInt(targetCat.dataset.catIdx, 10);
            if (!isNaN(targetIdx) && targetIdx !== draggedCatIdx) {
              reorderPackingCategories(draggedCatIdx, targetIdx);
            }
          }

          if (catTouchGhostEl && catTouchGhostEl.parentNode) {
            catTouchGhostEl.parentNode.removeChild(catTouchGhostEl);
          }
          catTouchGhostEl = null;
          draggedCatIdx = null;
          categories.forEach(c => c.classList.remove('cat-drop-target', 'dragging-cat'));
        }
      });
    });

    // --- B. ITEM DRAG & DROP ACROSS CATEGORIES ---
    itemRows.forEach(row => {
      row.addEventListener('dragstart', (e) => {
        draggedItemId = row.dataset.itemId;
        row.classList.add('dragging');
        e.dataTransfer.setData('text/plain', draggedItemId);
      });

      row.addEventListener('dragend', () => {
        row.classList.remove('dragging');
        categories.forEach(c => c.classList.remove('drag-over'));
      });
    });

    categories.forEach(cat => {
      cat.addEventListener('dragover', (e) => {
        e.preventDefault();
        cat.classList.add('drag-over');
      });

      cat.addEventListener('dragleave', () => {
        cat.classList.remove('drag-over');
      });

      cat.addEventListener('drop', (e) => {
        e.preventDefault();
        cat.classList.remove('drag-over');
        const targetCatName = cat.dataset.category;
        if (draggedItemId && targetCatName) {
          movePackingItemToCategory(draggedItemId, targetCatName);
        }
      });
    });

    // Touch Event Long-Press Drag & Drop for Mobile Items
    itemRows.forEach(row => {
      row.addEventListener('touchstart', (e) => {
        if (e.target.tagName === 'INPUT') return;

        const itemId = row.dataset.itemId;
        longPressTimer = setTimeout(() => {
          draggedItemId = itemId;
          if (navigator.vibrate) navigator.vibrate(50);
          row.classList.add('dragging');

          touchGhostEl = row.cloneNode(true);
          touchGhostEl.style.position = 'fixed';
          touchGhostEl.style.pointerEvents = 'none';
          touchGhostEl.style.zIndex = '9999';
          touchGhostEl.style.opacity = '0.88';
          touchGhostEl.style.boxShadow = '0 10px 25px rgba(0,0,0,0.2)';
          touchGhostEl.style.width = row.offsetWidth + 'px';
          document.body.appendChild(touchGhostEl);
        }, 300);
      }, { passive: true });

      row.addEventListener('touchmove', (e) => {
        const touch = e.touches[0];
        if (touchGhostEl) {
          e.preventDefault();
          touchGhostEl.style.left = (touch.clientX - 40) + 'px';
          touchGhostEl.style.top = (touch.clientY - 20) + 'px';

          const targetEl = document.elementFromPoint(touch.clientX, touch.clientY);
          const targetCat = targetEl ? targetEl.closest('.packing-category') : null;

          categories.forEach(c => c.classList.remove('drag-over'));
          if (targetCat) {
            targetCat.classList.add('drag-over');
          }
        } else {
          clearTimeout(longPressTimer);
        }
      }, { passive: false });

      row.addEventListener('touchend', (e) => {
        clearTimeout(longPressTimer);
        if (draggedItemId && touchGhostEl) {
          const touch = e.changedTouches[0];
          const targetEl = document.elementFromPoint(touch.clientX, touch.clientY);
          const targetCat = targetEl ? targetEl.closest('.packing-category') : null;

          if (targetCat) {
            const targetCatName = targetCat.dataset.category;
            movePackingItemToCategory(draggedItemId, targetCatName);
          }

          if (touchGhostEl && touchGhostEl.parentNode) {
            touchGhostEl.parentNode.removeChild(touchGhostEl);
          }
          touchGhostEl = null;
          draggedItemId = null;
          categories.forEach(c => c.classList.remove('drag-over'));
          itemRows.forEach(r => r.classList.remove('dragging'));
        }
      });
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

    document.getElementById('modal-packing-item-title').innerText = '🎒 編輯行李項目';
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
    document.getElementById('modal-packing-cat-title').innerText = '📁 編輯行李分類名稱';
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

      let statusBadgeText = `🛒 ${totalItemsCount} 項商品`;
      if (totalItemsCount > 0) {
        if (boughtItemsCount === totalItemsCount) {
          statusBadgeText = `🛒 ${totalItemsCount} 項商品 (全數已買)`;
        } else {
          statusBadgeText = `🛒 ${totalItemsCount} 項 (已買 ${boughtItemsCount} / 未買 ${unboughtItemsCount})`;
        }
      }

      let itineraryBadge = '';
      if (loc.itineraryId) {
        const boundItinerary = (tripData.itinerary || []).find(i => i.id === loc.itineraryId);
        if (boundItinerary) {
          itineraryBadge = `<span class="badge badge-spot" style="background:#8B5CF6; color:#FFF; font-size:0.68rem; padding:2px 8px;">🔗 [Day ${boundItinerary.day}] ${boundItinerary.title}</span>`;
        }
      }
      const itemNamesPreview = loc.items ? loc.items.map(i => Boolean(i.bought) ? `<s style="opacity:0.5;">${i.name}</s>` : `<span>${i.name}</span>`).join('、 ') : '';

      return `
        <div class="shopping-card" data-loc-id="${loc.id}" data-loc-idx="${locIdx}" draggable="true" style="cursor:pointer;">
          <img src="${coverImage}" class="shopping-img" alt="${loc.location}" title="封面" />
          <div class="shopping-details">
            <div>
              <div class="flex-between">
                <div style="display:flex; align-items:center; gap:4px;">
                  <span class="drag-handle-shop" style="font-size:0.85rem; opacity:0.4; cursor:grab;" title="長按拖拉移動順序">≡</span>
                  <div class="shopping-title" style="font-size:1.05rem;">📍 ${loc.location}</div>
                </div>
                <span class="badge badge-shop" style="font-size:0.68rem;">${loc.category}</span>
              </div>
              <div style="display:flex; gap:6px; margin:4px 0; flex-wrap:wrap;">
                <span class="badge badge-spot" style="font-size:0.7rem; padding:2px 8px;">${statusBadgeText}</span>
                ${itineraryBadge}
              </div>
              <div style="font-size:0.76rem; color:var(--kyoto-muted); margin-top:4px; line-height:1.3; max-height:2.6em; overflow:hidden;">
                ${itemNamesPreview || '尚無項目'}
              </div>
            </div>
            <div class="flex-between" style="margin-top:8px;">
              <button type="button" onclick="event.stopPropagation(); event.preventDefault(); window.editShoppingLocation('${loc.id}');" class="btn-secondary btn-edit-shop-loc" data-loc-id="${loc.id}" style="padding:4px 12px; font-size:0.75rem; border-radius:6px; position:relative; z-index:100; cursor:pointer;" title="編輯地點資訊">編輯地點</button>
              <div style="display:flex; gap:6px; align-items:center;">
                <button type="button" onclick="event.stopPropagation(); event.preventDefault(); window.deleteShoppingLocation('${loc.id}');" class="btn-delete-shop-loc" data-loc-id="${loc.id}" style="background:none; border:none; color:#DC2626; cursor:pointer; font-size:0.85rem; position:relative; z-index:100;" title="刪除地點">🗑️</button>
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
    if (!loc || !loc.items || fromIdx === toIdx) return;
    const moved = loc.items.splice(fromIdx, 1)[0];
    if (moved) {
      loc.items.splice(toIdx, 0, moved);
      saveDataAndUpdate();
    }
  }

  function initShoppingDragAndDrop() {
    const cards = document.querySelectorAll('.shopping-card[data-loc-idx]');
    let draggedLocIdx = null;
    let shopLongPressTimer = null;
    let shopGhostEl = null;

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

      // Mobile Touch Long-Press on Outer Shopping Location Card
      card.addEventListener('touchstart', (e) => {
        if (e.target.tagName === 'BUTTON' || e.target.closest('button') || e.target.tagName === 'INPUT') return;

        const locIdx = parseInt(card.dataset.locIdx, 10);
        shopLongPressTimer = setTimeout(() => {
          draggedLocIdx = locIdx;
          if (navigator.vibrate) navigator.vibrate(60);
          card.classList.add('dragging-shop');

          shopGhostEl = card.cloneNode(true);
          shopGhostEl.style.position = 'fixed';
          shopGhostEl.style.pointerEvents = 'none';
          shopGhostEl.style.zIndex = '9999';
          shopGhostEl.style.opacity = '0.9';
          shopGhostEl.style.boxShadow = '0 12px 30px rgba(0,0,0,0.25)';
          shopGhostEl.style.width = card.offsetWidth + 'px';
          document.body.appendChild(shopGhostEl);
        }, 300);
      }, { passive: true });

      card.addEventListener('touchmove', (e) => {
        const touch = e.touches[0];
        if (shopGhostEl) {
          e.preventDefault();
          shopGhostEl.style.left = (touch.clientX - 40) + 'px';
          shopGhostEl.style.top = (touch.clientY - 20) + 'px';

          const targetEl = document.elementFromPoint(touch.clientX, touch.clientY);
          const targetCard = targetEl ? targetEl.closest('.shopping-card[data-loc-idx]') : null;

          cards.forEach(c => c.classList.remove('shop-drop-target'));
          if (targetCard && targetCard !== card) {
            targetCard.classList.add('shop-drop-target');
          }
        } else {
          clearTimeout(shopLongPressTimer);
        }
      }, { passive: false });

      card.addEventListener('touchend', (e) => {
        clearTimeout(shopLongPressTimer);
        if (draggedLocIdx !== null && shopGhostEl) {
          const touch = e.changedTouches[0];
          const targetEl = document.elementFromPoint(touch.clientX, touch.clientY);
          const targetCard = targetEl ? targetEl.closest('.shopping-card[data-loc-idx]') : null;

          if (targetCard) {
            const targetIdx = parseInt(targetCard.dataset.locIdx, 10);
            if (!isNaN(targetIdx) && targetIdx !== draggedLocIdx) {
              reorderShoppingLocations(draggedLocIdx, targetIdx);
            }
          }

          if (shopGhostEl && shopGhostEl.parentNode) {
            shopGhostEl.parentNode.removeChild(shopGhostEl);
          }
          shopGhostEl = null;
          draggedLocIdx = null;
          cards.forEach(c => c.classList.remove('shop-drop-target', 'dragging-shop'));
        }
      });
    });
  }

  function initSubitemDragAndDrop(locId) {
    const subCards = document.querySelectorAll('.subitem-card');
    let draggedItemIdx = null;
    let subTimer = null;
    let subGhostEl = null;

    subCards.forEach(card => {
      card.addEventListener('touchstart', (e) => {
        if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT' || e.target.classList.contains('checkbox-custom')) return;

        const idx = parseInt(card.dataset.itemIdx, 10);
        subTimer = setTimeout(() => {
          draggedItemIdx = idx;
          if (navigator.vibrate) navigator.vibrate(50);
          card.classList.add('dragging-shop');

          subGhostEl = card.cloneNode(true);
          subGhostEl.style.position = 'fixed';
          subGhostEl.style.pointerEvents = 'none';
          subGhostEl.style.zIndex = '9999';
          subGhostEl.style.opacity = '0.9';
          subGhostEl.style.boxShadow = '0 10px 25px rgba(0,0,0,0.2)';
          subGhostEl.style.width = card.offsetWidth + 'px';
          document.body.appendChild(subGhostEl);
        }, 300);
      }, { passive: true });

      card.addEventListener('touchmove', (e) => {
        const touch = e.touches[0];
        if (subGhostEl) {
          e.preventDefault();
          subGhostEl.style.left = (touch.clientX - 40) + 'px';
          subGhostEl.style.top = (touch.clientY - 20) + 'px';

          const targetEl = document.elementFromPoint(touch.clientX, touch.clientY);
          const targetSub = targetEl ? targetEl.closest('.subitem-card') : null;

          subCards.forEach(c => c.classList.remove('shop-drop-target'));
          if (targetSub && targetSub !== card) {
            targetSub.classList.add('shop-drop-target');
          }
        } else {
          clearTimeout(subTimer);
        }
      }, { passive: false });

      card.addEventListener('touchend', (e) => {
        clearTimeout(subTimer);
        if (draggedItemIdx !== null && subGhostEl) {
          const touch = e.changedTouches[0];
          const targetEl = document.elementFromPoint(touch.clientX, touch.clientY);
          const targetSub = targetEl ? targetEl.closest('.subitem-card') : null;

          if (targetSub) {
            const targetIdx = parseInt(targetSub.dataset.itemIdx, 10);
            if (!isNaN(targetIdx) && targetIdx !== draggedItemIdx) {
              reorderShoppingSubitems(locId, draggedItemIdx, targetIdx);
              renderLocationDetailModal(locId);
            }
          }

          if (subGhostEl && subGhostEl.parentNode) {
            subGhostEl.parentNode.removeChild(subGhostEl);
          }
          subGhostEl = null;
          draggedItemIdx = null;
          subCards.forEach(c => c.classList.remove('shop-drop-target', 'dragging-shop'));
        }
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

    document.getElementById('modal-shopping-title').innerText = '🛍️ 編輯購物地點資訊';
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
    window.currentLocationDetailId = locId;
    renderLocationDetailModal(locId);
    window.openModal('modal-shopping-detail');
  };

  function renderLocationDetailModal(locId) {
    const loc = tripData.shopping.find(s => s.id === locId);
    if (!loc) return;

    window.currentLocationDetailId = loc.id;
    document.getElementById('detail-location-name').innerText = `📍 ${loc.location}`;
    document.getElementById('detail-location-note').innerText = loc.note ? `💡 ${loc.note}` : '點擊空白處可編輯，長按可拖拉排序';

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
        : `<span style="font-weight:700;">${item.name}</span>`;

      return `
        <div class="shopping-card subitem-card" data-subitem-id="${item.id}" data-item-idx="${itemIdx}" data-loc-id="${loc.id}" draggable="true" style="margin-bottom:12px; display:flex; align-items:center; gap:10px; padding:10px 12px; cursor:pointer; ${isBought ? 'opacity:0.7; background:#F8FAFC;' : ''}">
          <!-- Square Checkbox on FAR LEFT -->
          <div class="checkbox-custom ${isBought ? 'checked' : ''}" onclick="event.stopPropagation(); toggleSubitemBought('${loc.id}', '${item.id}')" title="點擊勾選/取消已買" style="cursor:pointer; flex-shrink:0;">${isBought ? '✓' : ''}</div>

          <!-- Product Image -->
          <img src="${item.image}" class="shopping-img" style="width:52px; height:52px; border-radius:10px; object-fit:cover; flex-shrink:0;" alt="${item.name}" onclick="event.stopPropagation(); openLightbox('${item.image}', '${item.name} | 📍 ${loc.location}')" title="點擊放大圖片" />

          <!-- Details (Clicking anywhere on blank/text opens edit directly without pencil icon) -->
          <div class="shopping-details" style="flex:1;" onclick="editSubitem('${loc.id}', '${item.id}')" title="點擊編輯商品說明">
            <div class="flex-between" style="margin-bottom:2px;">
              <div class="shopping-title">${titleHtml}</div>
              <span class="badge ${isBought ? 'badge-spot' : 'badge-hotel'}" style="${isBought ? 'background:#10B981; color:#FFF;' : 'background:#E2E8F0; color:#64748B;'} font-size:0.68rem; padding:2px 6px;">${isBought ? '✅ 已買' : '⏳ 未買'}</span>
            </div>
            ${item.note ? `<div style="font-size:0.72rem; color:var(--kyoto-muted);">💡 ${item.note}</div>` : ''}
            <div class="flex-between" style="margin-top:4px;">
              <div class="shopping-price" style="font-size:0.88rem; font-weight:800; color:var(--maple-crimson);">¥ ${item.priceJPY.toLocaleString()}</div>
              <div style="display:flex; gap:6px; align-items:center;">
                <span class="drag-handle-subitem" style="font-size:0.85rem; opacity:0.35; cursor:grab;" title="長按拖拉移動商品順序">≡</span>
                <button onclick="event.stopPropagation(); deleteSubitem('${loc.id}', '${item.id}')" style="background:none; border:none; color:#DC2626; cursor:pointer; font-size:0.85rem; padding:2px 4px;" title="刪除商品">🗑️</button>
              </div>
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


