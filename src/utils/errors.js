export class ClientNotFoundError extends Error {
  constructor(name) {
    super(`Client "${name}" not found. Run: n8n-manager client list`);
    this.name = 'ClientNotFoundError';
  }
}

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

export function handleCommandError(err) {
  if (err.name === 'ClientNotFoundError') {
    console.error(`\x1b[31mError:\x1b[0m ${err.message}`);
  } else if (err.name === 'ApiError') {
    console.error(`\x1b[31mAPI Error ${err.status}:\x1b[0m ${err.message}`);
    if (err.data) {
      console.error(JSON.stringify(err.data, null, 2));
    }
  } else {
    console.error(`\x1b[31mError:\x1b[0m ${err.message}`);
  }
  process.exit(1);
}
