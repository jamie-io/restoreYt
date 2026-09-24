import { isRecord } from './guards.js';

export interface RuntimeClientConfig {
  apiKey: string;
  clientName: string;
  clientVersion: string;
  visitorData: string | undefined;
}

export interface BuiltClientConfig {
  apiKey: string;
  context: {
    client: {
      clientName: string;
      clientVersion: string;
      visitorData?: string;
    };
  };
}

type YtcfgGetter = { get: (key: string) => unknown };

function readYtcfg(source: unknown, key: string): unknown {
  if (!isRecord(source)) return undefined;
  if (typeof source.get === 'function') {
    try {
      return (source as unknown as YtcfgGetter).get.call(source, key);
    } catch {
      return undefined;
    }
  }
  return source[key];
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function readString(source: unknown, key: string): string | undefined {
  return nonEmptyString(readYtcfg(source, key));
}

export function discoverRuntimeConfig(source: unknown): RuntimeClientConfig | null {
  const context = readYtcfg(source, 'INNERTUBE_CONTEXT');
  const client = isRecord(context) && isRecord(context.client) ? context.client : {};
  const apiKey = readString(source, 'INNERTUBE_API_KEY');
  const clientName = readString(source, 'INNERTUBE_CONTEXT_CLIENT_NAME') ?? nonEmptyString(client.clientName);
  const clientVersion = readString(source, 'INNERTUBE_CLIENT_VERSION') ?? nonEmptyString(client.clientVersion);
  const visitorData = readString(source, 'VISITOR_DATA') ?? nonEmptyString(client.visitorData);

  if (!apiKey || !clientName || !clientVersion) return null;
  return { apiKey, clientName, clientVersion, visitorData };
}

export function buildClientConfig(runtime: RuntimeClientConfig): BuiltClientConfig {
  const client = {
    clientName: runtime.clientName,
    clientVersion: runtime.clientVersion,
    ...(runtime.visitorData ? { visitorData: runtime.visitorData } : {}),
  };
  return { apiKey: runtime.apiKey, context: { client } };
}
