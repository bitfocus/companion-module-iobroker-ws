import { CompanionInputFieldDropdown, DropdownChoice } from '@companion-module/base/dist/index.js'

function EntityOptions(iobObjects: ioBroker.Object[], prefix: string | undefined): DropdownChoice[] {
	const entities = iobObjects.filter((ent) => prefix === undefined || ent._id.indexOf(`${prefix}.`) === 0)

	return entities
		.map((ent) => ({
			id: ent._id,
			label: `${ent.common.name} (${ent._id})`,
		}))
		.sort((a, b) => {
			const a2 = a.label.toLowerCase()
			const b2 = b.label.toLowerCase()
			return a2 === b2 ? 0 : a2 < b2 ? -1 : 1
		})
}

export function EntityPicker(iobObjects: ioBroker.Object[], prefix: string | undefined): CompanionInputFieldDropdown {
	const choices = EntityOptions(iobObjects, prefix)

	return {
		type: 'dropdown',
		label: 'Entity',
		id: 'entity_id',
		default: choices[0]?.id ?? '',
		choices: choices,
	}
}
