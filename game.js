const { v4: uuidv4 } = require('uuid');

module.exports = function(server) {
    const io = require('socket.io')(server);

    var rooms = [];

    io.on('connection', function(socket) {
        console.log('사용자가 연결 되었습니다.');

        if (rooms.length > 0) {
            var roomId = rooms.shift();
            socket.join(roomId);
            socket.emit('joinRoom', { roomId: roomId });
        
            // 여기서 실행 순서 보장
            setTimeout(() => {
                socket.to(roomId).emit('startGame', { userId: socket.id });
            }, 100);
        } else {
            var roomId = uuidv4();
            socket.join(roomId);
            socket.emit('createRoom', { roomId: roomId });
            rooms.push(roomId);
        }        

        socket.on('leaveRoom', function(data) {
            var roomId = data.roomId;
            socket.leave(roomId);
        
            // rooms 배열에서 제거
            const idx = rooms.indexOf(roomId);
            if (idx !== -1) {
                rooms.splice(idx, 1);
            }
        
            socket.emit('leaveRoom', { roomId: roomId });
            socket.to(roomId).emit('gameEnded', { userId: socket.id });
        });               

        socket.on('sendMessage', function(message) {
            if (!message.roomId || !message.nickName || !message.message) {
                console.error("잘못된 메시지 형식입니다:", message);
                return;
            }
        
            console.log(`메시지를 받았습니다: ${message.roomId} ${message.nickName} : ${message.message}`);
            socket.to(message.roomId).emit('receiveMessage', { nickName: message.nickName, message: message.message });
        });
        

        socket.on('disconnect', function() {
            console.log('사용자가 연결을 끊었습니다.');

            var socketRooms = Array.from(socket.rooms).filter(room => room !== socket.id);

            socketRooms.forEach(function(roomId) {
                socket.to(roomId).emit('gameEnded', { userId: socket.id })
                
                const roomInfo = io.sockets.adapter.rooms.get(roomId);
                const roomSize = roomInfo ? roomInfo.size : 0; // roomId가 존재하는 경우에만 size 체크
                if (roomSize <= 1) {
                    const idx = rooms.indexOf(roomId);
                    if (idx !== -1) {
                        rooms.splice(idx, 1);
                    }
                }
            });
        });
    });
}