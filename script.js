const startCallButton = document.getElementById('startCall');
const endCallButton = document.getElementById('endCall');
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');

let localStream;
let peerConnection;
const configuration = { 'iceServers': [{ 'urls': 'stun:stun.l.google.com:19302' }] };
const signalingServerUrl = 'wss://videocalling-lcwm.onrender.com/';
const signalingServer = new WebSocket(signalingServerUrl);

startCallButton.addEventListener('click', async () => {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localVideo.srcObject = localStream;
        
        peerConnection = new RTCPeerConnection(configuration);
        localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
        
        peerConnection.onicecandidate = event => {
            if (event.candidate) {
                signalingServer.send(JSON.stringify({ candidate: event.candidate }));
            }
        };
        
        peerConnection.ontrack = event => {
            remoteVideo.srcObject = event.streams[0];
        };

        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        signalingServer.send(JSON.stringify({ offer }));
    } catch (error) {
        console.error('Error accessing media devices.', error);
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
});

signalingServer.onmessage = async (message) => {
    let data;
    
    if (typeof message.data === 'string') {
        // Handle text message
        data = JSON.parse(message.data);
    } else if (message.data instanceof Blob) {
        // Handle Blob message
        const text = await message.data.text();
        data = JSON.parse(text);
    } else {
        console.error('Unexpected message format');
        return;
    }

    if (data.offer) {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        signalingServer.send(JSON.stringify({ answer }));
    } else if (data.answer) {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
    } else if (data.candidate) {
        await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
    }
};
