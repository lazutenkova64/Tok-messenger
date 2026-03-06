// realtime.js — обработка звонков через Ably

function setupUserChannelHandlers(userChannel) {

    console.log("📡 Subscribed to", userChannel.name);

    // входящий звонок
    userChannel.subscribe('offer', (message) => {
        console.log("📞 Incoming call:", message.data);

        if (window.handleIncomingCall) {
            window.handleIncomingCall(message.data);
        }
    });

    // ответ на звонок
    userChannel.subscribe('answer', (message) => {
        console.log("✅ Call answered:", message.data);

        if (window.handleCallAnswer) {
            window.handleCallAnswer(message.data);
        }
    });

    // ICE кандидаты
    userChannel.subscribe('ice-candidate', (message) => {
        console.log("🧊 ICE candidate:", message.data);

        if (window.handleIceCandidate) {
            window.handleIceCandidate(message.data);
        }
    });

    // завершение звонка
    userChannel.subscribe('end', (message) => {
        console.log("📴 Call ended:", message.data);

        if (window.handleCallEnd) {
            window.handleCallEnd(message.data);
        }
    });

}

// подключение Ably
function initRealtime() {

    if (!window.Ably) {
        console.error("Ably not loaded");
        return;
    }

    const ably = new Ably.Realtime(ABLY_KEY);

    window.ably = ably;

    ably.connection.on('connected', () => {

        console.log("✅ Connected to Ably");

        const userChannel = ably.channels.get(`user-${currentUser.id}`);

        setupUserChannelHandlers(userChannel);

    });

}

initRealtime();
