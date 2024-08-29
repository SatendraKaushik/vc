// Establish WebSocket connection
const signalingServer = new WebSocket('wss://videocalling-1nud.onrender.com/');
const peerConnection = new RTCPeerConnection();

// When the signaling server connects
signalingServer.onopen = () => {
    console.log('WebSocket connection established');
};

// When the signaling server receives a message
signalingServer.onmessage = async (message) => {
    const data = JSON.parse(message.data);

    if (data.offer) {
        if (peerConnection.signalingState === "stable") {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            signalingServer.send(JSON.stringify({ answer }));
        } else {
            console.error("Received offer in wrong state: ", peerConnection.signalingState);
        }
    } else if (data.answer) {
        if (peerConnection.signalingState === "have-local-offer") {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
        } else {
            console.error("Received answer in wrong state: ", peerConnection.signalingState);
        }
    } else if (data.candidate) {
        await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
    }
};

// When ICE candidates are discovered, send them to the signaling server
peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
        signalingServer.send(JSON.stringify({ candidate: event.candidate }));
    }
};

// Handle receiving remote stream
peerConnection.ontrack = (event) => {
    const remoteVideo = document.getElementById('remoteVideo');
    remoteVideo.srcObject = event.streams[0];
    console.log('Received remote track:', event.streams[0]);
};

// Start a call
document.getElementById('startButton').addEventListener('click', async () => {
    const localVideo = document.getElementById('localVideo');
    const localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideo.srcObject = localStream;

    localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
    });

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    signalingServer.send(JSON.stringify({ offer }));
    console.log('Call started');
});

// End a call
document.getElementById('endButton').addEventListener('click', () => {
    peerConnection.close();
    console.log('Call ended');
});

// When the signaling server closes
signalingServer.onclose = () => {
    console.log('WebSocket connection closed');
};

// Error handling for signaling server
signalingServer.onerror = (error) => {
    console.error('WebSocket error:', error);
};
