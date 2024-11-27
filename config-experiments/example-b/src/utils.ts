import type { RawConfig, RawEnvironment } from 'wrangler';

type SnakeToCamelCase<T extends string> = T extends `${infer L}_${infer R}`
	? `${L}${Capitalize<SnakeToCamelCase<R>>}`
	: T;

type KeysToCamelCase<T extends Record<string, any>> = {
	[K in keyof T as SnakeToCamelCase<string & K>]: T[K];
};

type NormalizedRecord<T extends Record<string, any>> = Record<
	string,
	Omit<KeysToCamelCase<T>, 'binding'>
>;

type Defined<T> = Exclude<T, undefined>;

interface Resources extends Record<string, any> {
	analyticsEngineDatasets?: NormalizedRecord<
		Defined<RawEnvironment['analytics_engine_datasets']>[number]
	>;
	d1Databases?: NormalizedRecord<
		Defined<RawEnvironment['d1_databases']>[number]
	>;
	// dispatchNamespaces
	hyperdrive?: NormalizedRecord<Defined<RawEnvironment['hyperdrive']>[number]>;
	kvNamespaces?: NormalizedRecord<
		Defined<RawEnvironment['kv_namespaces']>[number]
	>;
	mtlsCertificates?: NormalizedRecord<
		Defined<RawEnvironment['mtls_certificates']>[number]
	>;
	r2Buckets?: NormalizedRecord<Defined<RawEnvironment['r2_buckets']>[number]>;
	sendEmail?: NormalizedRecord<Defined<RawEnvironment['send_email']>[number]>;
	vars?: Defined<RawEnvironment['vars']>;
	vectorize?: NormalizedRecord<Defined<RawEnvironment['vectorize']>[number]>;
}

type Environment = {
	accountId?: Defined<RawEnvironment['account_id']>;
} & Resources;

type Environments = Record<string, Environment>;

interface Worker<TEnvironmentNames extends string | undefined> {
	build: {
		module: Record<string, any>;
		compatibilityDate: `${string}-${string}-${string}`;
		compatibilityFlags?: Array<'nodejs_compat'>;
	};
	runtime?: (environment: TEnvironmentNames) => {
		limits?: KeysToCamelCase<Defined<RawEnvironment['limits']>>;
		logpush?: Defined<RawEnvironment['logpush']>;
		observability?: KeysToCamelCase<Defined<RawEnvironment['observability']>>;
		// queueConsumers
		// route
		// routes
		triggers?: KeysToCamelCase<Defined<RawEnvironment['triggers']>>;
	};
}

interface Constructor<T> {
	new (...args: any[]): T;
}

declare const __resource: unique symbol;
declare const __worker: unique symbol;

interface ResourceDefinition<TType extends string> {
	[__resource]: never;
	type: TType;
}

interface WorkerDefinition<
	TWorkerName extends string,
	TEntrypoint extends string,
> {
	[__worker]: never;
	workerName: TWorkerName;
	entrypoint: TEntrypoint;
}

export function defineConfig<
	TEnvironments extends Environments,
	TWorkers extends Record<
		string,
		Worker<{} extends TEnvironments ? undefined : string & keyof TEnvironments>
	>,
>(config: { environments?: TEnvironments; workers?: TWorkers }) {
	type Resources = { [__resource]: never } & {
		[TBindingType in keyof TEnvironments[keyof TEnvironments]]: {
			[TBindingName in keyof TEnvironments[keyof TEnvironments][TBindingType]]: ResourceDefinition<
				string & TBindingType
			>;
		};
	};

	type Workers = {
		[TWorkerName in keyof TWorkers]: {
			[K in keyof TWorkers[TWorkerName]['build']['module']]: WorkerDefinition<
				string & TWorkerName,
				string & K
			>;
		};
	};

	return {} as {
		defineBindings: <
			TBindings extends Record<
				string,
				ResourceDefinition<string> | WorkerDefinition<string, string>
			>,
		>(
			config: (values: { resources: Resources; workers: Workers }) => TBindings,
		) => {
			[TBindingName in keyof TBindings]: TBindings[TBindingName] extends infer TBinding
				? TBinding extends ResourceDefinition<infer TResourceType>
					? TResourceType extends 'kvNamespaces'
						? KVNamespace
						: never
					: TBinding extends WorkerDefinition<
								infer TWorkerName,
								infer TEntrypoint
						  >
						? TWorkers[TWorkerName]['build']['module'][TEntrypoint] extends infer TExport
							? TExport extends Constructor<Rpc.DurableObjectBranded>
								? DurableObjectNamespace<InstanceType<TExport>>
								: TExport extends Constructor<Rpc.WorkerEntrypointBranded>
									? Service<InstanceType<TExport>>
									: Service
							: never
						: never
				: never;
		};
	};
}
