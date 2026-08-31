// Original file: proto/cli-host.proto

import type { Exit as _clifactory_Exit, Exit__Output as _clifactory_Exit__Output } from '../clifactory/Exit.js';

export interface RunOutput {
  'stdout'?: (Buffer | Uint8Array | string);
  'stderr'?: (Buffer | Uint8Array | string);
  'exit'?: (_clifactory_Exit | null);
  'payload'?: "stdout"|"stderr"|"exit";
}

export interface RunOutput__Output {
  'stdout'?: (Buffer);
  'stderr'?: (Buffer);
  'exit'?: (_clifactory_Exit__Output | null);
  'payload'?: "stdout"|"stderr"|"exit";
}
