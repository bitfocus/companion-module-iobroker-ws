import ChannelDetector, { DetectOptions, DetectorState, Types } from '@iobroker/type-detector'
import { inject, injectable } from 'tsyringe'
import { DiTokens } from './dependency-injection/tokens.js'
import { IEntityState, ILogger } from './types.js'

const reuseCacheForMs: number = 2 * 60 * 1000 // 2 Minutes

@injectable()
export class DeviceClassifier {
	private lastCalculationTimestamp: number | null = null
	private typeByDevice: Record<string, Types> | null = null
	private statesByDevice: Record<string, DetectorState[]> | null = null

	constructor(
		@inject(DiTokens.Logger) private readonly _logger: ILogger,
		@inject(DiTokens.State) private readonly _entityState: IEntityState,
	) {}

	public getTypesByChannel(): Record<string, Types> {
		return this.categorizeChannelsCached().typeByDevice
	}

	public getTypeByDevice(deviceId: string): Types | null {
		const typesByChannel = this.getTypesByChannel()
		return Object.hasOwnProperty.call(typesByChannel, deviceId) ? typesByChannel[deviceId] : null
	}

	public getStatesByDevice(deviceId: string): DetectorState[] {
		const statesByDevice = this.categorizeChannelsCached().statesByDevice
		return Object.hasOwnProperty.call(statesByDevice, deviceId) ? statesByDevice[deviceId] : []
	}

	public clear(): void {
		this.lastCalculationTimestamp = null
		this.typeByDevice = null
		this.statesByDevice = null
	}

	private categorizeChannelsCached(): {
		typeByDevice: Record<string, Types>
		statesByDevice: Record<string, DetectorState[]>
	} {
		if (
			this.lastCalculationTimestamp &&
			Date.now() < this.lastCalculationTimestamp + reuseCacheForMs &&
			this.typeByDevice &&
			this.statesByDevice
		) {
			// this._logger.logTrace(
			// 	`Cache hit when getting device type categorization. Will reevaluate at ${new Date(this.lastCalculationTimestamp + reuseCacheForMs)}.`,
			// )
			return { typeByDevice: this.typeByDevice, statesByDevice: this.statesByDevice }
		}

		if (this.lastCalculationTimestamp) {
			const expiredAt = new Date(this.lastCalculationTimestamp + reuseCacheForMs)
			this._logger.logDebug(`Cache expired at ${expiredAt}. Recalculating device type classification.`)
		}

		const iobObjects = this._entityState.getObjects()
		const startMs = Date.now()
		this._logger.logDebug(`Received ${iobObjects.length} ioBroker objects to classify.`)

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

		this._logger.logInfo(
			`Classified ${iobObjects.length} objects into ${Object.keys(typeByDevice).length} devices in ${Date.now() - startMs}ms`,
		)
		this.lastCalculationTimestamp = Date.now()
		this.typeByDevice = typeByDevice
		this.statesByDevice = statesByDevice

		return {
			typeByDevice,
			statesByDevice,
		}
	}
}
