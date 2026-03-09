// ========== АУТЕНТИФИКАЦИЯ ==========
async function login() {
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    
    if (!email || !password) {
        alert('Введите email и пароль');
        return;
    }
    
    try {
        const { data: authData, error: authError } = await supabaseClient.auth.signInWithPassword({
            email: email,
            password: password
        });
        
        if (authError) {
            alert('Неверный email или пароль');
            return;
        }
        
        const { data: userData } = await supabaseClient
            .from('profiles')
            .select('*')
            .eq('id', authData.user.id)
            .single();
        
        if (userData) {
            window.currentUser = {
                id: userData.id,
                name: userData.username,
                avatar: userData.avatar || '👤',
                bio: userData.bio || '',
                isAdmin: userData.username === ADMIN_USERNAME,
                dnd: userData.dnd || false
            };
            
            localStorage.setItem('currentUser', JSON.stringify(window.currentUser));
            
            document.getElementById('loginModal').classList.remove('active');
            document.getElementById('appContainer').style.display = 'flex';
            
            updateProfileUI();
            
            await Promise.all([
                loadAllUsers(),
                loadUserChats(),
                loadAllMessages()
            ]);
            
            await ensureSavedMessagesChat();
            
            loadPinnedChats();
            
            initAbly();
            startHeartbeat();
            startPresenceUpdates();
            startStatusUpdates();
            
            cleanupOldCalls();
            
            checkUrlForChat();
            forceShowInput();
            
            updateBackButtonVisibility();
            updateCreateChatButtonVisibility();
            
            populateThemeGrid();
            
            listenForIncomingCalls();
            
            if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
                Notification.requestPermission();
            }
        }
        
    } catch (err) {
        console.error('Login error:', err);
        alert('Ошибка при входе');
    }
}

async function register() {
    const email = document.getElementById('registerEmail').value.trim();
    const password = document.getElementById('registerPassword').value;
    const confirmPassword = document.getElementById('registerConfirmPassword').value;
    
    if (!email || !password) {
        alert('Заполните все поля');
        return;
    }
    if (password !== confirmPassword) {
        alert('Пароли не совпадают');
        return;
    }
    
    const username = email.split('@')[0];
    
    const creatorEmail = "k1lame@example.com";
    if (username === ADMIN_USERNAME && email !== creatorEmail) {
        alert('Имя пользователя K1lame зарезервировано для создателя');
        return;
    }
    
    try {
        const { data: authData, error: authError } = await supabaseClient.auth.signUp({
            email: email,
            password: password
        });
        
        if (authError) {
            alert('Ошибка при регистрации: ' + authError.message);
            return;
        }
        
        if (!authData.user) {
            alert('Ошибка при создании пользователя');
            return;
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
            return;
        }
        
        alert('Регистрация успешна! Теперь вы можете войти.');
        switchAuthMode('login');
        
    } catch (err) {
        console.error('Registration error:', err);
        alert('Ошибка при регистрации. Проверьте подключение к интернету и повторите попытку.');
    }
}

async function logout() {
    if (window.mediaRecorder && window.isRecording) {
        stopRecording();
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
    
    Object.values(window.audioElements || {}).forEach(audio => {
        if (audio) {
            audio.pause();
            audio.currentTime = 0;
        }
    });
    window.audioElements = {};
    window.activeAudio = null;
    window.activeAudioId = null;
    
    if (window.audioUpdateInterval) {
        clearInterval(window.audioUpdateInterval);
        window.audioUpdateInterval = null;
    }
    
    await updateUserLastSeen();
    await supabaseClient.auth.signOut();
    
    if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
    }
    if (presenceUpdateInterval) {
        clearInterval(presenceUpdateInterval);
        presenceUpdateInterval = null;
    }
    if (window.statusUpdateInterval) {
        clearInterval(window.statusUpdateInterval);
        window.statusUpdateInterval = null;
    }
    
    if (ably) {
        try {
            window.myChats.forEach(chat => {
                const channel = ably.channels.get(`chat-${chat.id}`);
                channel.unsubscribe();
            });
            
            const presenceChannel = ably.channels.get('presence');
            if (presenceChannel.state === 'attached') {
                presenceChannel.presence.leave();
            }
            
            ably.close();
        } catch (e) {
            console.error('Error closing Ably:', e);
        }
        ably = null;
    }
    
    localStorage.removeItem('currentUser');
    window.currentUser = null;
    window.currentChat = null;
    window.myChats = [];
    onlineUsers = {};
    window.allUsers = [];
    window.pinnedChats = [];
    
    document.getElementById('appContainer').style.display = 'none';
    document.getElementById('loginModal').classList.add('active');
    updateUrlWithChat(null);
    updateBackButtonVisibility();
    updateCreateChatButtonVisibility();
    
    document.getElementById('loginEmail').value = '';
    document.getElementById('loginPassword').value = '';
    document.getElementById('registerEmail').value = '';
    document.getElementById('registerPassword').value = '';
    document.getElementById('registerConfirmPassword').value = '';
}

async function updateUserLastSeen() {
    if (!window.currentUser) return;
    
    try {
        await supabaseClient
            .from('profiles')
            .update({ last_seen: new Date().toISOString() })
            .eq('id', window.currentUser.id);
    } catch (err) {
        console.error('Error updating last_seen:', err);
    }
}

function switchAuthMode(mode) {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const loginTab = document.getElementById('loginTabBtn');
    const registerTab = document.getElementById('registerTabBtn');
    if (mode === 'login') {
        loginForm.style.display = 'block';
        registerForm.style.display = 'none';
        loginTab.className = 'auth-tab active';
        registerTab.className = 'auth-tab';
    } else {
        loginForm.style.display = 'none';
        registerForm.style.display = 'block';
        loginTab.className = 'auth-tab';
        registerTab.className = 'auth-tab active';
    }
}

function togglePassword(inputId) {
    const input = document.getElementById(inputId);
    input.type = input.type === 'password' ? 'text' : 'password';
}
