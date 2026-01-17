import { injectable, registry } from 'tsyringe'
import { DiTokens } from '../dependency-injection/tokens.js'
import { GenericHandler } from './generic-handler.js'
import { LightHandler } from './light-handler.js'

@injectable()
@registry([
	{ token: DiTokens.DeviceHandler, useClass: GenericHandler },
	{ token: DiTokens.DeviceHandler, useClass: LightHandler },
])
export class DeviceHandlerRegistry {}
