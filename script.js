const startCallButton = document.getElementById('startCall');
const endCallButton = document.getElementById('endCall');
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');

let localStream;
let peerConnection;
const configuration = { 'iceServers': [{ 'urls': 'stun:stun.l.google.com:19302' }] };
const signalingServerUrl = 'wss://videocalling-1nud.onrender.com/';
const signalingServer = new WebSocket(signalingServerUrl);

// WebSocket Event Handlers
signalingServer.onopen = () => {
    console.log('WebSocket connection established.');
};

signalingServer.onerror = (error) => {
    console.error('WebSocket Error:', error);
};

signalingServer.onclose = (event) => {
    if (event.wasClean) {
        console.log(`Connection closed cleanly, code=${event.code}, reason=${event.reason}`);
    } else {
        console.error('Connection died');
    }
};

startCallButton.addEventListener('click', async () => {
    try {
        console.log('Attempting to access media devices...');
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localVideo.srcObject = localStream;
        console.log('Media devices accessed successfully.');

        peerConnection = new RTCPeerConnection(configuration);
        localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
        
        peerConnection.onicecandidate = event => {
            if (event.candidate) {
                console.log('Sending ICE candidate:', event.candidate);
                signalingServer.send(JSON.stringify({ candidate: event.candidate }));
            }
        };
        
        peerConnection.ontrack = event => {
            console.log('Received remote stream:', event.streams[0]);
            remoteVideo.srcObject = event.streams[0];
        };

        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        console.log('Sending offer:', offer);
        signalingServer.send(JSON.stringify({ offer }));
    } catch (error) {
        console.error('Error accessing media devices:', error);
    }
});

endCallButton.addEventListener('click', () => {
    console.log('Ending call...');
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localVideo.srcObject = null;
        remoteVideo.srcObject = null;
    }
});

signalingServer.onmessage = async (message) => {
    let data;

    if (typeof message.data === 'string') {
        data = JSON.parse(message.data);
    } else if (message.data instanceof Blob) {
        const text = await message.data.text();
        data = JSON.parse(text);
    } else {
        console.error('Unexpected message format');
        return;
    }

    console.log('Received message:', data);

    if (data.offer) {
        console.log('Handling offer:', data.offer);
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        console.log('Sending answer:', answer);
        signalingServer.send(JSON.stringify({ answer }));
    } else if (data.answer) {
        console.log('Handling answer:', data.answer);
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
    } else if (data.candidate) {
        console.log('Handling ICE candidate:', data.candidate);
        await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
    }
};
