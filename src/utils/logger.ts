import fs from 'fs';
import path from 'path';

export class Logger {
  private static logDir = path.resolve(process.cwd(), 'logs');
  private static logFile = path.join(Logger.logDir, 'app.log');

  static {
    if (!fs.existsSync(Logger.logDir)) {
      fs.mkdirSync(Logger.logDir, { recursive: true });
    }
  }

  private static formatTime(): string {
    const now = new Date();
    const YYYY = now.getFullYear();
    const MM = String(now.getMonth() + 1).padStart(2, '0');
    const DD = String(now.getDate()).padStart(2, '0');
    const HH = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    return `${YYYY}-${MM}-${DD} ${HH}:${mm}:${ss}`;
  }

  static info(message: string): void {
    const logLine = `[${this.formatTime()}] [INFO] ${message}`;
    console.log(logLine);
    fs.appendFileSync(this.logFile, logLine + '\n');
  }

  static error(message: string, error?: any): void {
    const logLine = `[${this.formatTime()}] [ERROR] ${message} ${error ? error.toString() : ''}`;
    console.error(logLine);
    fs.appendFileSync(this.logFile, logLine + '\n');
  }
}
