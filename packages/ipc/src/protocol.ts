import {
  loadPackageDefinition,
  credentials,
  type ChannelOptions,
} from "@grpc/grpc-js";
import { loadSync } from "@grpc/proto-loader";
import { fileURLToPath } from "node:url";
import type { ProtoGrpcType } from "./generated/cli-host.js";

const loaded = loadPackageDefinition(
  loadSync(fileURLToPath(new URL("../cli-host.proto", import.meta.url)), {
    oneofs: true,
    defaults: true,
  }),
) as unknown as ProtoGrpcType;
export const CliHost = loaded.clifactory.CliHost;
export const protocol = "1";
export const chunkBytes = 16_384;
export const bufferBytes = 1_048_576;
export const channelOptions: ChannelOptions = {
  "grpc.enable_retries": 0,
  "grpc.max_send_message_length": 65_536,
  "grpc.max_receive_message_length": 65_536,
};
export const connect = (endpoint: string) =>
  new CliHost(endpoint, credentials.createInsecure(), channelOptions);
