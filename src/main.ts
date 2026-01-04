import { InstanceBase, InstanceStatus, runEntrypoint, SomeCompanionConfigField } from '@companion-module/base'
import { GetConfigFields, type ModuleConfig } from './config.js'
import { UpdateVariableDefinitions } from './variables.js'
import { UpgradeScripts } from './upgrades.js'
import { UpdateActions } from './actions.js'
import { UpdateFeedbacks } from './feedbacks.js'
import { UpdatePresets } from './presets.js'

import { Connection } from '@iobroker/socket-client-backend'
import { EntitySubscriptions } from './state.js'

import '@iobroker/types'

function isValidIobObject(obj?: ioBroker.Object | null | undefined): obj is ioBroker.Object {
	return obj !== null && obj !== undefined
}

export class ModuleInstance extends InstanceBase<ModuleConfig> {
	config!: ModuleConfig // Setup in init()

	private state: Map<string, ioBroker.State> = new Map<string, ioBroker.State>()
	private entitySubscriptions = new EntitySubscriptions()

	constructor(internal: unknown) {
		super(internal)
	}

	async init(config: ModuleConfig): Promise<void> {
		this.config = config

		console.log(`Trying to connect to ${config.protocol}://${config.host}:${config.port} ...`)

		this.updateStatus(InstanceStatus.Connecting)

		var iobConnection = new Connection({
			protocol: config.protocol,
			host: config.host,
			port: config.port,
			doNotLoadAllObjects: true,
			doNotLoadACL: true,
			onLog: (_) => null,
		})

		try {
			await iobConnection.startSocket()
			await iobConnection.waitForFirstConnection()

			// (id: string, obj: State | null | undefined) => void | Promise<void>;
			await iobConnection.subscribeState(
				'alias.0.Triggers.ContactSensors.Bathroom',
				false,
				(id: string, obj: ioBroker.State | null | undefined) => {
					this.log('debug', `Received event for id ${id} -> Value: ${obj?.val ?? 'N/A'}`)
					if (!obj) {
						return
					}

					this.state.set(id, obj)

					const feedbackIds = this.entitySubscriptions.getFeedbackInstanceIds(id)
					console.log('Feedback ids:', feedbackIds)

					this.checkFeedbacksById(...feedbackIds)
				},
			)
		} catch (err) {
			this.updateStatus(InstanceStatus.Disconnected)

			console.error('Could not connect to provided ioBroker instance:')
			console.log(err)

			return
		}

		this.updateStatus(InstanceStatus.Ok)

		const startMs = Date.now()
		const states = await iobConnection.getStates('alias.*')
		const stateInfo = await Promise.all(Object.keys(states).map((stateId) => iobConnection.getObject(stateId)))

		const validStateInfos = stateInfo.filter(isValidIobObject)

		this.log(
			'debug',
			`Retrieved ${validStateInfos.length} (${Object.keys(states).length}) states in ${Date.now() - startMs}ms.`,
		)

		console.log(JSON.stringify(stateInfo[0], undefined, 2))

		if (!!validStateInfos) {
			this.updateActions() // export actions
			this.updateFeedbacks(validStateInfos) // export feedbacks
		}

		this.updatePresets() // export Presets
		this.updateVariableDefinitions() // export variable definitions
	}
	// When module gets deleted
	async destroy(): Promise<void> {
		this.log('debug', 'destroy')
	}

	async configUpdated(config: ModuleConfig): Promise<void> {
		this.config = config
	}

	// Return config fields for web config
	getConfigFields(): SomeCompanionConfigField[] {
		return GetConfigFields()
	}

	updateActions(): void {
		UpdateActions(this)
	}

	updateFeedbacks(iobObjects: ioBroker.Object[]): void {
		UpdateFeedbacks(this, iobObjects, () => this.state, this.entitySubscriptions)
	}

	updatePresets(): void {
		UpdatePresets(this)
	}

	updateVariableDefinitions(): void {
		UpdateVariableDefinitions(this)
	}
}

runEntrypoint(ModuleInstance, UpgradeScripts)
