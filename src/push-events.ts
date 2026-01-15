export interface IobPushApi {
	toggleState: (iobId: string) => Promise<void>

	sendMessage: (instance: string, command: string, data?: unknown) => Promise<void>

	setColor: (iobId: string, companionColor: number) => Promise<void>

	getObject: (iobId: string) => Promise<ioBroker.Object | null>

	setState: (iobId: string, val: ioBroker.StateValue) => Promise<void>
}
