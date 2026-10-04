const isWin = process.platform === 'win32';
const pythonScript = isWin ? '.venv/Scripts/python.exe' : '.venv/bin/python';

module.exports = {
  apps: [
    {
      name: 'samaj-api',
      script: 'java',
      args: '-jar target/samaj-drishti-api.jar',
      cwd: './backend-java',
      instances: 1,
      max_memory_restart: '512M',
      env: { PRODUCTION: '1' },
    },
    {
      name: 'samaj-ai',
      script: pythonScript,
      args: '-m uvicorn main:app --host 0.0.0.0 --port 5001',
      cwd: './ai-engine',
      instances: 1,
      max_memory_restart: '512M',
      env: { PRODUCTION: '1' },
    },
  ],
};
