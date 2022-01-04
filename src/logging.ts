import { default as bunyan, default as Logger } from 'bunyan';

let logger: Logger = bunyan.createLogger({
  name: 'Default Logger',
});

function setGlobalLogger(newLogger: Logger) {
  logger = newLogger;
}

function getGlobalLogger(): Logger {
  return logger;
}

export default { setGlobalLogger, getGlobalLogger };
export { logger };
