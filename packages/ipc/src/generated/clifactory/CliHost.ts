// Original file: proto/cli-host.proto

import type * as grpc from '@grpc/grpc-js'
import type { MethodDefinition } from '@grpc/proto-loader'
import type { Control as _clifactory_Control, Control__Output as _clifactory_Control__Output } from '../clifactory/Control.js';
import type { HostStatus as _clifactory_HostStatus, HostStatus__Output as _clifactory_HostStatus__Output } from '../clifactory/HostStatus.js';
import type { RunInput as _clifactory_RunInput, RunInput__Output as _clifactory_RunInput__Output } from '../clifactory/RunInput.js';
import type { RunOutput as _clifactory_RunOutput, RunOutput__Output as _clifactory_RunOutput__Output } from '../clifactory/RunOutput.js';

export interface CliHostClient extends grpc.Client {
  Run(metadata: grpc.Metadata, options?: grpc.CallOptions): grpc.ClientDuplexStream<_clifactory_RunInput, _clifactory_RunOutput__Output>;
  Run(options?: grpc.CallOptions): grpc.ClientDuplexStream<_clifactory_RunInput, _clifactory_RunOutput__Output>;
  run(metadata: grpc.Metadata, options?: grpc.CallOptions): grpc.ClientDuplexStream<_clifactory_RunInput, _clifactory_RunOutput__Output>;
  run(options?: grpc.CallOptions): grpc.ClientDuplexStream<_clifactory_RunInput, _clifactory_RunOutput__Output>;

  Status(argument: _clifactory_Control, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_clifactory_HostStatus__Output>): grpc.ClientUnaryCall;
  Status(argument: _clifactory_Control, metadata: grpc.Metadata, callback: grpc.requestCallback<_clifactory_HostStatus__Output>): grpc.ClientUnaryCall;
  Status(argument: _clifactory_Control, options: grpc.CallOptions, callback: grpc.requestCallback<_clifactory_HostStatus__Output>): grpc.ClientUnaryCall;
  Status(argument: _clifactory_Control, callback: grpc.requestCallback<_clifactory_HostStatus__Output>): grpc.ClientUnaryCall;
  status(argument: _clifactory_Control, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_clifactory_HostStatus__Output>): grpc.ClientUnaryCall;
  status(argument: _clifactory_Control, metadata: grpc.Metadata, callback: grpc.requestCallback<_clifactory_HostStatus__Output>): grpc.ClientUnaryCall;
  status(argument: _clifactory_Control, options: grpc.CallOptions, callback: grpc.requestCallback<_clifactory_HostStatus__Output>): grpc.ClientUnaryCall;
  status(argument: _clifactory_Control, callback: grpc.requestCallback<_clifactory_HostStatus__Output>): grpc.ClientUnaryCall;

  Stop(argument: _clifactory_Control, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_clifactory_HostStatus__Output>): grpc.ClientUnaryCall;
  Stop(argument: _clifactory_Control, metadata: grpc.Metadata, callback: grpc.requestCallback<_clifactory_HostStatus__Output>): grpc.ClientUnaryCall;
  Stop(argument: _clifactory_Control, options: grpc.CallOptions, callback: grpc.requestCallback<_clifactory_HostStatus__Output>): grpc.ClientUnaryCall;
  Stop(argument: _clifactory_Control, callback: grpc.requestCallback<_clifactory_HostStatus__Output>): grpc.ClientUnaryCall;
  stop(argument: _clifactory_Control, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_clifactory_HostStatus__Output>): grpc.ClientUnaryCall;
  stop(argument: _clifactory_Control, metadata: grpc.Metadata, callback: grpc.requestCallback<_clifactory_HostStatus__Output>): grpc.ClientUnaryCall;
  stop(argument: _clifactory_Control, options: grpc.CallOptions, callback: grpc.requestCallback<_clifactory_HostStatus__Output>): grpc.ClientUnaryCall;
  stop(argument: _clifactory_Control, callback: grpc.requestCallback<_clifactory_HostStatus__Output>): grpc.ClientUnaryCall;

}

export interface CliHostHandlers extends grpc.UntypedServiceImplementation {
  Run: grpc.handleBidiStreamingCall<_clifactory_RunInput__Output, _clifactory_RunOutput>;

  Status: grpc.handleUnaryCall<_clifactory_Control__Output, _clifactory_HostStatus>;

  Stop: grpc.handleUnaryCall<_clifactory_Control__Output, _clifactory_HostStatus>;

}

export interface CliHostDefinition extends grpc.ServiceDefinition {
  Run: MethodDefinition<_clifactory_RunInput, _clifactory_RunOutput, _clifactory_RunInput__Output, _clifactory_RunOutput__Output>
  Status: MethodDefinition<_clifactory_Control, _clifactory_HostStatus, _clifactory_Control__Output, _clifactory_HostStatus__Output>
  Stop: MethodDefinition<_clifactory_Control, _clifactory_HostStatus, _clifactory_Control__Output, _clifactory_HostStatus__Output>
}
