const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'events.json');

// Ensure data directory
const dataDir = path.dirname(DATA_FILE);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

function loadData() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch (e) {
    return [];
  }
}

function saveData(events) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(events, null, 2), 'utf-8');
}

const app = express();
app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

let events = loadData();

wss.on('connection', (ws) => {
  const clientId = Date.now() + '_' + Math.random().toString(36).slice(2, 8);
  console.log(`Client connected: ${clientId}`);

  // Send current data to the new client
  ws.send(JSON.stringify({ type: 'init', events, clientId }));

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());

      if (msg.type === 'update') {
        events = Array.isArray(msg.events) ? msg.events : [];
        saveData(events);

        // Broadcast to ALL other connected clients
        wss.clients.forEach((client) => {
          if (client !== ws && client.readyState === 1) {
            client.send(JSON.stringify({
              type: 'sync',
              events,
              source: clientId
            }));
          }
        });
      }
    } catch (e) {
      console.error('Invalid WebSocket message:', e.message);
    }
  });

  ws.on('close', () => {
    console.log(`Client disconnected: ${clientId}`);
  });

  ws.on('error', (err) => {
    console.error(`WebSocket error (${clientId}):`, err.message);
  });
});

server.listen(PORT, () => {
  console.log(`日程表协作版运行在 http://localhost:${PORT}`);
});
