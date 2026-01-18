import { IDeviceHandler, IEntityState, IioBrokerClient, ILogger, ISubscriptionManager } from '../types.js'
import { Types } from '@iobroker/type-detector'
import {
	combineRgb,
	CompanionActionDefinitions,
	CompanionActionEvent,
	CompanionFeedbackBooleanEvent,
	CompanionFeedbackDefinitions,
	CompanionFeedbackValueEvent,
	InputValue,
	JsonPrimitive,
	JsonValue,
} from '@companion-module/base'
import { inject, injectable } from 'tsyringe'
import { DiTokens } from '../dependency-injection/tokens.js'
import { EntityPicker, ToggleStatePicker } from '../choices.js'
import { FeedbackType } from '../feedback-type.js'
import { ActionType } from '../action-type.js'
import { isValue, raiseActionError } from '../utils.js'

const isWriteable = (o: ioBroker.Object): boolean => {
	return !!o.common.write
}

const isBooleanW = (o: ioBroker.Object): boolean => {
	return isWriteable(o) && o.common.type === 'boolean'
}

const isNumberW = (o: ioBroker.Object): boolean => {
	return isWriteable(o) && o.common.type === 'number'
}

const isStringW = (o: ioBroker.Object): boolean => {
	return isWriteable(o) && o.common.type === 'string'
}

const isButtonW = (o: ioBroker.Object): boolean => {
	return isWriteable(o) && o.common.type === 'boolean' && o.common.role === 'button'
}

const parseOrThrow = <TVt extends JsonPrimitive>(
	event: CompanionActionEvent,
	entityVar: InputValue | undefined,
	valueVar: InputValue | undefined,
	expectType: string,
	parseCb: (v: InputValue) => TVt,
): TVt | never => {
	const tryParse = (v: InputValue): TVt => {
		let parsed: TVt

		try {
			parsed = parseCb(v)
		} catch {
			raiseActionError(event, `Could not parse provided value '${v}' as ${expectType}. Please check your input.`)
		}

		if (typeof parsed !== expectType) {
			raiseActionError(event, `Could not parse provided value '${v}' as ${expectType}. Please check your input.`)
		}

		return parsed
	}

	if (!!entityVar && isValue<InputValue>(valueVar)) {
		return tryParse(valueVar)
	}

	if (!entityVar) {
		raiseActionError(
			event,
			`Invalid configuration. Entity must be provided for ${expectType} value type but was: '${entityVar}'.`,
		)
	}

	raiseActionError(
		event,
		`Invalid configuration. Value must be provided for ${expectType} value type but was: '${valueVar}'.`,
	)
}

@injectable()
export class GenericHandler implements IDeviceHandler {
	/**
	 * Initializes a new instance of {@link GenericHandler}
	 * @param _logger - A logger
	 * @param _entityState - The local (cached) ioBroker state (read-only)
	 * @param _subscriptionManager - The subscription manager used to construct feedback callbacks
	 * @param _iobClient - An ioBroker websocket client to interact with the backend
	 */
	constructor(
		@inject(DiTokens.Logger) private readonly _logger: ILogger,
		@inject(DiTokens.State) private readonly _entityState: IEntityState,
		@inject(DiTokens.SubscriptionManager) private readonly _subscriptionManager: ISubscriptionManager,
		@inject(DiTokens.IoBrokerClient) private readonly _iobClient: IioBrokerClient,
	) {}

	/** {@inheritDoc IDeviceHandler.getName} */
	getName(): string {
		return 'GenericHandler'
	}

	/** {@inheritDoc IDeviceHandler.getHandledTypes} */
	getHandledTypes(): Types[] {
		return [Types.unknown]
	}

