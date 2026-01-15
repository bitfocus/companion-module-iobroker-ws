export interface IobPushApi {
	toggleState: (iobId: string) => Promise<void>

	sendMessage: (instance: string, command: string, data?: unknown) => Promise<void>
}
