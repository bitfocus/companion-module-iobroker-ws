import { Regex, type SomeCompanionConfigField } from '@companion-module/base'

export interface ModuleConfig {
	protocol: 'ws:' | 'wss:'
	host: string
	port: number
	additionalNamespaces: string
	loadAllAliases: boolean
	developmentMode: boolean
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
		{
			type: 'checkbox',
			id: 'loadAllAliases',
			label: 'Load all Aliases',
			width: 4,
			default: true,
		},
		{
			type: 'textinput',
			id: 'additionalNamespaces',
			label: 'Additional Namespace (CSV)',
			width: 8,
			regex: '^[\\w\\d][\\w\\d\\.]+[\\w\\d]$',
		},
		{
			type: 'checkbox',
			id: 'developmentMode',
			label: 'Enable Development Mode',
			width: 4,
			default: false,
		},
	]
}
