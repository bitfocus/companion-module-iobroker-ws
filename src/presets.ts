import type { ModuleInstance } from './main.js'
import { CompanionPresetDefinitions } from '@companion-module/base'

/**
 * Populates the module's presets.
 * @param self - A reference to the module instance
 */
export function UpdatePresets(self: ModuleInstance): void {
	const presets: CompanionPresetDefinitions = {}

	// Seems presets cannot store local variables currently.
	// This makes basically _everything_ a lot harder and is really unfortunate.
	// There is a github issue already:
	// https://github.com/bitfocus/companion/issues/3893
	self.setPresetDefinitions(presets)
}
