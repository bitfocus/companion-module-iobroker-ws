import type { ModuleInstance } from './main.js'

/**
 * Populates the module's variable definitions.
 * @param self - A reference to the module instance
 */
export function UpdateVariableDefinitions(self: ModuleInstance): void {
	self.setVariableDefinitions([])
}
