import { Types } from '@iobroker/type-detector'
import { StateInfo } from '../types.js'
import { getNumByName } from '../utils.js'
import { combineRgb } from '@companion-module/base'

export const getColorDeviceAgnostic = (deviceId: string, type: Types, stateValues: StateInfo[]): number | null => {
	if (type === Types.rgb) {
		const red = getNumByName(stateValues, 'RED')
		const green = getNumByName(stateValues, 'GREEN')
		const blue = getNumByName(stateValues, 'BLUE')

		if (!red || !green || !blue) return null

		return combineRgb(red, green, blue)
	}

	if (type === Types.hue) {
		return null
	}

	console.log(`Could not handle type=${type} for device ${deviceId}. This is very likely missing functionality.`)
	return null
}