	/** {@inheritDoc IDeviceHandler.getActionDefinitions} */
	public getActionDefinitions(): CompanionActionDefinitions {
		const iobObjects = this._entityState.getObjects()

		return {
			[ActionType.Toggle]: {
				name: 'Toggle State',
				options: [ToggleStatePicker(iobObjects, undefined)],
				callback: async (event) => {
					void this._iobClient.toggleState(String(event.options.entity_id))
				},
			},
			[ActionType.PressButton]: {
				name: 'Press Button',
				options: [EntityPicker(iobObjects, undefined, undefined, undefined, isButtonW)],
				callback: this.actPressButton.bind(this),
			},
			[ActionType.SetValue]: {
				name: 'Set Value',
				options: [
					{
						id: 'value_type',
						type: 'dropdown',
						label: 'Value Type',
						default: 'string',
						choices: [
							{
								id: 'string',
								label: 'String',
							},
							{
								id: 'number',
								label: 'Number',
							},
							{
								id: 'boolean',
								label: 'Boolean',
							},
						],
					},
					EntityPicker(iobObjects, undefined, 'string_entity_id', `$(options:value_type) == 'string'`, isStringW),
					{
						id: 'string_value',
						type: 'textinput',
						label: 'Value',
						useVariables: true,
						multiline: true,
						isVisibleExpression: `$(options:value_type) == 'string'`,
					},
					EntityPicker(iobObjects, undefined, 'number_entity_id', `$(options:value_type) == 'number'`, isNumberW),
					{
						// We're purposefully not using type=number here, because it forces us to
						// define min+max which does not make sense for ioBroker number states.
						id: 'number_value',
						type: 'textinput',
						label: 'Value',
						regex: '^\\d+$',
						isVisibleExpression: `$(options:value_type) == 'number'`,
					},
					EntityPicker(iobObjects, undefined, 'bool_entity_id', `$(options:value_type) == 'boolean'`, isBooleanW),
					{
						id: 'bool_value',
						type: 'dropdown',
						label: 'Value',
						choices: [
							{
								id: 'true',
								label: 'true',
							},
							{
								id: 'false',
								label: 'false',
							},
						],
						default: 'true',
						isVisibleExpression: `$(options:value_type) == 'boolean'`,
					},
				],
				callback: this.actSetValue.bind(this),
			},
			[ActionType.Increment]: {
				name: 'Increment/Decrement Value',
				options: [
					EntityPicker(iobObjects, undefined, undefined, undefined, isNumberW),
					{
						id: 'increment_decrement',
						label: 'Value Change',
						type: 'textinput',
						useVariables: true,
					},
				],
				callback: this.actIncrementDecrementValue.bind(this),
			},
			[ActionType.SendMessage]: {
				name: 'Send Message to Adapter',
				options: [
					{
						id: 'adapter_instance',
						type: 'textinput',
						label: 'Instance',
						description: 'Choose the adapter instance to send to, for example matter.0',
					},
					{
						id: 'command',
						type: 'textinput',
						label: 'Command',
						description: 'The command to send',
					},
					{
						type: 'checkbox',
						label: 'Include Data',
						id: 'include_data',
						default: false,
					},
					{
						type: 'static-text',
						label: 'Payload Configuration',
						value: 'Below you can configure the payload to be send along with the message',
						id: 'data-description',
						isVisibleExpression: '$(options:include_data)',
					},
					{
						type: 'textinput',
						label: 'Data',
						id: 'data',
						default: '{}',
						useVariables: true,
						multiline: true,
						isVisibleExpression: '$(options:include_data)',
					},
					{
						type: 'checkbox',
						label: 'Parse Data as JSON',
						id: 'parse_as_json',
						default: true,
						isVisibleExpression: '$(options:include_data)',
					},
				],
				callback: this.actSendMessageToAdapter.bind(this),
			},
		}
	}

	private async actPressButton(event: CompanionActionEvent): Promise<void> {
		const { entity_id } = event.options
		this._logger.logTrace(`Pressing button of entity '${entity_id}'.`)
		await this._iobClient.setState(String(entity_id), true, 'boolean')
	}

	private async actSetValue(event: CompanionActionEvent): Promise<void> {
		const { value_type, string_entity_id, string_value, number_entity_id, number_value, bool_entity_id, bool_value } =
			event.options

		let value: JsonPrimitive | null = null
		let entityId: string = ''
		let actualType: ioBroker.CommonType | null = null

		if (value_type === 'string') {
			value = parseOrThrow(event, string_entity_id, string_value, 'string', (v) => String(v))
			entityId = String(string_entity_id)
			actualType = 'string'
		} else if (value_type === 'number') {
			value = parseOrThrow(event, number_entity_id, number_value, 'number', (v) => Number.parseFloat(String(v)))

			if (isNaN(value)) {
				raiseActionError(event, `Could not parse provided value '${number_value}' as number. Please check your input.`)
			}

			entityId = String(number_entity_id)
			actualType = 'number'
		} else if (value_type === 'boolean') {
			value = parseOrThrow(event, bool_entity_id, bool_value, 'boolean', (v) => JSON.parse(String(v)))
			entityId = String(bool_entity_id)
			actualType = 'boolean'
		} else {
			raiseActionError(event, `Unsupported value type '${value_type}' provided.`)
		}

		this._logger.logTrace(`Setting value of entity '${entityId}' to '${value}'.`)
		await this._iobClient.setState(entityId, value, actualType)
	}

