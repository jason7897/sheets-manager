// ===== 상태 =====
const STORAGE_KEY = 'sandwich-favorites';

let currentFilter = '전체';
let currentBread = '전체';
let currentSearch = '';
let showFavsOnly = false;

// localStorage에서 즐겨찾기 불러오기
function loadFavorites() {
  try {
    return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY)) || []);
  } catch {
    return new Set();
  }
}

// localStorage에 즐겨찾기 저장
function saveFavorites(favs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...favs]));
}

let favorites = loadFavorites();

// ===== DOM 요소 =====
const cards = document.querySelectorAll('.card');
const searchInput = document.getElementById('search-input');
const searchClear = document.getElementById('search-clear');
const filterBtns = document.querySelectorAll('.filter-btn:not(.fav-filter)');
const breadBtns = document.querySelectorAll('.bread-btn');
const favFilterBtn = document.getElementById('fav-filter-btn');
const emptyState = document.getElementById('empty-state');
const resetBtn = document.getElementById('reset-btn');
const favBtns = document.querySelectorAll('.fav-btn');

// ===== 필터 적용 =====
function applyFilters() {
  const query = currentSearch.trim().toLowerCase();
  let visibleCount = 0;

  cards.forEach(card => {
    const id = card.dataset.id;
    const category = card.dataset.category;
    const text = card.textContent.toLowerCase();

    const bread = card.dataset.bread;

    const matchesCategory = currentFilter === '전체' || category === currentFilter;
    const matchesBread = currentBread === '전체' || bread === currentBread;
    const matchesSearch = query === '' || text.includes(query);
    const matchesFav = !showFavsOnly || favorites.has(id);

    if (matchesCategory && matchesBread && matchesSearch && matchesFav) {
      card.classList.remove('hidden');
      visibleCount++;
    } else {
      card.classList.add('hidden');
    }
  });

  emptyState.hidden = visibleCount > 0;
}

// ===== 즐겨찾기 버튼 초기화 =====
function syncFavButtons() {
  favBtns.forEach(btn => {
    const id = btn.dataset.id;
    if (favorites.has(id)) {
      btn.classList.add('active');
      btn.textContent = '♥';
    } else {
      btn.classList.remove('active');
      btn.textContent = '♡';
    }
  });
}

// ===== 이벤트: 검색 =====
searchInput.addEventListener('input', () => {
  currentSearch = searchInput.value;
  searchClear.classList.toggle('visible', currentSearch.length > 0);
  applyFilters();
});

searchClear.addEventListener('click', () => {
  searchInput.value = '';
  currentSearch = '';
  searchClear.classList.remove('visible');
  searchInput.focus();
  applyFilters();
});

// ===== 이벤트: 카테고리 필터 =====
filterBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    filterBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.filter;
    applyFilters();
  });
});

// ===== 이벤트: 빵 종류 필터 =====
breadBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    breadBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentBread = btn.dataset.bread;
    applyFilters();
  });
});

// ===== 이벤트: 즐겨찾기만 보기 =====
favFilterBtn.addEventListener('click', () => {
  showFavsOnly = !showFavsOnly;
  favFilterBtn.classList.toggle('active', showFavsOnly);
  favFilterBtn.textContent = showFavsOnly ? '♥ 즐겨찾기' : '♡ 즐겨찾기';
  applyFilters();
});

// ===== 이벤트: 개별 즐겨찾기 토글 =====
favBtns.forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const id = btn.dataset.id;

    if (favorites.has(id)) {
      favorites.delete(id);
    } else {
      favorites.add(id);
      // 하트 애니메이션
      btn.style.transform = 'scale(1.4)';
      setTimeout(() => { btn.style.transform = ''; }, 250);
    }

    saveFavorites(favorites);
    syncFavButtons();

    // 즐겨찾기만 보기 중이면 즉시 재필터링
    if (showFavsOnly) applyFilters();
  });
});

// ===== 이벤트: 초기화 버튼 =====
resetBtn.addEventListener('click', () => {
  // 검색 초기화
  searchInput.value = '';
  currentSearch = '';
  searchClear.classList.remove('visible');

  // 카테고리 필터 초기화
  filterBtns.forEach(b => b.classList.remove('active'));
  document.querySelector('.filter-btn[data-filter="전체"]').classList.add('active');
  currentFilter = '전체';

  // 빵 종류 필터 초기화
  breadBtns.forEach(b => b.classList.remove('active'));
  document.querySelector('.bread-btn[data-bread="전체"]').classList.add('active');
  currentBread = '전체';

  // 즐겨찾기 필터 초기화
  showFavsOnly = false;
  favFilterBtn.classList.remove('active');
  favFilterBtn.textContent = '♡ 즐겨찾기';

  applyFilters();
});

// ===== 초기 실행 =====
syncFavButtons();
applyFilters();
