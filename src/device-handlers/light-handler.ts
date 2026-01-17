import { CompanionActionDefinitions, CompanionFeedbackDefinitions } from '@companion-module/base'
import { Types } from '@iobroker/type-detector'
import { IDeviceHandler } from '../types.js'
import { injectable } from 'tsyringe'

@injectable()
export class LightHandler implements IDeviceHandler {
	getName(): string {
		return 'LightHandler'
	}

	getHandledTypes(): Types[] {
		return [Types.rgb]
	}
	getActionDefinitions(): CompanionActionDefinitions {
		return {}
	}
	getFeedbackDefinitions(): CompanionFeedbackDefinitions {
		return {}
	}
}

// public async setColor(deviceId: string, companionColor: number): Promise<void> {
// 	this._logger.logDebug(`Setting color to ${companionColor} for ${deviceId}.`)
//
// 	if (!this._deviceClassifier) {
// 	return
// }
//
// const state = this._mutableState.getStates()
// const typeOfDevice = this._deviceClassifier.getTypeByDevice(deviceId)
// const statesOfDevice = this._deviceClassifier.getStatesByDevice(deviceId)
//
// if (!typeOfDevice || statesOfDevice.length === 0) {
// 	return
// }
//
// const stateValues: StateInfo[] = statesOfDevice
// 	.map((stateDef) => ({ definition: stateDef, value: state.get(stateDef.id) }))
// 	.filter((tuple) => tuple.value !== undefined)
// 	.map((tuple) => ({ ...tuple, value: tuple.value! }))
//
// return setColorDeviceAgnostic(this, deviceId, typeOfDevice, stateValues, companionColor)
// }
