import type { ModuleInstance } from './main.js'
import { ToggleStatePicker } from './choices.js'
import { IobPushApi } from './push-events.js'
import type { CompanionActionInfo } from '@companion-module/base'
import ChannelDetector, { DetectOptions, Types } from '@iobroker/type-detector'

export function UpdateActions(self: ModuleInstance, iobPushApi: IobPushApi, iobObjects: ioBroker.Object[]): void {
	const subscribeEntityPicker = (action: CompanionActionInfo): void => {
		const entityId = String(action.options.entity_id)
		console.log(`Changed action: ${action.actionId} -> ${entityId}`)
	}

	const detector = new ChannelDetector.default()
	const objectLookup: Record<string, ioBroker.Object> = iobObjects.reduce(
		(prev, curr) => ({ ...prev, [curr._id]: curr }),
		{},
	)

	const baseOptions: DetectOptions = {
		objects: objectLookup,
		id: '%%%TEMPLATE_VALUE%%%',
		detectOnlyChannel: true,
		allowedTypes: [
			Types.hue,
			Types.cie,
			Types.window,
			Types.light,
			Types.thermostat,
			Types.humidity,
			Types.temperature,
		],
	}
	const replacementRegex = new RegExp('\\.([^.]*)$')
	const channelIds = [...new Set(iobObjects.map((o) => o._id).map((id) => id.replace(replacementRegex, '')))]

	const result: Record<string, Types> = {}
	let usedIds: string[] = []
	for (const channelId of channelIds) {
		const options = {
			...baseOptions,
			id: channelId,
			usedIds: usedIds,
		}

		const detectionResult = detector.detect(options)
		if (!detectionResult || detectionResult.length === 0) {
			continue
		}

		result[channelId] = detectionResult[0].type
		usedIds = usedIds.concat(detectionResult[0].states.map((s) => s.id))
	}

	self.setActionDefinitions({
		toggle: {
			name: 'Toggle State',
			options: [ToggleStatePicker(iobObjects, undefined)],
			subscribe: subscribeEntityPicker,
			callback: async (event) => {
				void iobPushApi.toggleState(String(event.options.entity_id))
			},
		},
	})
}
