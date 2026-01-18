import { IDeviceHandler, IEntityState, IioBrokerClient, ISubscriptionManager } from '../types.js'
import { Types } from '@iobroker/type-detector'
import {
	CompanionActionDefinitions,
	CompanionActionEvent,
	CompanionFeedbackBooleanEvent,
	CompanionFeedbackDefinitions,
	CompanionFeedbackValueEvent,
	JsonValue,
} from '@companion-module/base'
import { inject, injectable } from 'tsyringe'
import { DiTokens } from '../dependency-injection/tokens.js'
import { EntityPicker, ToggleStatePicker } from '../choices.js'
import { FeedbackType } from '../feedback-type.js'
import { combineRgb } from '@companion-module/base'
import { ActionType } from '../action-type.js'

@injectable()
export class GenericHandler implements IDeviceHandler {
	/**
	 * Initializes a new instance of {@link GenericHandler}
	 * @param _entityState - The local (cached) ioBroker state (read-only)
	 * @param _subscriptionManager - The subscription manager used to construct feedback callbacks
	 * @param _iobClient - An ioBroker websocket client to interact with the backend
	 */
	constructor(
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
				throw new Error(
					`[${ActionType.SendMessage}] Could not parse provided payload '${data}' as json. Please check your input.`,
					{ cause: err },
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
