import { InstanceBase, LogLevel } from '@companion-module/base'
import type { ModuleConfig } from '../config.js'
import { ILogger } from '../types.js'
import { inject, injectable } from 'tsyringe'
import { DiTokens } from '../dependency-injection/tokens.js'

@injectable()
export class CompanionLogger implements ILogger {
	private traceEnabled: boolean = false

	constructor(
		@inject(DiTokens.Module) private readonly _module: InstanceBase<ModuleConfig>,
		@inject(DiTokens.ModuleConfigurationAccessor) private readonly _configAccessor: () => ModuleConfig,
	) {
		this.traceEnabled = _configAccessor().traceLogs
	}

	public configUpdated(): void {
		this.traceEnabled = this._configAccessor().traceLogs
	}

	public log(level: LogLevel, message: string): void {
		this._module.log(level, message)
	}

	logTrace = (message: string): void => {
		if (!this.traceEnabled) {
			return
		}

		this.log('debug', `[TRACE] ${message}`)
	}
	logDebug = (message: string): void => this.log('debug', message)
	logInfo = (message: string): void => this.log('info', message)
	logWarning = (message: string): void => this.log('warn', message)
	logError = (message: string): void => this.log('error', message)
}
