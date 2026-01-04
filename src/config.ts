import { Regex, type SomeCompanionConfigField } from '@companion-module/base'

export interface ModuleConfig {
	protocol: 'ws:' | 'wss:'
	host: string
	port: number
}

export function GetConfigFields(): SomeCompanionConfigField[] {
	return [
		{
			type: 'dropdown',
			id: 'protocol',
			label: 'Protocol',
			width: 8,
			choices: [
				{ id: 'ws', label: 'ws' },
				{ id: 'wss', label: 'WSS' },
			],
			default: 'wss',
		},
		{
			type: 'textinput',
			id: 'host',
			label: 'Host',
			width: 8,
			regex: Regex.HOSTNAME,
		},
		{
			type: 'number',
			id: 'port',
			label: 'Port',
			width: 4,
			min: 1,
			max: 65535,
			default: 8444,
		},
	]
}
