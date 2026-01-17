import { ILogger, IMutableState } from '../types.js'
import { inject, injectable } from 'tsyringe'
import { DiTokens } from '../dependency-injection/tokens.js'

@injectable()
export class IoBrokerState implements IMutableState {
	private stateById: Map<string, ioBroker.State> = new Map<string, ioBroker.State>()
	private objectDetails: ioBroker.Object[] = []

	constructor(@inject(DiTokens.Logger) private readonly _logger: ILogger) {
		this._logger.logTrace('Initialized ioBroker state.')
	}

	public getObjects(): ioBroker.Object[] {
		return this.objectDetails
	}

	public getStates(): Map<string, ioBroker.State> {
		return this.stateById
	}

	public setObjects(objectDetails: ioBroker.Object[]): void {
		this.objectDetails = objectDetails
	}

	public setStates(states: Map<string, ioBroker.State>): void {
		this.stateById = states
	}

	public clear(): void {
		this.objectDetails = []
		this.stateById = new Map<string, ioBroker.State>()
	}
}
