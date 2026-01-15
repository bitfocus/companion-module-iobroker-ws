import ChannelDetector, { DetectOptions, DetectorState, Types } from '@iobroker/type-detector'

export class DeviceClassifier {
	private readonly typeByDevice: Record<string, Types>
	private readonly statesByDevice: Record<string, DetectorState[]>

	constructor(iobObjects: ioBroker.Object[]) {
		const { typeByDevice, statesByDevice } = this.categorizeChannels(iobObjects)

		this.typeByDevice = typeByDevice
		this.statesByDevice = statesByDevice
	}

	public getTypesByChannel(): Record<string, Types> {
		return this.typeByDevice
	}

	public getTypeByDevice(deviceId: string): Types | null {
		return Object.hasOwnProperty.call(this.typeByDevice, deviceId) ? this.typeByDevice[deviceId] : null
	}

	public getStatesByDevice(deviceId: string): DetectorState[] {
		return Object.hasOwnProperty.call(this.statesByDevice, deviceId) ? this.statesByDevice[deviceId] : []
	}

	private categorizeChannels(iobObjects: ioBroker.Object[]): {
		typeByDevice: Record<string, Types>
		statesByDevice: Record<string, DetectorState[]>
	} {
		const detector = new ChannelDetector.default()
		const objectLookup: Record<string, ioBroker.Object> = iobObjects.reduce(
			(prev, curr) => ({ ...prev, [curr._id]: curr }),
			{},
		)

		const baseOptions: DetectOptions = {
			objects: objectLookup,
			id: '%%%TEMPLATE_VALUE%%%',
			detectOnlyChannel: true,
		}
		const replacementRegex = new RegExp('\\.([^.]*)$')
		const channelIds = [...new Set(iobObjects.map((o) => o._id).map((id) => id.replace(replacementRegex, '')))]

		const typeByDevice: Record<string, Types> = {}
		const statesByDevice: Record<string, DetectorState[]> = {}

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

			typeByDevice[channelId] = detectionResult[0].type
			statesByDevice[channelId] = detectionResult[0].states

			usedIds = usedIds.concat(detectionResult[0].states.map((s) => s.id))
		}

		return {
			typeByDevice,
			statesByDevice,
		}
	}
}
