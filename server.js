const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

let gameState = {
  phase: 'waiting', // waiting, prompting, physics, ended
  timer: 15,
  challenge: 'Build a bridge across the lava gap!',
  players: {},
  objects: []
};

// Game Loop Timer
setInterval(() => {
  if (gameState.phase === 'prompting') {
    gameState.timer--;
    if (gameState.timer <= 0) {
      gameState.phase = 'physics';
      gameState.timer = 5; // 5 seconds of physics chaos
      io.emit('game-update', gameState);
    }
  } else if (gameState.phase === 'physics') {
    gameState.timer--;
    if (gameState.timer <= 0) {
      // Reset for next round
      gameState.phase = 'prompting';
      gameState.timer = 15;
      gameState.challenge = getRandomChallenge();
      gameState.objects = [];
      io.emit('game-update', gameState);
    }
  }
  io.emit('timer-tick', { timer: gameState.timer, phase: gameState.phase });
}, 1000);

function getRandomChallenge() {
  const challenges = [
    'Build a bridge across the lava gap!',
    'Create a roof to block the falling meteors!',
    'Build a tall tower to escape rising toxic sludge!'
  ];
  return challenges[Math.floor(Math.random() * challenges.length)];
}

// Start first round when first player joins
io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);
  
  gameState.players[socket.id] = { id: socket.id, x: Math.random() * 20 - 10, z: 0, score: 0 };
  
  if (gameState.phase === 'waiting' && Object.keys(gameState.players).length >= 1) {
    gameState.phase = 'prompting';
  }

  socket.emit('init', gameState);
  io.emit('players-update', gameState.players);

  // Handle player submitting a prompt/object
  socket.on('submit-prompt', (promptText) => {
    if (gameState.phase !== 'prompting') return;

    let objType = 'box';
    let mass = 5;
    let scale = { x: 2, y: 1, z: 2 };

    const lower = promptText.toLowerCase();
    if (lower.includes('bridge') || lower.includes('plank')) {
      scale = { x: 6, y: 0.5, z: 2 };
    } else if (lower.includes('heavy') || lower.includes('wall')) {
      mass = 50;
      scale = { x: 3, y: 3, z: 1 };
    } else if (lower.includes('balloon') || lower.includes('feather')) {
      mass = 0.1;
    }

    const newObj = {
      id: Math.random().toString(),
      playerId: socket.id,
      prompt: promptText,
      type: objType,
      x: gameState.players[socket.id].x,
      y: 10, // Drop from sky
      z: gameState.players[socket.id].z,
      mass: mass,
      scale: scale
    };

    gameState.objects.push(newObj);
    io.emit('object-spawned', newObj);
  });

  socket.on('disconnect', () => {
    delete gameState.players[socket.id];
    io.emit('players-update', gameState.players);
  });
});

server.listen(3000, () => {
  console.log('Prompt-Battle server running at http://localhost:3000');
});
