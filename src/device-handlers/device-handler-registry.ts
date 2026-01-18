import { injectable, registry } from 'tsyringe'
import { DiTokens } from '../dependency-injection/tokens.js'
import { GenericHandler } from './generic-handler.js'

@injectable()
@registry([
	{ token: DiTokens.DeviceHandler, useClass: GenericHandler },

	// The light handler is work in progress that is not fully implemented.
	// I do not want to delete the code and later dig through the git history to find it again.

	/* { token: DiTokens.DeviceHandler, useClass: LightHandler }, */
])
export class DeviceHandlerRegistry {}
