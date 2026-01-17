import 'reflect-metadata'

import { InstanceBase, runEntrypoint, SomeCompanionConfigField } from '@companion-module/base'
import { GetConfigFields, type ModuleConfig } from './config.js'
import { UpdateVariableDefinitions } from './variables.js'
import { UpgradeScripts } from './upgrades.js'
import { UpdatePresets } from './presets.js'

import { FeedbackType } from './feedback-type.js'

import { DeviceClassifier } from './device-classifier.js'
import { DependencyRegistry } from './dependency-injection/dependency-registry.js'
import { DependencyContainer } from 'tsyringe'
import { IoBrokerWsClient } from './io-broker/io-broker-ws-client.js'
import { IActionConfiguration, IFeedbackConfiguration, ILogger } from './types.js'
import { DiTokens } from './dependency-injection/tokens.js'

export class ModuleInstance extends InstanceBase<ModuleConfig> {
	config!: ModuleConfig // Setup in init()

	private readonly _diContainer: DependencyContainer

	private touchLastChangedFeedbacksTimeout: NodeJS.Timeout | null = null

	constructor(internal: unknown) {
		super(internal)

		this._diContainer = DependencyRegistry.CreateRegistry(this, this.getConfig.bind(this)).Build()
	}

	public checkFeedbacks(...feedbackTypes: FeedbackType[]): void {
		super.checkFeedbacks(...feedbackTypes)
	}

	public checkFeedbacksByIdAsCb(feedbackIds: string[]): void {
		super.checkFeedbacksById(...feedbackIds)
	}

	async init(config: ModuleConfig): Promise<void> {
		this.config = config

		const wsClient = await this.getIobWsClient().connectAsync(this.updateStatus.bind(this))
		wsClient.setFeedbackCheckCb(this.checkFeedbacksByIdAsCb.bind(this))

		await wsClient.loadIobObjectsAsync()

		this.updateModuleConfigurations()

		this.touchLastChangedFeedbacksTimeout = setInterval(this.checkLastChangedFeedbacks.bind(this), 1_000)

		this.subscribeFeedbacks()
	}

	// When module gets deleted
	async destroy(): Promise<void> {
		try {
			await this.disconnectAsync()
			await this._diContainer.dispose()
		} catch (_e) {
			// Ignore
		}

		this.clearTimeouts()

		this.log('debug', `destroy ${this.id}`)
	}

	private clearTimeouts(): void {
		if (this.touchLastChangedFeedbacksTimeout) {
			clearInterval(this.touchLastChangedFeedbacksTimeout)
		}
	}

	private async disconnectAsync(): Promise<void> {
		const wsClient = this.getIobWsClient()
		if (!wsClient.isConnected()) {
			return
		}

		await wsClient.disconnectAsync(this.updateStatus.bind(this))
	}

	async configUpdated(config: ModuleConfig): Promise<void> {
		this.log('debug', 'Received config update.')

		this.config = config
		this.getLogger().configUpdated()

		this.getDeviceClassifier().clear()
		await this.disconnectAsync()

		await this.init(config)
	}

	private checkLastChangedFeedbacks() {
		this.checkFeedbacks(FeedbackType.ReadLastUpdated)
	}

	getConfig(): ModuleConfig {
		return this.config
	}

	getConfigFields(): SomeCompanionConfigField[] {
		return GetConfigFields()
	}

	updateActions(): void {
		this.getActionConfiguration().updateActions(this.setActionDefinitions.bind(this))
	}

	updateFeedbacks(): void {
		this.getFeedbackConfiguration().updateFeedbacks(this.setFeedbackDefinitions.bind(this))
	}

	updatePresets(): void {
		UpdatePresets(this)
	}

	updateVariableDefinitions(): void {
		UpdateVariableDefinitions(this)
	}

	updateModuleConfigurations(): void {
		this.updateActions()
		this.updateFeedbacks()
		this.updatePresets()
		this.updateVariableDefinitions()
	}

	// DI ACCESSORS
	private getIobWsClient(): IoBrokerWsClient {
		return this._diContainer.resolve(IoBrokerWsClient)
	}

	private getLogger(): ILogger {
		return this._diContainer.resolve(DiTokens.Logger)
	}

	private getDeviceClassifier(): DeviceClassifier {
		return this._diContainer.resolve(DeviceClassifier)
	}

	private getActionConfiguration(): IActionConfiguration {
		return this._diContainer.resolve(DiTokens.ActionConfiguration)
	}

	private getFeedbackConfiguration(): IFeedbackConfiguration {
		return this._diContainer.resolve(DiTokens.FeedbackConfiguration)
	}
	// DI ACCESSORS
}

runEntrypoint(ModuleInstance, UpgradeScripts)
