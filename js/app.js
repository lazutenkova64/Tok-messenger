// Основной файл приложения

// Глобальные переменные для отслеживания состояния
let appInitialized = false;

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', async () => {
    console.log('App initializing...');
    
    // Инициализация UI (безопасно, даже если модули не загружены)
    safelyCall('populateEmojiPicker');
    
    // Показываем модалку входа
    const loginModal = document.getElementById('loginModal');
    if (loginModal) loginModal.classList.add('active');
    
    // Ждём загрузки всех модулей (небольшая задержка)
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Проверяем существующую сессию
    const user = await safelyCallAsync('loadCurrentUser');
    
    if (user) {
        await initializeApp(user);
    }
    
    // Мобильные обработчики
    safelyCall('setupMobileHandlers');
    
    // Обработчики resize
    window.addEventListener('resize', handleResize);
    
    // Обработчик popstate для URL
    window.addEventListener('popstate', handlePopState);
    
    // Обработчик Escape
    document.addEventListener('keydown', handleEscapeKey);
    
    // Закрытие emoji picker при клике вне
    document.addEventListener('click', handleOutsideClick);
    
    // Авто-высота textarea
    const messageInput = document.getElementById('messageInput');
    if (messageInput) {
        messageInput.addEventListener('input', handleTextareaInput);
    }
    
    // Запрос разрешения на уведомления
    requestNotificationPermission();
    
    // Инициализируем звуки для звонков
    safelyCall('initSounds');
    
    appInitialized = true;
    console.log('App initialized');
});

// Инициализация приложения для авторизованного пользователя
async function initializeApp(user) {
    console.log('Initializing app for user:', user.name);
    
    const loginModal = document.getElementById('loginModal');
    const appContainer = document.getElementById('appContainer');
    
    if (loginModal) loginModal.classList.remove('active');
    if (appContainer) appContainer.style.display = 'flex';
    
    // Обновляем UI
    safelyCall('updateProfileUI');
    
    // Загружаем данные параллельно
    await Promise.all([
        safelyCallAsync('loadAllUsers'),
        safelyCallAsync('loadUserChats'),
        safelyCallAsync('loadAllMessages')
    ]);
    
    // Загружаем закрепленные чаты
    safelyCall('loadPinnedChats');
    
    // Инициализируем Ably
    safelyCall('initAbly');
    
    // Запускаем heartbeat
    safelyCall('startHeartbeat');
    safelyCall('startPresenceUpdates');
    safelyCall('startStatusUpdates');
    
    // Очищаем старые звонки
    safelyCall('cleanupOldCalls');
    
    // Проверяем URL на наличие чата
    safelyCall('checkUrlForChat');
    
    // Принудительно показываем инпут
    safelyCall('forceShowInput');
    
    // Обновляем видимость кнопок
    safelyCall('updateBackButtonVisibility');
    safelyCall('updateCreateChatButtonVisibility');
    
    // Инициализируем темы
    safelyCall('populateThemeGrid');
}

// Безопасные вызовы функций
function safelyCall(funcName, ...args) {
    if (typeof window[funcName] === 'function') {
        try {
            return window[funcName](...args);
        } catch (e) {
            console.warn(`Error calling ${funcName}:`, e);
        }
    }
    return null;
}

async function safelyCallAsync(funcName, ...args) {
    if (typeof window[funcName] === 'function') {
        try {
            return await window[funcName](...args);
        } catch (e) {
            console.warn(`Error calling ${funcName}:`, e);
        }
    }
    return null;
}

// Обработчики событий
function handleResize() {
    safelyCall('updateBackButtonVisibility');
    if (window.innerWidth > 768) {
        const sidebar = document.getElementById('sidebar');
        if (sidebar) sidebar.classList.remove('active');
    }
    safelyCall('forceShowInput');
}

function handlePopState(event) {
    const hash = window.location.hash.substring(1);
    if (hash) {
        const chat = (window.myChats || []).find(c => c.id === hash) || 
                    (window.publicChats || []).find(c => c.id === hash);
        if (chat) safelyCall('joinChat', chat);
    } else {
        window.currentChat = null;
        safelyCall('renderMessages');
        safelyCall('updateUrlWithChat', null);
    }
}

function handleEscapeKey(e) {
    if (e.key === 'Escape') {
        safelyCall('closeMediaViewer');
        safelyCall('hideMessageActions');
        const callModal = document.getElementById('callModal');
        if (callModal && callModal.classList.contains('active')) {
            safelyCall('endCall');
        }
    }
}

function handleOutsideClick(e) {
    const emojiPicker = document.getElementById('emojiPicker');
    const emojiBtn = document.querySelector('.emoji-toggle-btn');
    if (emojiPicker?.style.display === 'flex' && 
        !emojiPicker.contains(e.target) && 
        !emojiBtn?.contains(e.target)) {
        emojiPicker.style.display = 'none';
    }
}

function handleTextareaInput() {
    this.style.height = 'auto';
    this.style.height = (this.scrollHeight) + 'px';
}

function requestNotificationPermission() {
    if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
        Notification.requestPermission();
    }
}
