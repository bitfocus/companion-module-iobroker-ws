import { InstanceBase, InstanceStatus, runEntrypoint, SomeCompanionConfigField } from '@companion-module/base'
import { GetConfigFields, type ModuleConfig } from './config.js'
import { UpdateVariableDefinitions } from './variables.js'
import { UpgradeScripts } from './upgrades.js'
import { UpdateActions } from './actions.js'
import { UpdateFeedbacks } from './feedbacks.js'
import { UpdatePresets } from './presets.js'

import { Connection } from '@iobroker/socket-client-backend'
import { EntitySubscriptions } from './state.js'

import debounceFn, { DebouncedFunction } from 'debounce-fn'

import { FeedbackId } from './feedback.js'
import { IobPushApi } from './push-events.js'

import { isValidIobObject } from './utils.js'
import { DeviceClassifier } from './device-classifier.js'

export class ModuleInstance extends InstanceBase<ModuleConfig> implements IobPushApi {
	config!: ModuleConfig // Setup in init()

	private readonly entitySubscriptions: EntitySubscriptions

	private iobObjectDetails: ioBroker.Object[] | null = null
	private iobStateById: Map<string, ioBroker.State> = new Map<string, ioBroker.State>()
	private deviceClassifier: DeviceClassifier | null = null

	private subscribedEntityIds: string[] | null = null

	private connectPromise: Promise<boolean> | null = null
	private connected: boolean = false

	private client: Connection | null = null

	private touchLastChangedFeedbacksTimeout: NodeJS.Timeout | null = null

	private readonly onSubscriptionChange: DebouncedFunction<[], Promise<void> | undefined>

	constructor(internal: unknown) {
		super(internal)

		this.onSubscriptionChange = debounceFn(this.subscribeToIobStates.bind(this), {
			wait: 10,
			maxWait: 50,
			before: false,
			after: true,
		})

		this.entitySubscriptions = new EntitySubscriptions(
			this.onSubscriptionChange,
			this.getSubscribedIobIds.bind(this),
			this.getDeviceClassifier.bind(this),
		)

		this.onStateValueChange = this.onStateValueChange.bind(this)
	}

	private ensureClient(client: Connection | null): client is Connection {
		return client !== null && this.connected
	}

	private getSubscribedIobIds(): string[] {
		return this.subscribedEntityIds ?? []
	}

	private getDeviceClassifier(): DeviceClassifier {
		return this.deviceClassifier ?? new DeviceClassifier([])
	}

	public async toggleState(iobId: string): Promise<void> {
		this.log('debug', `Toggled state ${iobId}.`)

		if (!this.ensureClient(this.client)) {
			return
		}

		const isBoolState = (state: ioBroker.Object | null | undefined): boolean => {
			return !!state && state.common.type === 'boolean'
		}

		const oldState = await this.client.getObject(iobId)

		if (!isBoolState(oldState)) {
			return
		}

		const oldVal = await this.client.getState(iobId)

		if (!oldVal || (oldVal.val !== true && oldVal.val !== false)) {
			return
		}

		const newVal = !oldVal.val
		await this.client.setState(iobId, newVal)
	}

	public async sendMessage(instance: string, command: string, data?: unknown): Promise<void> {
		if (!this.ensureClient(this.client)) {
			return
		}

		const startMs = Date.now()
		this.log('debug', `Invoking command ${instance}::${command}.`)
		await this.client.sendTo(instance, command, data)
		this.log('info', `Finished command ${instance}::${command} in ${Date.now() - startMs}ms.`)
	}

	public checkFeedbacks(...feedbackTypes: FeedbackId[]): void {
		super.checkFeedbacks(...feedbackTypes)
	}

	private getObjectSubscriptions(): string[] {
		const namespaces = this.config.additionalNamespaces
			.split(',')
			.map((i) => i.trim())
			.filter((i) => i.length > 0)
			.map((i) => `${i}.*`)

		if (this.config.loadAllAliases) {
			namespaces.push('alias.*')
		}

		// TODO: This code can lead to a user specifying namespace overlaps which would subscribe to the
		// same object multiple times.
		// Since the objects form a tree we can detect this and ignore sub-subscriptions.

		this.log('debug', `Determined subscriptions: [${namespaces.join(', ')}].`)
		return namespaces
	}

	async init(config: ModuleConfig): Promise<void> {
		this.config = config

		this.log('info', `Trying to connect to ${config.protocol}://${config.host}:${config.port} ...`)

		this.connected = await this.tryConnectAsync()

		if (!this.connected || !this.client) {
			return
		}
		await this.loadIobObjectsAsync()

		if (!!this.iobObjectDetails && this.iobObjectDetails.length > 0) {
			this.updateActions(this.iobObjectDetails)
			this.updateFeedbacks(this.iobObjectDetails)
		}

		this.updatePresets()
		this.updateVariableDefinitions()

		await this.configUpdated(this.config)
	}

	private async loadIobObjectsAsync(): Promise<ioBroker.Object[]> {
		if (!this.ensureClient(this.client)) {
			return []
		}

		const loadAllStateDetails = (
			client: Connection,
			states: Record<string, ioBroker.State>,
		): ioBroker.GetObjectPromise<string>[] => {
			return Object.keys(states).map(async (stateId) => client.getObject(stateId))
		}

		const startMs = Date.now()
		const subscriptions = this.getObjectSubscriptions()

		const states = (await Promise.all(subscriptions.map(async (s) => this.client!.getStates(s)))).reduce(
			(prev, curr) => ({ ...prev, ...curr }),
			{},
		)

		const stateInfo = await Promise.all(loadAllStateDetails(this.client, states))

		this.iobObjectDetails = stateInfo.filter(isValidIobObject)

		this.log(
			'debug',
			`Retrieved ${this.iobObjectDetails.length} (${Object.keys(states).length}) states from ${subscriptions.length} subscriptions in ${Date.now() - startMs}ms.`,
		)

		this.deviceClassifier = new DeviceClassifier(this.iobObjectDetails)
		return this.iobObjectDetails
	}

