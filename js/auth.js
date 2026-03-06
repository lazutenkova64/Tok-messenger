// Состояние авторизации
let currentUser = null;
let loginAttempts = 0;
let lastLoginAttemptTime = 0;
const MAX_LOGIN_ATTEMPTS = 3;
const LOGIN_TIMEFRAME = 60000;

// Загрузка пользователя из сессии
async function loadCurrentUser() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    
    if (session?.user) {
        const { data: userData } = await supabaseClient
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();
        
        if (userData) {
            currentUser = {
                id: userData.id,
                name: userData.username,
                avatar: userData.avatar || '👤',
                bio: userData.bio || '',
                isAdmin: userData.username === ADMIN_USERNAME,
                dnd: userData.dnd || false
            };
            
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            return currentUser;
        }
    }
    return null;
}

// Вход
async function login() {
    const now = Date.now();
    if (now - lastLoginAttemptTime > LOGIN_TIMEFRAME) loginAttempts = 0;
    if (loginAttempts >= MAX_LOGIN_ATTEMPTS) {
        alert('Слишком много попыток входа. Попробуйте позже.');
        return false;
    }
    loginAttempts++;
    lastLoginAttemptTime = now;

    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    
    if (!email || !password) {
        alert('Введите email и пароль');
        return false;
    }
    
    try {
        const { data: authData, error: authError } = await supabaseClient.auth.signInWithPassword({
            email: email,
            password: password
        });
        
        if (authError) {
            alert('Неверный email или пароль');
            return false;
        }
        
        const user = await loadCurrentUser();
        if (user) {
            document.getElementById('loginModal').classList.remove('active');
            document.getElementById('appContainer').style.display = 'flex';
            
            // Обновляем UI
            if (typeof window.updateProfileUI === 'function') window.updateProfileUI();
            
            // Загружаем данные
            await Promise.all([
                typeof window.loadAllUsers === 'function' ? window.loadAllUsers() : Promise.resolve(),
                typeof window.loadUserChats === 'function' ? window.loadUserChats() : Promise.resolve(),
                typeof window.loadAllMessages === 'function' ? window.loadAllMessages() : Promise.resolve()
            ]);
            
            if (typeof window.loadPinnedChats === 'function') window.loadPinnedChats();
            if (typeof window.initAbly === 'function') window.initAbly();
            if (typeof window.startHeartbeat === 'function') window.startHeartbeat();
            if (typeof window.startPresenceUpdates === 'function') window.startPresenceUpdates();
            if (typeof window.startStatusUpdates === 'function') window.startStatusUpdates();
            if (typeof window.cleanupOldCalls === 'function') window.cleanupOldCalls();
            if (typeof window.checkUrlForChat === 'function') window.checkUrlForChat();
            if (typeof window.forceShowInput === 'function') window.forceShowInput();
            if (typeof window.updateBackButtonVisibility === 'function') window.updateBackButtonVisibility();
            if (typeof window.updateCreateChatButtonVisibility === 'function') window.updateCreateChatButtonVisibility();
            if (typeof window.populateThemeGrid === 'function') window.populateThemeGrid();
            if (typeof window.listenForIncomingCalls === 'function') window.listenForIncomingCalls();
            
            return true;
        }
    } catch (err) {
        console.error('Login error:', err);
        alert('Ошибка при входе');
    }
    return false;
}

