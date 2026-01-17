import { CompanionFeedbackDefinitions } from '@companion-module/base'

// import { getColorDeviceAgnostic } from './type-handlers/color-handler.js'
import { IDeviceHandler, IFeedbackConfiguration, ILogger } from './types.js'
import { injectable, inject, injectAll } from 'tsyringe'
import { DiTokens } from './dependency-injection/tokens.js'

@injectable({ token: DiTokens.ActionConfiguration })
export class FeedbackConfiguration implements IFeedbackConfiguration {
	constructor(
		@inject(DiTokens.Logger) private readonly _logger: ILogger,
		@injectAll(DiTokens.DeviceHandler) private readonly deviceHandlers: IDeviceHandler[],
	) {}

	updateFeedbacks(cb: (feedbacks: CompanionFeedbackDefinitions) => void): void {
		const startMs = Date.now()
		this._logger.logDebug(
			`Starting to gather definitions from ${this.deviceHandlers.length} device handlers: [${this.deviceHandlers.map((dh) => dh.getName()).join(', ')}]`,
		)

		const handlerResults = this.deviceHandlers.map((dh) => dh.getFeedbackDefinitions())
		const handlerResultCount = handlerResults.reduce((prev, curr) => prev + Object.keys(curr).length, 0)

		const mergedConfiguration = handlerResults.reduce((prev, curr) => ({ ...prev, ...curr }), {})
		const mergedCount = Object.keys(mergedConfiguration).length

		this._logger.logInfo(
			`Discovered ${handlerResultCount} (after merge: ${mergedCount}) definitions across ${this.deviceHandlers.length} handlers in ${Date.now() - startMs}ms`,
		)

		if (handlerResultCount !== mergedCount) {
			this._logger.logWarning(
				`Expectation not met: The number of definition should not change after merging. This indicates definition keys are reused between handlers and is a programming error.`,
			)
		}

		cb(mergedConfiguration)
	}
}

/*
export function UpdateFeedbacks(
	self: ModuleInstance,
	iobObjects: ioBroker.Object[],
	getDeviceClassifier: () => DeviceClassifier,
	getState: () => Map<string, ioBroker.State>,
): void {
	const typeByChannel = getDeviceClassifier().getTypesByChannel()

	const lightIds = Object.entries(typeByChannel).filter(([_, t]) => LightTypes.has(t))
	const lightOptions: DropdownChoice[] = lightIds.map(([id, _]) => ({ id: id, label: id }))

	const checkEntityOnOffState = (feedback: CompanionFeedbackBooleanEvent): boolean => {
		const state = getState()
		const entity = state.get(String(feedback.options.entity_id))
		if (entity) {
			const isOn = entity.val === true
			const targetOn = !!feedback.options.state
			return isOn === targetOn
		}
		return false
	}

	const retrieveCurrentValue = (feedback: CompanionFeedbackValueEvent): JsonValue => {
		const state = getState()
		const entity = state.get(String(feedback.options.entity_id))

		return entity ? entity.val : null
	}

	const retrieveLastChangeTimestamp = (feedback: CompanionFeedbackValueEvent): JsonValue => {
		const state = getState()
		const entity = state.get(String(feedback.options.entity_id))

		return typeof entity?.ts === 'number' ? entity.ts : null
	}

	const retrieveColorValue = (feedback: CompanionFeedbackValueEvent): JsonValue => {
		const deviceId = String(feedback.options.channel_id)

		const state = getState()
		const classifier = getDeviceClassifier()

		const typeOfDevice = classifier.getTypeByDevice(deviceId)
		const statesOfDevice = classifier.getStatesByDevice(deviceId)

		if (!typeOfDevice || statesOfDevice.length === 0) {
			return null
		}

		const stateValues: StateInfo[] = statesOfDevice
			.map((stateDef) => ({ definition: stateDef, value: state.get(stateDef.id) }))
			.filter((tuple) => tuple.value !== undefined)
			.map((tuple) => ({ ...tuple, value: tuple.value! }))

		return stateValues.length
		// return getColorDeviceAgnostic(deviceId, typeOfDevice, stateValues)
	}

	self.setFeedbackDefinitions({
		ChannelState: {
			type: 'boolean',
			name: 'Change from switch state',
			description: 'If the switch state matches the rule, change style of the bank',
			options: [EntityPicker(iobObjects, undefined)],
			defaultStyle: {
				color: combineRgb(0, 0, 0),
				bgcolor: combineRgb(0, 0, 0),
			},
			callback: entitySubscriptions.makeFeedbackCallback(checkEntityOnOffState),
		},
		ReadValueLocal: {
			type: 'value',
			name: 'Populate ioBroker state',
			description: 'Sync a state value from ioBroker',
			options: [EntityPicker(iobObjects, undefined)],
			callback: entitySubscriptions.makeFeedbackCallback(retrieveCurrentValue),
		},
		[FeedbackId.ReadLastUpdated]: {
			type: 'value',
			name: 'Populate timestamp of last ioBroker state change',
			description: 'Sync the timestamp of the last state change from ioBroker',
			options: [EntityPicker(iobObjects, undefined)],
			callback: entitySubscriptions.makeFeedbackCallback(retrieveLastChangeTimestamp),
		},
		ReadColorOfLight: {
			type: 'value',
			name: 'Read color of light',
			description: 'Sync the color of a light',
			options: [
				{
					type: 'dropdown',
					id: 'channel_id',
					label: 'Channel',
					default: lightOptions[0].id ?? '',
					choices: lightOptions,
				},
			],
			callback: entitySubscriptions.makeDeviceFeedbackCallback(retrieveColorValue),
		},
	})
}
*/
