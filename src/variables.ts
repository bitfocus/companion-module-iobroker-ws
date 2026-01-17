import type { ModuleInstance } from './main.js'

export function UpdateVariableDefinitions(self: ModuleInstance): void {
	// TODO: Populate variable value.
	self.setVariableDefinitions([
		{ variableId: 'connected', name: 'Indicates if a connection to ioBroker could be established' },
	])
}
