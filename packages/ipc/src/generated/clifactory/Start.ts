// Original file: proto/cli-host.proto


export interface Start {
  'argv'?: (string)[];
  'protocol'?: (string);
  'build'?: (string);
  'cwd'?: (string);
  'environment'?: ({[key: string]: string});
}

export interface Start__Output {
  'argv': (string)[];
  'protocol': (string);
  'build': (string);
  'cwd': (string);
  'environment': ({[key: string]: string});
}