	private async actIncrementDecrementValue(event: CompanionActionEvent): Promise<void> {
		const { entity_id, increment_decrement } = event.options

		const valueChange = parseOrThrow(event, entity_id, increment_decrement, 'number', (v) =>
			Number.parseFloat(String(v)),
		)

		if (isNaN(valueChange)) {
			raiseActionError(
				event,
				`Could not parse provided value '${increment_decrement}' as number. Please check your input.`,
			)
		}

		const currentValue = await this._iobClient.getState(String(entity_id), 'number')

		if (!currentValue) {
			raiseActionError(
				event,
				`Could not retrieve current value of entity '${entity_id}' for increment/decrement operation or object has invalid state (type not number).`,
			)
		}

		const newValue = (currentValue.val as number) + valueChange

		this._logger.logTrace(
			`Changing value of entity '${entity_id}' from '${currentValue.val}' by '${valueChange}' to '${newValue}'.`,
		)

		// No need to pass the type expectation here, we already checked it above.
		await this._iobClient.setState(String(entity_id), newValue)
	}

	private async actSendMessageToAdapter(event: CompanionActionEvent): Promise<void> {
		const { adapter_instance, command, data, include_data, parse_as_json } = event.options
		if (!adapter_instance || !command) {
			return
		}

		if (!include_data) {
			void this._iobClient.sendMessage(String(adapter_instance), String(command))
			return
		}

		let dataParsed = data
		if (parse_as_json && typeof data === 'string') {
			try {
				dataParsed = JSON.parse(data)
			} catch (err) {
				raiseActionError(
					event,
					`Could not parse provided payload '${data}' as json. Please check your input.`,
					err as Error,
				)
			}
		}

		void this._iobClient.sendMessage(String(adapter_instance), String(command), dataParsed)
	}

	/** {@inheritDoc IDeviceHandler.getFeedbackDefinitions} */
	public getFeedbackDefinitions(): CompanionFeedbackDefinitions {
		const iobObjects = this._entityState.getObjects()

		return {
			[FeedbackType.ChannelState]: {
				type: 'boolean',
				name: 'Change from switch state',
				description: 'If the switch state matches the rule, change style of the bank',
				options: [EntityPicker(iobObjects, undefined)],
				defaultStyle: {
					color: combineRgb(0, 0, 0),
					bgcolor: combineRgb(255, 0, 0),
				},
				callback: this._subscriptionManager.makeFeedbackCallback(this.fbCheckEntityOnOffState.bind(this)),
			},
			[FeedbackType.ReadValueLocal]: {
				type: 'value',
				name: 'Populate ioBroker state',
				description: 'Sync a state value from ioBroker',
				options: [EntityPicker(iobObjects, undefined)],
				callback: this._subscriptionManager.makeFeedbackCallback(this.fbRetrieveCurrentValue.bind(this)),
			},
			[FeedbackType.ReadLastUpdated]: {
				type: 'value',
				name: 'Populate timestamp of last ioBroker state change',
				description: 'Sync the timestamp of the last state change from ioBroker',
				options: [EntityPicker(iobObjects, undefined)],
				callback: this._subscriptionManager.makeFeedbackCallback(this.fbRetrieveLastChangeTimestamp.bind(this)),
			},
		}
	}

	private fbCheckEntityOnOffState(feedback: CompanionFeedbackBooleanEvent): boolean {
		const state = this._entityState.getStates()
		const entity = state.get(String(feedback.options.entity_id))

		if (!entity) {
			return false
		}

		const isOn = entity.val === true
		const targetOn = !!feedback.options.state
		return isOn === targetOn
	}

	private fbRetrieveCurrentValue(feedback: CompanionFeedbackValueEvent): JsonValue {
		const state = this._entityState.getStates()
		const entity = state.get(String(feedback.options.entity_id))

		return entity ? entity.val : null
	}

	private fbRetrieveLastChangeTimestamp(feedback: CompanionFeedbackValueEvent): JsonValue {
		const state = this._entityState.getStates()
		const entity = state.get(String(feedback.options.entity_id))

		return typeof entity?.ts === 'number' ? entity.ts : null
	}
}
