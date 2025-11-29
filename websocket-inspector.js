/**
 * WebSocket Inspector Script
 * 
 * Führen Sie dieses Skript in der Browser-Konsole auf polymarket.com aus,
 * um die WebSocket-Verbindungen und Subscription-Nachrichten zu erfassen.
 * 
 * Anleitung:
 * 1. Öffnen Sie polymarket.com in Ihrem Browser
 * 2. Öffnen Sie die DevTools (F12)
 * 3. Gehen Sie zur Konsole
 * 4. Kopieren Sie diesen gesamten Code und fügen Sie ihn ein
 * 5. Drücken Sie Enter
 * 6. Navigieren Sie zu einem Markt (z.B. /event/btc-updown-15m-...)
 * 7. Die WebSocket-Verbindungen und Nachrichten werden in der Konsole geloggt
 */

(function() {
  const wsLogs = [];
  const originalWebSocket = window.WebSocket;
  
  window.WebSocket = function(...args) {
    const url = args[0];
    const ws = new originalWebSocket(...args);
    
    console.log('🔌 WebSocket erstellt:', url);
    wsLogs.push({
      url: url,
      timestamp: new Date().toISOString(),
      messages: []
    });
    
    // Intercept send
    const originalSend = ws.send.bind(ws);
    ws.send = function(data) {
      const message = typeof data === 'string' ? data : JSON.stringify(data);
      console.log('📤 WebSocket SEND:', url);
      console.log('   Nachricht:', message);
      
      try {
        const parsed = JSON.parse(message);
        console.log('   Parsed:', parsed);
      } catch (e) {
        // Not JSON, ignore
      }
      
      wsLogs[wsLogs.length - 1].messages.push({
        type: 'send',
        data: message,
        timestamp: new Date().toISOString()
      });
      
      return originalSend(data);
    };
    
    // Intercept messages
    ws.addEventListener('message', (event) => {
      const message = typeof event.data === 'string' ? event.data : JSON.stringify(event.data);
      console.log('📥 WebSocket MESSAGE:', url);
      console.log('   Nachricht:', message);
      
      try {
        const parsed = JSON.parse(message);
        console.log('   Parsed:', parsed);
      } catch (e) {
        // Not JSON, ignore
      }
      
      wsLogs[wsLogs.length - 1].messages.push({
        type: 'message',
        data: message,
        timestamp: new Date().toISOString()
      });
    });
    
    ws.addEventListener('open', () => {
      console.log('✅ WebSocket OPEN:', url);
    });
    
    ws.addEventListener('close', (event) => {
      console.log('🔌 WebSocket CLOSE:', url, {
        code: event.code,
        reason: event.reason,
        wasClean: event.wasClean
      });
    });
    
    ws.addEventListener('error', (error) => {
      console.error('❌ WebSocket ERROR:', url, error);
    });
    
    return ws;
  };
  
  // Copy static properties
  Object.setPrototypeOf(window.WebSocket, originalWebSocket);
  Object.setPrototypeOf(window.WebSocket.prototype, originalWebSocket.prototype);
  
  // Expose logs globally
  window.__wsLogs = wsLogs;
  
  console.log('✅ WebSocket Inspector installiert!');
  console.log('   Navigieren Sie zu einem Markt, um WebSocket-Verbindungen zu sehen.');
  console.log('   Alle Logs sind in window.__wsLogs gespeichert.');
  
  // Helper function to get CLOB market subscriptions
  window.getCLOBMarketSubscriptions = function() {
    return wsLogs
      .filter(log => log.url.includes('ws-subscriptions-clob.polymarket.com'))
      .map(log => ({
        url: log.url,
        subscriptions: log.messages.filter(m => m.type === 'send')
      }));
  };
  
  console.log('   Verwenden Sie getCLOBMarketSubscriptions() um CLOB Market Subscriptions zu sehen.');
})();

