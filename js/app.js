// Основной файл приложения

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', async () => {
    // Инициализация UI
    window.populateEmojiPicker?.();
    
    // Показываем модалку входа
    document.getElementById('loginModal').classList.add('active');
    
    // Проверяем существующую сессию
    const user = await window.loadCurrentUser?.();
    
    if (user) {
        document.getElementById('loginModal').classList.remove('active');
        document.getElementById('appContainer').style.display = 'flex';
        
        // Обновляем UI
        window.updateProfileUI?.();
        
        // Загружаем данные
        await Promise.all([
            window.loadAllUsers?.(),
            window.loadUserChats?.(),
            window.loadAllMessages?.()
        ]);
        
        window.loadPinnedChats?.();
        window.initAbly?.();
        window.startHeartbeat?.();
        window.startPresenceUpdates?.();
        window.startStatusUpdates?.();
        window.cleanupOldCalls?.();
        window.checkUrlForChat?.();
        window.forceShowInput?.();
        window.updateBackButtonVisibility?.();
        window.updateCreateChatButtonVisibility?.();
        window.populateThemeGrid?.();
        window.listenForIncomingCalls?.();
    }
    
    // Мобильные обработчики
    window.setupMobileHandlers?.();
    
    // Обработчики resize
    window.addEventListener('resize', () => {
        window.updateBackButtonVisibility?.();
        if (window.innerWidth > 768) {
            document.getElementById('sidebar').classList.remove('active');
        }
        window.forceShowInput?.();
    });
    
    // Обработчик popstate для URL
    window.addEventListener('popstate', (event) => {
        const hash = window.location.hash.substring(1);
        if (hash) {
            const chat = window.myChats?.find(c => c.id === hash) || window.publicChats?.find(c => c.id === hash);
            if (chat) window.joinChat?.(chat);
        } else {
            window.currentChat = null;
            window.renderMessages?.();
            window.updateUrlWithChat?.(null);
        }
    });
    
    // Обработчик Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            window.closeMediaViewer?.();
            window.hideMessageActions?.();
            const callModal = document.getElementById('callModal');
            if (callModal && callModal.classList.contains('active')) {
                window.endCall?.();
            }
        }
    });
    
    // Закрытие emoji picker при клике вне
    document.addEventListener('click', (e) => {
        const emojiPicker = document.getElementById('emojiPicker');
        const emojiBtn = document.querySelector('.emoji-toggle-btn');
        if (emojiPicker?.style.display === 'flex' && 
            !emojiPicker.contains(e.target) && 
            !emojiBtn?.contains(e.target)) {
            emojiPicker.style.display = 'none';
        }
    });
    
    // Авто-высота textarea
    document.getElementById('messageInput')?.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
    });
    
    // Запрос разрешения на уведомления
    if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
        Notification.requestPermission();
    }
});