// Регистрация
async function register() {
    const now = Date.now();
    if (now - lastLoginAttemptTime > LOGIN_TIMEFRAME) loginAttempts = 0;
    if (loginAttempts >= MAX_LOGIN_ATTEMPTS) {
        alert('Слишком много попыток регистрации. Попробуйте позже.');
        return false;
    }
    loginAttempts++;
    lastLoginAttemptTime = now;

    const email = document.getElementById('registerEmail').value.trim();
    const password = document.getElementById('registerPassword').value;
    const confirmPassword = document.getElementById('registerConfirmPassword').value;
    
    if (!email || !password) {
        alert('Заполните все поля');
        return false;
    }
    if (password !== confirmPassword) {
        alert('Пароли не совпадают');
        return false;
    }
    
    const username = email.split('@')[0];
    const creatorEmail = "k1lame@example.com";
    
    if (username === ADMIN_USERNAME && email !== creatorEmail) {
        alert('Имя пользователя K1lame зарезервировано для создателя');
        return false;
    }
    
    try {
        const { data: authData, error: authError } = await supabaseClient.auth.signUp({
            email: email,
            password: password
        });
        
        if (authError) {
            alert('Ошибка при регистрации: ' + authError.message);
            return false;
        }
        
        if (!authData.user) {
            alert('Ошибка при создании пользователя');
            return false;
        }
        
        const newUser = {
            id: authData.user.id,
            username: username,
            avatar: '👤',
            bio: '',
            dnd: false,
            created_at: new Date().toISOString()
        };
        
        const { error } = await supabaseClient
            .from('profiles')
            .insert([newUser]);
        
        if (error) {
            alert('Ошибка при регистрации: ' + error.message);
            return false;
        }
        
        alert('Регистрация успешна! Теперь вы можете войти.');
        if (typeof window.switchAuthMode === 'function') window.switchAuthMode('login');
        return true;
        
    } catch (err) {
        console.error('Registration error:', err);
        alert('Ошибка при регистрации');
    }
    return false;
}

// Выход
async function logout() {
    if (window.mediaRecorder && window.isRecording) {
        if (typeof window.stopRecording === 'function') window.stopRecording();
    }
    
    if (window.mediaStream) {
        window.mediaStream.getTracks().forEach(track => track.stop());
        window.mediaStream = null;
    }
    
    if (window.peerConnection) {
        window.peerConnection.close();
        window.peerConnection = null;
    }
    
    if (window.localStream) {
        window.localStream.getTracks().forEach(track => track.stop());
        window.localStream = null;
    }
    
    await updateUserLastSeen();
    await supabaseClient.auth.signOut();
    
    if (window.ably) {
        try {
            if (window.myChats && Array.isArray(window.myChats)) {
                window.myChats.forEach(chat => {
                    const channel = window.ably.channels.get(`chat-${chat.id}`);
                    channel.unsubscribe();
                });
            }
            
            const presenceChannel = window.ably.channels.get('presence');
            presenceChannel.presence.leave();
            window.ably.close();
        } catch (e) {
            console.error('Error closing Ably:', e);
        }
        window.ably = null;
    }
    
    localStorage.removeItem('currentUser');
    window.currentUser = null;
    window.currentChat = null;
    window.myChats = [];
    window.onlineUsers = {};
    window.allUsers = [];
    window.pinnedChats = [];
    
    document.getElementById('appContainer').style.display = 'none';
    document.getElementById('loginModal').classList.add('active');
    if (typeof window.updateUrlWithChat === 'function') window.updateUrlWithChat(null);
    if (typeof window.updateBackButtonVisibility === 'function') window.updateBackButtonVisibility();
    if (typeof window.updateCreateChatButtonVisibility === 'function') window.updateCreateChatButtonVisibility();
    
    document.getElementById('loginEmail').value = '';
    document.getElementById('loginPassword').value = '';
    document.getElementById('registerEmail').value = '';
    document.getElementById('registerPassword').value = '';
    document.getElementById('registerConfirmPassword').value = '';
}

async function updateUserLastSeen() {
    if (!currentUser) return;
    
    try {
        await supabaseClient
            .from('profiles')
            .update({ last_seen: new Date().toISOString() })
            .eq('id', currentUser.id);
    } catch (err) {
        console.error('Error updating last_seen:', err);
    }
}

// Экспорт в глобальную область
window.currentUser = currentUser;
window.login = login;
window.register = register;
window.logout = logout;
window.loadCurrentUser = loadCurrentUser;
