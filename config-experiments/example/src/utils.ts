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
	vars?: RawEnvironment['vars'];
	vectorize?: NormalizedRecord<Defined<RawEnvironment['vectorize']>[number]>;
}

type Environment = {
	accountId?: Defined<RawEnvironment['account_id']>;
} & Resources;

type Environments = Record<string, Environment>;

type Definitions = Record<string, Record<string, any>>;

interface Binding<
	TBindingType extends string = string,
	TBindingName extends string = string,
> {
	type: TBindingType;
	name: TBindingName;
}

type Bindings<T extends Definitions = Definitions> = {
	[TBindingType in string & keyof T]: {
		[TBindingName in string & keyof T[TBindingType]]: Binding<
			TBindingType,
			TBindingName
		>;
	};
};

interface Worker<
	TEnvironmentNames extends string | undefined,
	TBindings extends Bindings,
> {
	build: {
		// compatibilityDate: RawEnvironment['compatibility_date']; // use narrower types
		compatibilityDate: `${string}-${string}-${string}`;
		// compatibilityFlags?: RawEnvironment['compatibility_flags']; // use narrower types
		compatibilityFlags?: Array<'nodejs_compat'>;
		main: RawEnvironment['main'];
	};
	runtime?: (environment: TEnvironmentNames) => {
		limits?: KeysToCamelCase<Defined<RawEnvironment['limits']>>;
		logpush?: RawEnvironment['logpush'];
		observability?: KeysToCamelCase<Defined<RawEnvironment['observability']>>;
		// queueConsumers
		// route
		// routes
		triggers?: KeysToCamelCase<Defined<RawEnvironment['triggers']>>;
	};
	bindings?: (resources: TBindings) => Record<string, Binding>;
}

type Services<TWorkerNames extends string = string> = Record<
	string,
	{ service: TWorkerNames }
>;

interface Config<
	TWorkerNames extends string,
	TEnvironments extends Environments = {},
	TServices extends Services<TWorkerNames> = {},
	TEnvironmentNames extends string | undefined = {} extends TEnvironments
		? undefined
		: string & keyof TEnvironments,
	TResources extends Definitions = Omit<
		TEnvironments[keyof TEnvironments],
		'accountId'
	>,
	TBindings extends Bindings = Bindings<TResources> &
		Bindings<{} extends TServices ? {} : { services: TServices }>,
> {
	keepVars?: RawConfig['keep_vars'];
	sendMetrics?: RawConfig['send_metrics'];
	environments?: TEnvironments;
	services?: TServices;
	// durableObjects
	// queueProducers
	// workflows
	workers?: Record<TWorkerNames, Worker<TEnvironmentNames, TBindings>>;
	exports?: (resources: TBindings) => Binding[];
}

export function defineConfig<
	TWorkerNames extends string,
	TEnvironments extends Environments,
	TServices extends Services<TWorkerNames>,
>(config: Config<TWorkerNames, TEnvironments, TServices>) {}
