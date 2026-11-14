import 'dotenv/config';
import app from './app.js';

const port = process.env.PORT || 4000;

const server = app.listen(port, process.env.HOST || '127.0.0.1', (err) => {
  if (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
  process.parentPort?.postMessage("cpstudio:ready");
  console.log(`API running on http://localhost:${port}`);
});

server.on('error', (err) => {
  console.error('Server error:', err);
  process.exit(1);
});