import fs from 'fs';
import path from 'path';

const lockPath = path.resolve(process.cwd(), 'data', '.posting.lock');

function processIsRunning(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== 'ESRCH';
  }
}

export async function withPostingLock<T>(action: () => Promise<T>): Promise<T> {
  fs.mkdirSync(path.dirname(lockPath), { recursive: true });
  let handle: number;
  try {
    handle = fs.openSync(lockPath, 'wx');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    let ownerPid = 0;
    try {
      ownerPid = Number(fs.readFileSync(lockPath, 'utf-8').trim());
    } catch {
      // An interrupted process may leave an empty lock file.
    }
    if (!ownerPid && Date.now() - fs.statSync(lockPath).mtimeMs < 5_000) {
      throw new Error('Another posting process is starting');
    }
    if (processIsRunning(ownerPid)) throw new Error(`Another posting process is running (PID ${ownerPid})`);
    fs.unlinkSync(lockPath);
    handle = fs.openSync(lockPath, 'wx');
  }

  try {
    fs.writeSync(handle, String(process.pid));
    return await action();
  } finally {
    fs.closeSync(handle);
    if (fs.existsSync(lockPath) && fs.readFileSync(lockPath, 'utf-8').trim() === String(process.pid)) {
      fs.unlinkSync(lockPath);
    }
  }
}
