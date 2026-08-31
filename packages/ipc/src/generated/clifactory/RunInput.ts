// Original file: proto/cli-host.proto

import type { Start as _clifactory_Start, Start__Output as _clifactory_Start__Output } from '../clifactory/Start.js';

export interface RunInput {
  'start'?: (_clifactory_Start | null);
  'stdin'?: (Buffer | Uint8Array | string);
  'payload'?: "start"|"stdin";
}

export interface RunInput__Output {
  'start'?: (_clifactory_Start__Output | null);
  'stdin'?: (Buffer);
  'payload'?: "start"|"stdin";
}