	// When module gets deleted
	async destroy(): Promise<void> {
		try {
			await this.disconnectAsync()
		} catch (_e) {
			// Ignore
		}

		this.clearTimeouts()

		this.iobStateById = new Map<string, ioBroker.State>()

		this.log('debug', `destroy ${this.id}`)
	}

	private clearTimeouts(): void {
		if (this.touchLastChangedFeedbacksTimeout) {
			clearInterval(this.touchLastChangedFeedbacksTimeout)
		}
	}

	private async tryConnectAsync(): Promise<boolean> {
		const connectInternal = async () => {
			this.updateStatus(InstanceStatus.Connecting)

			this.client = new Connection({
				protocol: this.config.protocol,
				host: this.config.host,
				port: this.config.port,
				doNotLoadAllObjects: true,
				doNotLoadACL: true,
				onLog: (_) => null,
			})

			try {
				await this.client.startSocket()
				await this.client.waitForFirstConnection()

				this.updateStatus(InstanceStatus.Ok)

				return true
			} catch (err: unknown) {
				this.client = null

				const errorMsg = typeof err === 'string' ? err : JSON.stringify(err)

				this.updateStatus(InstanceStatus.UnknownError, errorMsg)

				this.log('error', `Connect failed: ${errorMsg}`)

				return false
			} finally {
				this.connectPromise = null
			}
		}

		this.connectPromise ??= connectInternal()
		return await this.connectPromise
	}

	private async disconnectAsync(): Promise<void> {
		if (!this.client || !this.connected) {
			return
		}

		try {
			if (!!this.subscribedEntityIds && this.subscribedEntityIds.length > 0) {
				this.log('debug', `Unsubscribing from ${this.subscribedEntityIds.length} iob entities.`)
				this.client.unsubscribeState(this.subscribedEntityIds)
			}
		} catch (_err) {
			// Ignored
		}

		this.client = null
		this.connected = false
	}

	async configUpdated(config: ModuleConfig): Promise<void> {
		this.log('debug', 'Received config update.')

		this.config = config

		this.iobStateById = new Map<string, ioBroker.State>()

		await this.disconnectAsync()

		this.connected = await this.tryConnectAsync()

		if (!this.client || !this.connected) {
			this.log('debug', 'Either client is null or connected false. Stopping config update.')
			return
		}

		this.entitySubscriptions.clear()

		this.log('debug', 'Subscribing feedbacks.')
		this.subscribeFeedbacks()
	}

	async subscribeToIobStates(): Promise<void> {
		if (!this.client) {
			this.log('warn', 'The callback to subscribe to states was called, but no iob-ws client is available.')
			return
		}

		const previousSubscribedEntityIds: string[] = this.subscribedEntityIds ?? []
		this.subscribedEntityIds = this.entitySubscriptions.getEntityIds()

		const removed = previousSubscribedEntityIds.filter((eId) => !(this.subscribedEntityIds ?? []).includes(eId))
		const added = (this.subscribedEntityIds ?? []).filter((eId) => !previousSubscribedEntityIds.includes(eId))

		if (removed.length === 0 && added.length === 0) {
			// this.log('debug', 'No changes to subscribed entities.')
			return
		}

		this.log('debug', `Unsubscribing from ${this.subscribedEntityIds.length} iob entities.`)
		this.client.unsubscribeState(this.subscribedEntityIds)

		this.clearTimeouts()

		this.log('info', `Subscribing to ${this.subscribedEntityIds.length} ioBroker entities.`)
		this.log('debug', `Removed: [${removed.join(', ')}] Added: [${added.join(', ')}]`)

		await this.client.subscribeState(this.subscribedEntityIds, false, this.onStateValueChange.bind(this))

		this.touchLastChangedFeedbacksTimeout = setInterval(this.checkLastChangedFeedbacks.bind(this), 1_000)
	}

	private checkLastChangedFeedbacks() {
		this.checkFeedbacks(FeedbackId.ReadLastUpdated)
	}

	async onStateValueChange(id: string, obj: ioBroker.State | null | undefined): Promise<void> {
		this.log('debug', `Received event for id ${id} -> Value: ${obj?.val ?? 'N/A'}`)
		if (!obj) {
			return
		}

		this.iobStateById.set(id, obj)

		const feedbackIds = this.entitySubscriptions.getFeedbackInstanceIds(id)

		this.checkFeedbacksById(...feedbackIds)
	}

	getConfigFields(): SomeCompanionConfigField[] {
		return GetConfigFields()
	}

	updateActions(iobObjects: ioBroker.Object[]): void {
		UpdateActions(this, this, iobObjects, this.getDeviceClassifier())
	}

	updateFeedbacks(iobObjects: ioBroker.Object[]): void {
		UpdateFeedbacks(
			this,
			iobObjects,
			this.getDeviceClassifier.bind(this),
			() => this.iobStateById,
			this.entitySubscriptions,
		)
	}

	updatePresets(): void {
		UpdatePresets(this)
	}

	updateVariableDefinitions(): void {
		UpdateVariableDefinitions(this)
	}
}

runEntrypoint(ModuleInstance, UpgradeScripts)
