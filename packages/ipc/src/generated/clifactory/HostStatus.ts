// Original file: proto/cli-host.proto


export interface HostStatus {
  'pid'?: (number);
  'build'?: (string);
  'closing'?: (boolean);
}

export interface HostStatus__Output {
  'pid': (number);
  'build': (string);
  'closing': (boolean);
}
