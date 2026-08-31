import type * as grpc from '@grpc/grpc-js';
import type { MessageTypeDefinition } from '@grpc/proto-loader';

import type { CliHostClient as _clifactory_CliHostClient, CliHostDefinition as _clifactory_CliHostDefinition } from './clifactory/CliHost.js';
import type { Control as _clifactory_Control, Control__Output as _clifactory_Control__Output } from './clifactory/Control.js';
import type { Exit as _clifactory_Exit, Exit__Output as _clifactory_Exit__Output } from './clifactory/Exit.js';
import type { HostStatus as _clifactory_HostStatus, HostStatus__Output as _clifactory_HostStatus__Output } from './clifactory/HostStatus.js';
import type { RunInput as _clifactory_RunInput, RunInput__Output as _clifactory_RunInput__Output } from './clifactory/RunInput.js';
import type { RunOutput as _clifactory_RunOutput, RunOutput__Output as _clifactory_RunOutput__Output } from './clifactory/RunOutput.js';
import type { Start as _clifactory_Start, Start__Output as _clifactory_Start__Output } from './clifactory/Start.js';

type SubtypeConstructor<Constructor extends new (...args: any) => any, Subtype> = {
  new(...args: ConstructorParameters<Constructor>): Subtype;
};

export interface ProtoGrpcType {
  clifactory: {
    CliHost: SubtypeConstructor<typeof grpc.Client, _clifactory_CliHostClient> & { service: _clifactory_CliHostDefinition }
    Control: MessageTypeDefinition<_clifactory_Control, _clifactory_Control__Output>
    Exit: MessageTypeDefinition<_clifactory_Exit, _clifactory_Exit__Output>
    HostStatus: MessageTypeDefinition<_clifactory_HostStatus, _clifactory_HostStatus__Output>
    RunInput: MessageTypeDefinition<_clifactory_RunInput, _clifactory_RunInput__Output>
    RunOutput: MessageTypeDefinition<_clifactory_RunOutput, _clifactory_RunOutput__Output>
    Start: MessageTypeDefinition<_clifactory_Start, _clifactory_Start__Output>
  }
}
