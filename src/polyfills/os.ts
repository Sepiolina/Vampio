// Browser polyfill for Node.js 'os' module
export function platform(): string {
  return 'browser';
}

export function arch(): string {
  return 'javascript';
}

export function type(): string {
  return 'Browser';
}

export function release(): string {
  return '1.0.0';
}

export function homedir(): string {
  return '/';
}

export function tmpdir(): string {
  return '/tmp';
}

export function endianness(): string {
  return 'LE';
}

export function hostname(): string {
  return 'localhost';
}

export function uptime(): number {
  return 0;
}

export function freemem(): number {
  return 1024 * 1024 * 1024;
}

export function totalmem(): number {
  return 4 * 1024 * 1024 * 1024;
}

export function cpus(): unknown[] {
  return [];
}

export function networkInterfaces(): Record<string, unknown[]> {
  return {};
}

export const EOL = '\n';
export const constants = {
  UV_UDP_REUSEADDR: 4,
  signals: {},
  errno: {},
};

export default {
  platform,
  arch,
  type,
  release,
  homedir,
  tmpdir,
  endianness,
  hostname,
  uptime,
  freemem,
  totalmem,
  cpus,
  networkInterfaces,
  EOL,
  constants,
};
