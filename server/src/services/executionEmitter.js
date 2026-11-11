import { EventEmitter } from 'node:events';

export function createExecutionEmitter(response) {
  const emitter = new EventEmitter();
  emitter.on('update', (event, data) => {
    if (!response.destroyed && !response.writableEnded) {
      response.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    }
  });
  return emitter;
}
