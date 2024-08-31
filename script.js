const startCallButton = document.getElementById('startCall');
const endCallButton = document.getElementById('endCall');
const joinMeetingButton = document.getElementById('joinMeeting');
const meetingIdInput = document.getElementById('meetingIdInput');
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');

let localStream;
let peerConnection;
let signalingServer;
let meetingId = null;
const configuration = { 
    'iceServers': [
        { 'urls': 'stun:stun.l.google.com:19302' },
        { 'urls': 'stun:stun1.l.google.com:19302' },
        { 'urls': 'stun:stun2.l.google.com:19302' }
    ]
};

function setupWebSocket() {
    if (signalingServer) {
        signalingServer.close();
    }

    signalingServer = new WebSocket('wss://videocalling-1nud.onrender.com/');

    signalingServer.onopen = () => {
        console.log('WebSocket connection established');
        if (meetingId) {
            signalingServer.send(JSON.stringify({ type: 'join', meetingId }));
        }
    };

    signalingServer.onclose = () => {
        console.log('WebSocket connection closed');
        setTimeout(setupWebSocket, 5000); // Attempt to reconnect after 5 seconds
    };

    signalingServer.onerror = (error) => {
        console.error('WebSocket error:', error);
    };

    signalingServer.onmessage = async (message) => {
        try {
            const data = JSON.parse(message.data);
            console.log('Received signaling message:', data);

            switch (data.type) {
                case 'offer':
                    await handleOffer(data);
                    break;
                case 'answer':
                    await handleAnswer(data);
                    break;
                case 'candidate':
                    await handleCandidate(data);
                    break;
                default:
                    console.warn('Unknown message type:', data.type);
            }
        } catch (error) {
            console.error('Error processing message:', error);
        }
    };
}

async function handleOffer(data) {
    if (!peerConnection) {
        createPeerConnection();
    }
    await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    signalingServer.send(JSON.stringify({ type: 'answer', meetingId, answer }));
}

async function handleAnswer(data) {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
}

async function handleCandidate(data) {
    if (peerConnection.remoteDescription) {
        await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
    } else {
        console.warn('Received ICE candidate before remote description');
    }
}

function createPeerConnection() {
    peerConnection = new RTCPeerConnection(configuration);
    peerConnection.onicecandidate = event => {
        if (event.candidate) {
            signalingServer.send(JSON.stringify({ type: 'candidate', meetingId, candidate: event.candidate }));
        }
    };
    peerConnection.ontrack = event => {
        remoteVideo.srcObject = event.streams[0];
    };
    peerConnection.oniceconnectionstatechange = () => {
        console.log('ICE connection state:', peerConnection.iceConnectionState);
        if (peerConnection.iceConnectionState === 'failed') {
            console.warn('ICE connection failed, attempting to restart');
            peerConnection.restartIce();
        }
    };
}

startCallButton.addEventListener('click', async () => {
    if (!meetingId) {
        console.warn('Meeting ID not set');
        return;
    }

    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localVideo.srcObject = localStream;

        createPeerConnection();
        localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        signalingServer.send(JSON.stringify({ type: 'offer', meetingId, offer }));

        console.log('Call started');
    } catch (error) {
        console.error('Error starting call:', error);
    }
});

endCallButton.addEventListener('click', () => {
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localVideo.srcObject = null;
        remoteVideo.srcObject = null;
    }
    console.log('Call ended');
});

joinMeetingButton.addEventListener('click', () => {
    meetingId = meetingIdInput.value.trim();
    if (!meetingId) {
        console.warn('Meeting ID is empty');
        return;
    }
    setupWebSocket();
});

// Automatically reconnect WebSocket if it closes
setInterval(() => {
    if (signalingServer && signalingServer.readyState === WebSocket.CLOSED) {
        console.log('WebSocket disconnected, attempting to reconnect...');
        setupWebSocket();
    }
}, 5000);
